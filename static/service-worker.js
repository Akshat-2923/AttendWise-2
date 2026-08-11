/**
 * AttendWise Service Worker
 * 
 * Strategy:
 *   - Static assets (CSS, JS, fonts, icons): Cache-first (fast loads)
 *   - HTML pages: Network-first (always fresh when online, cached fallback offline)
 *   - API calls: Network-first (live data when online, cached fallback offline)
 */

const CACHE_VERSION = 'attendwise-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/static/images/icon-192.png',
  '/static/images/icon-512.png',
];

// ── Install: pre-cache static assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategy ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Chrome extension requests
  if (!url.protocol.startsWith('http')) return;

  // Static assets: Cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // External resources (fonts, CDN scripts): Cache-first
  if (url.origin !== location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API calls and HTML pages: Network-first
  event.respondWith(networkFirst(request));
});

// ── Helpers ──

function isStaticAsset(url) {
  return url.pathname.startsWith('/static/');
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline and not in cache
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline — try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // If it's a page request, return a simple offline page
    if (request.headers.get('Accept')?.includes('text/html')) {
      return new Response(
        `<!DOCTYPE html>
        <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>AttendWise — Offline</title>
        <style>
          body{background:#0d0f14;color:#e4e6f0;font-family:'Inter',sans-serif;display:flex;align-items:center;
          justify-content:center;min-height:100vh;text-align:center;padding:20px}
          h1{font-size:20px;margin-bottom:12px;color:#4f6ef7}
          p{color:#6b7191;font-size:14px}
          button{margin-top:20px;padding:10px 24px;border:1px solid #2e3347;background:#13161d;color:#e4e6f0;
          border-radius:8px;cursor:pointer;font-size:13px}
          button:hover{border-color:#4f6ef7}
        </style></head><body>
        <div><h1>You're Offline</h1><p>AttendWise needs an internet connection to fetch live attendance data.</p>
        <button onclick="location.reload()">Try Again</button></div></body></html>`,
        { status: 503, headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
