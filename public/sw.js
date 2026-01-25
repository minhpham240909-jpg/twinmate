// Service Worker for Clerva PWA 2.0
// Enables offline functionality and push notifications

const CACHE_NAME = 'clerva-pwa-v2';
const STATIC_CACHE = 'clerva-static-v2';
const DYNAMIC_CACHE = 'clerva-dynamic-v2';

// SCALABILITY: Cache size limits to prevent storage quota exhaustion
// With 2000-3000 concurrent users, unbounded caches would cause issues
const MAX_DYNAMIC_CACHE_SIZE = 100; // Max items in dynamic cache
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
      .then(async (cache) => {
        console.log('[SW] Caching static assets');
        // Cache each asset individually to avoid failing entire install if one is missing
        const assetsToCache = STATIC_ASSETS.filter(url => !url.includes('/api/'));
        for (const url of assetsToCache) {
          try {
            await cache.add(url);
          } catch (error) {
            console.warn(`[SW] Failed to cache ${url}:`, error.message);
          }
        }
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

// Network first strategy with cache size limits
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      // SCALABILITY: Enforce cache size limits before adding new items
      await enforceCacheLimit(cache);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Network error', { status: 503 });
  }
}

// Cache first strategy with size limits
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      // SCALABILITY: Enforce cache size limits before adding new items
      await enforceCacheLimit(cache);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Asset not available offline', { status: 503 });
  }
}

// SCALABILITY: Enforce cache size limits to prevent storage quota exhaustion
async function enforceCacheLimit(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length >= MAX_DYNAMIC_CACHE_SIZE) {
      // Delete oldest entries (first 10% of cache)
      const toDelete = Math.ceil(keys.length * 0.1);
      const deletePromises = keys.slice(0, toDelete).map(key => cache.delete(key));
      await Promise.all(deletePromises);
      console.log(`[SW] Cache cleanup: removed ${toDelete} old entries`);
    }
  } catch (error) {
    console.warn('[SW] Cache limit enforcement failed:', error);
  }
}

// Network first with offline fallback for pages
async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      // SCALABILITY: Enforce cache size limits before adding new items
      await enforceCacheLimit(cache);
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

    // ==========================================
    // CLERVA GUIDANCE NOTIFICATIONS
    // Calm, specific actions - no emojis, no pressure
    // ==========================================
    
    // Mission ready - today's learning is prepared
    if (data.type === 'MISSION_READY') {
      options.tag = 'mission-ready';
      options.actions = [
        { action: 'start', title: 'Start' },
        { action: 'later', title: 'Later' }
      ];
    }
    // Mission incomplete - user is close to finishing
    else if (data.type === 'MISSION_INCOMPLETE') {
      options.tag = 'mission-incomplete';
      options.actions = [
        { action: 'continue', title: 'Continue' },
        { action: 'later', title: 'Not now' }
      ];
    }
    // User struggled - offer supportive help
    else if (data.type === 'STUCK_HELP') {
      options.tag = 'stuck-help';
      options.actions = [
        { action: 'help', title: 'Yes, help me' },
        { action: 'dismiss', title: 'I\'m okay' }
      ];
    }
    // Spaced repetition review due
    else if (data.type === 'REVIEW_DUE') {
      options.tag = 'review-due';
      options.actions = [
        { action: 'review', title: 'Review' },
        { action: 'later', title: 'Later' }
      ];
    }
    // Test deadline approaching
    else if (data.type === 'TEST_PREP') {
      options.tag = 'test-prep';
      options.actions = [
        { action: 'study', title: 'Study now' },
        { action: 'later', title: 'Later' }
      ];
    }
    // Session completed summary
    else if (data.type === 'SESSION_SUMMARY') {
      options.tag = 'session-summary';
      options.actions = [
        { action: 'view', title: 'View' }
      ];
    }
    // Progress update - close to goal
    else if (data.type === 'PROGRESS_UPDATE') {
      options.tag = 'progress-update';
      options.actions = [
        { action: 'continue', title: 'Keep going' },
        { action: 'later', title: 'Later' }
      ];
    }
    // New user activation nudge
    else if (data.type === 'ACTIVATION_NUDGE') {
      options.tag = 'activation-nudge';
      options.actions = [
        { action: 'open', title: 'Open' }
      ];
    }
    // Admin announcements (rare)
    else if (data.type === 'ANNOUNCEMENT') {
      options.tag = 'announcement';
      options.requireInteraction = true;
      options.actions = [
        { action: 'view', title: 'Read' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
    }
    // Legacy types - minimal support
    else if (data.type === 'MISSION_REMINDER' || data.type === 'AI_SESSION_COMPLETE') {
      options.tag = 'legacy';
      options.actions = [
        { action: 'open', title: 'Open' }
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
    getVapidKey().then((vapidKey) => {
      if (!vapidKey) {
        console.error('[SW] No VAPID key available for subscription change');
        return;
      }
      return self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey
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
      });
    })
  );
});

/**
 * Get VAPID key from cache or memory
 */
