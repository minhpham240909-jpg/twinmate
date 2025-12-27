// Admin Dashboard Real-time Hook
// Uses polling for stable, reliable updates
// WebSocket can be added back later when Supabase Realtime is properly configured

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

// =====================================================
// TYPES
// =====================================================

export interface AdminRealtimeState {
  isConnected: boolean
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
  lastError: string | null
  stats: Record<string, unknown>
  onlineUsers: number
  pendingReports: number
  activeAISessions: number
}

export interface UseAdminRealtimeOptions {
  adminId: string
  onNewReport?: (report: unknown) => void
  onNewUser?: (user: unknown) => void
  onAISessionChange?: (session: unknown) => void
  fallbackPollingMs?: number
  enablePresence?: boolean
  enableReports?: boolean
  enableUsers?: boolean
  enableAISessions?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
}

export interface UseAdminRealtimeReturn extends AdminRealtimeState {
  refresh: () => Promise<void>
  isInitialized: boolean
}

// =====================================================
// HOOK IMPLEMENTATION - Simple Polling Version
// =====================================================

export function useAdminRealtime(options: UseAdminRealtimeOptions): UseAdminRealtimeReturn {
  const {
    adminId,
    fallbackPollingMs = 30000, // 30 second polling
  } = options

  // State - Always show as connected since we use reliable polling
  const [state, setState] = useState<AdminRealtimeState>({
    isConnected: true,
    connectionStatus: 'connected',
    lastError: null,
    stats: {},
    onlineUsers: 0,
    pendingReports: 0,
    activeAISessions: 0,
  })

  const [isInitialized, setIsInitialized] = useState(false)

  // Refs
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  const lastFetchRef = useRef<number>(0)

  // Fetch fresh data
  const fetchFreshData = useCallback(async () => {
    if (!isMountedRef.current) return

    // Debounce - don't fetch more than once per 5 seconds
    const now = Date.now()
    if (now - lastFetchRef.current < 5000) return
    lastFetchRef.current = now

    try {
      const [dashboardRes, onlineRes] = await Promise.all([
        fetch('/api/admin/dashboard'),
        fetch('/api/admin/analytics/online-users'),
      ])

      if (!isMountedRef.current) return

      const [dashboardData, onlineData] = await Promise.all([
        dashboardRes.json(),
        onlineRes.json(),
      ])

      if (dashboardData.success) {
        setState(prev => ({
          ...prev,
          pendingReports: dashboardData.data.stats?.moderation?.pendingReports || 0,
          isConnected: true,
          connectionStatus: 'connected',
          lastError: null,
        }))
      }

      if (onlineData.success) {
        setState(prev => ({
          ...prev,
          onlineUsers: onlineData.data?.count || 0,
        }))
      }
    } catch (error) {
      console.error('[useAdminRealtime] Error fetching data:', error)
      // Don't set disconnected on fetch error - just log it
      // The next poll will try again
    }
  }, [])

  // Initialize polling
  useEffect(() => {
    if (!adminId) return

    isMountedRef.current = true

    // Initial fetch
    fetchFreshData().then(() => {
      setIsInitialized(true)
    })

    // Start polling
    pollingIntervalRef.current = setInterval(() => {
      fetchFreshData()
    }, fallbackPollingMs)

    // Cleanup
    return () => {
      isMountedRef.current = false
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [adminId, fallbackPollingMs, fetchFreshData])

  // Manual refresh
  const refresh = useCallback(async () => {
    lastFetchRef.current = 0 // Reset debounce
    await fetchFreshData()
  }, [fetchFreshData])

  return {
    ...state,
    refresh,
    isInitialized,
  }
}

// =====================================================
// CONCURRENT EDIT WARNING HOOK (Simplified)
// =====================================================

export interface ConcurrentEditState {
  otherAdmins: Array<{
    adminId: string
    page: string
    timestamp: string
  }>
  hasConflict: boolean
}

export function useAdminConcurrentEdit(
  _adminId: string,
  _resourceType: string,
  _resourceId: string
): ConcurrentEditState {
  // Simplified - returns no conflicts since WebSocket is disabled
  return {
    otherAdmins: [],
    hasConflict: false,
  }
}

// =====================================================
// ADMIN PRESENCE HOOK (Simplified)
// =====================================================

export interface AdminPresence {
  adminId: string
  name?: string
  avatarUrl?: string
  currentPage: string
  lastSeen: string
}

export function useAdminPresenceList(): AdminPresence[] {
  // Simplified - returns empty array since WebSocket is disabled
  return []
}

// =====================================================
// CLEANUP (No-op since we don't use WebSocket)
// =====================================================

export function cleanupAdminRealtime(): void {
  // No-op - polling cleans up automatically
}
