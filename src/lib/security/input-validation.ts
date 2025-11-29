/**
 * Server-Side Input Validation Utilities
 * 
 * Provides comprehensive validation for user inputs including:
 * - Bio length limits
 * - Array size limits
 * - URL validation (HTTP(S) only)
 * - String length limits
 */

import { z } from 'zod'

// ===== CONSTANTS =====

/** Maximum bio length (characters) */
export const MAX_BIO_LENGTH = 500

/** Maximum number of items in arrays (subjects, interests, etc.) */
export const MAX_ARRAY_ITEMS = 20

/** Maximum length of individual array items */
export const MAX_ARRAY_ITEM_LENGTH = 100

/** Maximum length for custom descriptions */
export const MAX_CUSTOM_DESCRIPTION_LENGTH = 300

/** Maximum length for general text fields */
export const MAX_TEXT_FIELD_LENGTH = 1000

/** Maximum length for short text fields */
export const MAX_SHORT_TEXT_LENGTH = 100

/** Maximum length for name fields */
export const MAX_NAME_LENGTH = 100

// ===== ZOD SCHEMAS =====

/**
 * Bio schema with length limit
 */
export const bioSchema = z
  .string()
  .max(MAX_BIO_LENGTH, `Bio must be ${MAX_BIO_LENGTH} characters or less`)
  .optional()
  .nullable()

/**
 * URL schema that only allows HTTP(S) protocols
 */
export const httpUrlSchema = z
  .string()
  .refine(
    (url) => {
      if (!url || url.trim() === '') return true // Allow empty
      try {
        const parsed = new URL(url)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      } catch {
        return false
      }
    },
    { message: 'URL must use HTTP or HTTPS protocol' }
  )
  .optional()
  .nullable()

/**
 * Array schema with item count and length limits
 */
export function limitedArraySchema(
  maxItems: number = MAX_ARRAY_ITEMS,
  maxItemLength: number = MAX_ARRAY_ITEM_LENGTH
) {
  return z
    .array(
      z.string().max(maxItemLength, `Each item must be ${maxItemLength} characters or less`)
    )
    .max(maxItems, `Maximum ${maxItems} items allowed`)
    .default([])
}

/**
 * Custom description schema with length limit
 */
export const customDescriptionSchema = z
  .string()
  .max(MAX_CUSTOM_DESCRIPTION_LENGTH, `Description must be ${MAX_CUSTOM_DESCRIPTION_LENGTH} characters or less`)
  .optional()
  .nullable()

/**
 * Name schema with length limit
 */
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or less`)

/**
 * Short text schema
 */
export const shortTextSchema = z
  .string()
  .max(MAX_SHORT_TEXT_LENGTH, `Text must be ${MAX_SHORT_TEXT_LENGTH} characters or less`)
  .optional()
  .nullable()

// ===== VALIDATION FUNCTIONS =====

/**
 * Validate URL is HTTP(S) only
 */
export function isValidHttpUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === '') return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Validate and sanitize bio
 */
export function validateBio(bio: string | null | undefined): {
  valid: boolean
  sanitized: string | null
  error?: string
} {
  if (!bio || bio.trim() === '') {
    return { valid: true, sanitized: null }
  }
  
  const trimmed = bio.trim()
  
  if (trimmed.length > MAX_BIO_LENGTH) {
    return {
      valid: false,
      sanitized: null,
      error: `Bio must be ${MAX_BIO_LENGTH} characters or less (currently ${trimmed.length})`,
    }
  }
  
  return { valid: true, sanitized: trimmed }
}

/**
 * Validate and limit array
 */
export function validateArray(
  arr: string[] | null | undefined,
  maxItems: number = MAX_ARRAY_ITEMS,
  maxItemLength: number = MAX_ARRAY_ITEM_LENGTH
): {
  valid: boolean
  sanitized: string[]
  error?: string
} {
  if (!arr || !Array.isArray(arr)) {
    return { valid: true, sanitized: [] }
  }
  
  if (arr.length > maxItems) {
    return {
      valid: false,
      sanitized: [],
      error: `Maximum ${maxItems} items allowed (received ${arr.length})`,
    }
  }
  
  // Validate and sanitize each item
  const sanitized: string[] = []
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    if (typeof item !== 'string') continue
    
    const trimmed = item.trim()
    if (trimmed === '') continue
    
    if (trimmed.length > maxItemLength) {
      return {
        valid: false,
        sanitized: [],
        error: `Item at position ${i + 1} exceeds ${maxItemLength} characters`,
      }
    }
    
    sanitized.push(trimmed)
  }
  
  return { valid: true, sanitized }
}

/**
 * Validate URL field
 */
export function validateUrl(url: string | null | undefined): {
  valid: boolean
  sanitized: string | null
  error?: string
} {
  if (!url || url.trim() === '') {
    return { valid: true, sanitized: null }
  }
  
  const trimmed = url.trim()
  
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        sanitized: null,
        error: 'URL must use HTTP or HTTPS protocol',
      }
    }
    return { valid: true, sanitized: trimmed }
  } catch {
    return {
      valid: false,
      sanitized: null,
      error: 'Invalid URL format',
    }
  }
}

/**
 * Batch validate multiple URLs
 */
export function validateUrls(urls: Record<string, string | null | undefined>): {
  valid: boolean
  sanitized: Record<string, string | null>
  errors: Record<string, string>
} {
  const sanitized: Record<string, string | null> = {}
  const errors: Record<string, string> = {}
  let valid = true
  
  for (const [key, url] of Object.entries(urls)) {
    const result = validateUrl(url)
    sanitized[key] = result.sanitized
    if (!result.valid && result.error) {
      valid = false
      errors[key] = result.error
    }
  }
  
  return { valid, sanitized, errors }
}

/**
 * Validate text field with custom max length
 */
export function validateTextField(
  text: string | null | undefined,
  maxLength: number = MAX_TEXT_FIELD_LENGTH,
  fieldName: string = 'Text'
): {
  valid: boolean
  sanitized: string | null
  error?: string
} {
  if (!text || text.trim() === '') {
    return { valid: true, sanitized: null }
  }
  
  const trimmed = text.trim()
  
  if (trimmed.length > maxLength) {
    return {
      valid: false,
      sanitized: null,
      error: `${fieldName} must be ${maxLength} characters or less`,
    }
  }
  
  return { valid: true, sanitized: trimmed }
}

