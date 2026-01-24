'use client'

/**
 * DeferredProviders - Non-critical providers that load AFTER first paint
 *
 * PWA Edition: Simplified to only include essential providers
 * Includes: PWA (service worker), Background Session management
 */

import { ReactNode } from 'react'
import { BackgroundSessionProvider } from '@/lib/session/BackgroundSessionContext'
import { PWAProvider } from '@/contexts/PWAContext'
import PausedSessionFAB from '@/components/ai-partner/PausedSessionFAB'
import CompletedSessionFAB from '@/components/ai-partner/CompletedSessionFAB'

interface DeferredProvidersProps {
  children: ReactNode
}

export default function DeferredProviders({ children }: DeferredProvidersProps) {
  /**
   * PWA: Providers loaded after first paint
   * - PWAProvider: Registers service worker and handles install prompts
   * - BackgroundSessionProvider: AI Partner session management
   */
  return (
    <PWAProvider>
      <BackgroundSessionProvider>
        {children}
        <PausedSessionFAB />
        <CompletedSessionFAB />
      </BackgroundSessionProvider>
    </PWAProvider>
  )
}
