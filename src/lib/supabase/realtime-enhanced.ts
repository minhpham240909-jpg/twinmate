'use client'

/**
 * Enhanced Realtime Subscriptions with Offline Handling
 * Wraps Supabase realtime subscriptions with automatic pause/resume on network changes
 */

import { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from './client'

export interface EnhancedSubscriptionOptions {
  channelName: string
  isOnline: boolean
  onStatusChange?: (status: 'connected' | 'disconnected' | 'error' | 'paused') => void
}

export class EnhancedRealtimeSubscription {
  private channel: RealtimeChannel | null = null
  private supabase = createClient()
  private channelName: string
  private isOnline: boolean
  private isPaused = false
  private setupCallback: ((channel: RealtimeChannel) => RealtimeChannel) | null = null
  private onStatusChange?: (status: 'connected' | 'disconnected' | 'error' | 'paused') => void

  constructor(options: EnhancedSubscriptionOptions) {
    this.channelName = options.channelName
    this.isOnline = options.isOnline
    this.onStatusChange = options.onStatusChange
  }

  /**
   * Set up the subscription with event listeners
   * This should be called before subscribe()
   */
  setup(callback: (channel: RealtimeChannel) => RealtimeChannel): this {
    this.setupCallback = callback
    return this
  }

  /**
   * Subscribe to the channel
   */
  async subscribe(): Promise<void> {
    if (!this.isOnline) {
      console.log(`[Realtime Enhanced] Skipping subscription to ${this.channelName} - offline`)
      this.isPaused = true
      this.onStatusChange?.('paused')
      return
    }

    if (this.channel) {
      console.warn(`[Realtime Enhanced] Already subscribed to ${this.channelName}`)
      return
    }

    console.log(`[Realtime Enhanced] Subscribing to ${this.channelName}`)
    this.channel = this.supabase.channel(this.channelName)

    // Apply setup callback if provided
    if (this.setupCallback) {
      this.channel = this.setupCallback(this.channel)
    }

    // Subscribe with status tracking
    this.channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime Enhanced] ✅ Subscribed to ${this.channelName}`)
        this.isPaused = false
        this.onStatusChange?.('connected')
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[Realtime Enhanced] ❌ Error on ${this.channelName}:`, err)
        this.onStatusChange?.('error')
      } else if (status === 'TIMED_OUT') {
        console.warn(`[Realtime Enhanced] ⏱️ Timeout on ${this.channelName}`)
        this.onStatusChange?.('disconnected')
      } else if (status === 'CLOSED') {
        console.log(`[Realtime Enhanced] 🔒 Closed ${this.channelName}`)
        this.onStatusChange?.('disconnected')
      }
    })
  }

  /**
   * Pause the subscription (when going offline)
   */
  async pause(): Promise<void> {
    if (this.isPaused) {
      console.log(`[Realtime Enhanced] ${this.channelName} already paused`)
      return
    }

    console.log(`[Realtime Enhanced] Pausing ${this.channelName}`)
    this.isPaused = true

    if (this.channel) {
      await this.unsubscribe()
    }

    this.onStatusChange?.('paused')
  }

  /**
   * Resume the subscription (when coming back online)
   */
  async resume(): Promise<void> {
    if (!this.isPaused) {
      console.log(`[Realtime Enhanced] ${this.channelName} not paused, nothing to resume`)
      return
    }

    console.log(`[Realtime Enhanced] Resuming ${this.channelName}`)
    this.isPaused = false

    await this.subscribe()
  }

  /**
   * Update online status
   */
  async updateOnlineStatus(isOnline: boolean): Promise<void> {
    const wasOnline = this.isOnline
    this.isOnline = isOnline

    if (!wasOnline && isOnline) {
      // Coming back online
      await this.resume()
    } else if (wasOnline && !isOnline) {
      // Going offline
      await this.pause()
    }
  }

  /**
   * Unsubscribe and cleanup
   */
  async unsubscribe(): Promise<void> {
    if (this.channel) {
      console.log(`[Realtime Enhanced] Unsubscribing from ${this.channelName}`)
      this.supabase.removeChannel(this.channel)
      this.channel = null
    }
  }

  /**
   * Check if currently subscribed and active
   */
  isActive(): boolean {
    return !this.isPaused && this.channel !== null
  }
}

/**
 * Create an enhanced subscription that automatically handles offline/online transitions
 * 
 * @example
 * const subscription = createEnhancedSubscription({
 *   channelName: 'chat:123',
 *   isOnline: navigator.onLine,
 * })
 * 
 * subscription
 *   .setup(channel => 
 *     channel.on('postgres_changes', {
 *       event: 'INSERT',
 *       schema: 'public',
 *       table: 'Message',
 *     }, (payload) => {
 *       console.log('New message:', payload)
 *     })
 *   )
 *   .subscribe()
 * 
 * // Later, when network status changes:
 * subscription.updateOnlineStatus(newStatus)
 * 
 * // Cleanup:
 * subscription.unsubscribe()
 */
export function createEnhancedSubscription(
  options: EnhancedSubscriptionOptions
): EnhancedRealtimeSubscription {
  return new EnhancedRealtimeSubscription(options)
}
