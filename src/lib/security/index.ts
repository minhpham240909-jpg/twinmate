/**
 * Security Module
 * 
 * Exports all security-related utilities for the application.
 */

// Session & Token Management
export {
  rotateUserSession,
  handlePrivilegeChange,
  validateSession,
  recordSessionActivity,
} from './session-rotation'

// Session Management (Concurrent sessions, timeouts, fingerprinting)
export {
  MAX_CONCURRENT_SESSIONS,
  SESSION_INACTIVITY_TIMEOUT_MS,
  SESSION_INACTIVITY_TIMEOUT_SECONDS,
  generateDeviceFingerprint,
  extractFingerprint,
  recordSessionActivity as trackSessionActivity,
  getActiveSessions,
  countActiveSessions,
  hasExceededSessionLimit,
  enforceSessionLimit,
  invalidateSession,
  invalidateAllSessions,
  isSessionTimedOut,
  cleanupInactiveSessions,
  validateSessionSecurity,
  getSessionTimeoutConfig,
} from './session-management'

// OAuth Security
export {
  generateOAuthState,
  setOAuthStateCookie,
  validateOAuthState,
  clearOAuthStateCookie,
  buildOAuthUrl,
} from './oauth-state'

// API Error Handling
export {
  ErrorCode,
  apiError,
  ApiErrors,
  withErrorHandling,
} from './api-errors'

// Input Validation
export {
  MAX_BIO_LENGTH,
  MAX_ARRAY_ITEMS,
  MAX_ARRAY_ITEM_LENGTH,
  MAX_CUSTOM_DESCRIPTION_LENGTH,
  MAX_TEXT_FIELD_LENGTH,
  MAX_SHORT_TEXT_LENGTH,
  MAX_NAME_LENGTH,
  bioSchema,
  httpUrlSchema,
  limitedArraySchema,
  customDescriptionSchema,
  nameSchema,
  shortTextSchema,
  isValidHttpUrl,
  validateBio,
  validateArray,
  validateUrl,
  validateUrls,
  validateTextField,
} from './input-validation'

// Content-Type Validation
export {
  validateContentType,
  withContentTypeValidation,
  isFormDataRoute,
  isExemptRoute,
} from './content-type'

// Image Processing (metadata stripping)
export {
  MAX_IMAGE_WIDTH,
  MAX_IMAGE_HEIGHT,
  IMAGE_QUALITY,
  MAX_PROCESSED_SIZE,
  processImage,
  processAvatarImage,
  processCoverPhoto,
  processPostImage,
  isImageProcessingAvailable,
  getImageMetadata,
} from './image-processing'

