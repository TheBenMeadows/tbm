// Offline shell for /experiments/prayers/. Precache everything fixed;
// cache-first with network fallback. Bump VERSION on any asset change —
// tbm releases are deliberate, so a manual version string is fine.
const VERSION = "prayers-v2";
const BASE = "/experiments/prayers/";
const ASSETS = [
    BASE,
    BASE + "morning/",
    BASE + "prayers.css",
    BASE + "theme.js",
    BASE + "app.js",
    BASE + "vendor/pretext.js",
    BASE + "fonts/ebgaramond-var.woff2",
    BASE + "fonts/ebgaramond-italic-var.woff2",
    BASE + "art/header-arch.png",
    BASE + "art/header-gladzor.png",
    BASE + "manifest.webmanifest",
    BASE + "icon-192.png",
    BASE + "icon-512.png",
];

self.addEventListener("install", (e) => {
    e.waitUntil(
        caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (e) => {
    if (e.request.method !== "GET") return;
    e.respondWith(
        caches.match(e.request, { ignoreSearch: true }).then(
            (hit) => hit || fetch(e.request)
        )
    );
});
