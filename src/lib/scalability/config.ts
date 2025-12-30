/**
 * Scalability Configuration
 *
 * Centralized configuration for handling 1000-3000 concurrent users.
 * All scalability-related settings can be tuned from environment variables.
 *
 * ARCHITECTURE OVERVIEW:
 * ---------------------
 * 1. Request Queuing - OpenAI requests are queued to prevent rate limits
 * 2. Rate Limiting - Per-user and global rate limits (Redis/in-memory)
 * 3. Caching - Response caching for repeated queries
 * 4. Connection Pooling - Database connection management
 * 5. Request Deduplication - Prevent duplicate API calls
 * 6. Circuit Breaker - Fail-fast on downstream failures
 *
 * CAPACITY ESTIMATES (with this configuration):
 * - OpenAI requests: ~450 RPM (with queuing)
 * - Database queries: ~5000 QPM (with connection pooling)
 * - API requests: ~10000 RPM (with rate limiting)
 * - Concurrent users: 1000-3000
 */

// =============================================================================
// ENVIRONMENT-BASED CONFIGURATION
// =============================================================================

export const SCALABILITY_CONFIG = {
  // Target concurrent users
  targetConcurrentUsers: parseInt(process.env.TARGET_CONCURRENT_USERS || '3000', 10),

  // ==========================================================================
  // OPENAI QUEUE SETTINGS
  // ==========================================================================
  openai: {
    // Maximum concurrent OpenAI requests
    maxConcurrent: parseInt(process.env.OPENAI_MAX_CONCURRENT || '50', 10),

    // Rate limit: requests per minute (OpenAI Tier 3: ~500 RPM)
    requestsPerMinute: parseInt(process.env.OPENAI_REQUESTS_PER_MINUTE || '450', 10),

    // Request timeout in milliseconds
    requestTimeout: parseInt(process.env.OPENAI_REQUEST_TIMEOUT || '30000', 10),

    // Maximum queue size before rejecting
    maxQueueSize: parseInt(process.env.OPENAI_MAX_QUEUE_SIZE || '5000', 10),

    // Retry configuration
    maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
    retryBaseDelayMs: parseInt(process.env.OPENAI_RETRY_BASE_DELAY || '1000', 10),
    retryMaxDelayMs: parseInt(process.env.OPENAI_RETRY_MAX_DELAY || '30000', 10),

    // Circuit breaker
    circuitBreakerThreshold: parseInt(process.env.OPENAI_CIRCUIT_BREAKER_THRESHOLD || '10', 10),
    circuitBreakerResetMs: parseInt(process.env.OPENAI_CIRCUIT_BREAKER_RESET || '60000', 10),

    // Deduplication window
    deduplicationWindowMs: parseInt(process.env.OPENAI_DEDUPE_WINDOW || '2000', 10),
  },

  // ==========================================================================
  // DATABASE SETTINGS
  // ==========================================================================
  database: {
    // Connection pool size (Supabase default is 25)
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '25', 10),

    // Query timeout in seconds
    queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '30', 10),

    // Slow query threshold for logging (ms)
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '3000', 10),

    // Health check interval (ms)
    healthCheckInterval: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '30000', 10),
  },

  // ==========================================================================
  // RATE LIMITING SETTINGS
  // ==========================================================================
  rateLimit: {
    // Use Redis for distributed rate limiting (required for multi-instance)
    useRedis: process.env.UPSTASH_REDIS_REST_URL !== undefined,

    // Default rate limit: requests per minute per user
    defaultRequestsPerMinute: parseInt(process.env.RATE_LIMIT_DEFAULT || '60', 10),

    // Expensive operations (search, AI): requests per minute per user
    expensiveRequestsPerMinute: parseInt(process.env.RATE_LIMIT_EXPENSIVE || '10', 10),

    // Global rate limit: total requests per minute across all users
    globalRequestsPerMinute: parseInt(process.env.RATE_LIMIT_GLOBAL || '10000', 10),
  },

  // ==========================================================================
  // CACHING SETTINGS
  // ==========================================================================
  cache: {
    // Use Redis for distributed caching
    useRedis: process.env.UPSTASH_REDIS_REST_URL !== undefined,

    // Default cache TTL in seconds
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10),

    // Search results cache TTL
    searchTTL: parseInt(process.env.CACHE_SEARCH_TTL || '60', 10),

    // AI response cache TTL
    aiResponseTTL: parseInt(process.env.CACHE_AI_RESPONSE_TTL || '3600', 10),

    // Maximum cache size for in-memory cache
    maxMemoryCacheSize: parseInt(process.env.CACHE_MAX_MEMORY_SIZE || '1000', 10),
  },

  // ==========================================================================
  // REQUEST DEDUPLICATION
  // ==========================================================================
  deduplication: {
    // Enable request deduplication
    enabled: process.env.DEDUPE_ENABLED !== 'false',

    // Grace period for duplicate detection (ms)
    gracePeriodMs: parseInt(process.env.DEDUPE_GRACE_PERIOD || '500', 10),

    // Cache cleanup interval (ms)
    cleanupIntervalMs: parseInt(process.env.DEDUPE_CLEANUP_INTERVAL || '60000', 10),
  },

  // ==========================================================================
  // API OPTIMIZATION
  // ==========================================================================
  api: {
    // Enable response compression
    enableCompression: process.env.API_COMPRESSION !== 'false',

    // Maximum response size before truncation (bytes)
    maxResponseSize: parseInt(process.env.API_MAX_RESPONSE_SIZE || '1048576', 10), // 1MB

    // Request timeout (ms)
    requestTimeout: parseInt(process.env.API_REQUEST_TIMEOUT || '30000', 10),
  },

  // ==========================================================================
  // MONITORING
  // ==========================================================================
  monitoring: {
    // Enable detailed performance logging
    enablePerformanceLogging: process.env.ENABLE_PERFORMANCE_LOGGING === 'true',

    // Log slow requests above this threshold (ms)
    slowRequestThreshold: parseInt(process.env.SLOW_REQUEST_THRESHOLD || '5000', 10),

    // Health check endpoints enabled
    healthCheckEnabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
  },
} as const

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get configuration for a specific tier based on user count
 */
