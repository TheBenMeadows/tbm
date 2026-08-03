// Offline shell for /experiments/prayers/. Precache everything fixed;
// cache-first with network fallback. Bump VERSION on any asset change —
// tbm releases are deliberate, so a manual version string is fine.
const VERSION = "prayers-v5";
const BASE = "/experiments/prayers/";
const ASSETS = [
    BASE,
    BASE + "morning/",
    BASE + "morning/daybreak/",
    BASE + "hours/",
    BASE + "psalter/",
    BASE + "psalter/kathisma-1/",
    BASE + "psalter/kathisma-2/",
    BASE + "psalter/kathisma-3/",
    BASE + "psalter/kathisma-4/",
    BASE + "psalter/kathisma-5/",
    BASE + "psalter/kathisma-6/",
    BASE + "psalter/kathisma-7/",
    BASE + "psalter/kathisma-8/",
    BASE + "psalter/kathisma-9/",
    BASE + "psalter/kathisma-10/",
    BASE + "psalter/kathisma-11/",
    BASE + "psalter/kathisma-12/",
    BASE + "psalter/kathisma-13/",
    BASE + "psalter/kathisma-14/",
    BASE + "psalter/kathisma-15/",
    BASE + "psalter/kathisma-16/",
    BASE + "psalter/kathisma-17/",
    BASE + "psalter/kathisma-18/",
    BASE + "psalter/kathisma-19/",
    BASE + "psalter/kathisma-20/",
    BASE + "prayers.css",
    BASE + "theme.js",
    BASE + "app.js",
    BASE + "vendor/pretext.js",
    BASE + "fonts/ebgaramond-var.woff2",
    BASE + "fonts/ebgaramond-italic-var.woff2",
    BASE + "art/bars/bar2.svg",
    BASE + "art/bars/bar8.svg",
    BASE + "art/bars/bar12.svg",
    BASE + "art/bars/bar13.svg",
    BASE + "art/bars/bar19.svg",
    BASE + "art/bars/bar20.svg",
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
