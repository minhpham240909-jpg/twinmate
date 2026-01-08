'use client'

/**
 * DeferredProviders - Non-critical providers that load AFTER first paint
 *
 * These providers are important but NOT needed for initial render:
 * - PresenceProvider: User online status (can start after UI shows)
 * - IncomingCallProvider: Call notifications (can wait a moment)
 * - BackgroundSessionProvider: Session persistence (not critical for first paint)
 *
 * By deferring these, we reduce initial load time significantly
 * while still providing full functionality once the app is interactive.
 */

import { useEffect, useState, ReactNode } from 'react'
import { PresenceProvider } from '@/components/presence/PresenceProvider'
import { IncomingCallProvider } from '@/contexts/IncomingCallContext'
import { BackgroundSessionProvider } from '@/lib/session/BackgroundSessionContext'
import IncomingCallModal from '@/components/IncomingCallModal'
import FloatingSessionButton from '@/components/FloatingSessionButton'
import PausedSessionFAB from '@/components/ai-partner/PausedSessionFAB'
import CompletedSessionFAB from '@/components/ai-partner/CompletedSessionFAB'

interface DeferredProvidersProps {
  children: ReactNode
}

// Delay before loading deferred providers (ms)
// This ensures the main UI renders first
const DEFER_DELAY_MS = 100

export default function DeferredProviders({ children }: DeferredProvidersProps) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Use requestIdleCallback if available for better performance
    // Falls back to setTimeout for browsers that don't support it
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        const idleCallbackId = window.requestIdleCallback(
          () => setIsReady(true),
          { timeout: DEFER_DELAY_MS * 3 } // Max wait time
        )
        return () => window.cancelIdleCallback(idleCallbackId)
      } else {
        // Fallback for Safari and older browsers
        const timeoutId = setTimeout(() => setIsReady(true), DEFER_DELAY_MS)
        return () => clearTimeout(timeoutId)
      }
    }
  }, [])

  // Before deferred providers are ready, just render children
  // This ensures the main UI appears immediately
  if (!isReady) {
    return <>{children}</>
  }

  // Once ready, wrap children with deferred providers
  return (
    <PresenceProvider>
      <BackgroundSessionProvider>
        <IncomingCallProvider>
          {children}
          <FloatingSessionButton />
          <PausedSessionFAB />
          <CompletedSessionFAB />
          <IncomingCallModal />
        </IncomingCallProvider>
      </BackgroundSessionProvider>
    </PresenceProvider>
  )
}
