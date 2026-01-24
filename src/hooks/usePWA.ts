'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Type for the beforeinstallprompt event (not in standard TypeScript)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

// Extend Window interface
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

export interface PWAState {
  isInstalled: boolean
  isInstallable: boolean
  isIOS: boolean
  isAndroid: boolean
  isStandalone: boolean
  isServiceWorkerReady: boolean
  installPromptOutcome: 'accepted' | 'dismissed' | null
  hasUpdate: boolean
  isUpdating: boolean
}

export interface UsePWAReturn extends PWAState {
  promptInstall: () => Promise<boolean>
  dismissInstallPrompt: () => void
  canShowInstallBanner: boolean
  applyUpdate: () => void
  dismissUpdate: () => void
}

// LocalStorage key for tracking install prompt dismissal
const INSTALL_DISMISSED_KEY = 'pwa_install_dismissed'
const INSTALL_DISMISSED_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Hook for managing PWA installation and service worker
 *
 * Features:
 * - Registers service worker on mount
 * - Captures beforeinstallprompt for triggering install
 * - Detects if running in standalone mode (installed)
 * - Provides platform detection (iOS, Android)
 * - Handles install prompt with user preference memory
 */
export function usePWA(): UsePWAReturn {
  const [state, setState] = useState<PWAState>({
    isInstalled: false,
    isInstallable: false,
    isIOS: false,
    isAndroid: false,
    isStandalone: false,
    isServiceWorkerReady: false,
    installPromptOutcome: null,
    hasUpdate: false,
    isUpdating: false,
  })

  // Store the beforeinstallprompt event for later use
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)

  // Store the waiting service worker for updates
  const waitingWorkerRef = useRef<ServiceWorker | null>(null)

  // Track if install banner was dismissed
  const [installDismissed, setInstallDismissed] = useState(false)

  // Track if update was dismissed
  const [updateDismissed, setUpdateDismissed] = useState(false)

  // FIX: Use ref to track isUpdating state for the controllerchange listener
  const isUpdatingRef = useRef(false)

  // Keep ref in sync with state
  useEffect(() => {
    isUpdatingRef.current = state.isUpdating
  }, [state.isUpdating])

  // Register service worker
  useEffect(() => {
    if (typeof window === 'undefined') return

    // FIX: Track mounted state to prevent state updates after unmount
    let isMounted = true

    const registerServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) {
        console.log('[PWA] Service workers not supported')
        return
      }

      try {
        // Register service worker
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        console.log('[PWA] Service worker registered:', registration.scope)

        // Wait for the service worker to be ready
        await navigator.serviceWorker.ready
        console.log('[PWA] Service worker ready')

        if (!isMounted) return

        setState(prev => ({
          ...prev,
          isServiceWorkerReady: true,
        }))

        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (!isMounted) return
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker is ready, store it and notify user
                waitingWorkerRef.current = newWorker
                setState(prev => ({
                  ...prev,
                  hasUpdate: true,
                }))
              }
            })
          }
        })

        // Check if there's already a waiting worker (e.g., from a previous update)
        if (registration.waiting) {
          waitingWorkerRef.current = registration.waiting
          setState(prev => ({
            ...prev,
            hasUpdate: true,
          }))
        }

        // Listen for controlling service worker changes
        const handleControllerChange = () => {
          // FIX: Use ref to get current isUpdating state
          if (isUpdatingRef.current) {
            window.location.reload()
          }
        }
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
      } catch (error) {
        console.error('[PWA] Service worker registration failed:', error)
      }
    }

    registerServiceWorker()

    return () => {
      isMounted = false
    }
  }, [])

  // Detect platform and install state
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !('MSStream' in window)

    // Detect Android
    const isAndroid = /Android/i.test(navigator.userAgent)

    // Detect if running in standalone mode (installed PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true) ||
      document.referrer.includes('android-app://')

    // Check localStorage for dismissed state
    const dismissedAt = localStorage.getItem(INSTALL_DISMISSED_KEY)
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10)
      const now = Date.now()
      if (now - dismissedTime < INSTALL_DISMISSED_DURATION) {
        setInstallDismissed(true)
      } else {
        localStorage.removeItem(INSTALL_DISMISSED_KEY)
      }
    }

    setState(prev => ({
      ...prev,
      isIOS,
      isAndroid,
      isStandalone,
      isInstalled: isStandalone,
    }))

    // Listen for display mode changes (user installs/uninstalls)
    const displayModeQuery = window.matchMedia('(display-mode: standalone)')
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setState(prev => ({
        ...prev,
        isStandalone: e.matches,
        isInstalled: e.matches,
      }))
    }

    displayModeQuery.addEventListener('change', handleDisplayModeChange)

    return () => {
      displayModeQuery.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  // Capture beforeinstallprompt event
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()

      // Store the event for later use
      deferredPromptRef.current = e

      console.log('[PWA] Install prompt captured')

      setState(prev => ({
        ...prev,
        isInstallable: true,
      }))
    }

    const handleAppInstalled = () => {
      console.log('[PWA] App installed')

      // Clear the deferred prompt
      deferredPromptRef.current = null

      setState(prev => ({
        ...prev,
        isInstalled: true,
        isInstallable: false,
        isStandalone: true,
      }))
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // Trigger the install prompt
  const promptInstall = useCallback(async (): Promise<boolean> => {
    const deferredPrompt = deferredPromptRef.current

    if (!deferredPrompt) {
      console.log('[PWA] No install prompt available')
      return false
    }

    try {
      // Show the install prompt
      await deferredPrompt.prompt()

      // Wait for user choice
      const choiceResult = await deferredPrompt.userChoice

      console.log('[PWA] User choice:', choiceResult.outcome)

      setState(prev => ({
        ...prev,
        installPromptOutcome: choiceResult.outcome,
        isInstallable: choiceResult.outcome !== 'accepted',
      }))

      // Clear the deferred prompt (can only be used once)
      deferredPromptRef.current = null

      return choiceResult.outcome === 'accepted'
    } catch (error) {
      console.error('[PWA] Error showing install prompt:', error)
      return false
    }
  }, [])

  // Dismiss the install banner (won't show for 7 days)
  const dismissInstallPrompt = useCallback(() => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, Date.now().toString())
    setInstallDismissed(true)
  }, [])

  // Apply the waiting service worker update
  const applyUpdate = useCallback(() => {
    const waitingWorker = waitingWorkerRef.current

    if (!waitingWorker) {
      return
    }

    setState(prev => ({
      ...prev,
      isUpdating: true,
    }))

    // Tell the waiting service worker to skip waiting and become active
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }, [])

  // Dismiss the update notification
  const dismissUpdate = useCallback(() => {
    setUpdateDismissed(true)
    setState(prev => ({
      ...prev,
      hasUpdate: false,
    }))
  }, [])

  // Determine if we should show the install banner
  const canShowInstallBanner =
    !state.isInstalled &&
    !state.isStandalone &&
    !installDismissed &&
    (state.isInstallable || state.isIOS) // iOS doesn't fire beforeinstallprompt

  return {
    ...state,
    promptInstall,
    dismissInstallPrompt,
    canShowInstallBanner,
    applyUpdate,
    dismissUpdate,
  }
}

export default usePWA
