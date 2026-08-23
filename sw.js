/* BlightCast service worker — the standalone pages-kit's SW adapted for the
   Nuxt build: makes the hosted app installable and lets it OPEN with no
   signal (last-cached app shell + whatever data is in the browser; weather
   refreshes when connectivity returns).
   Differences from the single-file version: the shell pre-list holds only
   './' (Nuxt's asset names are content-hashed and unknowable here — the
   fetch handler caches them as they're first served), and navigations fall
   back to the cached app root so a deep link still opens offline.
   Update flow (2026-08-23, learned live): navigations are NETWORK-FIRST with
   the cached shell as the offline fallback. The old stale-while-revalidate
   shell was a trap: after a deploy replaced the content-hashed assets, the
   cached OLD shell still loaded but its lazy route chunks were gone from the
   server (and swept from the cache by the new worker) — clicking a header
   tab then silently did nothing. Hashed assets stay cache-first (immutable).
   CACHE is stamped per-deploy by the deploy script so old caches sweep. */
var CACHE = 'blightcast-nuxt-202608231806';
var SHELL = ['./', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('blightcast-nuxt-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   /* weather/station/API calls go straight to the network */
  var isNav = req.mode === 'navigate';
  if (isNav) {
    /* network first: an online open always gets the shell that matches the
       assets currently on the server; the cached copy serves only offline */
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./', copy); });
        }
        return res;
      }).catch(function () { return caches.match('./'); })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(function (cached) {
      var fresh = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || fresh;
    })
  );
});
