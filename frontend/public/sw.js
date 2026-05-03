/**
 * HustleAI Service Worker — v2.0.0 (network-first, auto-updating)
 *
 * Key guarantees:
 * 1. HTML and JS bundles use NETWORK-FIRST → users always get the latest code
 *    within seconds of a Vercel deploy, with NO manual cache clearing required.
 * 2. Images / fonts use CACHE-FIRST → fast repeat visits, offline-friendly.
 * 3. API calls (/api/*) bypass the SW entirely → always hit the live backend.
 * 4. Service worker self-updates within 1 minute thanks to
 *    self.skipWaiting() + clients.claim() + 'update on navigation'.
 */

const SW_VERSION = 'hustleai-v4-2026-05-03';
const STATIC_CACHE = `${SW_VERSION}-static`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;

// Minimal app shell — loads offline if user has been here before.
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/assets/images/icon.png',
  '/assets/images/favicon.png',
];

// ─── INSTALL ───────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => null) // don't fail install if any asset 404s
  );
  // Take over as soon as installed — don't wait for old tabs to close
  self.skipWaiting();
});

// ─── ACTIVATE ──────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete every cache that's not from THIS exact version
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      ),
      // Start controlling open pages immediately (no F5 needed)
      self.clients.claim(),
    ])
  );
});

// ─── HELPERS ───────────────────────────────────────────────────────────
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isNavigation(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function isBundleOrScript(url) {
  // Expo/Metro output, any JS, CSS, and source maps → always network-first
  return (
    url.pathname.startsWith('/_expo/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.map') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/sw.js'
  );
}

function isImageOrFont(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf')
  );
}

async function networkFirst(request, cacheName) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const clone = fresh.clone();
      const cache = await caches.open(cacheName);
      cache.put(request, clone).catch(() => {});
    }
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Final fallback for navigation: serve root from cache
    if (isNavigation(request)) {
      const rootCached = await caches.match('/');
      if (rootCached) return rootCached;
    }
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const clone = fresh.clone();
      const cache = await caches.open(cacheName);
      cache.put(request, clone).catch(() => {});
    }
    return fresh;
  } catch (err) {
    // No cached copy and network failed — let the browser show its error
    throw err;
  }
}

// ─── FETCH ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Only handle same-origin; cross-origin (Stripe, Google, etc) → passthrough
  if (url.origin !== self.location.origin) return;

  // API calls → always live network
  if (isApiRequest(url)) return;

  // Navigation → NETWORK-FIRST (users always get the latest HTML)
  if (isNavigation(request)) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  // JS/CSS/manifest → NETWORK-FIRST (critical — old bundles would keep 404s alive)
  if (isBundleOrScript(url)) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  // Images / fonts → CACHE-FIRST (fast repeat visits)
  if (isImageOrFont(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Default for anything else → network-first
  event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

// ─── MESSAGES (for "check for update" button in the app) ───────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── PUSH NOTIFICATIONS ────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'HustleAI', {
        body: data.body || '',
        icon: '/assets/images/icon.png',
        badge: '/assets/images/favicon.png',
        data: data.url || '/',
      })
    );
  } catch (e) { /* ignore malformed payloads */ }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      const url = event.notification.data || '/';
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
