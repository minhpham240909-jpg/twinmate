// Minimal service worker to prevent 404 errors
// This file exists to satisfy browser requests for a service worker

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim clients to become active immediately
  event.waitUntil(clients.claim());
});

// No-op fetch handler - just pass through all requests
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
