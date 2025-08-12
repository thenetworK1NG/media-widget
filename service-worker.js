// Basic offline-first service worker for PWA
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open('widget-cache').then(function(cache) {
      return cache.addAll([
        './widget.html',
        './widget.js',
        './widget.css',
        './manifest.json',
        './icon-192.png',
        './icon-512.png'
      ]);
    })
  );
});

self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(response) {
      return response || fetch(e.request);
    })
  );
});