async function getVapidKey() {
  // Try memory first
  if (self.VAPID_PUBLIC_KEY) {
    return self.VAPID_PUBLIC_KEY;
  }
  
  // Try to get from cache
  try {
    const cache = await caches.open('clerva-config');
    const response = await cache.match('/vapid-key');
    if (response) {
      const data = await response.json();
      self.VAPID_PUBLIC_KEY = data.key;
      return data.key;
    }
  } catch (error) {
    console.error('[SW] Error getting VAPID key from cache:', error);
  }
  
  // Try to fetch from server
  try {
    const response = await fetch('/api/push/subscribe');
    if (response.ok) {
      const data = await response.json();
      if (data.publicKey) {
        await saveVapidKey(data.publicKey);
        return data.publicKey;
      }
    }
  } catch (error) {
    console.error('[SW] Error fetching VAPID key:', error);
  }
  
  return null;
}

/**
 * Save VAPID key to cache for persistence
 */
async function saveVapidKey(key) {
  self.VAPID_PUBLIC_KEY = key;
  try {
    const cache = await caches.open('clerva-config');
    await cache.put('/vapid-key', new Response(JSON.stringify({ key }), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    console.error('[SW] Error saving VAPID key to cache:', error);
  }
}

// Handle messages from main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SET_VAPID_KEY') {
    // Save to both memory and cache for persistence
    saveVapidKey(event.data.key);
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    caches.open(DYNAMIC_CACHE).then((cache) => {
      cache.addAll(urls);
    });
  }

  if (event.data && event.data.type === 'GET_OFFLINE_QUEUE') {
    // Respond with offline queue from IndexedDB
    getOfflineQueue().then(queue => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage(queue);
      }
    });
  }
});

// Background sync for offline actions (if supported)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-flashcard-progress') {
    event.waitUntil(syncFlashcardProgress());
  } else if (event.tag === 'sync-study-session') {
    event.waitUntil(syncStudySession());
  } else if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});

/**
 * Sync flashcard progress when back online
 */
async function syncFlashcardProgress() {
  try {
    const queue = await getOfflineQueue();
    const flashcardActions = queue.filter(action => action.type.startsWith('flashcard_'));
    
    for (const action of flashcardActions) {
      try {
        const response = await fetch('/api/flashcards/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload),
        });
        
        if (response.ok) {
          await removeFromOfflineQueue(action.id);
        }
      } catch (error) {
        console.error('[SW] Error syncing flashcard:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Error in syncFlashcardProgress:', error);
  }
}

/**
 * Sync study session data when back online
 */
async function syncStudySession() {
  try {
    const queue = await getOfflineQueue();
    const sessionActions = queue.filter(action => action.type.startsWith('session_'));
    
    for (const action of sessionActions) {
      try {
        const response = await fetch('/api/study-sessions/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload),
        });
        
        if (response.ok) {
          await removeFromOfflineQueue(action.id);
        }
      } catch (error) {
        console.error('[SW] Error syncing session:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Error in syncStudySession:', error);
  }
}

/**
 * Generic sync for all offline queue items
 */
async function syncOfflineQueue() {
  try {
    const queue = await getOfflineQueue();
    
    for (const action of queue) {
      try {
        // Determine endpoint based on action type
        let endpoint = '/api/sync';
        if (action.type.startsWith('flashcard_')) {
          endpoint = '/api/flashcards/sync';
        } else if (action.type.startsWith('session_')) {
          endpoint = '/api/study-sessions/sync';
        } else if (action.type.startsWith('progress_')) {
          endpoint = '/api/progress/sync';
        }
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionType: action.type,
            payload: action.payload,
            timestamp: action.timestamp,
          }),
        });
        
        if (response.ok) {
          await removeFromOfflineQueue(action.id);
          // Notify the main app about successful sync
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SYNC_SUCCESS',
                actionId: action.id,
                actionType: action.type,
              });
            });
          });
        }
      } catch (error) {
        console.error('[SW] Error syncing action:', action.type, error);
      }
    }
  } catch (error) {
    console.error('[SW] Error in syncOfflineQueue:', error);
  }
}

/**
 * Get offline queue from IndexedDB or postMessage to client
 */
async function getOfflineQueue() {
  // Try to get from IndexedDB first
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('queue', 'readonly');
    const store = tx.objectStore('queue');
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    // Fallback: request from client
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      return new Promise((resolve) => {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data || []);
        };
        clients[0].postMessage({ type: 'GET_OFFLINE_QUEUE' }, [messageChannel.port2]);
        // Timeout after 5 seconds
        setTimeout(() => resolve([]), 5000);
      });
    }
    return [];
  }
}

/**
 * Remove item from offline queue
 */
async function removeFromOfflineQueue(actionId) {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    store.delete(actionId);
    await tx.done;
  } catch (error) {
    // Notify client to remove item
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'REMOVE_FROM_QUEUE',
        actionId,
      });
    });
  }
}

/**
 * Open IndexedDB for offline storage
 */
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('clerva-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('studySessions')) {
        db.createObjectStore('studySessions', { keyPath: 'id' });
      }
    };
  });
}
