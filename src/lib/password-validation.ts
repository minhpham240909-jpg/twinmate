/**
 * Password Validation Utility
 *
 * Enforces strong password policy:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */

import { z } from 'zod'

/**
 * Strong password validation regex
 * Requires:
 * - (?=.*[a-z]) - at least one lowercase letter
 * - (?=.*[A-Z]) - at least one uppercase letter
 * - (?=.*\d) - at least one digit
 * - (?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]) - at least one special character
 * - .{8,} - at least 8 characters
 */
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]).{8,}$/

/**
 * Password validation error messages
 */
export const PASSWORD_ERRORS = {
  TOO_SHORT: 'Password must be at least 8 characters long',
  NO_UPPERCASE: 'Password must contain at least one uppercase letter',
  NO_LOWERCASE: 'Password must contain at least one lowercase letter',
  NO_NUMBER: 'Password must contain at least one number',
  NO_SPECIAL: 'Password must contain at least one special character (@$!%*?&#^()_+-=[]{};\':"|,.<>/)',
  INVALID: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character',
} as const

/**
 * Validate password strength
 * Returns detailed error message or null if valid
 */
export function validatePassword(password: string): string | null {
  if (!password) {
    return PASSWORD_ERRORS.INVALID
  }

  // Check minimum length
  if (password.length < 8) {
    return PASSWORD_ERRORS.TOO_SHORT
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    return PASSWORD_ERRORS.NO_LOWERCASE
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    return PASSWORD_ERRORS.NO_UPPERCASE
  }

  // Check for digit
  if (!/\d/.test(password)) {
    return PASSWORD_ERRORS.NO_NUMBER
  }

  // Check for special character
  if (!/[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]/.test(password)) {
    return PASSWORD_ERRORS.NO_SPECIAL
  }

  return null // Valid password
}

/**
 * Check if password meets all requirements
 */
export function isStrongPassword(password: string): boolean {
  return STRONG_PASSWORD_REGEX.test(password)
}

/**
 * Zod schema for strong password validation
 * Use this in API routes for validation
 */
export const strongPasswordSchema = z.string().refine(
  (password) => {
    const error = validatePassword(password)
    return error === null
  },
  {
    message: PASSWORD_ERRORS.INVALID,
  }
)

/**
 * Zod schema with custom error messages for better UX
 */
export const passwordSchema = z.string().superRefine((password, ctx) => {
  const error = validatePassword(password)
  if (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error,
    })
  }
})

/**
 * Get password strength score (0-4)
 * 0 = Very Weak, 1 = Weak, 2 = Fair, 3 = Strong, 4 = Very Strong
 */
export function getPasswordStrength(password: string): number {
  if (!password) return 0

  let score = 0

  // Length bonus
  if (password.length >= 8) score++
  if (password.length >= 12) score++

  // Character variety bonus
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]/.test(password)) score++

  // Cap at 4
  return Math.min(score, 4)
}

/**
 * Get password strength label
 */
export function getPasswordStrengthLabel(strength: number): string {
  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong']
  return labels[strength] || 'Very Weak'
}

/**
 * Generate password requirements message for UI
 */
export function getPasswordRequirementsMessage(): string {
  return 'Password must be at least 8 characters and include:\n• One uppercase letter (A-Z)\n• One lowercase letter (a-z)\n• One number (0-9)\n• One special character (@$!%*?&#^()_+-=[]{};\':"|,.<>/)'
}
