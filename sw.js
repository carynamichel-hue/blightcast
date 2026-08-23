/* BlightCast service worker — the standalone pages-kit's SW adapted for the
   Nuxt build: makes the hosted app installable and lets it OPEN with no
   signal (last-cached app shell + whatever data is in the browser; weather
   refreshes when connectivity returns).
   Differences from the single-file version: the shell pre-list holds only
   './' (Nuxt's asset names are content-hashed and unknowable here — the
   fetch handler caches them as they're first served), and navigations fall
   back to the cached app root so a deep link still opens offline.
   Update flow: stale-while-revalidate — a new deploy is picked up in the
   background and shown on the NEXT open. Bump CACHE with each published
   release so old caches get swept. */
var CACHE = 'blightcast-nuxt-202608231756';
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
  e.respondWith(
    caches.match(isNav ? './' : req).then(function (cached) {
      var fresh = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(isNav ? './' : req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || fresh;
    })
  );
});
