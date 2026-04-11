// Service Worker for Clerva PWA
// Handles push notifications for high-intent lead alerts

const CACHE_NAME = 'clerva-v1'

// Install — minimal caching, app is primarily online
self.addEventListener('install', () => {
  self.skipWaiting()
})

// Activate — claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  )
})

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()

    const options = {
      body: data.body || 'You have a new lead',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'clerva-default',
      renotify: true,
      requireInteraction: data.requireInteraction || false,
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/dashboard',
        leadId: data.data?.leadId || null,
      },
      actions: data.actions || [],
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'Clerva', options)
    )
  } catch (err) {
    console.error('[SW] Error showing notification:', err)
    event.waitUntil(
      self.registration.showNotification('Clerva', {
        body: event.data.text(),
        icon: '/icon-192.png',
      })
    )
  }
})

// Notification click — open or focus the app
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification
  const data = notification.data || {}

  notification.close()

  const targetUrl = data.url || '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing tab if open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl)
            return client.focus()
          }
        }
        // Otherwise open new tab
        return self.clients.openWindow(targetUrl)
      })
  )
})

// Handle push subscription changes — re-subscribe automatically
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.VAPID_PUBLIC_KEY,
    })
    .then((subscription) => {
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          oldEndpoint: event.oldSubscription?.endpoint,
        }),
      })
    })
  )
})

// Accept VAPID key from main app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data?.type === 'SET_VAPID_KEY') {
    self.VAPID_PUBLIC_KEY = event.data.key
  }
})
