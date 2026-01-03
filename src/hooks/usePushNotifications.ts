'use client'

import { useEffect, useState, useCallback } from 'react'

interface PushSubscriptionState {
  isSupported: boolean
  isSubscribed: boolean
  permission: NotificationPermission
  isLoading: boolean
  error: string | null
}

/**
 * Hook for managing Web Push notification subscriptions
 * Handles service worker registration, push subscription, and server sync
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'default',
    isLoading: true,
    error: null,
  })

  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null)

  // Check support and current state on mount
  useEffect(() => {
    const init = async () => {
      // Check browser support
      if (typeof window === 'undefined') {
        setState(s => ({ ...s, isLoading: false }))
        return
      }

      const notificationSupported = 'Notification' in window
      const serviceWorkerSupported = 'serviceWorker' in navigator
      const pushManagerSupported = 'PushManager' in window

      if (!notificationSupported || !serviceWorkerSupported || !pushManagerSupported) {
        console.log('[PushHooks] Not supported:', {
          notification: notificationSupported,
          serviceWorker: serviceWorkerSupported,
          pushManager: pushManagerSupported
        })
        setState(s => ({
          ...s,
          isSupported: false,
          isLoading: false,
          error: 'Push notifications not supported in this browser',
        }))
        return
      }

      setState(s => ({
        ...s,
        isSupported: true,
        permission: Notification.permission,
      }))

      try {
        // Fetch VAPID public key from server
        console.log('[PushHooks] Fetching VAPID key from /api/push/subscribe...')
        const keyResponse = await fetch('/api/push/subscribe')
        console.log('[PushHooks] VAPID response status:', keyResponse.status)

        if (keyResponse.ok) {
          const data = await keyResponse.json()
          console.log('[PushHooks] VAPID key received:', data.publicKey ? 'yes (length: ' + data.publicKey.length + ')' : 'no')
          setVapidPublicKey(data.publicKey)
        } else if (keyResponse.status === 503) {
          console.log('[PushHooks] Push not configured (503) - VAPID keys missing on server')
          // Push not configured on server
          setState(s => ({
            ...s,
            isLoading: false,
            error: 'Push notifications not configured',
          }))
          return
        } else {
          console.log('[PushHooks] Unexpected response:', keyResponse.status)
        }

        // Register service worker
        console.log('[PushHooks] Registering SW...')
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })
        setRegistration(reg)

        // Wait for service worker to be ready
        console.log('[PushHooks] Waiting for SW ready...')
        await navigator.serviceWorker.ready
        console.log('[PushHooks] SW Ready')

        // Check current subscription
        const subscription = await reg.pushManager.getSubscription()
        console.log('[PushHooks] Initial subscription:', !!subscription)
        setState(s => ({
          ...s,
          isSubscribed: !!subscription,
          isLoading: false,
        }))
      } catch (error) {
        console.error('Error initializing push notifications:', error)
        setState(s => ({
          ...s,
          isLoading: false,
          error: 'Failed to initialize push notifications',
        }))
      }
    }

    init()
  }, [])

  /**
   * Request permission and subscribe to push notifications
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported || !registration || !vapidPublicKey) {
      return false
    }

    setState(s => ({ ...s, isLoading: true, error: null }))

    try {
      // Request notification permission
      const permission = await Notification.requestPermission()
      setState(s => ({ ...s, permission }))

      if (permission !== 'granted') {
        setState(s => ({
          ...s,
          isLoading: false,
          error: 'Notification permission denied',
        }))
        return false
      }

      // Store that permission was asked
      localStorage.setItem('notification_permission_asked', 'true')

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      })

      // Send subscription to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save subscription to server')
      }

      // Send VAPID key to service worker
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SET_VAPID_KEY',
          key: vapidPublicKey,
        })
      }

      setState(s => ({
        ...s,
        isSubscribed: true,
        isLoading: false,
      }))

      return true
    } catch (error) {
      console.error('Error subscribing to push:', error)
      setState(s => ({
        ...s,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to subscribe',
      }))
      return false
    }
  }, [state.isSupported, registration, vapidPublicKey])

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!registration) {
      return false
    }

    setState(s => ({ ...s, isLoading: true, error: null }))

    try {
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // Notify server first
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        }).catch((error) => {
          // Log error but don't fail unsubscribe - server cleanup is non-critical
          console.error('[usePushNotifications] Failed to unsubscribe on server:', error)
        })

        // Unsubscribe locally
        await subscription.unsubscribe()
      }

      setState(s => ({
        ...s,
        isSubscribed: false,
        isLoading: false,
      }))

      return true
    } catch (error) {
      console.error('Error unsubscribing from push:', error)
      setState(s => ({
        ...s,
        isLoading: false,
        error: 'Failed to unsubscribe',
      }))
      return false
    }
  }, [registration])

  /**
   * Check if we should prompt for push notifications
   * Shows prompt if: supported, not subscribed, and permission not denied
   */
  const shouldPrompt = useCallback((): boolean => {
    if (!state.isSupported) return false
    if (state.isSubscribed) return false
    if (state.permission === 'denied') return false
    if (state.isLoading) return false // Don't show while loading

    return true
  }, [state.isSupported, state.isSubscribed, state.permission, state.isLoading])

  return {
    ...state,
    subscribe,
    unsubscribe,
    shouldPrompt,
  }
}

/**
 * Convert base64 VAPID key to Uint8Array for PushManager
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

export default usePushNotifications
