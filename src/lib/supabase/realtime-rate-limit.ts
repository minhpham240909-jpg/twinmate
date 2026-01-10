'use client'

/**
 * WebSocket/Realtime Rate Limiting Utility
 * 
 * Prevents abuse of real-time channels by limiting:
 * - Broadcast frequency (e.g., typing indicators)
 * - Subscription callback frequency (debouncing rapid updates)
 * - Channel creation (prevent channel spam)
 * 
 * Designed for scale: 1000-3000 daily active users
 */

// Rate limit configuration
export interface RateLimitConfig {
  maxEvents: number          // Maximum events allowed in window
  windowMs: number           // Time window in milliseconds
  blockDurationMs?: number   // How long to block after limit exceeded (default: windowMs)
}

// Default presets for common use cases
export const RealtimeRateLimitPresets = {
  // Typing indicators: 5 events per second max
  typing: { maxEvents: 5, windowMs: 1000 },
  
  // Message broadcasts: 10 per second max
  messageBroadcast: { maxEvents: 10, windowMs: 1000 },
  
  // Presence updates: 3 per second max
  presence: { maxEvents: 3, windowMs: 1000 },
  
  // Generic broadcasts: 20 per second max
  broadcast: { maxEvents: 20, windowMs: 1000 },
  
  // Subscription callbacks: 30 per second max (for rapid updates)
  subscription: { maxEvents: 30, windowMs: 1000 },
  
  // Channel creation: 5 per minute max
  channelCreation: { maxEvents: 5, windowMs: 60000, blockDurationMs: 30000 },
} as const

/**
 * In-memory rate limiter for a single key
 */
class RateLimiter {
  private events: number[] = []
  private blocked: boolean = false
  private blockedUntil: number = 0
  private config: Required<RateLimitConfig>

  constructor(config: RateLimitConfig) {
    this.config = {
      ...config,
      blockDurationMs: config.blockDurationMs ?? config.windowMs,
    }
  }

  /**
   * Check if action is allowed and record it if so
   * @returns true if action is allowed, false if rate limited
   */
  checkAndRecord(): boolean {
    const now = Date.now()

    // Check if currently blocked
    if (this.blocked) {
      if (now < this.blockedUntil) {
        return false
      }
      // Unblock
      this.blocked = false
    }

    // Remove expired events
    this.events = this.events.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    )

    // Check if limit exceeded
    if (this.events.length >= this.config.maxEvents) {
      this.blocked = true
      this.blockedUntil = now + this.config.blockDurationMs
      console.warn(`[Realtime Rate Limit] Limit exceeded: ${this.events.length}/${this.config.maxEvents} in ${this.config.windowMs}ms`)
      return false
    }

    // Record event
    this.events.push(now)
    return true
  }

  /**
   * Get remaining allowed events in current window
   */
  getRemainingEvents(): number {
    const now = Date.now()
    this.events = this.events.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    )
    return Math.max(0, this.config.maxEvents - this.events.length)
  }

  /**
   * Check if currently blocked (without recording)
   */
  isBlocked(): boolean {
    if (!this.blocked) return false
    if (Date.now() >= this.blockedUntil) {
      this.blocked = false
      return false
    }
    return true
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.events = []
    this.blocked = false
    this.blockedUntil = 0
  }
}

/**
 * Global rate limiter registry
 * Tracks rate limits per channel/user combination
 */
const rateLimiters = new Map<string, RateLimiter>()

