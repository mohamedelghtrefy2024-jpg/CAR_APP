/**
 * ═══════════════════════════════════════════════════════════
 * service-worker.js - Service Worker
 * App Shell | Offline Support | Cache Management
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const CACHE_NAME    = 'fleet-v1.0.0';
const STATIC_CACHE  = 'fleet-static-v1';
const MAP_CACHE     = 'fleet-map-tiles-v1';

/* ── الملفات الأساسية للـ App Shell ── */
const APP_SHELL = [
  './',
  './index.html',
  './css/app.css',
  './css/dashboard.css',
  './js/constants.js',
  './js/security.js',
  './js/storage.js',
  './js/state.js',
  './js/auth.js',
  './js/notifications.js',
  './js/gps.js',
  './js/map.js',
  './js/ui.js',
  './js/drivers.js',
  './js/users.js',
  './js/reports.js',
  './js/offline.js',
  './js/app.js',
  './data/seed.js',
  './components/modal.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500&display=swap',
];

/* ══════════════════════════════════
   Install - تخزين App Shell
   ══════════════════════════════════ */

self.addEventListener('install', (event) => {
  console.info('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Cache install error:', err))
  );
});

/* ══════════════════════════════════
   Activate - تنظيف الكاش القديم
   ══════════════════════════════════ */

self.addEventListener('activate', (event) => {
  console.info('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== MAP_CACHE)
          .map(k => {
            console.info('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      );
    }).then(() => self.clients.claim())
  );
});

/* ══════════════════════════════════
   Fetch - استراتيجية Cache First
   ══════════════════════════════════ */

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Map Tiles - Cache First مع شبكة Fallback
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(_cacheFirst(event.request, MAP_CACHE));
    return;
  }

  // Google Fonts - Cache First
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(_cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // Leaflet CDN - Cache First
  if (url.hostname.includes('unpkg.com')) {
    event.respondWith(_cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // ملفات التطبيق - Cache First مع Network Fallback
  if (url.origin === self.location.origin) {
    event.respondWith(_cacheFirst(event.request, STATIC_CACHE));
    return;
  }
});

/* ══════════════════════════════════
   استراتيجيات الكاش
   ══════════════════════════════════ */

async function _cacheFirst(request, cacheName) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // إرجاع من الكاش كـ fallback نهائي
    const fallback = await caches.match(request);
    if (fallback) return fallback;

    // Offline fallback page
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }

    return new Response('Offline', { status: 503 });
  }
}

/* Background Sync للحفظ الآجل */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-gps') {
    console.info('[SW] Background sync: GPS data');
  }
});
