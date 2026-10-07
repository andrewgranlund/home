const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const gameChecks = require("./game.cjs");
const { validateBanks } = require("./curriculum.cjs");
const enhancementChecks = require("./enhancements.cjs");

const root = path.resolve(__dirname, "..");
const workerSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const version = workerSource.match(/const VERSION = "([^"]+)";/)[1];
const assets = ["index.html", "questions.js", "pwa.js", "manifest.webmanifest",
  "icons/cat-192.png", "icons/cat-512.png", "icons/cat-maskable-512.png"];
const types = { ".html": "text/html", ".js": "text/javascript",
  ".webmanifest": "application/manifest+json", ".png": "image/png" };
const deployments = new Map(["/", "/home/", "/failure/", "/broken-update/", "/missing-data/"]
  .map((scope) => [scope, { version, failIcon: false }]));
const requests = [];
let checks = 0;
function check(condition, label) { assert.ok(condition, label); checks++; }

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  requests.push({ method: req.method, pathname });
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (pathname === "/home") {
    res.writeHead(301, { Location: "/home/" });
    return res.end();
  }
  const scope = [...deployments.keys()].sort((a, b) => b.length - a.length)
    .find((prefix) => pathname.startsWith(prefix));
  const file = pathname.slice(scope.length) || "index.html";
  if (file === "unrelated.txt" || req.method !== "GET") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("Network only");
  }
  if (![...assets, "sw.js"].includes(file)) {
    res.writeHead(404);
    return res.end("Not found");
  }
  const deployment = deployments.get(scope);
  if ((deployment.failIcon && file === "icons/cat-maskable-512.png") || (deployment.failWorker && file === "sw.js")
    || (deployment.failQuestions && file === "questions.js")) {
    res.writeHead(503);
    return res.end("Intentional test failure");
  }
  let content = fs.readFileSync(path.join(root, ...file.split("/")));
  if (file === "sw.js") {
    content = content.toString().replace(`const VERSION = "${version}";`, `const VERSION = "${deployment.version}";`);
  } else if (file === "index.html" && deployment.version !== version) {
    content = content.toString().replace("<body>", `<body data-test-release="${deployment.version}">`);
  }
  res.writeHead(200, { "Content-Type": types[path.extname(file)] });
  res.end(content);
});

async function ready(page) {
  await page.waitForFunction(() => document.querySelector("#offline-status")
    .textContent.startsWith("Offline copy ready"), null, { timeout: 20000 });
  check(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), "Ready requires a controlling worker");
}

async function cacheEntries(page) {
  return page.evaluate(async () => {
    const result = {};
    for (const key of await caches.keys()) {
      result[key] = (await (await caches.open(key)).keys()).map((request) => request.url);
    }
    return result;
  });
}

async function snapshot(page) {
  return page.evaluate(() => ({
    question: document.querySelector("#question").textContent,
    key: document.querySelector("#question").dataset.key,
    curriculum: document.querySelector("#question").dataset.curriculum,
    answers: document.querySelector("#answers").textContent,
    hint: document.querySelector("#hint").hidden,
    play: document.querySelector("#play").hidden,
    rest: document.querySelector("#rest").hidden,
    ticket: document.querySelector("#ticket").hidden
  }));
}

