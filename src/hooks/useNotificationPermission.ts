import { useEffect, useState } from 'react'

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    // Check if notifications are supported
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true)
      setPermission(Notification.permission)
    }
  }, [])

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
  }
}
