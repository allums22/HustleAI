// HustleAI Service Worker — v1.1.0 (icon refresh)
// Gives installability + basic offline shell + cache-first assets

const CACHE_NAME = 'hustleai-v2';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/assets/images/icon.png?v=2',
  '/assets/images/favicon.png?v=2',
];

// Install — precache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => null))
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first for API, cache first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls — always go network
  if (url.pathname.startsWith('/api/')) {
    return; // let browser handle normally
  }

  // For other GETs — cache-first with network fallback
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Cache successful responses for static assets
          if (
            response.ok &&
            (url.pathname.includes('/assets/') ||
              url.pathname.endsWith('.js') ||
              url.pathname.endsWith('.css') ||
              url.pathname.endsWith('.png') ||
              url.pathname.endsWith('.jpg') ||
              url.pathname.endsWith('.svg'))
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback — return cached root for navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
    })
  );
});

// Push notification handler (for future use)
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
  } catch (e) {}
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
