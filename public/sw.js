// Dhindhora service worker: the studio keeps working on patchy 4G and offline.
// Immutable assets (Next chunks, video fonts, the versioned player, logos) are cache-first.
// Pages are network-first and fall back to the last copy seen, so an open shop still loads offline.
// API calls are never cached: saves queue in IndexedDB and the page retries them.
const SHELL = "dh-shell-v1";
const ASSETS = "dh-assets-v1";
const PRECACHE = ["/", "/f/fonts.json", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const immutable = (p) => p.startsWith("/_next/static/") || p.startsWith("/f/") || p.startsWith("/r/") || p.startsWith("/api/logos/");

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;

  if (immutable(p)) {
    e.respondWith(
      caches.open(ASSETS).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  if (p.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    // one cached copy per page path; the query (?at=booth) only picks a place inside the same page
    const key = new Request(url.origin + p);
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(key, copy)); }
          return res;
        })
        .catch(async () => (await caches.match(key)) || (await caches.match("/")) || Response.error()),
    );
  }
});