async function pwaChecks(browser, origin) {
  const errors = [];
  const context = await browser.newContext();
  const pages = [];
  for (const scope of ["/", "/home/"]) {
    const page = await context.newPage();
    pages.push(page);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(origin + scope);
    await ready(page);
    check(!(await page.locator("#update-status").textContent()).startsWith("An update is ready"), "First installation is not presented as a waiting update");
    check(await page.evaluate(() => window.isSecureContext), "Localhost is a secure context");
    check(await page.evaluate(() => navigator.serviceWorker.controller.scriptURL) === `${origin}${scope}sw.js`, `${scope} owns its worker`);
    const manifestURL = await page.locator('link[rel="manifest"]').evaluate((node) => node.href);
    const manifest = await (await context.request.get(manifestURL)).json();
    for (const key of ["id", "scope", "start_url"]) {
      check(new URL(manifest[key], manifestURL).href === origin + scope, `${scope} manifest ${key} stays relative`);
    }
    check(manifest.display === "standalone" && manifest.name && manifest.short_name, "Named standalone app");
    check(manifest.icons.length === 3 && manifest.icons.some((icon) => icon.purpose === "maskable"), "Regular and maskable icons");
    for (const icon of manifest.icons) {
      const imageURL = new URL(icon.src, manifestURL).href;
      const response = await context.request.get(imageURL);
      const bytes = await response.body();
      const size = Number(icon.sizes.split("x")[0]);
      check(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "Real PNG signature");
      check(bytes.readUInt32BE(16) === size && bytes.readUInt32BE(20) === size, "PNG dimensions match manifest");
      const decoded = await page.evaluate(async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      }, imageURL);
      check(decoded.every((value) => value === size), "Browser decodes icon");
      if (icon.purpose === "maskable") {
        const safe = await page.evaluate(async (url) => {
          const image = new Image();
          image.src = url;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = image.naturalWidth;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(image, 0, 0);
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let artwork = 0;
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              const i = (y * canvas.width + x) * 4;
              if (data[i + 3] !== 255) return false;
              const differs = data[i] !== data[0] || data[i + 1] !== data[1] || data[i + 2] !== data[2];
              if (differs) {
                artwork++;
                if (Math.hypot(x + 0.5 - canvas.width / 2, y + 0.5 - canvas.height / 2) > canvas.width * 0.4) return false;
              }
            }
          }
          return artwork > 1000;
        }, imageURL);
        check(safe, "Opaque maskable artwork fits completely inside the central 80%-diameter circle");
      }
    }
    const cdp = await context.newCDPSession(page);
    const appManifest = await cdp.send("Page.getAppManifest");
    check(appManifest.errors.length === 0, `Chrome parses manifest: ${JSON.stringify(appManifest.errors)}`);
    const installability = await cdp.send("Page.getInstallabilityErrors");
    // Isolated Playwright contexts are incognito; test full eligibility in a persistent profile below.
    check(installability.installabilityErrors.every((error) => error.errorId === "in-incognito"), `Chrome manifest/install criteria: ${JSON.stringify(installability)}`);
    const allCaches = await cacheEntries(page);
    const entries = allCaches[`cosy-cat-club:${origin}${scope}:${version}`];
    check(entries.length === assets.length, "Only required local assets are precached");
    check(assets.every((asset) => entries.includes(origin + scope + asset)), "Complete precache for scope");
    await page.locator("#grownups summary").click();
    await page.locator("#check-offline").click();
    await page.waitForFunction(() => document.querySelector("#app-action-status").textContent.startsWith("Offline copy ready"));
    check((await page.getByRole("status").allTextContents()).some((text) => text.startsWith("Offline copy ready")), "Explicit status check is announced");
    check(await page.locator("#offline-status").getAttribute("aria-live") === null, "Background setup does not announce over the puzzle");
    await page.locator("#grownups summary").click();
  }

  // Isolation includes unrelated same-origin and another copy of the app.
  const rootPage = pages[0];
  const homePage = pages[1];
  await rootPage.evaluate(async () => { await caches.open("another-app:keep"); });
  for (const [url, options] of [
    [`${origin}/home/unrelated.txt`, {}],
    [`${origin}/home/index.html`, { method: "POST" }],
    [`${origin.replace("127.0.0.1", "localhost")}/home/unrelated.txt`, {}]
  ]) {
    check(await homePage.evaluate(async ({ url, options }) => (await fetch(url, options)).text(), { url, options }) === "Network only", "Unrelated, non-GET and cross-origin requests pass through");
  }
  check((await cacheEntries(homePage))[`cosy-cat-club:${origin}/home/:${version}`].length === assets.length, "No runtime cache pollution");

  await context.setOffline(true);
  for (const [i, scope] of ["/", "/home/"].entries()) {
    const page = pages[i];
    await page.reload();
    await ready(page);
    check(await page.locator("#answers button").count() === 3, `${scope} reloads offline`);
    await page.goto(`${origin}${scope}index.html?offline=1`);
    await ready(page);
    check(await page.locator("#answers button").count() === 3, `${scope} explicit entry navigates offline`);
    await page.locator('[data-topic="math"]').click();
    const before = await snapshot(page);
    await page.locator("#rest-button").click();
    await page.locator("#resume-button").click();
    assert.deepEqual(await snapshot(page), before);
    checks++;
    await solveOfflineAreas(page);
    const noNetwork = await page.evaluate(async () => {
      try { await fetch("./unrelated.txt"); return false; }
      catch { return true; }
    });
    check(noNetwork, "Unrelated route is not served the game offline");
  }
  // Those deliberately failed network requests are expected console errors.
  const unexpected = errors.filter((error) => !error.includes("ERR_INTERNET_DISCONNECTED"));
  check(unexpected.length === 0, `No unexpected browser errors: ${unexpected.join("; ")}`);
  await context.setOffline(false);

  // A waiting update must preserve a question, hint and break across multiple tabs.
  await homePage.locator("#hint-button").click();
  await homePage.locator("#rest-button").click();
  const beforeUpdate = await snapshot(homePage);
  const sameScopeTab = await context.newPage();
  await sameScopeTab.goto(origin + "/home/");
  await ready(sameScopeTab);
  const secondQuestion = await snapshot(sameScopeTab);
  deployments.get("/home/").version = "test-v2";
  await homePage.locator("#grownups summary").click();
  await homePage.locator("#check-updates").click();
  await homePage.waitForFunction(() => document.querySelector("#update-status").textContent.startsWith("An update is ready"));
  check(await homePage.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting.state) === "installed", "New worker waits instead of forcing activation");
  check(await homePage.locator("#check-updates").evaluate((node) => node === document.activeElement), "Background update does not move focus");
  assert.deepEqual(await snapshot(homePage), beforeUpdate);
  assert.deepEqual(await snapshot(sameScopeTab), secondQuestion);
  checks += 2;
  await sameScopeTab.close();
  assert.deepEqual(await snapshot(homePage), beforeUpdate);
  checks++;
  await homePage.close();
  await rootPage.waitForFunction(async ({ scope, version }) => {
    const registration = await navigator.serviceWorker.getRegistration(scope);
    if (!registration?.active || registration.waiting || registration.active.state !== "activated") return false;
    return !(await caches.keys()).some((key) => key.endsWith(`/home/:${version}`));
  }, { scope: origin + "/home/", version });
  const updatedPage = await context.newPage();
  await updatedPage.goto(origin + "/home/");
  await ready(updatedPage);
  check(await updatedPage.locator("body").getAttribute("data-test-release") === "test-v2", "Reopening receives new release only after last scoped tab closes");
  const updatedCaches = await cacheEntries(updatedPage);
  check(Boolean(updatedCaches["another-app:keep"]), "Unrelated cache survives activation");
  check(Boolean(updatedCaches[`cosy-cat-club:${origin}/:${version}`]), "Root app cache survives subpath update");
  check(!updatedCaches[`cosy-cat-club:${origin}/home/:${version}`], "Only old matching-scope cache removed");
  await context.setOffline(true);
  await updatedPage.reload();
  await ready(updatedPage);
  check(await updatedPage.locator("body").getAttribute("data-test-release") === "test-v2", "Updated release also reloads offline");
  await context.setOffline(false);

  // Readiness must notice partial eviction, even with a controller and internet.
  await updatedPage.evaluate(async () => {
    const key = (await caches.keys()).find((key) => key.endsWith("/home/:test-v2"));
    await (await caches.open(key)).delete(new URL("./icons/cat-192.png", location.href).href);
  });
  await updatedPage.locator("#grownups summary").click();
  await updatedPage.locator("#check-offline").click();
  await updatedPage.waitForFunction(() => document.querySelector("#offline-status").textContent.startsWith("Offline copy is incomplete"));
  check((await updatedPage.locator("#offline-status").textContent()).startsWith("Offline copy is incomplete"), "Evicted asset is not falsely reported ready");
  await context.close();
  console.log(`PASS: root/subpath registration, Chrome install criteria, manifests/PNGs, scope isolation, offline navigation, update waiting, cache eviction.`);
}

