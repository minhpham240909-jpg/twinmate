// Simple service worker for Clerva
// This prevents 404 errors when the browser looks for a service worker

self.addEventListener('install', (event) => {
  console.log('Service worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
  event.waitUntil(clients.claim());
});

// Basic fetch handler - just pass through requests
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
