/**
 * TankRate — Service Worker
 * Caches static assets for offline fallback
 */

const CACHE_NAME = "TankRate-v1";
const STATIC_ASSETS = [
  "/",
  "/styles/main.css",
  "/js/main.js",
  "/js/chart.js",
  "/js/calculator.js",
  "/petrol-prices/",
  "/diesel-prices/",
  "/lpg-prices/",
  "/calculator/",
  "/fuel-saving-tips/",
  "/blog/",
  "/about/",
  "/privacy-policy/",
  "/contact/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip cross-origin API calls
  if (url.origin !== self.location.origin) return;

  // Network-first for API calls
  if (url.pathname.startsWith("/functions/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      }).catch(() => {
        if (request.destination === "document") {
          return caches.match("/");
        }
      });
    })
  );
});

// Offline notification
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
