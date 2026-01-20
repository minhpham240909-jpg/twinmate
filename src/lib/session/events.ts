/**
 * Session Events - Centralized session state management
 *
 * Provides utilities for:
 * - Broadcasting session end events across components
 * - Invalidating React Query caches
 * - Clearing localStorage caches
 *
 * This ensures consistent session state across:
 * - StartStudyingCTA (dashboard main CTA)
 * - SoloStudyCard (dashboard solo study card)
 * - DashboardAIWidget (AI partner widget)
 * - Quick Session components
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Debounced event dispatching to prevent rapid-fire updates
 * - Parallel cache invalidation
 * - Error-resilient localStorage operations
 */

import type { QueryClient } from '@tanstack/react-query'

// Custom event name for session end
export const SESSION_END_EVENT = 'clerva:session:end'

// LocalStorage cache keys that need clearing on session end
const SESSION_CACHE_KEYS = [
  'aipartner_currentSession',
  'aipartner_showWidget',
  'aipartner_stats',
  'aipartner_lastSession',
  'solo_study_active_session',
] as const

// React Query keys that need invalidating on session end
const SESSION_QUERY_KEYS = [
  'sessionData',
  'focusStats',
  'userStats',
  'dashboardCounts',
] as const

export type SessionType = 'solo_study' | 'quick_focus' | 'ai_partner'

export interface SessionEndEventDetail {
  sessionId?: string
  sessionType?: SessionType
  reason?: 'completed' | 'ended_early' | 'deleted'
}

// Debounce state to prevent rapid-fire events
let lastEventTime = 0
const EVENT_DEBOUNCE_MS = 100

/**
 * Dispatch a session end event to notify all components
 * Debounced to prevent multiple rapid dispatches
 */
export function dispatchSessionEndEvent(detail?: SessionEndEventDetail): void {
  if (typeof window === 'undefined') return

  // Debounce rapid-fire events
  const now = Date.now()
  if (now - lastEventTime < EVENT_DEBOUNCE_MS) {
    return
  }
  lastEventTime = now

  const event = new CustomEvent(SESSION_END_EVENT, {
    detail: detail || {},
    bubbles: true,
  })
  window.dispatchEvent(event)
}

/**
 * Subscribe to session end events
 * Returns a cleanup function
 * 
 * NOTE: Callback is debounced internally to prevent multiple rapid calls
 */
export function subscribeToSessionEnd(
  callback: (detail: SessionEndEventDetail) => void
): () => void {
  if (typeof window === 'undefined') return () => {}

  // Debounce the callback to prevent multiple rapid executions
  let lastCallTime = 0
  const CALLBACK_DEBOUNCE_MS = 100

  const handler = (event: Event) => {
    const now = Date.now()
    if (now - lastCallTime < CALLBACK_DEBOUNCE_MS) {
      return
    }
    lastCallTime = now

    const customEvent = event as CustomEvent<SessionEndEventDetail>
    try {
      callback(customEvent.detail || {})
    } catch (error) {
      console.error('[Session Events] Error in callback:', error)
    }
  }

  window.addEventListener(SESSION_END_EVENT, handler)
  return () => window.removeEventListener(SESSION_END_EVENT, handler)
}

/**
 * Clear all session-related localStorage caches
 * Error-resilient - continues even if individual keys fail
 */
export function clearSessionLocalStorage(): void {
  if (typeof window === 'undefined') return

  for (const key of SESSION_CACHE_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Ignore storage errors (quota exceeded, private browsing, etc.)
    }
  }
}

/**
 * Invalidate all session-related React Query caches
 * This forces a refetch of fresh data from the server
 * Error-resilient - continues even if individual invalidations fail
 */
export async function invalidateSessionQueries(
  queryClient: QueryClient
): Promise<void> {
  // Invalidate all session-related queries in parallel
  // Use allSettled to ensure all complete even if some fail
  const results = await Promise.allSettled(
    SESSION_QUERY_KEYS.map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] })
    )
  )

  // Log any failures for debugging (don't throw)
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`[Session Events] Failed to invalidate ${SESSION_QUERY_KEYS[index]}:`, result.reason)
    }
  })
}

/**
 * Complete session end handler - clears all caches and notifies components
 *
 * Call this when:
 * - User ends a session from the dashboard
 * - Session completes naturally
 * - Session is deleted
 *
 * @param queryClient - React Query client for cache invalidation
 * @param detail - Optional details about the session that ended
 */
export async function handleSessionEnd(
  queryClient: QueryClient,
  detail?: SessionEndEventDetail
): Promise<void> {
  try {
    // 1. Clear localStorage caches immediately (sync, fast)
    clearSessionLocalStorage()

    // 2. Invalidate React Query caches (async, forces refetch)
    await invalidateSessionQueries(queryClient)

    // 3. Dispatch event to notify other components
    dispatchSessionEndEvent(detail)
  } catch (error) {
    // Log but don't throw - session end should be resilient
    console.error('[Session Events] Error in handleSessionEnd:', error)
    // Still dispatch the event even if cache invalidation fails
    dispatchSessionEndEvent(detail)
  }
}

/**
 * Force refresh session data without clearing all caches
 * Use this for softer updates (e.g., pause/resume)
 */
export async function refreshSessionData(
  queryClient: QueryClient
): Promise<void> {
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: ['sessionData'] }),
    queryClient.invalidateQueries({ queryKey: ['focusStats'] }),
  ])
}
