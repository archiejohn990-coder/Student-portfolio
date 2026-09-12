// Minimal service worker — enables PWA install
const CACHE = "sp-v1";

self.addEventListener("install", (e) => {
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
    // Network-first; don't cache API calls
    if (e.request.url.includes("/api/")) return;
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
