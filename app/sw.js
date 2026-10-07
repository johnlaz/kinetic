// Kinetic Capital service worker
// HTML: network-first (so updates land). Static assets: cache-first. Fonts/TradingView: stale-while-revalidate.
// Live APIs: network-only. Keep VERSION in step with APP_VERSION in index.html.

const VERSION = '8.1.0';
const CACHE = 'kinetic-capital-v' + VERSION;
const RUNTIME = 'kinetic-capital-runtime-v' + VERSION;
const PRECACHE = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'chart.umd.min.js',
  'math.min.js'
];
const RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 's3.tradingview.com'];
const NETWORK_ONLY = ['financialmodelingprep.com', 'api.groq.com', 'api.x.ai'];

self.addEventListener('install', function (event) {
  // addAll is strict on purpose: if a precached file is missing, install fails loudly.
  event.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n !== CACHE && n !== RUNTIME; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) { return hit || caches.match('index.html'); });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || req.url.indexOf('http') !== 0) return;
  var url = new URL(req.url);

  if (NETWORK_ONLY.some(function (h) { return url.hostname.indexOf(h) >= 0; })) {
    event.respondWith(fetch(req).catch(function () {
      return new Response(JSON.stringify({ error: 'Offline: live data unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }));
    return;
  }

  if (RUNTIME_HOSTS.some(function (h) { return url.hostname.indexOf(h) >= 0; })) {
    event.respondWith(caches.open(RUNTIME).then(function (cache) {
      return cache.match(req).then(function (cached) {
        var net = fetch(req).then(function (res) { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(function () { return cached; });
        return cached || net;
      });
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  var isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0;
  if (isHTML) { event.respondWith(networkFirst(req)); return; }

  event.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  }));
});
