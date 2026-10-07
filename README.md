# The Cosy Cat Club

A small, static, installable game for a Pixel Tablet or Windows laptop. Mochi offers one question per round in **Maths, English, Science or HASS**, with unlimited gentle retries, hints and breaks. Mix it up offers all four areas once per shuffled cycle. Question kinds are balanced within an area so arithmetic does not crowd out other practice. A correct answer earns a symbolic ticket to show a grown-up, not a TV lock or parental-control mechanism. The optional finishing message is "All done!".

**This enhancement is local only and has not been deployed.** The user reports an existing site at <https://andrewgranlund.github.io/home/>; local edits do not change that site. No framework, backend, build step or Node installation is needed to run the game.

## Year 2 practice and curriculum map

Verified on **7 October 2026** against the current official **Australian Curriculum v9.0, Year 2** pages and the public JSON data those pages use. The questions are original, limited practice linked to content descriptions, **not ACARA-endorsed material, an accredited course, coverage of the entire Year 2 curriculum, or evidence of achievement**. Multiple-choice recognition cannot replace writing, speaking, practical investigations or teacher assessment. Gentle and A little more are support choices, not different school-year standards.

`questions.js` is the machine-readable authority: every generated/selectable entry has `area`, `kind`, `level`, `key` and `curriculum` identifiers. Each identifier maps to its version, year, verification date, official page, official dataset, paraphrased focus and explicit practice limits. No curriculum source is fetched by the running app.

