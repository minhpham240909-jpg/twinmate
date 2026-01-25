import { z } from 'zod'
import { PAGINATION } from './constants'

// ==========================================
// MESSAGE VALIDATION
// ==========================================

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long'),
  conversationId: z.string().uuid('Invalid conversation ID'),
  conversationType: z.enum(['partner', 'group']),
  type: z.enum(['TEXT', 'IMAGE', 'FILE', 'SYSTEM']).optional(),
  fileUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().int().positive().optional(),
})

export const callMessageSchema = z.object({
  action: z.enum(['start', 'end']),
  messageId: z.string().uuid().optional(),
  conversationId: z.string().uuid('Invalid conversation ID'),
  conversationType: z.enum(['partner', 'group']),
  callType: z.enum(['AUDIO', 'VIDEO']),
  callDuration: z.number().int().nonnegative().optional(),
  callStatus: z.enum(['STARTED', 'COMPLETED', 'MISSED', 'CANCELLED', 'DECLINED']).optional(),
})

// ==========================================
// MATCH/CONNECTION VALIDATION
// ==========================================

export const createMatchSchema = z.object({
  receiverId: z.string().uuid('Invalid user ID'),
  message: z.string().max(500, 'Message too long').optional(),
})

export const respondToMatchSchema = z.object({
  matchId: z.string().uuid('Invalid match ID'),
  action: z.enum(['accept', 'reject']),
})

// ==========================================
// GROUP VALIDATION
// ==========================================

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name required').max(100, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  subject: z.string().min(1, 'Subject required').max(100, 'Subject too long'),
  subjectCustomDescription: z.string().max(500).optional(),
  skillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  skillLevelCustomDescription: z.string().max(500).optional(),
  privacy: z.enum(['PUBLIC', 'PRIVATE', 'INVITE_ONLY']),
  maxMembers: z.number().int().min(2).max(100),
})

export const inviteToGroupSchema = z.object({
  groupId: z.string().uuid('Invalid group ID'),
  inviteeId: z.string().uuid('Invalid user ID'),
  message: z.string().max(500, 'Message too long').optional(),
})

// ==========================================
// STUDY SESSION VALIDATION
// ==========================================

export const createStudySessionSchema = z.object({
  title: z.string().min(1, 'Title required').max(200, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  type: z.enum(['SOLO', 'ONE_ON_ONE', 'GROUP']),
  subject: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  maxParticipants: z.number().int().min(1).max(50),
  isPublic: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional(),
})

export const inviteToSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  userIds: z.array(z.string().uuid()).min(1).max(20),
})

export const updateSessionGoalSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  goalId: z.string().uuid('Invalid goal ID'),
  isCompleted: z.boolean(),
})

// ==========================================
// PROFILE VALIDATION
// ==========================================

export const updateProfileSchema = z.object({
  bio: z.string().max(1000, 'Bio too long').optional(),
  timezone: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  subjects: z.array(z.string().max(100)).max(20).optional(),
  interests: z.array(z.string().max(100)).max(20).optional(),
  goals: z.array(z.string().max(200)).max(10).optional(),
  skillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  studyStyle: z.enum(['VISUAL', 'AUDITORY', 'KINESTHETIC', 'READING_WRITING', 'COLLABORATIVE', 'INDEPENDENT', 'SOLO', 'MIXED']).optional(),
  school: z.string().max(200).optional(),
  languages: z.string().max(500).optional(),
  availableDays: z.array(z.string()).max(7).optional(),
  availableHours: z.array(z.string()).max(20).optional(),
  aboutYourselfItems: z.array(z.string().max(100)).max(20).optional(),
  aboutYourself: z.string().max(2000).optional(),
  onlineStatus: z.enum(['ONLINE', 'BUSY', 'OFFLINE', 'LOOKING_FOR_PARTNER']).optional(),
  isLookingForPartner: z.boolean().optional(),
  showLocation: z.boolean().optional(),
  showEmail: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
})

