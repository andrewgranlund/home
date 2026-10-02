(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const base = new URL("./", window.location.href);
  const workerURL = new URL("sw.js", base).href;
  let registration;
  let installPrompt;
  let checkingOffline;
  let installationFailed = false;
  const standalone = window.matchMedia("(display-mode: standalone)");

  function installGuidance() {
    $("install-app").hidden = !installPrompt || standalone.matches;
    $("install-status").textContent = standalone.matches
      ? "You are using the installed game. Offline readiness is checked separately below."
      : "On a Pixel Tablet, open this website in Chrome. Tap the three-dot menu, then Add to Home screen, then Install if offered. On Windows, use Chrome or Edge's install icon or app-install menu. If installation is not offered, you can still use a browser tab.";
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installGuidance();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    $("install-app").hidden = true;
    $("install-status").textContent = "Installed. You can open Cosy Cat Club from your apps. Check the offline message below before disconnecting.";
  });
  standalone.addEventListener("change", installGuidance);
  installGuidance();

  $("install-app").addEventListener("click", async () => {
    const prompt = installPrompt;
    if (!prompt) return;
    installPrompt = null;
    $("install-app").hidden = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      $("app-action-status").textContent = choice.outcome === "accepted"
        ? "Installation requested. Your browser will handle the next step."
        : "No problem. You can keep playing in this browser.";
    } catch (error) {
      $("app-action-status").textContent = "Installation could not be opened. Try your browser's app-install menu instead.";
      console.warn("Could not open installation.", error);
    } finally {
      if ($("grownups").open) $("app-action-status").focus();
    }
  });

  function offlineCheck() {
    if (checkingOffline) return checkingOffline;
    checkingOffline = (async () => {
      const controller = navigator.serviceWorker.controller;
      if (!controller || controller.scriptURL !== workerURL) {
        $("offline-status").textContent = "Offline copy not ready yet. Keep this page open online while setup finishes.";
        return;
      }
      try {
        const result = await new Promise((resolve, reject) => {
          const channel = new MessageChannel();
          const close = () => { channel.port1.close(); channel.port2.close(); };
          const timeout = window.setTimeout(() => {
            close();
            reject(new Error("Offline check timed out."));
          }, 5000);
          channel.port1.onmessage = (event) => {
            window.clearTimeout(timeout);
            close();
            resolve(event.data);
          };
          try {
            controller.postMessage({ type: "CHECK_OFFLINE" }, [channel.port2]);
          } catch (error) {
            window.clearTimeout(timeout);
            close();
            reject(error);
          }
        });
        $("offline-status").textContent = result?.app === "cosy-cat-club" && result.complete === true
          ? `Offline copy ready (${result.version}): all game files are saved in this browser. Try reopening once with Wi-Fi off. Browser storage can still be cleared or removed.`
          : "Offline copy is incomplete. Keep an internet connection. Close all game windows and revisit online; if it persists, see the README recovery steps.";
      } catch (error) {
        $("offline-status").textContent = "Offline readiness could not be verified. Keep an internet connection and try Check offline copy again.";
        console.warn("Could not verify offline readiness.", error);
      }
    })();
    return checkingOffline.finally(() => { checkingOffline = null; });
  }

  function updateStatus() {
    if (registration.waiting && navigator.serviceWorker.controller?.scriptURL === workerURL) {
      $("update-status").textContent = "An update is ready. Finish your round, then close every game tab and installed window and reopen. Nothing will reload automatically.";
    }
  }

  function watchInstallation(worker) {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") {
        updateStatus();
      } else if (worker.state === "activated") {
        if (!registration.waiting) $("update-status").textContent = "Updates never reload your puzzle automatically.";
        offlineCheck();
      } else if (worker.state === "redundant") {
        installationFailed = true;
        $("update-status").textContent = "Setup or an update did not finish. An earlier saved copy may still work. Check offline copy, then try Check for updates when online.";
        offlineCheck();
      }
    });
  }

  async function setup() {
    if (!["http:", "https:"].includes(location.protocol) || !window.isSecureContext) {
      $("offline-status").textContent = "Installation and offline saving need the hosted HTTPS website or a localhost preview. A file or Google Drive preview cannot install this PWA.";
      return;
    }
    if (!("serviceWorker" in navigator)) {
      $("offline-status").textContent = "This browser does not support offline saving here. You can still play while this page is open; use Chrome or Edge for installation.";
      return;
    }
    navigator.serviceWorker.addEventListener("controllerchange", () => { offlineCheck(); });
    try {
      registration = await navigator.serviceWorker.register(workerURL, { scope: base.href, updateViaCache: "none" });
      $("check-offline").hidden = false;
      $("check-updates").hidden = false;
      registration.addEventListener("updatefound", () => {
        installationFailed = false;
        watchInstallation(registration.installing);
      });
      watchInstallation(registration.installing);
      updateStatus();
      await offlineCheck();
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) offlineCheck();
      });
    } catch (error) {
      $("offline-status").textContent = "Offline setup failed or is blocked by this browser. The open game still works. Revisit online in Chrome or Edge and check browser storage permissions.";
      console.warn("Could not set up the offline game.", error);
    }
  }

  $("check-offline").addEventListener("click", async () => {
    await offlineCheck();
    $("app-action-status").textContent = $("offline-status").textContent;
  });
  $("check-updates").addEventListener("click", async () => {
    if (!registration || $("check-updates").getAttribute("aria-disabled") === "true") return;
    $("check-updates").setAttribute("aria-disabled", "true");
    try {
      await registration.update();
      if (registration.waiting) updateStatus();
      else if (!installationFailed) $("update-status").textContent = registration.installing
        ? "An update is downloading. Keep playing; check here later."
        : "Update check finished; no new version was found. Your puzzle has not changed.";
      $("app-action-status").textContent = $("update-status").textContent;
      await offlineCheck();
    } catch (error) {
      $("update-status").textContent = "Could not check for updates. Try again when connected. Your current puzzle has not changed.";
      $("app-action-status").textContent = $("update-status").textContent;
      console.warn("Could not check for updates.", error);
    } finally {
      $("check-updates").removeAttribute("aria-disabled");
    }
  });
  setup();
})();
