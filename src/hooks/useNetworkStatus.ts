'use client'

import { useState, useEffect, useCallback } from 'react'

// Check if we're in production (disable verbose logging)
const isProduction = process.env.NODE_ENV === 'production'

export interface NetworkStatus {
  isOnline: boolean
  isSlowConnection: boolean
  effectiveType?: string // '4g', '3g', '2g', 'slow-2g'
  downlink?: number // Mbps
  rtt?: number // Round-trip time in ms
  saveData?: boolean
}

export interface UseNetworkStatusReturn extends NetworkStatus {
  wasOffline: boolean // Track if user was offline (for recovery detection)
}

// Check if Network Information API is available
const hasNetworkInfo = typeof navigator !== 'undefined' && 'connection' in navigator

/**
 * Hook to monitor network status including online/offline and connection quality
 * Listens to browser online/offline events and Network Information API
 */
export function useNetworkStatus(): UseNetworkStatusReturn {
  // Always start as true (online) to ensure server/client match during hydration
  const [isOnline, setIsOnline] = useState(true)
  
  const [wasOffline, setWasOffline] = useState(false)
  
  const [connectionInfo, setConnectionInfo] = useState<Omit<NetworkStatus, 'isOnline'>>({
    isSlowConnection: false,
    effectiveType: undefined,
    downlink: undefined,
    rtt: undefined,
    saveData: false,
  })

  // Update connection info from Network Information API
  const updateConnectionInfo = useCallback(() => {
    if (!hasNetworkInfo) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connection = (navigator as any).connection || 
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (navigator as any).mozConnection || 
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (navigator as any).webkitConnection

      if (connection) {
        const effectiveType = connection.effectiveType || '4g'
        const downlink = connection.downlink
        const rtt = connection.rtt
        const saveData = connection.saveData || false

        // Determine if connection is slow
        // Consider slow if: 2g, slow-2g, or 3g with high RTT
        const isSlowConnection = 
          effectiveType === '2g' || 
          effectiveType === 'slow-2g' ||
          (effectiveType === '3g' && rtt > 400) ||
          rtt > 1000

        setConnectionInfo({
          isSlowConnection,
          effectiveType,
          downlink,
          rtt,
          saveData,
        })
      }
    } catch (error) {
      if (!isProduction) {
        console.error('[Network Status] Error reading connection info:', error)
      }
    }
  }, [])

  // Handle online event
  const handleOnline = useCallback(() => {
    setIsOnline(true)
    setWasOffline(true) // Mark that we recovered from offline
    updateConnectionInfo()
    
    // Reset wasOffline flag after a delay so components can react
    setTimeout(() => {
      setWasOffline(false)
    }, 5000)
  }, [updateConnectionInfo])

  // Handle offline event
  const handleOffline = useCallback(() => {
    setIsOnline(false)
    setConnectionInfo(prev => ({
      ...prev,
      isSlowConnection: true, // Treat offline as "slow" for UI purposes
    }))
  }, [])

  // Set up event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Add online/offline listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Add Network Information API listeners if available
    if (hasNetworkInfo) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const connection = (navigator as any).connection || 
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (navigator as any).mozConnection || 
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (navigator as any).webkitConnection

        if (connection) {
          connection.addEventListener('change', updateConnectionInfo)
        }
      } catch (error) {
        if (!isProduction) {
          console.error('[Network Status] Error setting up connection listener:', error)
        }
      }
    }

    // Initial connection info check
    updateConnectionInfo()

    // Sync initial online status
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine)
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)

      if (hasNetworkInfo) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const connection = (navigator as any).connection || 
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (navigator as any).mozConnection || 
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (navigator as any).webkitConnection

          if (connection) {
            connection.removeEventListener('change', updateConnectionInfo)
          }
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }, [handleOnline, handleOffline, updateConnectionInfo])

  // Periodic online check (fallback for browsers that don't fire events reliably)
  // OPTIMIZATION: Increased interval to reduce CPU usage
  useEffect(() => {
    const interval = setInterval(() => {
      const currentOnlineStatus = navigator.onLine
      if (currentOnlineStatus !== isOnline) {
        if (currentOnlineStatus) {
          handleOnline()
        } else {
          handleOffline()
        }
      }
    }, 10000) // Check every 10 seconds (reduced from 5s)

    return () => clearInterval(interval)
  }, [isOnline, handleOnline, handleOffline])

  return {
    isOnline,
    wasOffline,
    ...connectionInfo,
  }
}