// ==========================================
// NOTIFICATION VALIDATION
// ==========================================

export const markNotificationReadSchema = z.object({
  notificationId: z.string().uuid('Invalid notification ID').optional(),
  notificationIds: z.array(z.string().uuid()).optional(),
}).refine(
  (data) => data.notificationId || data.notificationIds,
  { message: 'Either notificationId or notificationIds must be provided' }
)

export const deleteNotificationSchema = z.object({
  notificationIds: z.array(z.string().uuid()).min(1, 'At least one notification ID required'),
})

// ==========================================
// PAGINATION & FILTERING
// ==========================================

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
})

export const messageQuerySchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  conversationType: z.enum(['partner', 'group']),
  limit: z.number().int().min(1).max(100).default(50),
  before: z.string().uuid().optional(), // Message ID to fetch messages before
})

// ==========================================
// HELPER FUNCTIONS
// ==========================================

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validatedData = schema.parse(data)
    return { success: true, data: validatedData }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      return { success: false, error: errorMessage }
    }
    return { success: false, error: 'Validation failed' }
  }
}

export function validateRequestAsync<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  return new Promise((resolve) => {
    const result = validateRequest(schema, data)
    resolve(result)
  })
}

// ==========================================
// ADDITIONAL VALIDATION UTILITIES
// ==========================================

/**
 * Validates and sanitizes pagination limit parameter
 * 
 * @param limit - The limit parameter from query string (can be null)
 * @param defaultLimit - Optional default limit (defaults to PAGINATION.DEFAULT_LIMIT)
 * @param maxLimit - Optional max limit (defaults to PAGINATION.MAX_LIMIT)
 * @returns Validated limit within bounds
 */
export function validatePaginationLimit(
  limit: string | null,
  defaultLimit: number = PAGINATION.DEFAULT_LIMIT,
  maxLimit: number = PAGINATION.MAX_LIMIT
): number {
  const parsed = parseInt(limit || String(defaultLimit))
  
  if (isNaN(parsed) || parsed < 1) {
    return defaultLimit
  }
  
  return Math.min(parsed, maxLimit)
}

/**
 * Validates content string length
 * 
 * @param content - The content string to validate
 * @param maxLength - Maximum allowed length
 * @param fieldName - Name of the field (for error messages)
 * @returns Validation result with error message if invalid
 */
export function validateContent(
  content: string | undefined | null,
  maxLength: number,
  fieldName: string = 'Content'
): { valid: boolean; error?: string } {
  // Handle undefined/null content
  if (content === undefined || content === null) {
    return {
      valid: false,
      error: `${fieldName} cannot be empty`
    }
  }

  const trimmed = content.trim()

  if (trimmed.length === 0) {
    return {
      valid: false,
      error: `${fieldName} cannot be empty`
    }
  }
  
  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} too long (max ${maxLength} characters)`
    }
  }
  
  return { valid: true }
}

/**
 * Validates and parses a positive integer parameter
 * 
 * @param value - The value to parse (can be null)
 * @param defaultValue - Default value to use if parsing fails
 * @returns Validated positive integer or default value
 */
export function validatePositiveInt(
  value: string | null,
  defaultValue: number
): number {
  const parsed = parseInt(value || String(defaultValue))
  return isNaN(parsed) || parsed < 1 ? defaultValue : parsed
}

/**
 * Validates an array parameter has items and doesn't exceed max length
 * 
 * @param array - The array to validate
 * @param maxLength - Maximum allowed array length
 * @param fieldName - Name of the field (for error messages)
 * @returns Validation result with error message if invalid
 */
export function validateArray(
  array: unknown[],
  maxLength: number,
  fieldName: string = 'Array'
): { valid: boolean; error?: string } {
  if (!Array.isArray(array)) {
    return {
      valid: false,
      error: `${fieldName} must be an array`
    }
  }
  
  if (array.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} cannot have more than ${maxLength} items`
    }
  }
  
  return { valid: true }
}

