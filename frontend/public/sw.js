self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
});

self.addEventListener('fetch', (event) => {
  // Pass through all requests, rely on Next.js caching or simple caching strategy later.
  event.respondWith(fetch(event.request));
});
