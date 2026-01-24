'use client'

/**
 * PWA Context Provider
 *
 * Provides PWA state and actions to the entire app.
 * Registers the service worker on mount (deferred after first paint).
 * Handles install prompts and provides install state to components.
 */

import { createContext, useContext, ReactNode } from 'react'
import { usePWA, UsePWAReturn } from '@/hooks/usePWA'

// Create context with default values
const PWAContext = createContext<UsePWAReturn | null>(null)

interface PWAProviderProps {
  children: ReactNode
}

export function PWAProvider({ children }: PWAProviderProps) {
  // usePWA handles service worker registration on mount
  const pwaState = usePWA()

  return (
    <PWAContext.Provider value={pwaState}>
      {children}
    </PWAContext.Provider>
  )
}

/**
 * Hook to access PWA context
 * Falls back to direct usePWA hook if used outside provider
 */
export function usePWAContext(): UsePWAReturn {
  const context = useContext(PWAContext)

  if (!context) {
    // If used outside provider, return a default state
    // This allows components to work even if PWA provider isn't mounted
    return {
      isInstalled: false,
      isInstallable: false,
      isIOS: false,
      isAndroid: false,
      isStandalone: false,
      isServiceWorkerReady: false,
      installPromptOutcome: null,
      hasUpdate: false,
      isUpdating: false,
      promptInstall: async () => false,
      dismissInstallPrompt: () => {},
      canShowInstallBanner: false,
      applyUpdate: () => {},
      dismissUpdate: () => {},
    }
  }

  return context
}

export default PWAProvider
