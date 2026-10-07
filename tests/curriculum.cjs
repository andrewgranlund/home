const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
require("../questions.js");
const { bank, curriculum, topics, createPicker } = globalThis.CosyQuestions;

// Independently reviewed identifiers and bounded focus from the official Year 2 pages.
const approved = {
  AC9M2N04: ["math", "MATMATY2", /add and subtract one- and two-digit numbers/i],
  AC9M2N02: ["math", "MATMATY2", /two- and three-digit numbers/i],
  AC9M2M01: ["math", "MATMATY2", /uniform informal units/i],
  AC9E2LY10: ["english", "ENGENGY2", /including vowel digraphs/i],
  AC9E2LA07: ["english", "ENGENGY2", /articles and adjectives/i],
  AC9E2LA10: ["english", "ENGENGY2", /commas are used to separate items/i],
  AC9E2LY05: ["english", "ENGENGY2", /literal and inferred meaning/i],
  AC9S2U01: ["science", "SCISCIY2", /Earth is a planet in the solar system/i],
  AC9S2U02: ["science", "SCISCIY2", /sound energy causes objects to vibrate/i],
  AC9S2U03: ["science", "SCISCIY2", /without changing their material composition/i],
  AC9HS2K02: ["hass", "HASHASY2", /technological developments changed/i],
  AC9HS2S03: ["hass", "HASHASY2", /comparison of objects from the past and present/i]
};
const kindCodes = {
  addition: "AC9M2N04", subtraction: "AC9M2N04", "place-value": "AC9M2N02", measurement: "AC9M2M01",
  "word-building": "AC9E2LY10", "noun-group": "AC9E2LA07", "list-commas": "AC9E2LA10", reading: "AC9E2LY05",
  space: "AC9S2U01", sound: "AC9S2U02", materials: "AC9S2U03", technology: "AC9HS2K02", "source-reading": "AC9HS2S03"
};
const pages = { math: "mathematics", english: "english", science: "science", hass: "hass-f-6" };
const expectedCounts = {
  gentle: { addition: 45, subtraction: 54, "place-value": 10, measurement: 6, "word-building": 4, "noun-group": 4, "list-commas": 4, reading: 4, space: 4, sound: 4, materials: 4, technology: 4, "source-reading": 4 },
  stretch: { addition: 135, subtraction: 144, "place-value": 10, measurement: 6, "word-building": 4, "noun-group": 4, "list-commas": 4, reading: 4, space: 4, sound: 4, materials: 4, technology: 4, "source-reading": 4 }
};
// Answer fixtures are deliberately independent of the shipped scenario answers.
const expectedScenarios = {
  "space:gentle": ["Earth", "Earth", "The solar system", "The Sun"],
  "space:stretch": ["Earth and Mars", "The Sun", "Earth is a planet", "The Moon"],
  "sound:gentle": ["Tapping its skin", "Plucking", "Shaking", "Moving back and forth"],
  "sound:stretch": ["The string", "Scraping", "High", "Make objects vibrate"],
  "materials:gentle": ["Paper", "Chalk", "Bending", "Foil"],
  "materials:stretch": ["Twisting", "Stretching", "Cotton fabric", "A torn paper piece"],
  "technology:gentle": ["A telephone", "The aeroplane", "A washing machine", "Email"],
  "technology:stretch": ["People can see and hear each other", "Photos can be viewed without developing film", "Changing text before printing it", "Carrying many people along rails"],
  "source-reading:gentle": ["L", "The park", "The typewriter", "The bridge opened"],
  "source-reading:stretch": ["The stone bridge", "The kind of transport", "Route A", "The museum opened"]
};
const scenarioEvidence = {
  "space:gentle": [/Earth, the Sun and the Moon/, /solar system/, /travels around the Sun/, /Earth travels around it/],
  "space:stretch": [/solar system/, /Earth, Venus and the Sun/, /Earth's place/, /natural satellite/],
  "sound:gentle": [/stretched skin/, /pulled aside and released/, /beads.*closed rattle/, /ruler.*vibrates/],
  "sound:stretch": [/string moves back and forth/, /rubbed along a ridged/, /higher sound/, /paper tremble/],
  "materials:gentle": [/paper.*folded/, /chalk.*crushed/, /wire.*curved/, /foil.*scrunched/],
  "materials:stretch": [/yarn.*wound/, /band.*longer/, /cotton fabric.*strips/, /paper sheet.*shape/],
  "technology:gentle": [/carried on foot.*live conversation/, /horse-drawn cart/, /by hand.*powered/, /paper letter.*digital/],
  "technology:stretch": [/voices.*moving pictures/, /film.*screen/, /edit before printing/, /walking.*train/],
  "source-reading:gentle": [/L = library.*P = park.*S = station/, /park is 1.*library is 3.*museum is 5/, /1920.*typewriter.*2020.*tablet/, /bridge.*1980.*library.*1990.*pool.*2000/],
  "source-reading:stretch": [/bus.*stone bridge.*train.*same stone bridge/, /Earlier.*carts.*Later.*electric buses/, /A.*farm to market.*B.*school to pool.*C.*park to library/, /post office 1950.*station 1960.*museum 1970/]
};

function validateBanks() {
  let checks = 0;
  function check(value, label) { assert.ok(value, label); checks++; }
  assert.deepEqual(Object.keys(topics), ["math", "english", "science", "hass"]);
  assert.deepEqual(Object.keys(curriculum).sort(), Object.keys(approved).sort());
  const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
  for (const [id, mapping] of Object.entries(curriculum)) {
    const [area, dataset] = approved[id];
    check(mapping.id === id && mapping.area === area && mapping.year === 2 && mapping.version === "9.0", `${id}: official Year 2 identity`);
    check(mapping.source === `https://www.australiancurriculum.edu.au/f-10-curriculum/learning-areas/${pages[area]}/year-2`, `${id}: exact verified official page`);
    check(mapping.dataSource === `https://www.australiancurriculum.edu.au/conf/acara/api/spa/ac/curriculum.${dataset}.json`, `${id}: exact official dataset`);
    check(mapping.focus.length > 20 && mapping.practice.length > 30 && mapping.verified === "2026-10-07", `${id}: bounded practice and verification date`);
    check(readme.includes(id) && readme.includes(mapping.source), `${id}: documented trace`);
  }
  const keys = new Set();
  const used = new Set();
  for (const level of ["gentle", "stretch"]) {
    const questions = bank(level);
    const counts = {};
    for (const q of questions) {
      check(!keys.has(q.key), `Unique key ${q.key}`);
      keys.add(q.key);
      counts[q.kind] = (counts[q.kind] || 0) + 1;
      check(q.level === level && Object.hasOwn(topics, q.area), "Supported level/area only");
      assert.deepEqual(q.curriculum, [kindCodes[q.kind]], `${q.key}: mapped to independently approved kind`);
      checks++;
      for (const id of q.curriculum) {
        check(curriculum[id]?.area === q.area, `${q.key}: area matches curriculum`);
        used.add(id);
      }
      for (const field of ["prompt", "display", "spoken", "clue", "answer", "hint", "explanation"]) {
        check(typeof q[field] === "string" && q[field].trim().length > 0, `${q.key}: ${field} is usable`);
      }
      check(q.options.length === 3 && new Set(q.options).size === 3 && q.options.filter((o) => o === q.answer).length === 1, "Three distinct choices; one keyed answer");
      check(!/\bpatterns?\b|\blogic\b/i.test(JSON.stringify(q)), "No removed question category or task");
      if (["addition", "subtraction"].includes(q.kind)) {
        const [, a, op, b] = q.display.match(/^(\d+) ([+\u2212]) (\d+) = \?$/);
        const expected = op === "+" ? +a + +b : +a - +b;
        check(+q.answer === expected && expected >= 0 && expected <= (level === "gentle" ? 10 : 20), "Independent arithmetic and bounds");
        check(q.dots.reduce((x, y) => x + y, 0) === (op === "+" ? +a + +b : +a), "Hint dots match the scenario");
        check(q.hint.includes(`${expected}.`), "Counting hint reaches the correct answer");
        check(!q.prompt.includes("has 1 treats"), "Singular noun grammar");
      } else if (q.kind === "place-value") {
        const number = q.hundreds * 100 + q.tens * 10 + q.ones;
        check(+q.answer === number && (level === "gentle" ? number < 100 : number >= 100), "Standard place value including zero places");
        check(q.display.includes(`${q.tens} tens and ${q.ones} ones`), "Place value prompt matches model");
      } else if (q.kind === "measurement") {
        const big = ["heavier", "longer", "holds more"].includes(q.comparison);
        check(q.answer === ((q.a > q.b) === big ? q.first : q.second), "Same-unit comparison is correct");
        check(q.a !== q.b && q.display.includes("same size"), "Measurements explicitly use uniform units without ties");
        check(q.attribute !== "mass" || q.display.includes("same size and mass"), "Mass units are equal mass");
      } else if (q.kind === "word-building") {
        check(q.display.replace(/_+/, q.answer) === q.word, "Sound-letter choice reconstructs the target word");
        check(q.hint.includes(`"${q.word}"`), "Hint supports the actual word");
        check(q.options.filter((o) => q.display.replace(/_+/, o) === q.word).length === 1, "Only one letter choice forms the target");
      } else if (q.kind === "noun-group") {
        const [, adjective, noun] = q.display.split(" ");
        check(adjective === q.answer && noun === q.noun, "Correct adjective extends the noun");
        check(q.display.startsWith("an ") === /^[aeiou]/.test(adjective), "Article suits this adjective");
      } else if (q.kind === "list-commas") {
        check(q.answer === "Comma (,)" && q.display === `${q.list[0]} __ ${q.list[1]} and ${q.list[2]}`, "Comma separates list entries");
        check(q.explanation.includes(`${q.list[0]}, ${q.list[1]} and ${q.list[2]}`), "Punctuation example is accurate");
      } else if (q.kind === "reading") {
        check(q.display.toLowerCase().includes(q.answer.toLowerCase()), "Literal answer is explicitly in the supplied reading");
        check(q.hint.includes(q.answer), "Reading hint points to the answer");
      } else {
        const group = `${q.kind}:${level}`;
        const index = Number(q.key.split(":").at(-1));
        check(q.answer === expectedScenarios[group][index], `${q.key}: independently reviewed scenario answer`);
        check(scenarioEvidence[group][index].test(q.display), `${q.key}: answer still supported by scenario evidence`);
      }
    }
    assert.deepEqual(counts, expectedCounts[level]);
    checks++;
  }
  assert.deepEqual([...used].sort(), Object.keys(curriculum).sort());
  check(keys.size === 482, "482 level-specific questions");
  check(new Set([...bank("gentle"), ...bank("stretch")].map((q) => JSON.stringify([q.prompt, q.display]))).size === 383, "383 distinct prompt/display pairs across both levels");
  const areaCounts = {};
  for (const q of [...bank("gentle"), ...bank("stretch")]) areaCounts[q.area] = (areaCounts[q.area] || 0) + 1;
  assert.deepEqual(areaCounts, { math: 410, english: 32, science: 24, hass: 16 });
  const picker = createPicker(() => 0);
  const last = new Map();
  for (const level of ["gentle", "stretch"]) {
    let previous;
    for (let batch = 0; batch < 25; batch++) {
      const areas = [];
      for (let i = 0; i < 4; i++) {
        const q = picker.next("mixed", level);
        areas.push(q.area);
        check(keys.has(q.key) && q.area !== previous, "Mixed mode selects supported questions without consecutive same area");
        check(last.get(q.area) !== q.key, "Even constant randomness cannot immediately repeat an area's question");
        previous = q.area;
        last.set(q.area, q.key);
      }
      assert.deepEqual(areas.sort(), Object.keys(topics).sort());
      checks++;
    }
    for (const area of Object.keys(topics)) {
      let prior;
      for (let i = 0; i < 20; i++) {
        const q = picker.next(area, level);
        check(q.key !== prior && q.area === area, "Selected area excludes immediate repeats with constant randomness");
        prior = q.key;
      }
    }
  }
  assert.throws(() => picker.next("unsupported", "gentle"), /Unsupported/);
  assert.throws(() => picker.next("math", "unsupported"), /Unsupported/);
  assert.throws(() => bank("unsupported"), /Unknown/);
  console.log(`PASS: ${checks} curriculum/bank checks; 482 level-specific questions (Maths 410, English 32, Science 24, HASS 16); 12 verified content-description IDs.`);
}

async function verifyOfficial() {
  const datasets = new Map();
  for (const [id, [area, dataset, meaning]] of Object.entries(approved)) {
    if (!datasets.has(dataset)) {
      const response = await fetch(curriculum[id].dataSource, { signal: AbortSignal.timeout(30000) });
      assert.ok(response.ok, `Official source ${dataset}: HTTP ${response.status}`);
      datasets.set(dataset, await response.json());
    }
    const document = datasets.get(dataset);
    assert.equal(document.subject.level.title, "Year 2");
    assert.equal(document.subject.level.code, dataset);
    const description = document["content-description"][id];
    assert.ok(description, `${id}: present in current official source`);
    assert.match(description.title, meaning, `${id}: current scope still matches reviewed practice`);
    assert.equal(curriculum[id].area, area);
    console.log(`CONFIRMED ${id}: ${curriculum[id].dataSource}`);
  }
  console.log("PASS: all 12 identifiers and scoped meanings confirmed against 4 current official ACARA Year 2 datasets.");
}

module.exports = { validateBanks, verifyOfficial };
if (require.main === module) {
  validateBanks();
  if (process.argv.includes("--official")) verifyOfficial().catch((error) => { console.error(error); process.exitCode = 1; });
}
