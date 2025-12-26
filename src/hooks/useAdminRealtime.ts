// Admin Dashboard Real-time Hook
// React hook for real-time admin dashboard updates
// Replaces polling with WebSocket subscriptions for better performance

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  AdminRealtimeManager,
  AdminRealtimeStats,
  AdminRealtimeCallbacks,
  AdminRealtimeConfig,
  getAdminRealtimeManager,
  resetAdminRealtimeManager,
} from '@/lib/admin/realtime'

// =====================================================
// TYPES
// =====================================================

export interface AdminRealtimeState {
  isConnected: boolean
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
  lastError: string | null
  stats: Partial<AdminRealtimeStats>
  onlineUsers: number
  pendingReports: number
  activeAISessions: number
}

export interface UseAdminRealtimeOptions extends AdminRealtimeConfig {
  adminId: string
  onNewReport?: (report: any) => void
  onNewUser?: (user: any) => void
  onAISessionChange?: (session: any) => void
  fallbackPollingMs?: number // Fallback polling interval if realtime fails
}

export interface UseAdminRealtimeReturn extends AdminRealtimeState {
  refresh: () => Promise<void>
  isInitialized: boolean
}

// =====================================================
// HOOK IMPLEMENTATION
// =====================================================

export function useAdminRealtime(options: UseAdminRealtimeOptions): UseAdminRealtimeReturn {
  const {
    adminId,
    onNewReport,
    onNewUser,
    onAISessionChange,
    fallbackPollingMs = 30000, // 30 second fallback
    ...config
  } = options

  // State
  const [state, setState] = useState<AdminRealtimeState>({
    isConnected: false,
    connectionStatus: 'disconnected',
    lastError: null,
    stats: {},
    onlineUsers: 0,
    pendingReports: 0,
    activeAISessions: 0,
  })

  const [isInitialized, setIsInitialized] = useState(false)

  // Refs
  const managerRef = useRef<AdminRealtimeManager | null>(null)
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  // Fetch fresh data (for initial load and fallback)
  const fetchFreshData = useCallback(async () => {
    if (!isMountedRef.current) return

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
        }))
      }

      if (onlineData.success) {
        setState(prev => ({
          ...prev,
          onlineUsers: onlineData.data?.count || 0,
        }))
      }
    } catch (error) {
      console.error('[useAdminRealtime] Error fetching fresh data:', error)
    }
  }, [])

  // Initialize realtime manager
  useEffect(() => {
    if (!adminId) return

    isMountedRef.current = true

    const initializeRealtime = async () => {
      try {
        // Clean up any existing instance
        if (managerRef.current) {
          await managerRef.current.cleanup()
        }

        managerRef.current = getAdminRealtimeManager(config)

        const callbacks: AdminRealtimeCallbacks = {
          onStatsUpdate: (stats) => {
            if (!isMountedRef.current) return

            setState(prev => {
              const newState = { ...prev, stats: { ...prev.stats, ...stats } }

              // Handle special signal values
              if (stats.onlineUsers === -1) {
                // Refresh online count
                fetchFreshData()
              }
              if (stats.pendingReports === -1) {
                // Increment pending reports
                newState.pendingReports = prev.pendingReports + 1
              } else if (stats.pendingReports === -2) {
                // Decrement pending reports
                newState.pendingReports = Math.max(0, prev.pendingReports - 1)
              }
              if (stats.activeAISessions === -1) {
                // Refresh AI sessions
                fetchFreshData()
              }

              return newState
            })
          },

          onNewReport: (report) => {
            if (!isMountedRef.current) return
            onNewReport?.(report)
          },

          onNewUser: (user) => {
            if (!isMountedRef.current) return
            onNewUser?.(user)
          },

          onAISessionChange: (session) => {
            if (!isMountedRef.current) return
            onAISessionChange?.(session)
          },

          onError: (error) => {
            if (!isMountedRef.current) return
            console.error('[useAdminRealtime] Error:', error)
            setState(prev => ({ ...prev, lastError: error }))

            // Start fallback polling on error
            startFallbackPolling()
          },

          onConnectionChange: (status) => {
            if (!isMountedRef.current) return

            setState(prev => ({
              ...prev,
              isConnected: status === 'connected',
              connectionStatus: status,
              lastError: status === 'connected' ? null : prev.lastError,
            }))

            // Stop fallback polling when connected
            if (status === 'connected') {
              stopFallbackPolling()
            } else if (status === 'disconnected') {
              startFallbackPolling()
            }
          },
        }

        await managerRef.current.initialize(adminId, callbacks)
        setIsInitialized(true)

        // Fetch initial data
        await fetchFreshData()
      } catch (error) {
        console.error('[useAdminRealtime] Initialization error:', error)
        setState(prev => ({
          ...prev,
          lastError: 'Failed to initialize realtime connection',
          connectionStatus: 'disconnected',
        }))

        // Start fallback polling
        startFallbackPolling()
        setIsInitialized(true)
      }
    }

    const startFallbackPolling = () => {
      if (fallbackIntervalRef.current) return

      console.log('[useAdminRealtime] Starting fallback polling')
      fallbackIntervalRef.current = setInterval(() => {
        fetchFreshData()
      }, fallbackPollingMs)
    }

    const stopFallbackPolling = () => {
      if (fallbackIntervalRef.current) {
        console.log('[useAdminRealtime] Stopping fallback polling')
        clearInterval(fallbackIntervalRef.current)
        fallbackIntervalRef.current = null
      }
    }

    initializeRealtime()

    // Cleanup
    return () => {
      isMountedRef.current = false
      stopFallbackPolling()

      if (managerRef.current) {
        managerRef.current.cleanup()
        managerRef.current = null
      }
    }
  }, [adminId, config, fetchFreshData, fallbackPollingMs, onNewReport, onNewUser, onAISessionChange])

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchFreshData()
  }, [fetchFreshData])

  return {
    ...state,
    refresh,
    isInitialized,
  }
}

// =====================================================
// CONCURRENT EDIT WARNING HOOK
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
  adminId: string,
  resourceType: string,
  resourceId: string
): ConcurrentEditState {
  const [state, setState] = useState<ConcurrentEditState>({
    otherAdmins: [],
    hasConflict: false,
  })

  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!adminId || !resourceType || !resourceId) return

    const manager = getAdminRealtimeManager()

    // Track our presence
    manager.trackAdminPresence({
      page: `/${resourceType}/${resourceId}`,
      resourceType,
      resourceId,
    })

    // Subscribe to other admins' presence
    cleanupRef.current = manager.subscribeToAdminPresence(
      resourceType,
      (admins) => {
        const conflicting = admins.filter(a =>
          a.adminId !== adminId &&
          a.page.includes(resourceId)
        )

        setState({
          otherAdmins: conflicting,
          hasConflict: conflicting.length > 0,
        })
      }
    )

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [adminId, resourceType, resourceId])

  return state
}

// =====================================================
// ADMIN PRESENCE HOOK (for showing who's viewing what)
// =====================================================

export interface AdminPresence {
  adminId: string
  name?: string
  avatarUrl?: string
  currentPage: string
  lastSeen: string
}

export function useAdminPresenceList(): AdminPresence[] {
  const [presences, setPresences] = useState<AdminPresence[]>([])

  useEffect(() => {
    // This would subscribe to a global admin presence channel
    // For now, return empty array - can be implemented with Supabase presence
    return () => {}
  }, [])

  return presences
}

// =====================================================
// CLEANUP ON UNMOUNT
// =====================================================

export function cleanupAdminRealtime(): void {
  resetAdminRealtimeManager()
}
