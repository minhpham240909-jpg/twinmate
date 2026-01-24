'use client'

/**
 * DeferredProviders - Non-critical providers that load AFTER first paint
 *
 * PWA Edition: Simplified to only include essential providers
 * Removed: Presence, IncomingCall, FloatingSession (not needed for PWA)
 */

import { ReactNode } from 'react'
import { BackgroundSessionProvider } from '@/lib/session/BackgroundSessionContext'
import PausedSessionFAB from '@/components/ai-partner/PausedSessionFAB'
import CompletedSessionFAB from '@/components/ai-partner/CompletedSessionFAB'

interface DeferredProvidersProps {
  children: ReactNode
}

export default function DeferredProviders({ children }: DeferredProvidersProps) {
  /**
   * PWA: Simplified providers - only keeping AI Partner session management
   */
  return (
    <BackgroundSessionProvider>
      {children}
      <PausedSessionFAB />
      <CompletedSessionFAB />
    </BackgroundSessionProvider>
  )
}
