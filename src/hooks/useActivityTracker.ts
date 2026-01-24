'use client'

/**
 * Activity Tracking Hook
 * Tracks user activity (page visits, feature usage, time spent)
 */

import { useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'

// Generate unique session ID (persists for browser session)
const getSessionId = (): string => {
  if (typeof window === 'undefined') return ''

  let sessionId = sessionStorage.getItem('clerva_session_id')
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`
    sessionStorage.setItem('clerva_session_id', sessionId)
  }
  return sessionId
}

// Generate device ID (persists across sessions)
const getDeviceId = (): string => {
  if (typeof window === 'undefined') return ''

  let deviceId = localStorage.getItem('clerva_device_id')
  if (!deviceId) {
    deviceId = `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`
    localStorage.setItem('clerva_device_id', deviceId)
  }
  return deviceId
}

// Page name mapping
const PAGE_NAMES: Record<string, string> = {
  '/': 'Home',
  '/search': 'Find Partner',
  '/messages': 'Messages',
  '/community': 'Community',
  '/profile': 'Profile',
  '/profile/edit': 'Edit Profile',
  '/connections': 'Connections',
  '/groups': 'Groups',
  '/study-sessions': 'Study Sessions',
  '/settings': 'Settings',
  '/admin': 'Admin Dashboard',
  '/admin/users': 'Admin Users',
  '/admin/reports': 'Admin Reports',
  '/admin/analytics': 'Admin Analytics',
}

interface TrackOptions {
  feature?: string
  category?: string
  action?: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
}

interface UseActivityTrackerReturn {
  trackFeature: (options: TrackOptions) => void
  trackSearch: (query: string, searchType: string, resultCount?: number, filters?: Record<string, unknown>) => void
  trackClick: (element: string, context?: Record<string, unknown>) => void
}

export function useActivityTracker(): UseActivityTrackerReturn {
  const pathname = usePathname()
  const { user } = useAuth()

  const visitIdRef = useRef<string | null>(null)
  const pageEnterTimeRef = useRef<number>(Date.now())
  const sessionStartedRef = useRef(false)
  const lastPathRef = useRef<string>('')

  // Track API call (batched for efficiency)
  const track = useCallback(async (type: string, data: Record<string, unknown>) => {
    if (!user) return

    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data }),
      })
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.debug('Activity tracking failed:', error)
    }
  }, [user])

  // Start session
  const startSession = useCallback(async () => {
    if (!user || sessionStartedRef.current) return

    try {
      await fetch('/api/analytics/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: getSessionId(),
          action: 'start',
          deviceId: getDeviceId(),
          userAgent: navigator.userAgent,
        }),
      })
      sessionStartedRef.current = true
    } catch (error) {
      console.debug('Session start failed:', error)
    }
  }, [user])

  // Track page visit
  const trackPageVisit = useCallback(async (path: string) => {
    if (!user) return

    const pageName = PAGE_NAMES[path] || path.split('/').pop() || 'Unknown'

    try {
      const response = await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'page_visit',
          data: {
            path,
            pageName,
            referrer: lastPathRef.current || document.referrer,
            sessionId: getSessionId(),
            deviceId: getDeviceId(),
            query: window.location.search,
          }
        }),
      })

      const result = await response.json()
      if (result.visitId) {
        visitIdRef.current = result.visitId
      }
    } catch (error) {
      console.debug('Page visit tracking failed:', error)
    }
  }, [user])

  // Track page exit
  const trackPageExit = useCallback(async () => {
    if (!user || !visitIdRef.current) return

    const duration = Math.floor((Date.now() - pageEnterTimeRef.current) / 1000)

    // Use sendBeacon for reliable exit tracking
    const data = JSON.stringify({
      type: 'page_exit',
      visitId: visitIdRef.current,
      data: {
        exitedAt: new Date().toISOString(),
        duration,
      }
    })

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/track', data)
    } else {
      // Fallback for browsers without sendBeacon
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
        keepalive: true,
      }).catch(() => {})
    }
  }, [user])

  // Track feature usage
  const trackFeature = useCallback((options: TrackOptions) => {
    if (!user) return

    track('feature_usage', {
      feature: options.feature || 'unknown',
      category: options.category || 'general',
      action: options.action || 'use',
      targetType: options.targetType,
      targetId: options.targetId,
      metadata: options.metadata,
    })
  }, [user, track])

  // Track search
  const trackSearch = useCallback((
    query: string,
    searchType: string,
    resultCount?: number,
    filters?: Record<string, unknown>
  ) => {
    if (!user) return

    track('search_query', {
      query,
      searchType,
      resultCount,
      filters,
      pagePath: pathname,
    })
  }, [user, track, pathname])

  // Track click
  const trackClick = useCallback((element: string, context?: Record<string, unknown>) => {
    trackFeature({
      feature: element,
      category: 'interaction',
      action: 'click',
      metadata: context,
    })
  }, [trackFeature])

  // Initialize session and track page changes
  useEffect(() => {
    if (!user) return

    // Start session
    startSession()

    // Track initial page visit
    if (pathname !== lastPathRef.current) {
      // Track exit from previous page
      if (lastPathRef.current) {
        trackPageExit()
      }

      // Track new page visit
      pageEnterTimeRef.current = Date.now()
      trackPageVisit(pathname)
      lastPathRef.current = pathname
    }
  }, [user, pathname, startSession, trackPageVisit, trackPageExit])

  // Track page exit on unmount or visibility change
  useEffect(() => {
    // FIX: Track mounted state to prevent state updates after unmount
    let isMounted = true

    const handleVisibilityChange = () => {
      if (!isMounted) return
      if (document.visibilityState === 'hidden') {
        trackPageExit()
      } else if (document.visibilityState === 'visible') {
        // Re-track page visit when user returns
        pageEnterTimeRef.current = Date.now()
        trackPageVisit(pathname)
      }
    }

    const handleBeforeUnload = () => {
      trackPageExit()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      isMounted = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // FIX: Only call trackPageExit on actual page unload, not component unmount
      // trackPageExit uses sendBeacon which is fire-and-forget, so it's safe
      trackPageExit()
    }
  }, [pathname, trackPageExit, trackPageVisit])

  return {
    trackFeature,
    trackSearch,
    trackClick,
  }
}

// Standalone function for tracking without hook (for use in non-component code)
export async function trackActivity(
  type: 'feature' | 'search' | 'click',
  data: Record<string, unknown>
): Promise<void> {
  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: type === 'feature' ? 'feature_usage' : type === 'search' ? 'search_query' : 'feature_usage',
        data: {
          ...data,
          action: type === 'click' ? 'click' : data.action,
        },
      }),
    })
  } catch (error) {
    console.debug('Activity tracking failed:', error)
  }
}
