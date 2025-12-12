import { useEffect, useState, useCallback } from 'react'

// H14 FIX: Token refresh interval (24 hours)
const TOKEN_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000
// H14 FIX: Key for storing last token refresh timestamp
const TOKEN_REFRESH_KEY = 'push_token_last_refresh'
const TOKEN_KEY = 'push_notification_token'

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // H14 FIX: Check if token needs refresh
  const tokenNeedsRefresh = useCallback((): boolean => {
    if (typeof window === 'undefined') return false
    
    const lastRefresh = localStorage.getItem(TOKEN_REFRESH_KEY)
    if (!lastRefresh) return true
    
    const lastRefreshTime = parseInt(lastRefresh, 10)
    const timeSinceRefresh = Date.now() - lastRefreshTime
    
    return timeSinceRefresh > TOKEN_REFRESH_INTERVAL_MS
  }, [])

  // H14 FIX: Refresh push notification token
  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (!isSupported || permission !== 'granted') {
      return null
    }
    
    if (isRefreshing) {
      return null
    }
    
    setIsRefreshing(true)
    
    try {
      // Check if service worker and push manager are available
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('[Push] Push not supported in this browser')
        return null
      }
      
      const registration = await navigator.serviceWorker.ready
      
      // Get new push subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })
      
      if (subscription) {
        const token = JSON.stringify(subscription)
        
        // Store token and update refresh timestamp
        localStorage.setItem(TOKEN_KEY, token)
        localStorage.setItem(TOKEN_REFRESH_KEY, Date.now().toString())
        
        // Send new token to server
        try {
          await fetch('/api/push/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription }),
          })
          console.log('[Push] Token refreshed and registered successfully')
        } catch (error) {
          console.error('[Push] Failed to register token with server:', error)
        }
        
        return token
      }
      
      return null
    } catch (error) {
      console.error('[Push] Error refreshing token:', error)
      return null
    } finally {
      setIsRefreshing(false)
    }
  }, [isSupported, permission, isRefreshing])

  useEffect(() => {
    // Check if notifications are supported
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true)
      setPermission(Notification.permission)
      
      // H14 FIX: Refresh token on app launch if permission is granted and token is stale
      if (Notification.permission === 'granted' && tokenNeedsRefresh()) {
        console.log('[Push] Token stale, refreshing on app launch...')
        refreshToken()
      }
    }
  }, [tokenNeedsRefresh, refreshToken])

  // H14 FIX: Periodic token validation
  useEffect(() => {
    if (!isSupported || permission !== 'granted') {
      return
    }
    
    // Check token freshness every hour
    const checkInterval = setInterval(() => {
      if (tokenNeedsRefresh()) {
        console.log('[Push] Scheduled token refresh')
        refreshToken()
      }
    }, 60 * 60 * 1000) // Check every hour
    
    return () => clearInterval(checkInterval)
  }, [isSupported, permission, tokenNeedsRefresh, refreshToken])

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      console.log('Notifications not supported')
      return false
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result === 'granted') {
        // Store that user has been asked
        localStorage.setItem('notification_permission_asked', 'true')
        
        // H14 FIX: Immediately get and register token when permission is granted
        await refreshToken()
        
        return true
      }
      return false
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return false
    }
  }

  const hasBeenAsked = (): boolean => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('notification_permission_asked') === 'true'
  }

  return {
    permission,
    isSupported,
    requestPermission,
    hasBeenAsked,
    isGranted: permission === 'granted',
    // H14 FIX: Expose token refresh functionality
    refreshToken,
    isRefreshing,
    tokenNeedsRefresh: tokenNeedsRefresh(),
  }
}
