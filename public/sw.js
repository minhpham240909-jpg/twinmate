// Service Worker for Web Push Notifications
// This enables notifications even when the app is closed

const CACHE_NAME = 'clerva-v1';

// Install event - activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push event but no data');
    return;
  }

  try {
    const data = event.data.json();

    const options = {
      body: data.body || 'You have a new notification',
      icon: data.icon || '/icon-192x192.png',
      badge: '/badge-72x72.png',
      image: data.image || null,
      tag: data.tag || 'default',
      renotify: data.renotify || false,
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
      vibrate: data.vibrate || [200, 100, 200],
      data: {
        url: data.url || '/',
        type: data.type || 'default',
        id: data.id || null,
        ...data.data
      },
      actions: data.actions || []
    };

    // Add action buttons based on notification type
    if (data.type === 'INCOMING_CALL') {
      options.requireInteraction = true;
      options.tag = 'incoming-call-' + data.id;
      options.actions = [
        { action: 'answer', title: 'Answer', icon: '/icons/call-answer.png' },
        { action: 'decline', title: 'Decline', icon: '/icons/call-decline.png' }
      ];
      options.vibrate = [300, 100, 300, 100, 300];
    } else if (data.type === 'NEW_MESSAGE') {
      options.tag = 'message-' + data.conversationId;
      options.renotify = true;
      options.actions = [
        { action: 'reply', title: 'Reply' },
        { action: 'mark-read', title: 'Mark as Read' }
      ];
    } else if (data.type === 'CONNECTION_REQUEST') {
      options.tag = 'connection-' + data.id;
      options.actions = [
        { action: 'accept', title: 'Accept' },
        { action: 'view', title: 'View Profile' }
      ];
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'Clerva', options)
    );
  } catch (error) {
    console.error('Error showing notification:', error);

    // Fallback for plain text push
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Clerva', {
        body: text,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png'
      })
    );
  }
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  let targetUrl = '/';

  // Handle different notification types and actions
  if (data.type === 'INCOMING_CALL') {
    if (action === 'answer') {
      targetUrl = data.url || `/study-sessions/${data.sessionId}/call`;
    } else if (action === 'decline') {
      // Just close the notification, maybe send decline API call
      return;
    } else {
      targetUrl = data.url || `/study-sessions/${data.sessionId}/lobby`;
    }
  } else if (data.type === 'NEW_MESSAGE') {
    if (action === 'reply') {
      targetUrl = data.url || `/chat/${data.conversationType}s`;
    } else if (action === 'mark-read') {
      // Could send API call to mark as read
      return;
    } else {
      targetUrl = data.url || '/chat';
    }
  } else if (data.type === 'CONNECTION_REQUEST') {
    if (action === 'accept') {
      targetUrl = '/connections?action=accept&id=' + data.id;
    } else {
      targetUrl = data.url || '/connections';
    }
  } else if (data.type === 'POST_LIKE' || data.type === 'POST_COMMENT') {
    targetUrl = data.url || '/community';
  } else if (data.type === 'SESSION_INVITE') {
    targetUrl = data.url || '/study-sessions';
  } else if (data.type === 'GROUP_INVITE') {
    targetUrl = data.url || '/groups';
  } else {
    targetUrl = data.url || '/dashboard';
  }

  // Focus existing window or open new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            // Navigate existing window
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Open new window if none exists
        return clients.openWindow(targetUrl);
      })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};

  // Track notification dismissal if needed
  if (data.type === 'INCOMING_CALL') {
    // Could send API call to notify caller that notification was dismissed
    console.log('Call notification dismissed');
  }
});

// Handle push subscription change (browser may revoke subscription)
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.VAPID_PUBLIC_KEY
    })
    .then((subscription) => {
      // Send new subscription to server
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

// Message event - receive messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SET_VAPID_KEY') {
    self.VAPID_PUBLIC_KEY = event.data.key;
  }
});

// No-op fetch handler - just pass through all requests
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
