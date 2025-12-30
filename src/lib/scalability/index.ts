/**
 * Scalability Module
 *
 * Centralized exports for all scalability-related utilities.
 * Designed to support 1000-3000 concurrent users.
 */

// Configuration
export { SCALABILITY_CONFIG, getScaleTier, getAdjustedRateLimit, isUnderHeavyLoad, getRecommendedAction } from './config'

// Request Deduplication
export {
  generateDedupeKey,
  isDuplicate,
  getCachedResult,
  withDeduplication,
  getStats as getDeduplicationStats,
} from './deduplication'

// Response Optimization
export {
  optimizeResponse,
  compressResponse,
  paginateArray,
  selectFields,
  truncateContent,
  type OptimizationOptions,
} from './response-optimization'

// Batch Processing
export {
  processBatches,
  createNotificationsBatch,
  cleanupStalePresenceBatch,
  batchDelete,
  processWithRateLimit,
  type BatchOptions,
  type BatchResult,
} from './batch-processor'
