// Minimal Service Worker to enable PWA installation
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Simple network-first strategy
  e.respondWith(
    fetch(e.request).catch(() => {
      return new Response("Offline mode not fully supported yet.");
    })
  );
});