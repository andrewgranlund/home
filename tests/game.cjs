const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "..", "index.html");
const source = fs.readFileSync(file, "utf8");
const results = path.join(__dirname, "results");
const errors = [];
let checks = 0;
function check(condition, label) { assert.ok(condition, label); checks++; }

module.exports = async function gameChecks(browser, url) {
    fs.mkdirSync(results, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const external = [];
    page.on("request", (request) => { if (new URL(request.url()).origin !== new URL(url).origin) external.push(request.url()); });
    await page.goto(url);
    check(await page.locator("#answers button").count() === 3, "Hosted game starts");
    check(await page.locator("#read-button").isHidden(), "Speech hidden by default");
    check(await page.locator("#ticket").isHidden(), "No unearned ticket");
    check(await page.locator("#grownups").getAttribute("open") === null, "Settings initially closed");

    async function axe(label) {
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      check(result.violations.length === 0, `${label}: ${JSON.stringify(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`);
    }
    async function selectTopic(topic) {
      await page.locator(`[data-topic="${topic}"]`).click();
      check(await page.locator(`[data-topic="${topic}"]`).getAttribute("aria-pressed") === "true", `${topic} selected`);
    }
    async function correctAnswer() {
      return page.evaluate(() => {
        const tag = document.querySelector("#question-tag").textContent;
        const display = document.querySelector("#puzzle-display").textContent.trim();
        if (tag.startsWith("Maths")) {
          const [, a, operation, b] = display.match(/(\d+)\s*([+\u2212])\s*(\d+)/);
          return String(operation === "+" ? Number(a) + Number(b) : Number(a) - Number(b));
        }
        const hint = document.querySelector("#hint-text").textContent;
        if (tag.startsWith("Words")) {
          const word = hint.match(/The word is "([^"]+)"/)[1];
          return word[display.split(" ").indexOf("_")];
        }
        return hint.match(/next picture is a (\w+)/)[1];
      });
    }
    async function solve() {
      const answer = await correctAnswer();
      await page.locator("#answers").getByRole("button", { name: answer, exact: true }).click();
      check(await page.locator("#ticket").isVisible(), "Correct answer finishes round");
      check(await page.locator("#play").isHidden(), "No second question after success");
      check(await page.locator("#ticket-title").evaluate((node) => node === document.activeElement), "Completion heading receives focus");
    }
    await selectTopic("math");
    await axe("Initial maths");
    await page.screenshot({ path: path.join(results, "desktop.png"), fullPage: true });
    const answer = await correctAnswer();
    const wrong = page.locator("#answers button").filter({ hasText: new RegExp(`^(?!${answer}$).+`) }).first();
    await wrong.click();
    check(await page.locator("#ticket").isHidden(), "Wrong answer does not finish");
    check((await page.locator("#feedback").textContent()).includes("Not that one"), "Gentle wrong answer feedback");
    await page.locator("#hint-button").click();
    check(await page.locator("#hint").isVisible(), "Hint available after wrong answer");
    const axClient = await context.newCDPSession(page);
    const axTree = await axClient.send("Accessibility.getFullAXTree");
    check(axTree.nodes.some((node) => node.role?.value === "button" && node.name?.value === "Hide hint"
      && node.properties?.some((property) => property.name === "expanded" && property.value.value === true)), "Hint has computed button name and expanded state");
    check(axTree.nodes.some((node) => node.role?.value === "status"
      && node.properties?.some((property) => property.name === "live" && property.value.value === "polite")), "Feedback exposes a polite live status in the accessibility tree");
    check((await page.locator("#question").ariaSnapshot()).includes("equals what?"), "Accessible question includes the visual arithmetic");
    await axe("Hint and retry");
    const originalQuestion = await page.locator("#question").textContent();
    const originalAnswers = await page.locator("#answers").textContent();
    await page.locator("#rest-button").click();
    check(await page.locator("#rest").isVisible(), "Break screen");
    await axe("Rest screen");
    await page.locator("#resume-button").click();
    check(await page.locator("#question").textContent() === originalQuestion, "Break preserves question");
    check(await page.locator("#answers").textContent() === originalAnswers, "Break preserves answer order");
    check(await page.locator("#hint").isVisible(), "Break preserves hint");
    await solve();
    await axe("TV ticket");
    await page.screenshot({ path: path.join(results, "ticket.png"), fullPage: true });
    await page.locator("#grownups summary").click();
    await page.locator("#level").selectOption("stretch");
    await page.locator("#reward").selectOption("done");
    await page.locator("#simple").check();
    await page.locator("#apply-settings").click();
    check(await page.locator("#ticket").isVisible(), "Settings do not revoke earned ticket");
    check(await page.locator("#ticket-title").textContent() === "All done!", "Alternative reward");
    check(await page.locator("body").getAttribute("class") === "simple", "Simple background");
    await axe("Settings open and alternative reward");
    await page.locator("#grownups summary").click();
    await page.reload();
    check(await page.locator("#level").inputValue() === "stretch", "Level persists locally");
    check(await page.locator("#reward").inputValue() === "done", "Reward persists locally");
    check(await page.locator("#ticket").isHidden(), "Reload starts fresh");

    for (const level of ["gentle", "stretch"]) {
      await page.locator("#grownups summary").click();
      await page.locator("#level").selectOption(level);
      await page.locator("#apply-settings").click();
      await page.locator("#grownups summary").click();
      for (const topic of ["math", "logic", "spelling"]) {
        await selectTopic(topic);
        await axe(`${level} ${topic}`);
        let previous = "";
        for (let i = 0; i < 18; i++) {
          const question = await page.locator("#question").textContent();
          check(previous !== question, "Refresh avoids immediate repeat");
          const choices = await page.locator("#answers button").allTextContents();
          check(new Set(choices).size === 3, "Three unique answers");
          check(choices.includes(await correctAnswer()), "One correct choice");
          previous = question;
          if (i % 6 === 0) {
            await solve();
            await page.locator("#next-round").click();
          } else {
            await page.locator("#new-question").click();
          }
        }
      }
    }
    await selectTopic("mixed");
    const observed = new Set();
    for (let i = 0; i < 40; i++) {
      observed.add((await page.locator("#question-tag").textContent()).split(" ")[0]);
      await page.locator("#new-question").click();
    }
    check(observed.size === 3, "Mixed mode exercises all three types");

    await selectTopic("logic");
    for (const viewport of [{ width: 800, height: 1280 }, { width: 1024, height: 768 }, { width: 320, height: 740 }]) {
      await page.setViewportSize(viewport);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `No horizontal overflow at ${viewport.width}`);
      const targets = await page.locator("#play button:visible").evaluateAll((buttons) => buttons.map((button) => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
      check(targets.every((target) => target.width >= 44 && target.height >= 44), "Large touch targets");
      await page.screenshot({ path: path.join(results, `layout-${viewport.width}.png`), fullPage: true });
    }
    await page.locator("#grownups summary").click();
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Settings fit at 320px");
    await axe("Small screen with settings");
    await page.locator("#grownups summary").click();
    await page.setViewportSize({ width: 800, height: 1000 });
    await page.addStyleTag({ content: "html { font-size: 200% !important; } * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }" });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Large text and text spacing reflow");
    await page.reload();
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.locator('[data-topic="math"]').focus();
    await page.keyboard.press("Space");
    check(await page.locator("#question").evaluate((node) => node === document.activeElement), "Keyboard topic selection");
    await page.keyboard.press("Tab");
    check(await page.locator("#answers button").first().evaluate((node) => node === document.activeElement), "Logical keyboard order");
    check(await page.locator("#answers button").first().evaluate((node) => getComputedStyle(node).outlineStyle !== "none"), "Keyboard focus visible");
    await page.keyboard.press("Enter");
    check((await page.locator("#feedback").textContent()).includes("Not that one") || await page.locator("#ticket").isVisible(), "Keyboard answer activates");
    if (await page.locator("#play").isVisible()) await solve();

    await page.locator("#grownups summary").click();
    check(await page.locator("#download-button").count() === 0, "No misleading single-file PWA download");
    check(await page.locator("#install-status").textContent(), "Manual installation guidance available");
    check(external.length === 0, "Game makes no cross-origin requests");

    const noStorage = await browser.newContext();
    await noStorage.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } });
    });
    const blockedPage = await noStorage.newPage();
    await blockedPage.goto(url);
    check(await blockedPage.locator("#answers button").count() === 3, "Works with localStorage blocked");
    await blockedPage.locator("#grownups summary").click();
    check((await blockedPage.locator("#settings-note").textContent()).includes("cannot be read"), "Storage load limitation disclosed");
    await blockedPage.locator("#apply-settings").click();
    check((await blockedPage.locator("#settings-note").textContent()).includes("visit only"), "Storage save limitation disclosed");
    await noStorage.close();

    const speechContext = await browser.newContext();
    await speechContext.addInitScript(() => {
      window.speechCalls = [];
      Object.defineProperty(window, "speechSynthesis", { value: {
        speaking: false, pending: false, cancel() {},
        speak(utterance) { window.speechCalls.push(utterance.text); utterance.onerror({ error: "voice-unavailable" }); }
      }});
    });
    const speechPage = await speechContext.newPage();
    await speechPage.goto(url);
    await speechPage.locator("#grownups summary").click();
    await speechPage.locator("#speech").check();
    await speechPage.locator("#apply-settings").click();
    await speechPage.locator("#grownups summary").click();
    check(await speechPage.evaluate(() => speechCalls.length === 0), "Speech never auto-plays");
    await speechPage.locator("#read-button").click();
    check(await speechPage.evaluate(() => speechCalls.length === 1), "Speech requires explicit click");
    check((await speechPage.locator("#feedback").textContent()).includes("isn't available"), "Speech errors visible");
    await speechContext.close();

    const bankPage = await context.newPage();
    const instrumented = source.replace(/<script src="\.\/pwa.js" defer><\/script>/, "").replace("      loadSettings();", `      window.bankForLevel = (level) => {
        settings.level = level;
        return [...mathQuestions(), ...spellingQuestions(), ...logicQuestions()];
      };
      loadSettings();`);
    await bankPage.setContent(instrumented);
    let bankCount = 0;
    for (const level of ["gentle", "stretch"]) {
      const bank = await bankPage.evaluate((level) => window.bankForLevel(level), level);
      const keys = new Set();
      for (const q of bank) {
        check(!keys.has(q.key), "Unique bank keys");
        keys.add(q.key);
        if (q.type === "math") {
          check(!q.prompt.includes("has 1 treats"), "Singular treat grammar");
          const [, a, operation, b] = q.display.match(/(\d+)\s*([+\u2212])\s*(\d+)/);
          const expected = operation === "+" ? Number(a) + Number(b) : Number(a) - Number(b);
          check(Number(q.answer) === expected && expected >= 0 && expected <= (level === "gentle" ? 10 : 20), "Arithmetic is correct and in bounds");
          check(q.dots.reduce((a, b) => a + b, 0) <= (level === "gentle" ? 10 : 20), "Counting visual in bounds");
        } else if (q.type === "logic") {
          const unitSize = level === "gentle" ? 2 : 3;
          check(q.answer === q.sequence[q.sequence.length % unitSize], "Pattern continuation correct");
          check(new Set(q.options).size === 3 && q.options.includes(q.answer), "Pattern choices unique and contain answer");
        } else {
          const word = q.key.split(":")[1];
          const gap = q.display.split(" ").indexOf("_");
          check(word[gap] === q.answer, "Spelling answer fills exact gap");
          check(new Set(q.options).size === 3 && q.options.includes(q.answer), "Letter choices unique and contain answer");
        }
        bankCount++;
      }
    }
    await bankPage.close();
    const touchContext = await browser.newContext({
      viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true
    });
    const touchPage = await touchContext.newPage();
    await touchPage.goto(url);
    await touchPage.locator('[data-topic="math"]').tap();
    const touchAnswer = await touchPage.locator("#puzzle-display").textContent();
    const [, touchA, touchOp, touchB] = touchAnswer.match(/(\d+)\s*([+\u2212])\s*(\d+)/);
    const touchCorrect = String(touchOp === "+" ? Number(touchA) + Number(touchB) : Number(touchA) - Number(touchB));
    await touchPage.locator("#answers").getByRole("button", { name: touchCorrect, exact: true }).tap();
    check(await touchPage.locator("#ticket").isVisible(), "Tablet-emulated tap completes one question");
    await touchPage.setViewportSize({ width: 1280, height: 800 });
    await touchPage.locator("#next-round").tap();
    await touchPage.locator("#hint-button").tap();
    await touchPage.locator("#rest-button").tap();
    await touchPage.locator("#resume-button").tap();
    check(await touchPage.locator("#hint").isVisible(), "Landscape tablet touch preserves hint across break");
    check(await touchPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Landscape tablet reflows");
    await touchPage.locator("#grownups summary").tap();
    await touchPage.screenshot({ path: path.join(results, "tablet-settings.png"), fullPage: true });
    await touchContext.close();
    const edge = await chromium.launch({ channel: "msedge", headless: true });
    try {
      const edgeContext = await edge.newContext();
      const edgePage = await edgeContext.newPage();
      await edgePage.goto(url);
      check(await edgePage.locator("#answers button").count() === 3, "Edge opens hosted game");
      await edgePage.locator("#new-question").click();
      check(await edgePage.locator("#answers button").count() === 3, "Edge refresh works");
    } finally {
      await edge.close();
    }
    check(errors.length === 0, `No JavaScript errors: ${errors.join("; ")}`);
    check(bankCount === 434, "All 434 original questions retained");
    await context.close();
    console.log(`PASS: ${checks} game checks; ${bankCount} questions checked exhaustively; interaction states, axe, layouts, keyboard, storage and speech failure.`);
};
