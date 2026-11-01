// Makes Quiver open offline. Prompts are never cached here: they live in the
// user's folder, and this only stores the app's own files.

// scripts/stamp-sw.mjs fills these two lines in after each build, because the
// build's file names are hashed and can't be known when this file is written.
const BUILD = "unstamped";
const PRECACHE = [];

const CACHE_PREFIX = "quiver-";
const CACHE = `${CACHE_PREFIX}${BUILD}`;
const SCOPE = self.registration.scope;
const HOME = new URL("./", SCOPE).href;

// A connection that hangs shouldn't hold up opening the app.
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // "reload" skips the HTTP cache, so a stale response can't be stored here.
      await cache.addAll(PRECACHE.map((path) => new Request(path, { cache: "reload" })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

  try {
    const response = await fetch(request, { signal: controller.signal });
    if (response.ok && request.url.split(/[?#]/)[0] === HOME) {
      await cache.put(HOME, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(HOME)) ?? Response.error();
  } finally {
    clearTimeout(timer);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  // The favicon's URL carries a build hash, so the query string has to be ignored.
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(SCOPE)) return;

  event.respondWith(request.mode === "navigate" ? networkFirst(request) : cacheFirst(request));
});
