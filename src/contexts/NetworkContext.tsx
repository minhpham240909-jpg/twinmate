'use client'

import React, { createContext, useContext, useEffect, ReactNode } from 'react'
import { useNetworkStatus, UseNetworkStatusReturn } from '@/hooks/useNetworkStatus'
import toast from 'react-hot-toast'

interface NetworkContextType extends UseNetworkStatusReturn {
  // Add any additional network-related utilities here
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

export function NetworkProvider({ children }: { children: ReactNode }) {
  const networkStatus = useNetworkStatus()
  const { isOnline, wasOffline, isSlowConnection } = networkStatus

  // Show toast notifications on network status changes
  useEffect(() => {
    if (wasOffline && isOnline) {
      // Just came back online
      toast.success('Connection restored', {
        icon: '🟢',
        duration: 3000,
        id: 'network-online', // Prevent duplicates
      })
    }
  }, [wasOffline, isOnline])

  useEffect(() => {
    if (!isOnline) {
      // Went offline
      toast.error('You are offline', {
        icon: '🔴',
        duration: 5000,
        id: 'network-offline', // Prevent duplicates
      })
    }
  }, [isOnline])

  // Warn about slow connection
  useEffect(() => {
    if (isOnline && isSlowConnection) {
      toast('Slow connection detected', {
        icon: '⚠️',
        duration: 4000,
        id: 'network-slow',
      })
    }
  }, [isOnline, isSlowConnection])

  return (
    <NetworkContext.Provider value={networkStatus}>
      {children}
    </NetworkContext.Provider>
  )
}

/**
 * Hook to access network status from any component
 * @throws Error if used outside NetworkProvider
 */
export function useNetwork(): NetworkContextType {
  const context = useContext(NetworkContext)
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider')
  }
  return context
}