| Area / official Year 2 source | Identifier | Bounded practice in this game |
| --- | --- | --- |
| [Maths](https://www.australiancurriculum.edu.au/f-10-curriculum/learning-areas/mathematics/year-2) | AC9M2N04 | Addition/subtraction number sentences and counting hints; not all strategies |
| Maths | AC9M2N02 | Compose standard two-/three-digit place values, including zero places |
| Maths | AC9M2M01 | Compare supplied length, capacity and mass measurements using equal informal units; not physical measuring |
| [English](https://www.australiancurriculum.edu.au/f-10-curriculum/learning-areas/english/year-2) | AC9E2LY10 | Word gaps using digraphs, a longer vowel spelling and silent letters; written recognition, not spoken phonics testing |
| English | AC9E2LA07 | Adjectives extending a noun group; not the whole grammar description |
| English | AC9E2LA10 | Commas in lists; not title capitalisation |
| English | AC9E2LY05 | Reread short original texts for literal information; not full comprehension coverage |
| [Science](https://www.australiancurriculum.edu.au/f-10-curriculum/learning-areas/science/year-2) | AC9S2U01 | Earth in the solar system and identifying celestial objects; not ongoing sky observations |
| Science | AC9S2U02 | Sound-making actions, pitch and vibration from supplied descriptions; no audio or hands-on test |
| Science | AC9S2U03 | Physical changes to shape/size without a change of material |
| [HASS F-6](https://www.australiancurriculum.edu.au/f-10-curriculum/learning-areas/hass-f-6/year-2) | AC9HS2K02 | How specified earlier/later technologies change travel, communication or work; no assumptions about ownership |
| HASS F-6 | AC9HS2S03 | Interpret supplied fictional museum notes, map keys and timelines; no local knowledge, personal beliefs or family disclosure |

Official machine-readable sources used to check the identifiers and their meaning: [Maths](https://www.australiancurriculum.edu.au/conf/acara/api/spa/ac/curriculum.MATMATY2.json), [English](https://www.australiancurriculum.edu.au/conf/acara/api/spa/ac/curriculum.ENGENGY2.json), [Science](https://www.australiancurriculum.edu.au/conf/acara/api/spa/ac/curriculum.SCISCIY2.json), [HASS](https://www.australiancurriculum.edu.au/conf/acara/api/spa/ac/curriculum.HASHASY2.json). Descriptions above are paraphrases. The game uses only the bounded portions listed, not every element of each description. Original arithmetic is retained under AC9M2N04; the earlier simple word bank is replaced by the more explicit Year 2 word work.

| Area / question kind | Gentle entries | A little more entries |
| --- | ---: | ---: |
| Maths: addition | 45 | 135 |
| Maths: subtraction | 54 | 144 |
| Maths: place value | 10 | 10 |
| Maths: informal measurement comparison | 6 | 6 |
| English: word building | 4 | 4 |
| English: noun groups | 4 | 4 |
| English: list commas | 4 | 4 |
| English: reading | 4 | 4 |
| Science: Earth/space | 4 | 4 |
| Science: sound | 4 | 4 |
| Science: physical material changes | 4 | 4 |
| HASS: changing technology | 4 | 4 |
| HASS: reading supplied sources | 4 | 4 |
| **Total** | **151** | **331** |

There are **482 level-specific entries**: Maths 410, English 32, Science 24 and HASS 16. The 99 smaller arithmetic tasks occur in both levels, giving **383 distinct prompt/display pairs**, not 482 wholly different tasks. Gentle arithmetic stays within 10; A little more stays within 20. Place value adds two-digit and three-digit work respectively. Each area avoids its immediately previous question within the chosen level.

## Optional check-in and celebration

The collapsed **A little check-in, if you feel like it** section offers brushing teeth and making the bed, each with equally available **Done**, **Not today** and **Skip** choices. It never opens or takes focus on its own. It is not a question bank or curriculum assessment, never gates the game or a ticket, and has no score, streak or required state. Choices are only DOM state on the current page: no storage, history, dates, account or network request. Reloading/reopening clears them; closing the section just tucks them away for this open page.

Only a correct puzzle answer starts Mochi's gentle 1.1-second sway, once. The scenery does not move; there are no flashes, sounds or interaction-blocking timers. Ticket text and heading focus convey completion independently. Reduced-motion and forced-colours modes show the same still cat and completion words without animation. Changing these preferences cancels an active celebration without replaying it later. Keyboard users can move on immediately.

## Local preview

Keep `index.html`, `questions.js`, `pwa.js`, `sw.js`, `manifest.webmanifest` and `icons` together. From this directory, if Python is installed:

```powershell
py -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080/` in Chrome or Edge. Stop the server with Ctrl+C. Any static HTTP server works for a localhost preview. Opening `index.html` directly may run the puzzle, but **file:// cannot install or save this PWA offline**. A tablet opening a laptop's LAN HTTP address does not get the localhost secure-context exception; use an HTTPS host for real tablet installation.

## Deployment later (separate authorisation required)

After reviewing the files and explicitly choosing to publish:

1. Commit/merge the app files into the repository branch you intend to deploy, then push that branch. Do not publish personal information or secrets.
2. Preserve the existing Pages configuration. For a fresh branch-root setup, select **Settings > Pages > Deploy from a branch**, the branch containing the app files (normally `master` after merging), and **/ (root)**. `.nojekyll` allows static serving without Jekyll processing. Do not change hosting or visibility as part of local development.
3. Wait for deployment and use the HTTPS URL shown by Pages. With the usual account/repository settings it is `https://andrewgranlund.github.io/home/`. Pages availability depends on repository visibility and plan; this setup does not change either.
4. Visit the URL online and check **Grown-up corner** for a complete offline copy. Then install and test offline on each device.

The same folder also works at a site's root or any directory with a trailing slash: all app paths, manifest `id`/`start_url`/`scope`, worker scope and icons are relative. A host should redirect `/home` to `/home/`. There is no SPA routing requirement. Serve `.webmanifest` as `application/manifest+json` (or JSON), `.js` as JavaScript and `.png` as `image/png`. For hosts you control, revalidate `sw.js` rather than assigning it a long immutable HTTP cache lifetime.

A public static website makes its game code and question banks publicly readable. The app has no accounts, analytics, third-party assets or question uploads, but the hosting provider may log ordinary requests, including IP addresses. Do not add a child's name or other personal information before publishing. Google Drive is suitable for storing a backup of **all** supporting files, not for hosting the PWA; saving the current page as one HTML file is not an offline installation.

## Pixel Tablet installation

1. In **Google Chrome** (not an embedded preview or private/incognito window), visit the HTTPS address while connected.
2. Open **Grown-up corner**. Wait for **Offline copy ready**. This means the controlling worker verified every required cached file, not merely that registration succeeded.
3. Tap **Install Cosy Cat Club** if offered. Otherwise use Chrome's **three-dot menu > Add to Home screen > Install** (some versions say **Install app**). Confirm and open the new icon from the Home screen or app drawer. A shortcut-only option is not proof of installation or offline readiness.
4. Turn Wi-Fi off, close and reopen the app, and try a puzzle. Turn Wi-Fi back on afterwards. Speech may need a downloaded voice or a connection even when the game is offline.

On Windows, use Chrome/Edge's address-bar install icon, or Chrome's **Cast, save and share > Install page as app** / Edge's **Apps > Install this site as an app** when available. Menu names vary. Installation is optional; Firefox and other compatible browsers can play in a regular tab, with offline support where service workers are allowed.

## Offline behavior, preferences and updates

- The first online visit atomically precaches the HTML, question/curriculum data script, PWA script, manifest and three PNG icons. The service-worker script itself is stored by the browser's service-worker machinery. Nothing is fetched from third-party asset services.
- The worker is cache-first for the two entry points (`./` and `./index.html`, including navigation query strings) and exact listed assets. It does not cache/intercept other routes, cross-origin requests or non-GET requests. A missing cached asset falls back to the network without silently saving a mixed release.
- A cached game can reopen offline without installation. **Check offline copy** verifies the current saved files; browser storage can be evicted or cleared, so no permanent offline guarantee is possible. A missing/incomplete cache is reported, not treated as ready.
- Settings are saved only in this browser, with a visible fallback if storage is blocked. No device sync. Break/resume preserves the current question, choices and hint while the page stays open; a reload or reopening starts a fresh round.
- Read aloud is hidden by default and speaks only after being enabled and clicked. It uses the device/browser speech service, which may use an online voice. There is no automatic audio, timer or score.
- Every release **must change `VERSION` in `sw.js` whenever any cached file changes**. Upload all files as one deployment. `cache.addAll` commits the required assets as a batch; a failed install cannot replace the active release. Caches are named by this app's exact registration scope and version, so another site directory's caches are not deleted.
- This local enhancement bumps the worker from `v1` to `v2` and adds `questions.js` to that atomic batch.
- A new worker waits while any game tab/window is open. There is deliberately no `skipWaiting`, no forced reload and no apply-update button. **Check for updates** is only a check. After an update is ready, finish the round, close every game tab and installed window, then reopen. Only then can the new worker activate and remove this scope's older caches. Background checks do not announce over the child's puzzle; deliberate grown-up button actions have a polite live status.

If the offline copy is incomplete, first revisit online after closing every game window. If that does not repair it, a grown-up can clear this site's stored data in the browser's site settings and revisit online (this also removes preferences and the saved offline copy). On a developer machine, DevTools > Application > Service Workers / Storage can unregister the worker and clear **this app's** data. Do not clear unrelated sites. A maintainer can also publish a new version to trigger a complete fresh precache.

## Developer checks (optional)

The app has no development-tool dependencies at runtime. The browser regression suite uses Node and installed Google Chrome/Edge:

```powershell
npm install --prefix tests
npm test --prefix tests
# Optional online recheck of the official curriculum sources:
npm run curriculum --prefix tests
```

The suite starts and stops its own loopback HTTP server and checks the real app at `/` and `/home/`. It exhaustively validates every bank entry's answer structure, calculation or reviewed scenario fixture, curriculum metadata and official URL allowlist; checks the exact four-area mix, no immediate repeats, optional check-in independence/privacy, success-only celebration, reduced motion, keyboard/touch/reflow, axe, manifests/icons, offline reload/reopening, scope isolation and failed/waiting updates. The ordinary suite needs no external requests. The explicit `curriculum` command additionally checks all 12 identifiers and their scoped meanings against the four live official ACARA datasets; failure is reported rather than silently ignored.

Screenshots are opt-in: set `COSY_SCREENSHOTS` to a directory outside the repository before running tests. No bulk screenshots are written into the repo by default. Browser automation cannot prove educational efficacy, complete curriculum attainment or human screen-reader speech.

To regenerate original Mochi PNGs from the inline SVG: `npm run icons --prefix tests`. The maskable icon keeps the complete artwork inside the central 80%-diameter safe circle with an opaque background. Commit regenerated PNGs and bump the worker version when shipping them.

Automated browser/touch emulation is not a physical Pixel install or a complete screen-reader accessibility audit. Test installation and the family's chosen voice on the actual tablet before relying on them.
