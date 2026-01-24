// Service Worker for Clerva PWA 2.0
// Enables offline functionality and push notifications

const CACHE_NAME = 'clerva-pwa-v2';
const STATIC_CACHE = 'clerva-static-v2';
const DYNAMIC_CACHE = 'clerva-dynamic-v2';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/offline',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
];

// API routes that should use network-first strategy
const API_ROUTES = [
  '/api/ai-partner/',
  '/api/flashcards/',
  '/api/study/',
  '/api/user/',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(url => !url.includes('/api/')));
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => clients.claim())
  );
});

// Fetch event - network-first for API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API routes - network first with cache fallback
  if (API_ROUTES.some(route => url.pathname.startsWith(route))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets - cache first with network fallback
  if (request.destination === 'image' ||
      request.destination === 'style' ||
      request.destination === 'script' ||
      url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages - network first with offline fallback
  if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Default - network first
  event.respondWith(networkFirst(request));
});

// Network first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Network error', { status: 503 });
  }
}

// Cache first strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Asset not available offline', { status: 503 });
  }
}

// Network first with offline fallback for pages
async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return offline page if available
    const offlinePage = await caches.match('/offline');
    if (offlinePage) {
      return offlinePage;
    }
    return new Response('You are offline', {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[SW] Push event but no data');
    return;
  }

  try {
    const data = event.data.json();

    const options = {
      body: data.body || 'You have a new notification',
      icon: data.icon || '/icon-192.png',
      badge: '/badge-72x72.png',
      image: data.image || null,
      tag: data.tag || 'default',
      renotify: data.renotify || false,
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
      vibrate: data.vibrate || [200, 100, 200],
      data: {
        url: data.url || '/dashboard',
        type: data.type || 'default',
        id: data.id || null,
        ...data.data
      },
      actions: data.actions || []
    };

    // Notification type specific actions
    if (data.type === 'STUDY_REMINDER') {
      options.tag = 'study-reminder';
      options.actions = [
        { action: 'start', title: 'Start Studying' },
        { action: 'snooze', title: 'Remind Later' }
      ];
    } else if (data.type === 'STREAK_WARNING') {
      options.tag = 'streak-warning';
      options.requireInteraction = true;
      options.actions = [
        { action: 'study', title: 'Quick Study' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
    } else if (data.type === 'FLASHCARD_REVIEW') {
      options.tag = 'flashcard-review';
      options.actions = [
        { action: 'review', title: 'Review Now' },
        { action: 'later', title: 'Later' }
      ];
    } else if (data.type === 'XP_MILESTONE') {
      options.tag = 'xp-milestone';
      options.actions = [
        { action: 'view', title: 'View Progress' }
      ];
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'Clerva', options)
    );
  } catch (error) {
    console.error('[SW] Error showing notification:', error);

    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Clerva', {
        body: text,
        icon: '/icon-192.png',
        badge: '/badge-72x72.png'
      })
    );
  }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  let targetUrl = '/dashboard';

  // Handle different notification types
  if (data.type === 'STUDY_REMINDER') {
    if (action === 'start') {
      targetUrl = '/ai-partner';
    } else if (action === 'snooze') {
      return; // Just close, app will handle rescheduling
    }
  } else if (data.type === 'STREAK_WARNING') {
    if (action === 'study') {
      targetUrl = '/ai-partner?quick=true';
    } else {
      return;
    }
  } else if (data.type === 'FLASHCARD_REVIEW') {
    if (action === 'review') {
      targetUrl = '/flashcards';
    } else {
      return;
    }
  } else if (data.type === 'XP_MILESTONE') {
    targetUrl = '/profile';
  } else if (data.url) {
    targetUrl = data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  console.log('[SW] Notification closed:', data.type);
});

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.VAPID_PUBLIC_KEY
    })
    .then((subscription) => {
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          oldEndpoint: event.oldSubscription?.endpoint
        })
      });
    })
  );
});

// Handle messages from main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SET_VAPID_KEY') {
    self.VAPID_PUBLIC_KEY = event.data.key;
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    caches.open(DYNAMIC_CACHE).then((cache) => {
      cache.addAll(urls);
    });
  }
});

// Background sync for offline actions (if supported)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-flashcard-progress') {
    event.waitUntil(syncFlashcardProgress());
  } else if (event.tag === 'sync-study-session') {
    event.waitUntil(syncStudySession());
  }
});

async function syncFlashcardProgress() {
  // Will sync offline flashcard progress when back online
  console.log('[SW] Syncing flashcard progress');
}

async function syncStudySession() {
  // Will sync offline study session data when back online
  console.log('[SW] Syncing study session');
}
