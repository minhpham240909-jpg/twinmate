/**
 * Application-wide constants
 * 
 * This file contains all hardcoded values used throughout the application.
 * Centralizing constants makes the app easier to maintain and modify.
 */

/**
 * Pagination limits for list endpoints
 */
export const PAGINATION = {
  /** Default number of items to return when no limit is specified */
  DEFAULT_LIMIT: 20,
  /** Maximum number of items that can be requested in a single query */
  MAX_LIMIT: 100,
  /** Default limit for posts feed */
  POSTS_LIMIT: 20,
  /** Default limit for messages */
  MESSAGES_LIMIT: 50,
  /** Default limit for notifications */
  NOTIFICATIONS_LIMIT: 50,
  /** Number of posts to fetch when calculating popular posts */
  POPULAR_POSTS_FETCH: 100,
  /** Default limit for history endpoints */
  HISTORY_LIMIT: 50,
  /** Default limit for search results */
  SEARCH_LIMIT: 20,
} as const

/**
 * Batch operation limits (for security)
 */
export const BATCH_LIMITS = {
  /** Maximum items in a batch delete operation */
  MAX_BATCH_DELETE: 50,
  /** Maximum items in a batch update operation */
  MAX_BATCH_UPDATE: 50,
  /** Maximum recipients in a batch message */
  MAX_BATCH_MESSAGE: 20,
  /** Maximum invites that can be sent at once */
  MAX_BATCH_INVITES: 10,
} as const

/**
 * Enforce pagination limits on a requested limit value
 * @param requestedLimit - The limit requested by the client
 * @param maxLimit - Maximum allowed limit (defaults to PAGINATION.MAX_LIMIT)
 * @param defaultLimit - Default limit if none provided (defaults to PAGINATION.DEFAULT_LIMIT)
 */
export function enforcePaginationLimit(
  requestedLimit: number | undefined | null,
  maxLimit: number = PAGINATION.MAX_LIMIT,
  defaultLimit: number = PAGINATION.DEFAULT_LIMIT
): number {
  if (requestedLimit === undefined || requestedLimit === null || requestedLimit <= 0) {
    return defaultLimit
  }
  return Math.min(requestedLimit, maxLimit)
}

/**
 * Enforce batch operation limits
 * @param items - The items to batch process
 * @param maxItems - Maximum items allowed
 * @returns Truncated array if needed
 */
export function enforceBatchLimit<T>(items: T[], maxItems: number): T[] {
  if (items.length <= maxItems) {
    return items
  }
  return items.slice(0, maxItems)
}

/**
 * Content length limits for user-generated content
 */
export const CONTENT_LIMITS = {
  /** Maximum length for a post */
  POST_MAX_LENGTH: 5000,
  /** Maximum length for a message */
  MESSAGE_MAX_LENGTH: 1000,
  /** Maximum length for a comment */
  COMMENT_MAX_LENGTH: 500,
  /** Maximum length for user bio */
  BIO_MAX_LENGTH: 500,
  /** Maximum length for group name */
  GROUP_NAME_MAX: 100,
  /** Maximum length for group description */
  GROUP_DESCRIPTION_MAX: 500,
  /** Maximum length for study session title */
  SESSION_TITLE_MAX: 100,
  /** Maximum length for study session description */
  SESSION_DESCRIPTION_MAX: 500,
  /** Maximum length for goal title */
  GOAL_TITLE_MAX: 200,
  /** Maximum length for goal description */
  GOAL_DESCRIPTION_MAX: 1000,
  /** Maximum length for flashcard front */
  FLASHCARD_FRONT_MAX: 500,
  /** Maximum length for flashcard back */
  FLASHCARD_BACK_MAX: 1000,
  /** Maximum length for notes */
  NOTES_MAX_LENGTH: 10000,
  /** Maximum length for whiteboard data */
  WHITEBOARD_MAX_LENGTH: 100000,
} as const

/**
 * Study session configuration
 */
export const STUDY_SESSION = {
  /** Minimum duration for a study session in minutes */
  MIN_DURATION_MINUTES: 5,
  /** Maximum duration for a study session in minutes */
  MAX_DURATION_MINUTES: 480,
  /** Maximum number of participants in a study session */
  MAX_PARTICIPANTS: 20,
  /** Timer update interval in milliseconds */
  TIMER_UPDATE_INTERVAL_MS: 1000,
} as const

/**
 * Upload size limits
 */
export const UPLOAD_LIMITS = {
  /** Maximum avatar file size in MB */
  AVATAR_MAX_SIZE_MB: 5,
  /** Maximum cover photo file size in MB */
  COVER_PHOTO_MAX_SIZE_MB: 10,
  /** Maximum post image file size in MB */
  POST_IMAGE_MAX_SIZE_MB: 5,
  /** Maximum number of images per post */
  MAX_POST_IMAGES: 4,
  /** Maximum group avatar size in MB */
  GROUP_AVATAR_MAX_SIZE_MB: 5,
} as const

/**
 * Engagement calculation weights
 * Used for calculating post popularity/engagement scores
 */
export const ENGAGEMENT_WEIGHTS = {
  /** Weight multiplier for likes */
  LIKE_WEIGHT: 2,
  /** Weight multiplier for comments */
  COMMENT_WEIGHT: 3,
  /** Weight multiplier for reposts */
  REPOST_WEIGHT: 4,
} as const

/**
 * Time periods for various features
 */
export const TIME_PERIODS = {
  /** Number of days to look back for popular posts */
  POPULAR_POSTS_DAYS: 7,
  /** Number of days to look back for trending hashtags */
  TRENDING_HASHTAGS_DAYS: 7,
  /** Number of days to look back for recent activity */
  RECENT_ACTIVITY_DAYS: 30,
  /** User presence timeout in minutes */
  PRESENCE_TIMEOUT_MINUTES: 5,
  /** How long deleted items are kept before permanent deletion (days) */
  SOFT_DELETE_RETENTION_DAYS: 30,
} as const

/**
 * Rate limiting presets
 * Note: Rate limit implementation is in src/lib/rate-limit.ts
 */
export const RATE_LIMIT_WINDOWS = {
  /** Window size for rate limiting in milliseconds (1 minute) */
  WINDOW_MS: 60 * 1000,
  /** Window size for hourly rate limiting in milliseconds */
  HOURLY_WINDOW_MS: 60 * 60 * 1000,
} as const
