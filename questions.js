/* Original practice questions, not ACARA assessment items or a complete Year 2 course. */
globalThis.CosyQuestions = (() => {
  "use strict";

  const topics = { math: "Maths", english: "English", science: "Science", hass: "HASS" };
  const sources = {
    math: { page: "mathematics", dataset: "MATMATY2" },
    english: { page: "english", dataset: "ENGENGY2" },
    science: { page: "science", dataset: "SCISCIY2" },
    hass: { page: "hass-f-6", dataset: "HASHASY2" }
  };
  const descriptions = {
    AC9M2N04: ["math", "Addition and subtraction with one- and two-digit numbers.", "Short number sentences and counting hints; not the full range of calculation strategies."],
    AC9M2N02: ["math", "Grouping and regrouping two- and three-digit numbers by place value.", "Compose standard hundreds, tens and ones, including zero places; not all regroupings."],
    AC9M2M01: ["math", "Measuring and comparing length, capacity and mass with uniform informal units.", "Compare supplied same-unit measurements; does not assess hands-on measuring."],
    AC9E2LY10: ["english", "Using sound-letter relationships to read and spell, including digraphs and silent letters.", "Complete a written word using its meaning clue; no claim to assess spoken phonics."],
    AC9E2LA07: ["english", "Extending nouns into noun groups and recognising verb groups.", "Identify the adjective in a supplied noun group; only one part of this description."],
    AC9E2LA10: ["english", "Capital letters in titles and commas between list items.", "Select list punctuation; title capitalisation is not assessed."],
    AC9E2LY05: ["english", "Comprehension strategies for literal and inferred meaning.", "Reread an original short text to locate explicit information; not full comprehension coverage."],
    AC9S2U01: ["science", "Earth as a solar-system planet and observations of objects in the sky.", "Recognise Earth and distinguish planets, the Sun and the Moon; no observation-cycle assessment."],
    AC9S2U02: ["science", "Actions that make sounds, varied sounds and vibration.", "Reason from short descriptions of sound-making actions; no listening or practical investigation required."],
    AC9S2U03: ["science", "Physical changes to materials without changing what they are made of.", "Identify bending, twisting, stretching and smaller pieces in supplied scenarios."],
    AC9HS2K02: ["hass", "How changes in technology affected communication, travel, work and home life.", "Compare specified earlier and later technologies, without assuming anyone owns them."],
    AC9HS2S03: ["hass", "Interpreting supplied sources and observations, including past/present comparisons.", "Read original museum notes, timelines and map keys; no local knowledge or personal disclosure."]
  };
  const curriculum = Object.fromEntries(Object.entries(descriptions).map(([id, [area, focus, practice]]) => [
    id, {
      id, area, version: "9.0", year: 2, verified: "2026-10-07", focus, practice,
      source: `https://www.australiancurriculum.edu.au/f-10-curriculum/learning-areas/${sources[area].page}/year-2`,
      dataSource: `https://www.australiancurriculum.edu.au/conf/acara/api/spa/ac/curriculum.${sources[area].dataset}.json`
    }
  ]));

  function item(area, kind, level, id, outcome, prompt, display, answer, others, explanation, extra = {}) {
    return {
      key: `${area}:${kind}:${level}:${id}`, area, kind, level, curriculum: [outcome],
      prompt, display, spoken: display, clue: "Choose one answer. Help is welcome.",
      answer, options: [answer, ...others], explanation, hint: explanation,
      compact: false, ...extra
    };
  }

  function maths(level) {
    const max = level === "gentle" ? 10 : 20;
    const result = [];
    for (const operation of ["+", "-"]) {
      for (let a = 1; a <= max; a++) {
        for (let b = 1; b <= Math.min(9, operation === "+" ? max - a : a); b++) {
          const answer = operation === "+" ? a + b : a - b;
          const steps = Array.from({ length: b }, (_, i) => operation === "+" ? a + i + 1 : a - i - 1);
          const choices = Array.from({ length: max + 1 }, (_, i) => i)
            .filter((n) => n !== answer).sort((x, y) => Math.abs(x - answer) - Math.abs(y - answer)).slice(0, 2).map(String);
          const symbol = operation === "+" ? "+" : "\u2212";
          result.push(item("math", operation === "+" ? "addition" : "subtraction", level, `${a}-${b}`, "AC9M2N04",
            operation === "+"
              ? `Mochi has ${a} ${a === 1 ? "treat" : "treats"}. She finds ${b} more. How many treats now?`
              : `Mochi has ${a} ${a === 1 ? "treat" : "treats"}. She eats ${b}. How many treats are left?`,
            `${a} ${symbol} ${b} = ?`, String(answer), choices, `${a} ${symbol} ${b} = ${answer}.`, {
              a, b, operation, compact: true, clue: "Choose a number.",
              spoken: `${a} ${operation === "+" ? "plus" : "minus"} ${b} equals what?`,
              dots: operation === "+" ? [a, b] : [answer, b],
              hint: `Start at ${a}. Count ${operation === "+" ? "on" : "back"} ${b}: ${steps.join(", ")}. ${operation === "+" ? "Count both groups of dots." : "The filled dots are left."}`
            }));
        }
      }
    }
    for (let n = 1; n <= 5; n++) {
      for (const zero of [true, false]) {
        const hundreds = level === "gentle" ? 0 : n;
        const tens = level === "gentle" ? n : zero ? 0 : 2;
        const ones = zero ? 0 : 4;
        const answer = hundreds * 100 + tens * 10 + ones;
        const display = `${hundreds ? `${hundreds} hundreds, ` : ""}${tens} tens and ${ones} ones`;
        result.push(item("math", "place-value", level, `${n}-${zero}`, "AC9M2N02",
          "Which number do these parts make?", display, String(answer), [String(answer + 1), String(answer + 10)],
          `${display} make ${answer}. Each hundred is 100 and each ten is 10.`, { hundreds, tens, ones }));
      }
    }
    const measurements = level === "gentle"
      ? [
          ["length", "Ribbon A", 4, "Ribbon B", 7, "paperclips", "longer"],
          ["length", "Stick A", 6, "Stick B", 3, "blocks", "shorter"],
          ["capacity", "Jug A", 3, "Jug B", 5, "cups of water", "holds more"],
          ["capacity", "Jar A", 4, "Jar B", 2, "spoons of sand", "holds less"],
          ["mass", "Parcel A", 6, "Parcel B", 4, "cubes on a balance", "heavier"],
          ["mass", "Box A", 3, "Box B", 5, "cubes on a balance", "lighter"]
        ]
      : [
          ["length", "Ribbon A", 12, "Ribbon B", 9, "paperclips", "longer"],
          ["length", "Stick A", 11, "Stick B", 14, "blocks", "shorter"],
          ["capacity", "Jug A", 8, "Jug B", 11, "cups of water", "holds more"],
          ["capacity", "Jar A", 13, "Jar B", 10, "spoons of sand", "holds less"],
          ["mass", "Parcel A", 9, "Parcel B", 12, "cubes on a balance", "heavier"],
          ["mass", "Box A", 14, "Box B", 11, "cubes on a balance", "lighter"]
        ];
    measurements.forEach(([attribute, first, a, second, b, unit, comparison], i) => {
      const bigger = ["longer", "holds more", "heavier"].includes(comparison);
      const answer = (a > b) === bigger ? first : second;
      result.push(item("math", "measurement", level, i, "AC9M2M01",
        `Which ${comparison.startsWith("holds") ? "" : "is "}${comparison}?`,
        `${first}: ${a}. ${second}: ${b}. Both measured in ${unit} of the same size${attribute === "mass" ? " and mass" : ""}.`,
        answer, [answer === first ? second : first, "They are equal"],
        `${answer} ${comparison.startsWith("holds") ? "" : "is "}${comparison}. Compare ${a} and ${b}; the measuring units are the same.`,
        { attribute, first, second, a, b, comparison }));
    });
    return result;
  }

  function english(level) {
    const result = [];
    const words = level === "gentle"
      ? [
          ["rain", "r__n", "ai", ["ee", "oa"], "Water falling from clouds."],
          ["seed", "s__d", "ee", ["oa", "ai"], "A small part from which a plant can grow."],
          ["boat", "b__t", "oa", ["ee", "ai"], "A craft that travels on water."],
          ["moon", "m__n", "oo", ["ee", "ai"], "Earth's natural companion in space."]
        ]
      : [
          ["night", "n___t", "igh", ["air", "ear"], "The time between sunset and sunrise."],
          ["knee", "_nee", "k", ["w", "t"], "The joint in the middle of a leg."],
          ["thumb", "thum_", "b", ["k", "n"], "The short digit beside four fingers."],
          ["knock", "_nock", "k", ["w", "g"], "Tap on a door to make a sound."]
        ];
    words.forEach(([word, display, letters, others, meaning]) => {
      result.push(item("english", "word-building", level, word, "AC9E2LY10",
        "Which letters finish the word?", display, letters, others,
        `The word is "${word}". Put "${letters}" in the gap.`, {
          word, letters, compact: true, clue: meaning,
          spoken: `${[...display.replace(/_+/, "|")].map((letter) => letter === "|" ? "gap" : letter).join(", ")}. ${meaning}`
        }));
    });
    const groups = level === "gentle"
      ? [["the soft cushion", "soft", "cushion"], ["a small boat", "small", "boat"], ["the green leaf", "green", "leaf"], ["a round pebble", "round", "pebble"]]
      : [["the narrow bridge", "narrow", "bridge"], ["a gentle breeze", "gentle", "breeze"], ["the smooth shell", "smooth", "shell"], ["an enormous balloon", "enormous", "balloon"]];
    groups.forEach(([display, adjective, noun], i) => {
      result.push(item("english", "noun-group", level, i, "AC9E2LA07",
        `Which word describes the ${noun}?`, display, adjective, [display.split(" ")[0], noun],
        `"${adjective}" describes the ${noun}. It adds detail to the noun group.`, { adjective, noun }));
    });
    const lists = level === "gentle"
      ? [["pens", "books", "bags"], ["cats", "dogs", "fish"], ["red", "green", "blue"], ["leaves", "twigs", "seeds"]]
      : [["ribbons", "buttons", "beads"], ["pencils", "crayons", "brushes"], ["shells", "stones", "feathers"], ["boats", "trains", "buses"]];
    lists.forEach((words, i) => {
      result.push(item("english", "list-commas", level, i, "AC9E2LA10",
        "Which mark separates the first two items in this list?", `${words[0]} __ ${words[1]} and ${words[2]}`,
        "Comma (,)", ["Full stop (.)", "Question mark (?)"],
        `A comma separates the first two items: ${words[0]}, ${words[1]} and ${words[2]}.`, { list: words }));
    });
    const texts = level === "gentle"
      ? [
          ["Mochi rests on a cushion. The cushion is beside a window.", "Where does Mochi rest?", "on a cushion", ["under a table", "in a boat"]],
          ["A snail rests under a leaf. Rain lands on the leaf.", "What is above the snail?", "a leaf", ["a shell", "a bridge"]],
          ["A bird carries a twig to its nest.", "What does the bird carry?", "a twig", ["a pebble", "a flower"]],
          ["The boat has a blue sail and a white hull.", "What colour is the sail?", "blue", ["white", "green"]]
        ]
      : [
          ["Mochi puts a red ball in a box. She leaves a green ball on the mat.", "Which ball stays on the mat?", "a green ball", ["a red ball", "a blue ball"]],
          ["A gardener waters the seeds, then puts the empty can in the shed.", "Where does the empty can go?", "in the shed", ["beside the pond", "under the tree"]],
          ["The wind carries a feather over the fence. It lands beside the gate.", "Where does the feather land?", "beside the gate", ["on the fence", "in the pond"]],
          ["A ferry leaves the island at noon. It reaches the mainland later.", "Where does the ferry leave from?", "the island", ["the mainland", "the mountain"]]
        ];
    texts.forEach(([display, prompt, answer, others], i) => {
      result.push(item("english", "reading", level, i, "AC9E2LY05", prompt, display, answer, others,
        `Reread the text. It tells us: ${answer}.`));
    });
    return result;
  }

  // These original scenarios supply context rather than asking about a child's life.
  const scenarios = {
    science: {
      "space": {
        outcome: "AC9S2U01",
        gentle: [
          ["Which one is a planet?", "Earth, the Sun and the Moon are objects in space.", "Earth", ["The Sun", "The Moon"], "Earth is a planet. The Sun is a star and the Moon is Earth's natural satellite."],
          ["Which planet do people live on?", "Think about our place in the solar system.", "Earth", ["Mars", "Venus"], "People live on Earth, a planet in the solar system."],
          ["What is Earth part of?", "Earth travels around the Sun.", "The solar system", ["A cloud", "A rainbow"], "Earth is one of the planets in the solar system."],
          ["Which object is a star?", "Earth travels around it.", "The Sun", ["Earth", "The Moon"], "The Sun is the star at the centre of our solar system."]
        ],
        stretch: [
          ["Which pair contains only planets?", "Look at the kinds of objects in the solar system.", "Earth and Mars", ["Earth and the Moon", "The Sun and Earth"], "Earth and Mars are planets. The Sun is a star; the Moon is a natural satellite."],
          ["Which object is NOT a planet?", "Compare Earth, Venus and the Sun.", "The Sun", ["Earth", "Venus"], "The Sun is a star, while Earth and Venus are planets."],
          ["Which statement is accurate?", "Think about Earth's place in space.", "Earth is a planet", ["Earth is a star", "Earth is the Sun"], "Earth is a planet that travels around the Sun."],
          ["Which object travels around Earth?", "It is Earth's natural satellite.", "The Moon", ["Mars", "Venus"], "The Moon travels around Earth. Mars and Venus are planets that travel around the Sun."]
        ]
      },
      "sound": {
        outcome: "AC9S2U02",
        gentle: [
          ["Which action makes this drum sound?", "The drum has a stretched skin.", "Tapping its skin", ["Looking at it", "Drawing beside it"], "Tapping the skin makes it vibrate and produce a sound."],
          ["Which action makes a guitar string sound?", "The string is pulled aside and released.", "Plucking", ["Painting", "Folding"], "Pulling and releasing a string is plucking. The string vibrates."],
          ["Which action makes a rattle sound?", "Loose beads are inside a closed rattle.", "Shaking", ["Staring", "Drawing"], "Shaking makes the beads hit the rattle and produce sound."],
          ["What does vibrating mean?", "A ruler makes a sound as it vibrates.", "Moving back and forth", ["Staying still", "Changing colour"], "Vibration is back-and-forth movement."]
        ],
        stretch: [
          ["What is vibrating here?", "A plucked guitar string moves back and forth.", "The string", ["A painted picture", "A closed book"], "The moving string is vibrating and making the sound."],
          ["Which action is being used?", "A stick is rubbed along a ridged instrument to make sound.", "Scraping", ["Looking", "Folding"], "Rubbing along the ridges is scraping. It can make the instrument vibrate."],
          ["Which word describes pitch?", "One whistle makes a higher sound than another.", "High", ["Bright", "Smooth"], "Pitch describes how high or low a sound is."],
          ["What can sound energy do?", "A nearby loudspeaker makes a thin sheet of paper tremble.", "Make objects vibrate", ["Turn paper into metal", "Make paper vanish"], "Sound energy can make an object vibrate, as the trembling paper shows."]
        ]
      },
      "materials": {
        outcome: "AC9S2U03",
        gentle: [
          ["What is the folded sheet made of?", "A sheet of paper is folded into a fan.", "Paper", ["Metal", "Glass"], "Folding changes the shape, but the material is still paper."],
          ["What are the small pieces made of?", "A piece of chalk is crushed into powder.", "Chalk", ["Wood", "Fabric"], "Crushing makes smaller pieces. The material is still chalk."],
          ["Which change happened?", "A straight piece of soft wire is curved into a loop.", "Bending", ["Melting", "Painting"], "Curving the wire changes its shape by bending it."],
          ["What is the scrunched sheet made of?", "A sheet of foil is scrunched into a ball.", "Foil", ["Paper", "Wood"], "Scrunching changes its shape, not the material."]
        ],
        stretch: [
          ["Which action changed the yarn?", "Strands of yarn are wound around each other.", "Twisting", ["Melting", "Freezing"], "Winding the strands around each other twists the yarn."],
          ["Which action changed the band?", "An elastic band is gently pulled so it becomes longer.", "Stretching", ["Cutting", "Folding"], "Pulling it longer stretches it; it is still the same material."],
          ["What are the strips made of?", "A sheet of cotton fabric is cut into strips.", "Cotton fabric", ["Glass", "Metal"], "Cutting changes the size and shape, but it is still cotton fabric."],
          ["Which one is still paper?", "A paper sheet is changed in shape, not material.", "A torn paper piece", ["A glass marble", "A metal spoon"], "Tearing paper makes smaller pieces of paper."]
        ]
      }
    },
    hass: {
      "technology": {
        outcome: "AC9HS2K02",
        gentle: [
          ["Which technology lets people talk across a long distance?", "Compare a spoken message carried on foot with a live conversation far away.", "A telephone", ["A wheelbarrow", "A watering can"], "A telephone carries voices across distance without a messenger walking there."],
          ["Which change let people travel by air?", "Compare a horse-drawn cart with later transport.", "The aeroplane", ["The typewriter", "The camera"], "An aeroplane can carry people through the air; a cart travels on land."],
          ["Which technology can wash clothes using a motor?", "Compare washing clothes by hand with a powered device.", "A washing machine", ["A telescope", "A bicycle"], "A powered washing machine can do washing work that would otherwise be done by hand."],
          ["Which technology can send a written message electronically?", "Compare posting a paper letter with a digital message.", "Email", ["A paper envelope", "A wooden cart"], "Email sends a written message electronically, rather than carrying a paper letter."]
        ],
        stretch: [
          ["What changed with video calls?", "Earlier telephone calls carried voices. Video calls can also carry moving pictures.", "People can see and hear each other", ["People must post every word", "People travel inside the phone"], "A video call adds moving pictures to a voice conversation across distance."],
          ["What changed with digital cameras?", "Film cameras needed film to be developed. Digital cameras can show an image on a screen.", "Photos can be viewed without developing film", ["Every photo must be painted", "Cameras stopped recording images"], "Digital images can be viewed on a screen without developing photographic film."],
          ["Which change helps edit writing?", "A typewriter puts ink straight on paper. A word processor lets a writer edit before printing.", "Changing text before printing it", ["Making paper waterproof", "Sending a person through a screen"], "A word processor lets a writer change the text before it is printed."],
          ["What new travel option did railways provide?", "Compare walking a route with riding a train along that route.", "Carrying many people along rails", ["Making people fly without a vehicle", "Sending only written messages"], "Trains carry many people together along railway lines."]
        ]
      },
      "source-reading": {
        outcome: "AC9HS2S03",
        gentle: [
          ["Which symbol marks the library?", "Map key: L = library. P = park. S = station.", "L", ["P", "S"], "The supplied map key says L stands for library."],
          ["Which place is closest to the station?", "Map notes: park is 1 block from the station; library is 3; museum is 5.", "The park", ["The library", "The museum"], "One block is the smallest distance in these map notes."],
          ["Which object is from the earlier display?", "Museum labels: 1920 display - typewriter. 2020 display - tablet computer.", "The typewriter", ["The tablet computer", "Both are labelled 2020"], "The typewriter has the earlier date, 1920, in the supplied labels."],
          ["Which event happened first?", "Town timeline: bridge opened in 1980; library in 1990; pool in 2000.", "The bridge opened", ["The library opened", "The pool opened"], "1980 is the earliest date on this supplied timeline."]
        ],
        stretch: [
          ["Which detail is the same in both notes?", "Old photo note: a bus beside a stone bridge. New photo note: a train beside the same stone bridge.", "The stone bridge", ["The bus", "The train"], "Both notes describe the same stone bridge; the vehicles differ."],
          ["Which detail changed between the notes?", "Earlier street note: horse-drawn carts. Later street note: electric buses.", "The kind of transport", ["The notes both say carts", "The notes both say buses"], "The supplied notes change from carts to electric buses."],
          ["Which route reaches the market?", "Map key: route A joins farm to market; B joins school to pool; C joins park to library.", "Route A", ["Route B", "Route C"], "The supplied map key shows route A joins the farm and market."],
          ["Which event came after the station opened?", "Town timeline: post office 1950; station 1960; museum 1970.", "The museum opened", ["The post office opened", "Both events were earlier"], "The museum date, 1970, is after the station date, 1960."]
        ]
      }
    }
  };

  function bank(level) {
    if (!["gentle", "stretch"].includes(level)) throw new Error(`Unknown question level: ${level}`);
    const result = [...maths(level), ...english(level)];
    for (const [area, kinds] of Object.entries(scenarios)) {
      for (const [kind, group] of Object.entries(kinds)) {
        group[level].forEach(([prompt, display, answer, others, explanation], i) => {
          result.push(item(area, kind, level, i, group.outcome, prompt, display, answer, others, explanation));
        });
      }
    }
    return result;
  }

  // Balance areas and question kinds, rather than letting the large arithmetic bank dominate.
  function createPicker(random = Math.random) {
    const banks = { gentle: bank("gentle"), stretch: bank("stretch") };
    const previousKeys = new Map();
    let previousArea;
    let mixedBag = [];
    function pick(items) { return items[Math.floor(random() * items.length)]; }
    function shuffle(items) {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }
    return {
      next(topic, level) {
        if (!banks[level] || (topic !== "mixed" && !Object.hasOwn(topics, topic))) {
          throw new Error(`Unsupported question selection: ${topic}/${level}`);
        }
        let area = topic;
        if (topic === "mixed") {
          if (!mixedBag.length) {
            mixedBag = shuffle(Object.keys(topics));
            if (mixedBag[mixedBag.length - 1] === previousArea) {
              [mixedBag[0], mixedBag[mixedBag.length - 1]] = [mixedBag[mixedBag.length - 1], mixedBag[0]];
            }
          }
          area = mixedBag.pop();
        } else {
          mixedBag = [];
        }
        previousArea = area;
        const pool = banks[level].filter((question) => question.area === area && question.key !== previousKeys.get(`${area}:${level}`));
        const kind = pick([...new Set(pool.map((question) => question.kind))]);
        const question = pick(pool.filter((question) => question.kind === kind));
        previousKeys.set(`${area}:${level}`, question.key);
        return { ...question, options: shuffle(question.options) };
      }
    };
  }

  return { topics, curriculum, bank, createPicker };
})();
