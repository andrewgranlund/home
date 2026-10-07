"use strict";

// Bump VERSION whenever any precached file changes. Never reuse a released version.
const VERSION = "v2";
const PREFIX = `cosy-cat-club:${self.registration.scope}:`;
const CACHE = `${PREFIX}${VERSION}`;
const ASSETS = [
  "./index.html",
  "./questions.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./icons/cat-192.png",
  "./icons/cat-512.png",
  "./icons/cat-maskable-512.png"
].map((path) => new URL(path, self.registration.scope).href);
const ENTRY = new URL("./", self.registration.scope).href;
const INDEX = ASSETS[0];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      // addAll commits the whole batch or none of it; bypass the HTTP cache.
      await cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" })));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
    // No skipWaiting: existing questions and other open game windows stay untouched.
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const canonical = `${url.origin}${url.pathname}`;
  const navigation = request.mode === "navigate" && (canonical === ENTRY || canonical === INDEX);
  const asset = !url.search && ASSETS.includes(canonical);
  if (!navigation && !asset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(navigation ? INDEX : canonical);
    if (saved) return saved;
    // Do not silently create a partial or mixed-version offline copy.
    return fetch(request);
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CHECK_OFFLINE" || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      const entries = await Promise.all(ASSETS.map((url) => cache.match(url)));
      event.ports[0].postMessage({
        app: "cosy-cat-club", version: VERSION,
        complete: entries.every((response) => response?.ok)
      });
    } catch (error) {
      console.warn("Could not inspect the offline copy.", error);
      event.ports[0].postMessage({ app: "cosy-cat-club", version: VERSION, complete: false });
    }
  })());
});
