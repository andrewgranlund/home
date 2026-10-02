# The Cosy Cat Club

A small, static, installable game for a Pixel Tablet or Windows laptop. Mochi offers one question per round, with 434 questions across two levels, Maths, Patterns and Words, unlimited gentle retries, hints and breaks. A correct answer earns a symbolic ticket to show a grown-up, not a TV lock or parental-control mechanism. The optional finishing message is "All done!".

**These files are local only. Hosting has not been enabled, and nothing has been pushed or published.** No framework, backend, build step or Node installation is needed to run the game.

## Local preview

Keep `index.html`, `pwa.js`, `sw.js`, `manifest.webmanifest` and `icons` together. From this directory, if Python is installed:

```powershell
py -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080/` in Chrome or Edge. Stop the server with Ctrl+C. Any static HTTP server works for a localhost preview. Opening `index.html` directly may run the puzzle, but **file:// cannot install or save this PWA offline**. A tablet opening a laptop's LAN HTTP address does not get the localhost secure-context exception; use an HTTPS host for real tablet installation.

## Hosting later (not yet configured)

After reviewing the files and explicitly choosing to publish:

1. Commit/merge the app files into the repository branch you intend to deploy, then push that branch. Do not publish personal information or secrets.
2. In GitHub, open this repository's **Settings > Pages**. Select **Deploy from a branch**, the branch containing these files (normally `master` after merging), and **/ (root)**. Save. `.nojekyll` allows the static files to be served without Jekyll processing.
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

- The first online visit atomically precaches the HTML, PWA script, manifest and three PNG icons. The service-worker script itself is stored by the browser's service-worker machinery. Nothing is fetched from third-party asset services.
- The worker is cache-first for the two entry points (`./` and `./index.html`, including navigation query strings) and exact listed assets. It does not cache/intercept other routes, cross-origin requests or non-GET requests. A missing cached asset falls back to the network without silently saving a mixed release.
- A cached game can reopen offline without installation. **Check offline copy** verifies the current saved files; browser storage can be evicted or cleared, so no permanent offline guarantee is possible. A missing/incomplete cache is reported, not treated as ready.
- Settings are saved only in this browser, with a visible fallback if storage is blocked. No device sync. Break/resume preserves the current question, choices and hint while the page stays open; a reload or reopening starts a fresh round.
- Read aloud is hidden by default and speaks only after being enabled and clicked. It uses the device/browser speech service, which may use an online voice. There is no automatic audio, timer or score.
- Every release **must change `VERSION` in `sw.js` whenever any cached file changes**. Upload all files as one deployment. `cache.addAll` commits the required assets as a batch; a failed install cannot replace the active release. Caches are named by this app's exact registration scope and version, so another site directory's caches are not deleted.
- A new worker waits while any game tab/window is open. There is deliberately no `skipWaiting`, no forced reload and no apply-update button. **Check for updates** is only a check. After an update is ready, finish the round, close every game tab and installed window, then reopen. Only then can the new worker activate and remove this scope's older caches. Background checks do not announce over the child's puzzle; deliberate grown-up button actions have a polite live status.

If the offline copy is incomplete, first revisit online after closing every game window. If that does not repair it, a grown-up can clear this site's stored data in the browser's site settings and revisit online (this also removes preferences and the saved offline copy). On a developer machine, DevTools > Application > Service Workers / Storage can unregister the worker and clear **this app's** data. Do not clear unrelated sites. A maintainer can also publish a new version to trigger a complete fresh precache.

## Developer checks (optional)

The app has no development-tool dependencies at runtime. The browser regression suite uses Node and installed Google Chrome/Edge:

```powershell
npm install --prefix tests
npm test --prefix tests
```

The suite starts and stops its own loopback HTTP server, checks the real app at `/` and `/home/`, game interactions and question banks, keyboard/touch/reflow, axe checks, manifests/icons, offline reload and reopened browser context, isolated scopes and update/failure behavior. No public hosting is needed. Generated screenshots go to ignored `tests/results`.

To regenerate original Mochi PNGs from the inline SVG: `npm run icons --prefix tests`. The maskable icon keeps the complete artwork inside the central 80%-diameter safe circle with an opaque background. Commit regenerated PNGs and bump the worker version when shipping them.

Automated browser/touch emulation is not a physical Pixel install or a complete screen-reader accessibility audit. Test installation and the family's chosen voice on the actual tablet before relying on them.
