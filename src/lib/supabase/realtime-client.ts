'use client'

// Enhanced Supabase Realtime Client with Robust Connection Management
import { createClient } from './client'
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface RealtimeConfig {
  maxRetries?: number
  retryDelay?: number
  maxRetryDelay?: number
  heartbeatInterval?: number
  enableLogging?: boolean
}

const DEFAULT_CONFIG: Required<RealtimeConfig> = {
  maxRetries: 5,
  retryDelay: 1000, // 1 second
  maxRetryDelay: 30000, // 30 seconds
  heartbeatInterval: 30000, // 30 seconds
  enableLogging: process.env.NODE_ENV === 'development',
}

export class RealtimeConnection {
  private channel: RealtimeChannel | null = null
  private config: Required<RealtimeConfig>
  private retryCount = 0
  private retryTimeout: NodeJS.Timeout | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
  private connectionStatus: ConnectionStatus = 'disconnected'
  private statusCallbacks: ((status: ConnectionStatus) => void)[] = []
  private isCleanedUp = false

  constructor(config: RealtimeConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private log(...args: unknown[]) {
    if (this.config.enableLogging) {
      console.log('[Realtime]', ...args)
    }
  }

  private updateStatus(status: ConnectionStatus) {
    this.connectionStatus = status
    this.statusCallbacks.forEach(callback => callback(status))
  }

  onStatusChange(callback: (status: ConnectionStatus) => void) {
    this.statusCallbacks.push(callback)
    // Immediately call with current status
    callback(this.connectionStatus)

    // Return unsubscribe function
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback)
    }
  }

  private getRetryDelay(): number {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      this.config.retryDelay * Math.pow(2, this.retryCount),
      this.config.maxRetryDelay
    )
    const jitter = Math.random() * 1000 // Add up to 1 second of jitter
    return exponentialDelay + jitter
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatInterval = setInterval(() => {
      if (this.channel && this.connectionStatus === 'connected') {
        this.log('Heartbeat ping')
        // Send a heartbeat to check connection health
        this.channel.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { timestamp: Date.now() },
        })
      }
    }, this.config.heartbeatInterval)
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private scheduleRetry(reconnectFn: () => void) {
    if (this.isCleanedUp) return

    if (this.retryCount >= this.config.maxRetries) {
      this.log('Max retries reached, giving up')
      this.updateStatus('error')
      return
    }

    const delay = this.getRetryDelay()
    this.log(`Scheduling retry ${this.retryCount + 1}/${this.config.maxRetries} in ${delay}ms`)

    this.retryTimeout = setTimeout(() => {
      this.retryCount++
      reconnectFn()
    }, delay)
  }

  subscribe<T = Record<string, unknown>>(
    channelName: string,
    config: {
      event: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
      schema: string
      table: string
      filter?: string
    },
    onMessage: (payload: T) => void
  ): () => void {
    const supabase = createClient()

    const setupSubscription = () => {
      if (this.isCleanedUp) return

      this.log(`Setting up subscription to ${channelName}`)
      this.updateStatus('connecting')

      // Clean up existing channel if any
      if (this.channel) {
        supabase.removeChannel(this.channel)
      }

      const channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: true },
            presence: { key: '' },
          },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any

      channel.on(
        'postgres_changes',
        {
          event: config.event,
          schema: config.schema,
          table: config.table,
          ...(config.filter && { filter: config.filter }),
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          this.log('Received message:', payload)
          onMessage(payload.new as T)
        }
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.channel = channel.subscribe((status: any, err: any) => {
          if (this.isCleanedUp) return

          this.log(`Subscription status: ${status}`, err || '')

          switch (status) {
            case 'SUBSCRIBED':
              this.log(`✅ Successfully subscribed to ${channelName}`)
              this.updateStatus('connected')
              this.retryCount = 0 // Reset retry count on successful connection
              this.startHeartbeat()
              break

            case 'CHANNEL_ERROR':
              this.log(`❌ Channel error on ${channelName}:`, err)
              this.updateStatus('error')
              this.stopHeartbeat()
              // Attempt to reconnect
              this.scheduleRetry(setupSubscription)
              break

            case 'TIMED_OUT':
              this.log(`⏱️ Connection timed out on ${channelName}`)
              this.updateStatus('disconnected')
              this.stopHeartbeat()
              // Attempt to reconnect
              this.scheduleRetry(setupSubscription)
              break

            case 'CLOSED':
              if (!this.isCleanedUp) {
                this.log(`🔒 Connection closed on ${channelName}`)
                this.updateStatus('disconnected')
                this.stopHeartbeat()
                // Attempt to reconnect
                this.scheduleRetry(setupSubscription)
              }
              break
          }
        })
    }

    // Initial setup
    setupSubscription()

    // Return cleanup function
    return () => {
      this.cleanup()
    }
  }

  cleanup() {
    this.log('Cleaning up Realtime connection')
    this.isCleanedUp = true
    this.stopHeartbeat()

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
      this.retryTimeout = null
    }

    if (this.channel) {
      const supabase = createClient()
      supabase.removeChannel(this.channel)
      this.channel = null
    }

    this.updateStatus('disconnected')
    this.statusCallbacks = []
  }

  getStatus(): ConnectionStatus {
    return this.connectionStatus
  }

  forceReconnect() {
    this.log('Force reconnecting...')
    this.retryCount = 0
    this.cleanup()
    this.isCleanedUp = false
  }
}