export function getScaleTier(currentUsers: number): 'low' | 'medium' | 'high' | 'critical' {
  if (currentUsers < 100) return 'low'
  if (currentUsers < 500) return 'medium'
  if (currentUsers < 2000) return 'high'
  return 'critical'
}

/**
 * Adjust rate limits based on current load
 */
export function getAdjustedRateLimit(
  baseLimit: number,
  currentUsers: number,
  tier: 'low' | 'medium' | 'high' | 'critical'
): number {
  const multipliers = {
    low: 1.5,     // Allow more when load is low
    medium: 1.0,  // Normal limits
    high: 0.7,    // Reduce to prevent overload
    critical: 0.5 // Aggressive throttling
  }

  return Math.floor(baseLimit * multipliers[tier])
}

/**
 * Check if system is under heavy load
 */
export function isUnderHeavyLoad(metrics: {
  activeRequests?: number
  queuedRequests?: number
  errorRate?: number
}): boolean {
  const { activeRequests = 0, queuedRequests = 0, errorRate = 0 } = metrics

  // Consider heavy load if:
  // - Queue is more than 50% full
  // - Error rate is above 5%
  // - Active requests exceed concurrent limit by 50%
  const queueThreshold = SCALABILITY_CONFIG.openai.maxQueueSize * 0.5
  const concurrentThreshold = SCALABILITY_CONFIG.openai.maxConcurrent * 1.5

  return (
    queuedRequests > queueThreshold ||
    errorRate > 0.05 ||
    activeRequests > concurrentThreshold
  )
}

/**
 * Get recommended action based on system state
 */
export function getRecommendedAction(metrics: {
  activeRequests: number
  queuedRequests: number
  errorRate: number
  circuitState: string
}): 'continue' | 'throttle' | 'queue' | 'reject' {
  const { activeRequests, queuedRequests, errorRate, circuitState } = metrics

  // Circuit breaker open - reject new requests
  if (circuitState === 'open') {
    return 'reject'
  }

  // High error rate - start throttling
  if (errorRate > 0.1) {
    return 'throttle'
  }

  // Queue is filling up - start queuing aggressively
  if (queuedRequests > SCALABILITY_CONFIG.openai.maxQueueSize * 0.7) {
    return 'queue'
  }

  // Normal operation
  return 'continue'
}

export default SCALABILITY_CONFIG
