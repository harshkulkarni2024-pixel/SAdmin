// A unique name for the cache
const CACHE_NAME = 'item-ai-cache-v1.8';

// On install, activate the new service worker immediately.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// On activate, clean up any old caches and take control of uncontrolled clients.
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Delete old caches
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of the page
  );
});

// On fetch, serve from cache if available, otherwise fetch from network and update cache.
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  // For navigation requests (the HTML page itself), use a network-first strategy.
  // This ensures users always get the latest version of the app shell if they are online.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If the network fails, serve the root from cache if it exists.
        return caches.match('/'); 
      })
    );
    return;
  }

  // For all other requests (JS, CSS, images, fonts), use a cache-first strategy.
  // This makes the app load instantly on subsequent visits.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // If a cached response is found, return it.
      if (cachedResponse) {
        return cachedResponse;
      }

      // Otherwise, fetch from the network.
      return fetch(event.request).then((networkResponse) => {
        // If the request is successful, clone the response and cache it.
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
