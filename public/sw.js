const CACHE_NAME = "riftsync-pwa-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./site.webmanifest",
  "./favicon.svg",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-icon-512.png",
];

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function isDocsRequest(request) {
  const docsPath = new URL("./docs/", self.registration.scope).pathname;

  return new URL(request.url).pathname.startsWith(docsPath);
}

async function putInCache(request, response) {
  if (!response || !response.ok || response.type === "opaque") {
    return;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.filter((cacheName) => cacheName !== CACHE_NAME).map((cacheName) => caches.delete(cacheName))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || !isSameOrigin(request)) {
    return;
  }

  if (isDocsRequest(request)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          void putInCache("./index.html", response);
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match("./index.html")) ?? caches.match("./")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkResponse = fetch(request)
        .then((response) => {
          void putInCache(request, response);
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse ?? networkResponse;
    }),
  );
});
