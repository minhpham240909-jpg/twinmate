// Admin Dashboard Real-time Utilities
// Provides WebSocket-based real-time updates for admin dashboard
// Replaces polling with Supabase Realtime for ~80% reduction in database load

'use client'

import { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

// =====================================================
// TYPES
// =====================================================

export interface AdminRealtimeStats {
  onlineUsers: number
  activeDevices: number
  pendingReports: number
  activeAISessions: number
  timestamp: string
}

export interface OnlineUserUpdate {
  id: string
  name: string
  avatarUrl: string | null
  status: string
  lastSeenAt: string
  currentPage?: string
}

export interface AdminRealtimeCallbacks {
  onStatsUpdate?: (stats: Partial<AdminRealtimeStats>) => void
  onUserPresenceChange?: (users: OnlineUserUpdate[]) => void
  onNewReport?: (report: any) => void
  onNewUser?: (user: any) => void
  onAISessionChange?: (session: any) => void
  onError?: (error: string) => void
  onConnectionChange?: (status: 'connected' | 'disconnected' | 'reconnecting') => void
}

export interface AdminRealtimeConfig {
  enablePresence?: boolean
  enableReports?: boolean
  enableUsers?: boolean
  enableAISessions?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
}

// =====================================================
// ADMIN REALTIME MANAGER
// =====================================================

export class AdminRealtimeManager {
  private supabase = createClient()
  private channels: Map<string, RealtimeChannel> = new Map()
  private callbacks: AdminRealtimeCallbacks = {}
  private config: AdminRealtimeConfig
  private isConnected = false
  private reconnectAttempts = 0
  private adminId: string | null = null

  constructor(config: AdminRealtimeConfig = {}) {
    this.config = {
      enablePresence: true,
      enableReports: true,
      enableUsers: true,
      enableAISessions: true,
      reconnectAttempts: 5,
      reconnectDelay: 2000,
      ...config,
    }
  }

  /**
   * Initialize all realtime subscriptions for admin dashboard
   */
  async initialize(adminId: string, callbacks: AdminRealtimeCallbacks): Promise<void> {
    this.adminId = adminId
    this.callbacks = callbacks

    try {
      // Subscribe to all configured channels
      if (this.config.enablePresence) {
        await this.subscribeToPresence()
      }
      if (this.config.enableReports) {
        await this.subscribeToReports()
      }
      if (this.config.enableUsers) {
        await this.subscribeToUsers()
      }
      if (this.config.enableAISessions) {
        await this.subscribeToAISessions()
      }

      this.isConnected = true
      this.reconnectAttempts = 0
      this.callbacks.onConnectionChange?.('connected')
    } catch (error) {
      console.error('[AdminRealtime] Initialization error:', error)
      this.callbacks.onError?.('Failed to initialize realtime connection')
      this.handleReconnect()
    }
  }

  /**
   * Subscribe to user presence changes (online status)
   */
  private async subscribeToPresence(): Promise<void> {
    const channelName = 'admin:presence'

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        (payload) => {
          this.handlePresenceChange(payload)
        }
      )
      .subscribe((status) => {
        this.handleSubscriptionStatus(channelName, status)
      })

    this.channels.set(channelName, channel)
  }

  /**
   * Subscribe to new reports
   */
  private async subscribeToReports(): Promise<void> {
    const channelName = 'admin:reports'

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Report',
        },
        (payload) => {
          this.callbacks.onNewReport?.(payload.new)
          // Update pending reports count
          this.callbacks.onStatsUpdate?.({
            pendingReports: -1, // Signal to increment
            timestamp: new Date().toISOString(),
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Report',
        },
        (payload) => {
          // Report status changed, might affect pending count
          const oldStatus = (payload.old as any)?.status
          const newStatus = (payload.new as any)?.status
          if (oldStatus === 'PENDING' && newStatus !== 'PENDING') {
            this.callbacks.onStatsUpdate?.({
              pendingReports: -2, // Signal to decrement
              timestamp: new Date().toISOString(),
            })
          }
        }
      )
      .subscribe((status) => {
        this.handleSubscriptionStatus(channelName, status)
      })

    this.channels.set(channelName, channel)
  }

  /**
   * Subscribe to new user signups
   */
  private async subscribeToUsers(): Promise<void> {
    const channelName = 'admin:users'

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'User',
        },
        (payload) => {
          this.callbacks.onNewUser?.(payload.new)
        }
      )
      .subscribe((status) => {
        this.handleSubscriptionStatus(channelName, status)
      })

    this.channels.set(channelName, channel)
  }

  /**
   * Subscribe to AI partner session changes
   */
  private async subscribeToAISessions(): Promise<void> {
    const channelName = 'admin:ai-sessions'

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'AIPartnerSession',
        },
        (payload) => {
          this.callbacks.onAISessionChange?.(payload)

          // Update active sessions count
          const session = payload.new as any
          if (payload.eventType === 'INSERT' ||
              (payload.eventType === 'UPDATE' && session?.status === 'ACTIVE')) {
            this.callbacks.onStatsUpdate?.({
              activeAISessions: -1, // Signal to refresh
              timestamp: new Date().toISOString(),
            })
          }
        }
      )
      .subscribe((status) => {
        this.handleSubscriptionStatus(channelName, status)
      })

    this.channels.set(channelName, channel)
  }

  /**
   * Handle presence changes and aggregate online user data
   */
  private handlePresenceChange(payload: any): void {
    const presence = payload.new as OnlineUserUpdate

    // Notify about individual user change
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      if (presence?.status === 'online') {
        this.callbacks.onStatsUpdate?.({
          onlineUsers: -1, // Signal to refresh count
          timestamp: new Date().toISOString(),
        })
      }
    }
  }

  /**
   * Handle subscription status changes
   */
  private handleSubscriptionStatus(channelName: string, status: string): void {
    if (status === 'SUBSCRIBED') {
      console.log(`✅ [AdminRealtime] ${channelName} subscribed`)
    } else if (status === 'CHANNEL_ERROR') {
      console.error(`❌ [AdminRealtime] ${channelName} error`)
      this.callbacks.onError?.(`Channel ${channelName} error`)
    } else if (status === 'TIMED_OUT') {
      console.warn(`⏱️ [AdminRealtime] ${channelName} timeout`)
      this.handleReconnect()
    } else if (status === 'CLOSED') {
      console.warn(`🔒 [AdminRealtime] ${channelName} closed`)
      if (this.isConnected) {
        this.handleReconnect()
      }
    }
  }

  /**
   * Handle reconnection attempts
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= (this.config.reconnectAttempts || 5)) {
      this.callbacks.onError?.('Max reconnection attempts reached')
      this.callbacks.onConnectionChange?.('disconnected')
      return
    }

    this.reconnectAttempts++
    this.isConnected = false
    this.callbacks.onConnectionChange?.('reconnecting')

    setTimeout(async () => {
      console.log(`[AdminRealtime] Reconnecting (attempt ${this.reconnectAttempts})...`)
      await this.cleanup()
      if (this.adminId) {
        await this.initialize(this.adminId, this.callbacks)
      }
    }, this.config.reconnectDelay || 2000)
  }

  /**
   * Broadcast admin presence (for concurrent edit tracking)
   */
  async trackAdminPresence(pageContext: {
    page: string
    resourceType?: string
    resourceId?: string
  }): Promise<void> {
    if (!this.adminId) return

    const channelName = `admin:editing:${pageContext.resourceType || 'general'}`

    let channel = this.channels.get(channelName)
    if (!channel) {
      channel = this.supabase.channel(channelName, {
        config: {
          presence: { key: this.adminId },
        },
      })
      this.channels.set(channelName, channel)
    }

    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel!.track({
          adminId: this.adminId,
          page: pageContext.page,
          resourceType: pageContext.resourceType,
          resourceId: pageContext.resourceId,
          timestamp: new Date().toISOString(),
        })
      }
    })
  }

  /**
   * Subscribe to admin presence for concurrent edit warnings
   */
  subscribeToAdminPresence(
    resourceType: string,
    onPresenceChange: (admins: Array<{ adminId: string; page: string; timestamp: string }>) => void
  ): () => void {
    const channelName = `admin:editing:${resourceType}`

    const channel = this.supabase
      .channel(channelName)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const admins: Array<{ adminId: string; page: string; timestamp: string }> = []

        Object.values(state).forEach((presences: any[]) => {
          presences.forEach((presence) => {
            if (presence.adminId !== this.adminId) {
              admins.push({
                adminId: presence.adminId,
                page: presence.page,
                timestamp: presence.timestamp,
              })
            }
          })
        })

        onPresenceChange(admins)
      })
      .subscribe()

    this.channels.set(channelName, channel)

    return () => {
      this.supabase.removeChannel(channel)
      this.channels.delete(channelName)
    }
  }

  /**
   * Clean up all subscriptions
   */
  async cleanup(): Promise<void> {
    this.isConnected = false

    for (const [name, channel] of this.channels) {
      try {
        await this.supabase.removeChannel(channel)
      } catch (error) {
        console.error(`[AdminRealtime] Error removing channel ${name}:`, error)
      }
    }

    this.channels.clear()
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected
  }
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

let adminRealtimeInstance: AdminRealtimeManager | null = null

export function getAdminRealtimeManager(config?: AdminRealtimeConfig): AdminRealtimeManager {
  if (!adminRealtimeInstance) {
    adminRealtimeInstance = new AdminRealtimeManager(config)
  }
  return adminRealtimeInstance
}

export function resetAdminRealtimeManager(): void {
  if (adminRealtimeInstance) {
    adminRealtimeInstance.cleanup()
    adminRealtimeInstance = null
  }
}
