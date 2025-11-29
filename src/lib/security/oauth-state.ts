/**
 * OAuth State Parameter Validation
 * 
 * Implements CSRF protection for OAuth flows by:
 * 1. Generating a cryptographically secure state parameter
 * 2. Storing it in an HTTP-only cookie
 * 3. Validating it when the OAuth callback returns
 */

import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/logger'

const OAUTH_STATE_COOKIE = 'oauth_state'
const OAUTH_STATE_EXPIRY = 10 * 60 * 1000 // 10 minutes

/**
 * Generate a cryptographically secure state parameter
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Create state and set it in a secure cookie
 */
export async function setOAuthStateCookie(): Promise<string> {
  const state = generateOAuthState()
  const cookieStore = await cookies()
  
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: OAUTH_STATE_EXPIRY / 1000, // Convert to seconds
  })
  
  return state
}

/**
 * Validate the state parameter from OAuth callback
 */
export async function validateOAuthState(stateFromCallback: string | null): Promise<{
  valid: boolean
  reason?: string
}> {
  if (!stateFromCallback) {
    logger.warn('OAuth callback missing state parameter')
    return { valid: false, reason: 'Missing state parameter' }
  }
  
  const cookieStore = await cookies()
  const storedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value
  
  if (!storedState) {
    logger.warn('OAuth state cookie not found')
    return { valid: false, reason: 'State cookie expired or missing' }
  }
  
  // Clear the state cookie immediately after reading
  cookieStore.delete(OAUTH_STATE_COOKIE)
  
  // Timing-safe comparison
  if (!timingSafeEqual(stateFromCallback, storedState)) {
    logger.warn('OAuth state mismatch', { 
      callbackStateLength: stateFromCallback.length,
      storedStateLength: storedState.length 
    })
    return { valid: false, reason: 'State mismatch - possible CSRF attack' }
  }
  
  return { valid: true }
}

/**
 * Clear OAuth state cookie
 */
export async function clearOAuthStateCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(OAUTH_STATE_COOKIE)
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * Build OAuth URL with state parameter
 */
export function buildOAuthUrl(baseUrl: string, state: string, additionalParams?: Record<string, string>): string {
  const url = new URL(baseUrl)
  url.searchParams.set('state', state)
  
  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }
  
  return url.toString()
}