// Cleanup old rate limiters periodically (every 5 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => {
    for (const [key, limiter] of rateLimiters.entries()) {
      // Remove limiters that haven't been used recently (full capacity = unused)
      if (limiter.getRemainingEvents() === limiter['config'].maxEvents) {
        rateLimiters.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

/**
 * Get or create a rate limiter for a specific key
 */
function getRateLimiter(key: string, config: RateLimitConfig): RateLimiter {
  let limiter = rateLimiters.get(key)
  if (!limiter) {
    limiter = new RateLimiter(config)
    rateLimiters.set(key, limiter)
  }
  return limiter
}

/**
 * Check and record a rate-limited action
 * 
 * @param channelName - The channel name (e.g., "typing:dm:user1-user2")
 * @param action - The action type (e.g., "broadcast", "subscribe")
 * @param config - Rate limit configuration
 * @returns true if action is allowed, false if rate limited
 */
export function checkRealtimeRateLimit(
  channelName: string,
  action: string,
  config: RateLimitConfig = RealtimeRateLimitPresets.broadcast
): boolean {
  const key = `${channelName}:${action}`
  const limiter = getRateLimiter(key, config)
  return limiter.checkAndRecord()
}

/**
 * Create a rate-limited version of a broadcast function
 * Automatically drops broadcasts that exceed the rate limit
 */
export function createRateLimitedBroadcast<T>(
  channelName: string,
  broadcastFn: (payload: T) => void | Promise<void>,
  config: RateLimitConfig = RealtimeRateLimitPresets.broadcast
): (payload: T) => void {
  const key = `${channelName}:broadcast`
  const limiter = getRateLimiter(key, config)

  return (payload: T) => {
    if (limiter.checkAndRecord()) {
      broadcastFn(payload)
    }
    // Silently drop if rate limited
  }
}

/**
 * Create a debounced callback for subscription updates
 * Coalesces rapid updates into batched callbacks
 */
export function createDebouncedCallback<T>(
  callback: (payload: T) => void,
  waitMs: number = 100,
  maxWaitMs: number = 500
): (payload: T) => void {
  let timeout: NodeJS.Timeout | null = null
  let lastCallTime: number = 0
  let lastPayload: T | null = null

  return (payload: T) => {
    const now = Date.now()
    lastPayload = payload

    // If max wait time exceeded, call immediately
    if (lastCallTime > 0 && now - lastCallTime >= maxWaitMs) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      lastCallTime = now
      callback(payload)
      return
    }

    // Debounce
    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      lastCallTime = Date.now()
      if (lastPayload !== null) {
        callback(lastPayload)
      }
      timeout = null
    }, waitMs)
  }
}

/**
 * Create a throttled callback that runs at most once per interval
 */
export function createThrottledCallback<T>(
  callback: (payload: T) => void,
  intervalMs: number = 100
): (payload: T) => void {
  let lastCallTime: number = 0
  let pendingPayload: T | null = null
  let timeout: NodeJS.Timeout | null = null

  return (payload: T) => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallTime

    if (timeSinceLastCall >= intervalMs) {
      // Execute immediately
      lastCallTime = now
      callback(payload)
    } else {
      // Schedule for later
      pendingPayload = payload
      
      if (!timeout) {
        timeout = setTimeout(() => {
          lastCallTime = Date.now()
          if (pendingPayload !== null) {
            callback(pendingPayload)
            pendingPayload = null
          }
          timeout = null
        }, intervalMs - timeSinceLastCall)
      }
    }
  }
}

/**
 * Rate-limited typing indicator sender
 * Specifically designed for typing indicators with smart coalescing
 */
export function createTypingIndicatorSender(
  sendFn: (isTyping: boolean) => void,
  config: RateLimitConfig = RealtimeRateLimitPresets.typing
): {
  startTyping: () => void
  stopTyping: () => void
  cleanup: () => void
} {
  let isCurrentlyTyping = false
  let stopTypingTimeout: NodeJS.Timeout | null = null
  const limiter = new RateLimiter(config)

  const startTyping = () => {
    // Clear any pending stop
    if (stopTypingTimeout) {
      clearTimeout(stopTypingTimeout)
      stopTypingTimeout = null
    }

    // Only send if not already typing and rate limit allows
    if (!isCurrentlyTyping && limiter.checkAndRecord()) {
      isCurrentlyTyping = true
      sendFn(true)
    }

    // Auto-stop after 3 seconds of no typing
    stopTypingTimeout = setTimeout(() => {
      if (isCurrentlyTyping) {
        isCurrentlyTyping = false
        sendFn(false)
      }
    }, 3000)
  }

  const stopTyping = () => {
    if (stopTypingTimeout) {
      clearTimeout(stopTypingTimeout)
      stopTypingTimeout = null
    }

    if (isCurrentlyTyping && limiter.checkAndRecord()) {
      isCurrentlyTyping = false
      sendFn(false)
    }
  }

  const cleanup = () => {
    if (stopTypingTimeout) {
      clearTimeout(stopTypingTimeout)
      stopTypingTimeout = null
    }
    isCurrentlyTyping = false
    limiter.reset()
  }

  return { startTyping, stopTyping, cleanup }
}

/**
 * Track channel creation to prevent spam
 */
const channelCreationTracker = new Map<string, RateLimiter>()

export function canCreateChannel(userId: string): boolean {
  let limiter = channelCreationTracker.get(userId)
  if (!limiter) {
    limiter = new RateLimiter(RealtimeRateLimitPresets.channelCreation)
    channelCreationTracker.set(userId, limiter)
  }
  return limiter.checkAndRecord()
}

/**
 * Reset all rate limiters (useful for testing)
 */
export function resetAllRateLimiters(): void {
  rateLimiters.clear()
  channelCreationTracker.clear()
}
