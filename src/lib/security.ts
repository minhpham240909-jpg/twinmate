/**
 * Security utility functions for input validation and sanitization
 * Prevents XSS, SQL injection, and other common attacks
 */

import logger from './logger'

/**
 * Sanitize user input to prevent XSS attacks
 * This is a basic sanitizer - for production consider using DOMPurify on client-side
 */
export function sanitizeInput(input: string): string {
  if (!input) return ''
  
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers (onclick, onerror, etc)
    .trim()
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(email)
}

/**
 * Validate username format (alphanumeric, underscores, hyphens)
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/
  return usernameRegex.test(username)
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Check if string contains suspicious patterns
 */
export function hasSuspiciousPatterns(input: string): boolean {
  const suspiciousPatterns = [
    /<script/i,
    /<iframe/i,
    /javascript:/i,
    /onerror=/i,
    /onclick=/i,
    /onload=/i,
    /<embed/i,
    /<object/i,
    /eval\(/i,
    /expression\(/i, // CSS expression
    /vbscript:/i,
    /data:text\/html/i,
  ]

  return suspiciousPatterns.some(pattern => pattern.test(input))
}

/**
 * Validate and sanitize object fields
 * Returns sanitized object or null if validation fails
 */
export function validateAndSanitizeObject<T extends Record<string, any>>(
  obj: T,
  rules: Record<keyof T, 'email' | 'username' | 'url' | 'uuid' | 'string' | 'number'>
): T | null {
  try {
    const sanitized: any = {}

    for (const [key, rule] of Object.entries(rules)) {
      const value = obj[key]

      if (value === undefined || value === null) {
        sanitized[key] = value
        continue
      }

      // Check for suspicious patterns in string values
      if (typeof value === 'string' && hasSuspiciousPatterns(value)) {
        logger.warn('Suspicious pattern detected in input', { key, value })
        return null
      }

      switch (rule) {
        case 'email':
          if (typeof value !== 'string' || !isValidEmail(value)) {
            logger.warn('Invalid email format', { key, value })
            return null
          }
          sanitized[key] = value.toLowerCase().trim()
          break

        case 'username':
          if (typeof value !== 'string' || !isValidUsername(value)) {
            logger.warn('Invalid username format', { key, value })
            return null
          }
          sanitized[key] = value.trim()
          break

        case 'url':
          if (typeof value !== 'string' || !isValidUrl(value)) {
            logger.warn('Invalid URL format', { key, value })
            return null
          }
          sanitized[key] = value.trim()
          break

        case 'uuid':
          if (typeof value !== 'string' || !isValidUUID(value)) {
            logger.warn('Invalid UUID format', { key, value })
            return null
          }
          sanitized[key] = value.toLowerCase().trim()
          break

        case 'string':
          if (typeof value !== 'string') {
            logger.warn('Expected string type', { key, value })
            return null
          }
          sanitized[key] = sanitizeInput(value)
          break

        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            logger.warn('Expected number type', { key, value })
            return null
          }
          sanitized[key] = value
          break

        default:
          sanitized[key] = value
      }
    }

    return sanitized as T
  } catch (error) {
    logger.error('Error validating object', error as Error)
    return null
  }
}

/**
 * Rate limit key generator - prevents user enumeration
 * Generates a consistent but obfuscated key for rate limiting
 * SECURITY: Uses SHA256 hash instead of base64 to prevent reverse engineering
 */
export function generateRateLimitKey(identifier: string, prefix: string): string {
  // SECURITY: Use SHA256 hash instead of base64 to prevent user enumeration
  // Base64 is reversible, making it easy to extract user identifiers
  const crypto = require('crypto')
  const hash = crypto.createHash('sha256').update(identifier).digest('hex')
  return `${prefix}:${hash}`
}

/**
 * Validate password strength
 */
export function isStrongPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Sanitize filename to prevent directory traversal and injection attacks
 * SECURITY: Enhanced sanitization to prevent path traversal and control characters
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'file'
  }
  
  // Remove null bytes and control characters
  let sanitized = filename
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[^a-zA-Z0-9._-]/g, '') // Only allow alphanumeric, dots, underscores, hyphens
    .replace(/^\.+/, '') // Remove leading dots
    .replace(/\.\.+/g, '.') // Remove multiple dots (path traversal attempt)
    .replace(/\.$/, '') // Remove trailing dots
    .substring(0, 255) // Limit length
  
  // Ensure filename is not empty and doesn't start with reserved names (Windows)
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']
  const nameWithoutExt = sanitized.split('.')[0].toUpperCase()
  if (reservedNames.includes(nameWithoutExt) || sanitized.length === 0) {
    sanitized = `file_${Date.now()}`
  }
  
  return sanitized
}
