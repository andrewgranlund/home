const assert = require("node:assert/strict");
const { AxeBuilder } = require("@axe-core/playwright");

module.exports = async function revisitChecks(browser, url) {
  let checks = 0;
  const errors = [];
  function check(condition, label) { assert.ok(condition, label); checks++; }
  async function currentQuestion(page) {
    return page.evaluate(() => {
      const key = document.querySelector("#question").dataset.key;
      return [...CosyQuestions.bank("gentle"), ...CosyQuestions.bank("stretch")].find((question) => question.key === key);
    });
  }
  async function stored(page) {
    return page.evaluate(() => JSON.parse(localStorage.getItem("cosy-cat-club.revisit.v1") || "[]"));
  }
  async function axe(page, label) {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    check(result.violations.length === 0, `${label}: ${JSON.stringify(result.violations.map((violation) => violation.id))}`);
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(url);
  check(await page.locator("#grownups").getAttribute("open") === null, "Grown-up corner starts closed");
  check(await page.evaluate(() => localStorage.getItem("cosy-cat-club.revisit.v1") === null), "Initial question does not create a revisit record");
  await page.locator("#grownups > summary").click();
  check(await page.locator("#revisit-empty").isVisible(), "Revisit list has a zero state");
  await page.locator("#grownups > summary").click();

  const first = await currentQuestion(page);
  await page.locator("#new-question").click();
  let records = await stored(page);
  check(records.length === 1 && records[0].key === first.key, "Different question saves the outgoing unanswered question once");
  check(records[0].area === CosyAreaName(first.area) && records[0].prompt === first.prompt &&
    records[0].display === first.display && records[0].answer === first.answer &&
    records[0].hint === first.hint && records[0].explanation === first.explanation,
  "Saved question has a durable useful snapshot");
  check(JSON.stringify(records[0].choices.sort()) === JSON.stringify([...first.options].sort()) &&
    records[0].curriculum[0].id === first.curriculum[0] && records[0].curriculum[0].focus,
  "Saved snapshot retains choices and curriculum mapping");

  const second = await currentQuestion(page);
  await page.locator('[data-topic="science"]').click();
  records = await stored(page);
  check(records.length === 2 && records[0].key === second.key && records[1].key === first.key,
    "A category change saves the outgoing question before replacing it");
  await page.locator("[data-topic='science']").click();
  check((await stored(page)).length === 2, "Selecting the current category does not duplicate a record");

  await page.locator("#grownups > summary").click();
  check(await page.locator("#revisit-list > li").count() === 2, "Parent list renders saved entries");
  await page.locator("#revisit-list > li > details").first().locator(":scope > summary").click();
  check(await page.locator("#revisit-list > li > details").first().getByText(`Task: ${second.display}`).isVisible(),
    "Question details disclose the saved task");
  await page.locator("#revisit-list .revisit-answer summary").first().click();
  check(await page.getByText(`Correct answer: ${second.answer}`).isVisible(), "Answer is inside a grown-up-only disclosure");
  await axe(page, "Revisit list disclosures");

  await page.locator("#revisit-clear").focus();
  await page.keyboard.press("Enter");
  check(await page.locator("#revisit-confirmation").isVisible() &&
    await page.locator("#revisit-confirm").evaluate((node) => node === document.activeElement),
  "Clear uses an inline confirmation with sensible keyboard focus");
  await page.locator("#revisit-cancel").focus();
  await page.keyboard.press("Enter");
  check(await page.locator("#revisit-confirmation").isHidden() && (await stored(page)).length === 2 &&
    await page.locator("#revisit-clear").evaluate((node) => node === document.activeElement),
  "Cancelling clear keeps records and returns focus");
  await page.locator("#revisit-clear").click();
  await page.locator("#revisit-confirm").click();
  check((await stored(page)).length === 0 && await page.locator("#revisit-empty").isVisible() &&
    (await page.locator("#revisit-status").textContent()).includes("cleared") &&
    await page.locator("#revisit-heading").evaluate((node) => node === document.activeElement),
  "Confirmed clear updates storage, announces management status, and moves focus");

  const requestCount = requests.length;
  const paused = await currentQuestion(page);
  await page.locator("#rest-button").click();
  await page.locator("#resume-button").click();
  await page.locator("#level").selectOption("stretch");
  await page.locator("#apply-settings").click();
  await page.locator("#grownups > summary").click();
  check((await stored(page)).length === 0 && requests.length === requestCount,
    "Break/resume and settings changes do not save or request revisit data");
  check(paused.key !== (await currentQuestion(page)).key, "Settings still replaces questions without treating it as a skip");

  const answer = (await currentQuestion(page)).answer;
  await page.locator("#answers").getByRole("button", { name: answer, exact: true }).click();
  await page.locator("#next-round").click();
  check((await stored(page)).length === 0, "Solved questions and next round do not save revisit records");

  await page.locator("#new-question").click();
  const persistent = await stored(page);
  await page.reload();
  check(JSON.stringify(await stored(page)) === JSON.stringify(persistent) &&
    await page.locator("#revisit-list > li").count() === persistent.length,
  "Saved revisit records persist after reload");

  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator("#grownups > summary").click();
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Revisit management reflows at 320px");
  const controls = await page.locator("#revisit-clear").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
  check(controls.every((rect) => rect.width >= 44 && rect.height >= 44), "Revisit controls have large targets");
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.locator("#revisit-clear").focus();
  check(await page.locator("#revisit-clear").evaluate((node) => node === document.activeElement &&
    matchMedia("(forced-colors: active)").matches && matchMedia("(prefers-reduced-motion: reduce)").matches) &&
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  "Forced colours and reduced motion retain keyboard focus and reflow");
  await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });
  await context.close();

  const duplicateContext = await browser.newContext();
  await duplicateContext.addInitScript(() => {
    let questions;
    Object.defineProperty(globalThis, "CosyQuestions", {
      configurable: true,
      get: () => questions,
      set(value) {
        const fixed = value.bank("gentle")[0];
        const createPicker = value.createPicker;
        value.createPicker = (...args) => {
          const picker = createPicker(...args);
          picker.next = () => ({ ...fixed, options: [...fixed.options] });
          return picker;
        };
        questions = value;
      }
    });
  });
  const duplicatePage = await duplicateContext.newPage();
  await duplicatePage.goto(url);
  await duplicatePage.locator("#new-question").click();
  await duplicatePage.locator("#new-question").click();
  check((await stored(duplicatePage)).length === 1, "Repeated skips of the exact question deduplicate instead of growing history");
  const template = (await stored(duplicatePage))[0];
  await duplicatePage.evaluate((entry) => {
    const records = Array.from({ length: 50 }, (_, index) => ({ ...entry, key: `seed-${index}` }));
    localStorage.setItem("cosy-cat-club.revisit.v1", JSON.stringify(records));
  }, template);
  await duplicatePage.reload();
  await duplicatePage.locator("#new-question").click();
  records = await stored(duplicatePage);
  check(records.length === 50 && records[0].key === template.key && !records.some((entry) => entry.key === "seed-49"),
    "New records are newest-first and the oldest record is removed at the 50-question cap");
  await duplicateContext.close();

  const hostileContext = await browser.newContext();
  await hostileContext.addInitScript(() => localStorage.setItem("cosy-cat-club.revisit.v1", '{"key":"hostile","choices":"not an array"}'));
  const hostilePage = await hostileContext.newPage();
  hostilePage.on("pageerror", (error) => errors.push(error.message));
  await hostilePage.goto(url);
  await hostilePage.locator("#grownups > summary").click();
  check((await hostilePage.locator("#revisit-status").textContent()).includes("safely") &&
    await hostilePage.locator("#answers button").count() === 3,
  "Malformed storage is rejected safely without interrupting play");
  await hostileContext.close();

  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } });
  });
  const blockedPage = await blockedContext.newPage();
  blockedPage.on("pageerror", (error) => errors.push(error.message));
  await blockedPage.goto(url);
  await blockedPage.locator("#new-question").click();
  await blockedPage.locator("#grownups > summary").click();
  check((await blockedPage.locator("#revisit-status").textContent()).includes("cannot be saved") &&
    await blockedPage.locator("#answers button").count() === 3,
  "Blocked storage gives a calm parent status while the game continues");
  await blockedContext.close();

  const touch = await browser.newContext({ viewport: { width: 800, height: 1280 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const touchPage = await touch.newPage();
  await touchPage.goto(url);
  await touchPage.locator("#new-question").tap();
  await touchPage.locator("#grownups > summary").tap();
  await touchPage.locator("#revisit-clear").tap();
  check(await touchPage.locator("#revisit-confirmation").isVisible(), "Touch can open inline clear confirmation");
  await touch.close();
  check(errors.length === 0, `No revisit JavaScript errors: ${errors.join("; ")}`);
  console.log(`PASS: ${checks} revisit checks; skip-only persistence, snapshots, deduplication/cap, storage failures, disclosure, clearing, keyboard/touch/reflow, forced colours and axe.`);
};

function CosyAreaName(area) {
  return { math: "Maths", english: "English", science: "Science", hass: "HASS" }[area];
}
