'use client'

/**
 * DeferredProviders - Non-critical providers that load AFTER first paint
 *
 * PWA Edition: Simplified to only include essential providers
 * Includes: PWA (service worker), Presence Heartbeat
 *
 * Note: AI Partner FABs removed - feature is hidden but code preserved
 */

import { ReactNode } from 'react'
import { PWAProvider } from '@/contexts/PWAContext'
import PresenceHeartbeatProvider from '@/components/providers/PresenceHeartbeatProvider'

interface DeferredProvidersProps {
  children: ReactNode
}

export default function DeferredProviders({ children }: DeferredProvidersProps) {
  /**
   * PWA: Providers loaded after first paint
   * - PWAProvider: Registers service worker and handles install prompts
   * - PresenceHeartbeatProvider: Tracks user presence for admin dashboard
   */
  return (
    <PWAProvider>
      <PresenceHeartbeatProvider>
        {children}
      </PresenceHeartbeatProvider>
    </PWAProvider>
  )
}
