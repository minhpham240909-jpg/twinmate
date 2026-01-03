/**
 * API Utilities
 *
 * Common utilities for API route handlers including:
 * - Timeout protection
 * - Response helpers
 * - Error handling
 */

export {
  withTimeout,
  withTimeoutPromise,
  executeWithTimeout,
  TimeoutPresets,
  DEFAULT_API_TIMEOUT,
  QUICK_API_TIMEOUT,
  LONG_API_TIMEOUT,
} from './timeout'