async function failureChecks(browser, origin) {
  deployments.get("/failure/").failIcon = true;
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(origin + "/failure/");
  await page.waitForFunction(() => document.querySelector("#update-status").textContent.includes("did not finish")
    || document.querySelector("#offline-status").textContent.includes("failed"));
  check(!(await page.locator("#offline-status").textContent()).startsWith("Offline copy ready"), "Registration or connectivity alone does not mean ready");
  check(await page.locator("#answers button").count() === 3, "Precache failure leaves current game playable");
  check(Object.keys(await cacheEntries(page)).length === 0, "Failed initial precache is atomic and removed");
  await context.close();
  deployments.get("/failure/").failIcon = false;

  deployments.get("/missing-data/").failQuestions = true;
  const missingContext = await browser.newContext();
  const missingPage = await missingContext.newPage();
  await missingPage.goto(origin + "/missing-data/");
  await missingPage.waitForFunction(() => document.querySelector("#update-status").textContent.includes("did not finish")
    || document.querySelector("#offline-status").textContent.includes("failed"));
  check((await missingPage.locator("#question").textContent()).includes("could not be loaded"), "Missing bank is a visible error, never an unsupported fallback question");
  check(await missingPage.locator("#answers button").count() === 0, "Missing bank cannot produce a question");
  check(await missingPage.locator("#new-question").isDisabled() && await missingPage.locator("#apply-settings").isDisabled(), "Unavailable game actions do not appear to succeed");
  check(Object.keys(await cacheEntries(missingPage)).length === 0, "Question data is required in the atomic precache");
  check(!(await missingPage.locator("#offline-status").textContent()).startsWith("Offline copy ready"), "Missing question data is never advertised as offline ready");
  await missingPage.locator("#wellbeing summary").click();
  await missingPage.getByRole("group", { name: "Brushing teeth", exact: true }).getByRole("button", { name: "Skip", exact: true }).click();
  check((await missingPage.locator("#wellbeing-status").textContent()).includes("Brushing teeth: Skip"), "Optional check-in remains independent even when the bank cannot load");
  await missingPage.locator("#close-checkin").click();
  check(await missingPage.locator("#wellbeing").getAttribute("open") === null, "Independent check-in can always close");
  await missingContext.close();
  deployments.get("/missing-data/").failQuestions = false;

  const updateContext = await browser.newContext();
  const updatePage = await updateContext.newPage();
  await updatePage.goto(origin + "/broken-update/");
  await ready(updatePage);
  const original = await snapshot(updatePage);
  deployments.get("/broken-update/").version = "test-failed-v2";
  deployments.get("/broken-update/").failQuestions = true;
  await updatePage.locator("#grownups summary").click();
  await updatePage.locator("#check-updates").click();
  await updatePage.waitForFunction(() => document.querySelector("#update-status").textContent.includes("did not finish"));
  assert.deepEqual(await snapshot(updatePage), original);
  checks++;
  check(Object.keys(await cacheEntries(updatePage)).every((key) => !key.endsWith("test-failed-v2")), "Failed update does not leave a partial new cache");
  await updateContext.setOffline(true);
  await updatePage.reload();
  await ready(updatePage);
  check(await updatePage.locator("#answers button").count() === 3, "Prior complete release survives broken update offline");
  await solveOfflineAreas(updatePage);
  // Chromium may fetch worker updates outside the page context's offline emulation.
  deployments.get("/broken-update/").failWorker = true;
  await updatePage.locator("#grownups summary").click();
  await updatePage.locator("#check-updates").click();
  await updatePage.waitForFunction(() => document.querySelector("#update-status").textContent.includes("Could not check"));
  check((await updatePage.locator("#update-status").textContent()).includes("Could not check"), "Unavailable update endpoint reports failure, not success");
  await updateContext.close();

  const unsupported = await browser.newContext();
  await unsupported.addInitScript(() => {
    delete Navigator.prototype.serviceWorker;
    delete window.speechSynthesis;
    delete window.SpeechSynthesisUtterance;
  });
  const unsupportedPage = await unsupported.newPage();
  await unsupportedPage.goto(origin);
  await unsupportedPage.locator("#grownups summary").click();
  check((await unsupportedPage.locator("#offline-status").textContent()).includes("does not support"), "Unsupported service workers are disclosed");
  await unsupportedPage.locator("#speech").check();
  await unsupportedPage.locator("#apply-settings").click();
  check((await unsupportedPage.locator("#settings-note").textContent()).includes("not supported"), "Unsupported speech disclosed");
  check(await unsupportedPage.locator("#read-button").isHidden(), "Unsupported speech button stays hidden");
  await unsupported.close();

  const blocked = await browser.newContext();
  await blocked.addInitScript(() => {
    navigator.serviceWorker.register = async () => { throw new DOMException("Blocked", "SecurityError"); };
  });
  const blockedPage = await blocked.newPage();
  await blockedPage.goto(origin);
  await blockedPage.locator("#grownups summary").click();
  check((await blockedPage.locator("#offline-status").textContent()).includes("failed or is blocked"), "Blocked registration is explicit");
  check(await blockedPage.locator("#answers button").count() === 3, "Blocked registration does not block game");
  await blocked.close();

  const fileContext = await browser.newContext();
  const filePage = await fileContext.newPage();
  await filePage.goto(pathToFileURL(path.join(root, "index.html")).href);
  await filePage.locator("#grownups summary").click();
  check((await filePage.locator("#offline-status").textContent()).includes("cannot install"), "file:// does not claim install/offline support");
  await fileContext.close();
}

