/**
 * StudyTrack – sw.js (Service Worker)
 * Cache-first strategy for all app assets so it works fully offline.
 */

const CACHE_NAME = 'studytrack-v4';

// Assets to pre-cache on install
const PRECACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/fallback-sentences.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ── Install: pre-cache app shell ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first, network fallback ──────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept or cache serverless API requests (e.g. /api/daily-sentence)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;

  // For CDN resources (Chart.js) use network-first with cache fallback
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
  );
});
