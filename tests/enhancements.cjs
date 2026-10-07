const assert = require("node:assert/strict");
const { AxeBuilder } = require("@axe-core/playwright");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function enhancementChecks(browser, url) {
  let checks = 0;
  const errors = [];
  function check(condition, message) { assert.ok(condition, message); checks++; }
  async function axe(page, label) {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    check(result.violations.length === 0, `${label}: ${JSON.stringify(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`);
  }
  async function question(page) {
    return page.evaluate(() => {
      const key = document.querySelector("#question").dataset.key;
      return [...CosyQuestions.bank("gentle"), ...CosyQuestions.bank("stretch")].find((q) => q.key === key);
    });
  }
  async function snapshot(page) {
    return page.evaluate(() => ["question", "answers", "hint", "play", "rest", "ticket", "ticket-title"]
      .map((id) => { const node = document.getElementById(id); return { id, text: node.textContent, hidden: node.hidden }; }));
  }
  async function solve(page, keyboard = false) {
    const q = await question(page);
    const button = page.locator("#answers").getByRole("button", { name: q.answer, exact: true });
    if (keyboard) { await button.focus(); await page.keyboard.press("Enter"); }
    else await button.click();
    check(await page.locator("#ticket").isVisible(), "Ticket never waits for a check-in or animation");
    check(await page.locator("#ticket-title").evaluate((node) => node === document.activeElement), "Success heading receives focus immediately");
  }
  const context = await browser.newContext({ reducedMotion: "no-preference" });
  await context.addInitScript(() => {
    window.celebrations = [];
    document.addEventListener("animationstart", (event) => {
      if (event.animationName === "cosy-cheer") window.celebrations.push(event.target.id);
    });
    window.speechCalls = [];
    Object.defineProperty(window, "speechSynthesis", { value: {
      speaking: false, pending: false, cancel() {},
      speak(utterance) { window.speechCalls.push(utterance.text); utterance.onend?.(); }
    } });
    window.storageWrites = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      window.storageWrites.push({ key, value });
      return original.call(this, key, value);
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector("#offline-status").textContent.startsWith("Offline copy ready"));
  check(await page.locator("#wellbeing").getAttribute("open") === null, "Bonus never opens itself");
  check(await page.evaluate(() => !document.querySelector("#wellbeing").contains(document.activeElement)), "Bonus never grabs focus");
  check(await page.evaluate(() => celebrations.length === 0 && speechCalls.length === 0), "No automatic motion or audio");
  const first = await question(page);
  await page.locator("#answers").getByRole("button", { name: first.options.find((o) => o !== first.answer), exact: true }).click();
  await page.locator("#hint-button").click();
  await page.locator("#rest-button").click();
  const paused = await snapshot(page);
  await page.locator("#wellbeing summary").focus();
  await page.keyboard.press("Enter");
  const teeth = page.getByRole("group", { name: "Brushing teeth", exact: true });
  const bed = page.getByRole("group", { name: "Making the bed", exact: true });
  await teeth.getByRole("button", { name: "Skip", exact: true }).focus();
  await page.keyboard.press("Space");
  check(await teeth.getByRole("button", { name: "Skip", pressed: true }).count() === 1, "Keyboard operates the named group with computed pressed state");
  check((await page.locator("#wellbeing-status").textContent()).includes("Brushing teeth: Skip"), "Routine feedback names the action and selection");
  assert.deepEqual(await snapshot(page), paused);
  checks++;
  const ax = await context.newCDPSession(page);
  const tree = await ax.send("Accessibility.getFullAXTree");
  check(tree.nodes.some((n) => n.role?.value === "group" && n.name?.value === "Brushing teeth"), "Named routine group is in the accessibility tree");
  check(tree.nodes.some((n) => n.role?.value === "status" && n.properties?.some((p) => p.name === "live" && p.value.value === "polite")), "Check-in feedback exposes a polite live status");
  await axe(page, "Open optional check-in during break");
  await page.locator("#close-checkin").click();
  check(await page.locator("#wellbeing summary").evaluate((node) => node === document.activeElement), "Closing check-in returns focus to its summary");
  await page.locator("#resume-button").click();
  check(await page.locator("#hint").isVisible(), "Check-in during break preserves hint");
  check(await page.evaluate(() => celebrations.length === 0), "Wrong answer, hint, break and skipped routine never celebrate");
  await solve(page, true);
  await page.waitForFunction(() => celebrations.length === 1);
  assert.deepEqual(await page.evaluate(() => celebrations), ["mochi-cat"]);
  checks++;
  check(await page.locator("#mochi-cat").evaluate((node) => getComputedStyle(node).animationDuration) === "1.1s", "Celebration is brief");
  check(await page.locator("#mochi-cat").evaluate((node) => getComputedStyle(node).animationIterationCount) === "1", "Celebration runs once");
  check(await page.evaluate(() => document.getAnimations().every((a) => a.effect.target.id === "mochi-cat")), "Only the cat moves, not scenery");
  await page.keyboard.press("Tab");
  check(await page.locator("#next-round").evaluate((node) => node === document.activeElement), "Success keyboard flow is not blocked by motion");
  await page.keyboard.press("Enter");
  check(await page.locator("#play").isVisible(), "Next round can start without waiting for celebration");

  const requestCount = requests.length;
  for (const a of ["Done", "Not today", "Skip"]) {
    for (const b of ["Done", "Not today", "Skip"]) {
      await page.locator("#wellbeing summary").click();
      const before = await snapshot(page);
      await teeth.getByRole("button", { name: a, exact: true }).click();
      await bed.getByRole("button", { name: b, exact: true }).click();
      check(await teeth.locator('[aria-pressed="true"]').count() === 1 && await bed.locator('[aria-pressed="true"]').count() === 1, "Each group has one reversible choice");
      assert.deepEqual(await snapshot(page), before);
      checks++;
      await page.locator("#close-checkin").click();
      await solve(page);
      const ticket = await snapshot(page);
      await page.locator("#wellbeing summary").click();
      await teeth.getByRole("button", { name: "Not today", exact: true }).click();
      await bed.getByRole("button", { name: "Skip", exact: true }).click();
      assert.deepEqual(await snapshot(page), ticket);
      checks++;
      await page.locator("#close-checkin").click();
      await page.locator("#next-round").click();
    }
  }
  check(requests.length === requestCount, "Bonus and puzzle interactions cause no network requests");
  check(await page.evaluate(() => storageWrites.length === 0 && localStorage.length === 0 && sessionStorage.length === 0), "Routine choices and puzzle results have no durable history");
  check(await page.evaluate(() => speechCalls.length === 0), "No sound from celebrations or check-ins");
  await page.locator("#grownups summary").click();
  await page.locator("#speech").check();
  await page.locator("#apply-settings").click();
  check(await page.evaluate(() => speechCalls.length === 0), "Enabling speech does not play anything");
  check(await page.evaluate(() => storageWrites.every(({ key, value }) =>
    key === "cosy-cat-club.preferences.v1" && JSON.stringify(Object.keys(JSON.parse(value)).sort()) === JSON.stringify(["level", "reward", "simple", "speech"]))), "Only the four non-history preferences persist");
  await page.locator("#grownups summary").click();
  await solve(page);
  check(await page.evaluate(() => speechCalls.length === 0), "Win does not speak even when read-aloud is enabled");
  await page.locator("#next-round").click();
  await page.locator("#read-button").click();
  check(await page.evaluate(() => speechCalls.length === 1), "Explicit read click alone starts speech");
  await page.reload();
  check(await page.locator("#wellbeing").getAttribute("open") === null && await page.locator("#wellbeing [aria-pressed=true]").count() === 0, "Reload clears choices and closes check-in");
  check(await page.evaluate(() => speechCalls.length === 0), "Saved speech preference never autoplays on reload");
  const freshPage = await context.newPage();
  await freshPage.goto(url);
  check(await freshPage.locator("#wellbeing").getAttribute("open") === null && await freshPage.locator("#wellbeing [aria-pressed=true]").count() === 0, "Another page never inherits a routine history");
  await freshPage.close();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await solve(page);
  check(await page.locator("#mochi-cat").evaluate((node) => getComputedStyle(node).animationName) === "none", "Reduced-motion celebration is static");
  check(await page.evaluate(() => celebrations.length === 0 && document.getAnimations().length === 0), "Reduced-motion win starts no animation");
  check((await page.locator("#cat-title").textContent()).includes("lovely little solve"), "Still cat and words are the equivalent celebration");
  await axe(page, "Reduced-motion success");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  check(await page.evaluate(() => document.getAnimations().length === 0), "Disabling reduced motion on an existing ticket never starts a late celebration");
  await page.locator("#next-round").click();
  await solve(page);
  await page.waitForFunction(() => celebrations.length === 1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => !document.querySelector(".cat-side").classList.contains("celebrating"));
  check(await page.evaluate(() => document.getAnimations().length === 0), "Changing motion preference stops an in-progress celebration");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  check(await page.evaluate(() => document.getAnimations().length === 0), "Restoring motion never replays a cancelled celebration");
  await page.locator("#next-round").click();
  await page.emulateMedia({ reducedMotion: "no-preference", forcedColors: "active" });
  await page.locator("#wellbeing summary").click();
  await teeth.getByRole("button", { name: "Done", exact: true }).click();
  check(await teeth.getByRole("button", { name: "Done", pressed: true }).evaluate((node) => getComputedStyle(node).outlineStyle !== "none"), "Forced-colours selection has a non-colour-only outline");
  await solve(page);
  check(await page.locator("#mochi-cat").evaluate((node) => getComputedStyle(node).animationName) === "none", "Forced-colours success remains still and textual");
  await page.emulateMedia({ forcedColors: "none" });
  check(await page.evaluate(() => document.getAnimations().length === 0), "Leaving forced colours never starts a late celebration");
  await page.locator("#next-round").click();
  await solve(page);
  await page.waitForFunction(() => !document.querySelector(".cat-side").classList.contains("celebrating"));
  check(await page.evaluate(() => document.getAnimations().length === 0), "Completed celebration cleans up its animation state");
  await context.close();

  // Feed each real bank kind to the unmodified renderer and answer handler.
  const renderer = await browser.newContext({ viewport: { width: 320, height: 740 } });
  await renderer.addInitScript(() => {
    let data;
    Object.defineProperty(globalThis, "CosyQuestions", {
      configurable: true, get: () => data,
      set(value) {
        const create = value.createPicker;
        value.createPicker = (...args) => {
          const picker = create(...args);
          const next = picker.next;
          picker.next = (topic, level) => window.testQuestion || next(topic, level);
          return picker;
        };
        data = value;
      }
    });
  });
  const renderPage = await renderer.newPage();
  renderPage.on("pageerror", (error) => errors.push(error.message));
  await renderPage.goto(url);
  const representatives = await renderPage.evaluate(() => {
    const representatives = new Map();
    for (const q of [...CosyQuestions.bank("gentle"), ...CosyQuestions.bank("stretch")]) {
      const key = `${q.kind}:${q.level}`;
      // Longest answer exercises wrapping, not just the shortest scenario.
      if (!representatives.has(key) || q.options.join("").length > representatives.get(key).options.join("").length) representatives.set(key, q);
    }
    return [...representatives.values()];
  });
  check(representatives.length === 26, "All 13 kinds are exercised at both levels");
  for (const q of representatives) {
    await renderPage.evaluate((q) => { window.testQuestion = q; }, q);
    await renderPage.locator("#new-question").click();
    check(await renderPage.locator("#question").getAttribute("data-key") === q.key, "Renderer uses the real bank entry");
    check(await renderPage.locator("#question").getAttribute("data-curriculum") === q.curriculum[0], "Rendered question retains curriculum trace");
    check((await renderPage.locator("#question").ariaSnapshot()).includes(q.spoken), "All visual stimulus also has accessible text");
    check(await renderPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${q.key}: 320px reflow`);
    const targets = await renderPage.locator("#answers button").evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().toJSON()));
    check(targets.every((r) => r.width >= 44 && r.height >= 44), `${q.key}: large answer targets`);
    check(await renderPage.locator("#answers button").evaluateAll((nodes) => nodes.every((n) => n.scrollHeight <= n.clientHeight && n.scrollWidth <= n.clientWidth)), `${q.key}: choices are not clipped`);
    if (process.env.COSY_SCREENSHOTS && q.kind === "technology" && q.level === "stretch") {
      await renderPage.screenshot({ path: path.join(process.env.COSY_SCREENSHOTS, "year2-hass-320.png"), fullPage: true });
    }
    await axe(renderPage, `${q.kind} ${q.level}`);
    await renderPage.locator("#answers").getByRole("button", { name: q.answer, exact: true }).click();
    check(await renderPage.locator("#ticket").isVisible(), "Every kind can finish a round");
    await renderPage.locator("#next-round").click();
  }
  await renderPage.locator("#wellbeing summary").click();
  await renderPage.locator("#grownups summary").click();
  await renderPage.addStyleTag({ content: "html{font-size:200%!important} *{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}" });
  check(await renderPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "New controls reflow at 320px with double text size and spacing");
  await renderer.close();

  const touch = await browser.newContext({ viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const tablet = await touch.newPage();
  await tablet.goto(url);
  await tablet.locator("#wellbeing summary").tap();
  await tablet.getByRole("group", { name: "Brushing teeth", exact: true }).getByRole("button", { name: "Not today", exact: true }).tap();
  await tablet.getByRole("group", { name: "Making the bed", exact: true }).getByRole("button", { name: "Skip", exact: true }).tap();
  await axe(tablet, "Touch tablet optional choices");
  const targets = await tablet.locator("#wellbeing button").evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().toJSON()));
  check(targets.every((r) => r.width >= 44 && r.height >= 44), "All routine controls have large touch targets");
  if (process.env.COSY_SCREENSHOTS) {
    fs.mkdirSync(process.env.COSY_SCREENSHOTS, { recursive: true });
    await tablet.screenshot({ path: path.join(process.env.COSY_SCREENSHOTS, "year2-checkin.png"), fullPage: true });
  }
  await tablet.locator("#close-checkin").tap();
  await tablet.locator('[data-topic="hass"]').tap();
  const touchQuestion = await question(tablet);
  await tablet.locator("#answers").getByRole("button", { name: touchQuestion.answer, exact: true }).tap();
  check(await tablet.locator("#ticket").isVisible(), "Skipped check-ins do not gate tablet success");
  await tablet.setViewportSize({ width: 1280, height: 800 });
  check(await tablet.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Celebration and ticket fit landscape tablet");
  if (process.env.COSY_SCREENSHOTS) await tablet.screenshot({ path: path.join(process.env.COSY_SCREENSHOTS, "year2-ticket.png"), fullPage: true });
  await touch.close();
  check(errors.length === 0, `No enhancement JavaScript errors: ${errors.join("; ")}`);
  console.log(`PASS: ${checks} enhancement checks; 26 kind/level renderings, optional routine privacy/independence, gentle success-only motion, reduced motion, forced colours, keyboard/touch/reflow and axe.`);
};