async function installPromptChecks(browser, origin) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(origin);
  await ready(page);
  const question = await snapshot(page);
  for (const outcome of ["dismissed", "accepted", "error"]) {
    await page.evaluate((outcome) => {
      window.promptCalls = 0;
      const event = new Event("beforeinstallprompt", { cancelable: true });
      event.prompt = async () => {
        window.promptCalls++;
        if (outcome === "error") throw new Error("Intentional install failure");
      };
      event.userChoice = Promise.resolve({ outcome });
      window.dispatchEvent(event);
    }, outcome);
    check(await page.evaluate(() => window.promptCalls) === 0, "Install prompt never opens automatically");
    check(await page.locator("#grownups").getAttribute("open") === null, "Installation does not open grown-up corner");
    await page.locator("#grownups summary").click();
    if (outcome === "dismissed") {
      const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      check(a11y.violations.length === 0, `Install controls accessibility: ${JSON.stringify(a11y.violations)}`);
      await page.locator("#install-app").focus();
      await page.keyboard.press("Enter");
    } else {
      await page.locator("#install-app").click();
    }
    check(await page.evaluate(() => window.promptCalls) === 1, "Install prompt requires explicit grown-up click");
    check(await page.locator("#install-app").isHidden(), "Single-use prompt is not reused");
    const status = await page.locator("#app-action-status").textContent();
    check(status.includes(outcome === "dismissed" ? "No problem" : outcome === "accepted" ? "requested" : "could not"), "Accurate install outcome");
    check(await page.locator("#app-action-status").evaluate((node) => node === document.activeElement), "Focus returns to the installation result when the single-use button disappears");
    assert.deepEqual(await snapshot(page), question);
    checks++;
    await page.locator("#grownups summary").click();
  }
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await page.locator("#grownups summary").click();
  check((await page.locator("#install-status").textContent()).startsWith("Installed."), "Confirmed installation is distinguished from request");
  await context.close();
}