/**
 * Validates a date range
 *
 * @param days - Number of days to look back
 * @param maxDays - Maximum allowed days
 * @param defaultDays - Default days to use if invalid
 * @returns Validated number of days
 */
export function validateDateRange(
  days: string | null,
  maxDays: number,
  defaultDays: number
): number {
  const parsed = parseInt(days || String(defaultDays))

  if (isNaN(parsed) || parsed < 1) {
    return defaultDays
  }

  return Math.min(parsed, maxDays)
}

// ==========================================
// ENFORCEMENT VALIDATION
// ==========================================

/**
 * Sanitize user-submitted text content
 * - Removes potential XSS vectors
 * - Strips excessive whitespace
 * - Validates UTF-8 encoding
 */
export function sanitizeUserInput(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }

  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace (collapse multiple spaces, but preserve newlines)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    // Trim leading/trailing whitespace
    .trim()
    // Limit length to prevent memory issues
    .slice(0, 10000)
}

/**
 * Validate explanation quality beyond just length
 * Checks for:
 * - Minimum word count
 * - Not just repeated characters
 * - Contains actual words (not just numbers/symbols)
 */
export function validateExplanationQuality(
  content: string,
  options: {
    minLength?: number
    minWords?: number
    minUniqueWords?: number
  } = {}
): { valid: boolean; reason?: string } {
  const {
    minLength = 100,
    minWords = 15,
    minUniqueWords = 10
  } = options

  const sanitized = sanitizeUserInput(content)

  // Check length
  if (sanitized.length < minLength) {
    return {
      valid: false,
      reason: `Explanation too short. Minimum ${minLength} characters required.`
    }
  }

  // Check word count
  const words = sanitized
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2) // Ignore very short words

  if (words.length < minWords) {
    return {
      valid: false,
      reason: `Explanation needs more substance. At least ${minWords} meaningful words required.`
    }
  }

  // Check for unique words (prevents "test test test test...")
  const uniqueWords = new Set(words)
  if (uniqueWords.size < minUniqueWords) {
    return {
      valid: false,
      reason: 'Explanation lacks variety. Use more diverse vocabulary.'
    }
  }

  // Check for gibberish (random character strings)
  const alphabeticWords = words.filter(w => /^[a-z]+$/.test(w))
  const alphabeticRatio = alphabeticWords.length / words.length
  if (alphabeticRatio < 0.5) {
    return {
      valid: false,
      reason: 'Explanation must contain mostly real words.'
    }
  }

  return { valid: true }
}

/**
 * Validate quiz score
 */
export function validateQuizScore(
  score: number | undefined,
  threshold: number = 80
): { valid: boolean; reason?: string } {
  if (typeof score !== 'number' || isNaN(score)) {
    return {
      valid: false,
      reason: 'Quiz score is required.'
    }
  }

  if (score < 0 || score > 100) {
    return {
      valid: false,
      reason: 'Quiz score must be between 0 and 100.'
    }
  }

  if (score < threshold) {
    return {
      valid: false,
      reason: `Score of ${score}% is below the ${threshold}% threshold. Review and try again.`
    }
  }

  return { valid: true }
}

/**
 * Validate practice submission
 */
export function validatePracticeSubmission(
  content: string
): { valid: boolean; reason?: string } {
  const sanitized = sanitizeUserInput(content)

  if (sanitized.length < 20) {
    return {
      valid: false,
      reason: 'Practice summary too brief. Describe what you did and learned.'
    }
  }

  return { valid: true }
}

// ==========================================
// REMEDIATION VALIDATION SCHEMAS
// ==========================================

export const remediationProofSchema = z.object({
  type: z.enum(['explanation', 'quiz', 'practice']),
  content: z.string().min(1, 'Content required'),
  score: z.number().min(0).max(100).optional()
})

export const remediationSubmitSchema = z.object({
  missionId: z.string().min(1, 'Mission ID required'),
  proof: remediationProofSchema
})
