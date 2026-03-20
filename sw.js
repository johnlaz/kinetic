// Kinetic Capital PWA — Service Worker
// Cache-first strategy: app works fully offline after first load

const CACHE_NAME = 'kinetic-capital-v1';
const STATIC_ASSETS = [
  '.',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-180.png',
  'chart.umd.min.js',
  'math.min.js'
];

// CDN assets to cache on first fetch
const CDN_CACHE_NAME = 'kinetic-capital-cdn-v1';
const CDN_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  's3.tradingview.com'
];

// API domains — network-only, no caching (live data must be fresh)
const NETWORK_ONLY = [
  'financialmodelingprep.com',
  'api.groq.com',
  'api.x.ai',
  'finnhub.io'
];

// ── INSTALL ────────────────────────────────────────────────────────────────
self.addEventListener('install', function(event) {
  console.log('[SW] Installing Kinetic Capital v1...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW] Caching static assets');
        // Cache what we can, don't fail if something is missing
        return Promise.allSettled(
          STATIC_ASSETS.map(function(url) {
            return cache.add(url).catch(function(err) {
              console.warn('[SW] Could not cache:', url, err.message);
            });
          })
        );
      })
      .then(function() {
        console.log('[SW] Install complete — skipping waiting');
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE ───────────────────────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) {
            // Delete old caches that aren't our current versions
            return name !== CACHE_NAME && name !== CDN_CACHE_NAME;
          })
          .map(function(name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── FETCH ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip browser extensions
  if (!url.startsWith('http')) return;

  // API calls — network only, no caching
  var isAPI = NETWORK_ONLY.some(function(domain) {
    return url.indexOf(domain) >= 0;
  });
  if (isAPI) {
    event.respondWith(
      fetch(event.request).catch(function() {
        // Return a JSON error response if offline
        return new Response(
          JSON.stringify({ error: 'Offline — live market data unavailable' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // CDN assets — cache on first use (stale-while-revalidate)
  var isCDN = CDN_PATTERNS.some(function(pattern) {
    return url.indexOf(pattern) >= 0;
  });
  if (isCDN) {
    event.respondWith(
      caches.open(CDN_CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(cached) {
          var networkFetch = fetch(event.request).then(function(response) {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(function() {
            return cached; // Fall back to cache if network fails
          });
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // App shell — cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // Return cached version immediately, update in background
        var bgFetch = fetch(event.request).then(function(response) {
          if (response.ok) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, response.clone());
            });
          }
          return response;
        }).catch(function() {});
        return cached;
      }
      // Not in cache — fetch from network and cache it
      return fetch(event.request).then(function(response) {
        if (response.ok) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(function() {
        // Offline fallback — return main index
        return caches.match('index.html');
      });
    })
  );
});

// ── PUSH NOTIFICATIONS (future) ────────────────────────────────────────────
self.addEventListener('push', function(event) {
  if (!event.data) return;
  var data = event.data.json();
  self.registration.showNotification(data.title || 'Kinetic Capital', {
    body: data.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'kinetic-capital'
  });
});