async function persistentOfflineCheck(origin) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cosy-cat-club-test-"));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true });
    let page = await context.newPage();
    await page.goto(origin + "/home/");
    await ready(page);
    const cdp = await context.newCDPSession(page);
    const installability = await cdp.send("Page.getInstallabilityErrors");
    check(installability.installabilityErrors.length === 0, `Non-incognito Chrome install criteria: ${JSON.stringify(installability)}`);
    await context.close();
    context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true, offline: true });
    page = await context.newPage();
    await page.goto(origin + "/home/");
    await ready(page);
    check(await page.locator("#answers button").count() === 3, "Offline reopening survives a full browser shutdown");
    await solveOfflineAreas(page);
  } finally {
    if (context) await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

async function solveOfflineAreas(page) {
  for (const area of ["math", "english", "science", "hass"]) {
    await page.locator(`[data-topic="${area}"]`).click();
    const q = await page.evaluate(() => CosyQuestions.bank("gentle").find((q) => q.key === document.querySelector("#question").dataset.key));
    check(q.area === area && q.curriculum.length > 0, "Offline question has the selected curriculum area");
    await page.locator("#answers").getByRole("button", { name: q.answer, exact: true }).click();
    check(await page.locator("#ticket").isVisible(), `Offline ${area} completes a real round`);
    await page.locator("#next-round").click();
  }
}

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    check((await fetch(origin)).ok, "Bounded local server is responsive");
    check(version === "v2", "Curriculum release increments worker to v2");
    if (!process.argv.includes("--pwa")) {
      validateBanks();
      await gameChecks(browser, origin + "/");
      await enhancementChecks(browser, origin + "/");
    }
    await pwaChecks(browser, origin);
    await failureChecks(browser, origin);
    await installPromptChecks(browser, origin);
    await persistentOfflineCheck(origin);
    check(requests.some((request) => request.method === "POST"), "Non-GET reached network server");
    console.log(`PASS: ${checks} PWA checks. Physical Pixel installation and real screen-reader output remain manual checks.`);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
