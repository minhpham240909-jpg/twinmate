import { z } from 'zod'
import { PAGINATION, CONTENT_LIMITS } from './constants'

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
  content: string,
  maxLength: number,
  fieldName: string = 'Content'
): { valid: boolean; error?: string } {
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
