const CACHE_NAME = 'billing-app-v2';

// Precache only same-origin assets. Cross-origin CDN assets can make install fail.
const urlsToCache = [
  'index.html',
  'style.css',
  'script.js',
  'manifest.json'
];

function toScopedRequest(path) {
  return new Request(new URL(path, self.registration.scope).toString(), { cache: 'reload' });
}

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache.map(toScopedRequest));
      })
      .catch(err => {
        console.log('Cache install failed:', err);
      })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Strategy: Network First, fallback to Cache
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Firebase and external API calls (they need network)
  if (event.request.url.includes('firebasedatabase.app') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('firebase')) {
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      const responseToCache = response.clone();
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, responseToCache);
      return response;
    } catch (err) {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      // Offline fallback for navigations
      if (event.request.mode === 'navigate') {
        return caches.match(toScopedRequest('index.html'));
      }
      throw err;
    }
  })());
});

// Background Sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncDataWithServer());
  }
});

function syncDataWithServer() {
  // This will be triggered when connection is restored
  return self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_REQUIRED',
        message: 'Connection restored. Syncing data...'
      });
    });
  });
}
