import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import logger from '@/lib/logger'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

// In-memory store for email-based rate limiting
// In production, use Redis for distributed rate limiting
const emailRateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Cleanup old entries periodically
if (typeof window === 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of emailRateLimitStore.entries()) {
      if (value.resetTime < now) {
        emailRateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000) // Clean up every 5 minutes
}

/**
 * Email-based rate limiting: 3 requests per hour per email
 * This is stricter than IP-based limiting to prevent abuse
 */
function checkEmailRateLimit(email: string): { allowed: boolean; retryAfter?: number } {
  const normalizedEmail = email.toLowerCase().trim()
  const key = `forgot-password:${normalizedEmail}`
  const now = Date.now()
  const windowMs = 60 * 60 * 1000 // 1 hour
  const maxRequests = 3
  
  const record = emailRateLimitStore.get(key)
  
  if (!record || record.resetTime < now) {
    // New window
    emailRateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true }
  }
  
  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000)
    return { allowed: false, retryAfter }
  }
  
  // Increment count
  record.count++
  emailRateLimitStore.set(key, record)
  return { allowed: true }
}

export async function POST(request: NextRequest) {
  // IP-based rate limiting: 10 attempts per 15 minutes (general protection)
  const rateLimitResult = await rateLimit(request, {
    max: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyPrefix: 'forgot-password-ip',
  })

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many password reset requests. Please try again later.' },
      {
        status: 429,
        headers: rateLimitResult.headers,
      }
    )
  }

  try {
    const body = await request.json()

    // Validate input
    const validation = forgotPasswordSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { email } = validation.data
    
    // Email-based rate limiting: 3 requests per hour per email (stricter)
    const emailRateLimit = checkEmailRateLimit(email)
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many password reset requests for this email. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': emailRateLimit.retryAfter?.toString() || '3600',
          },
        }
      )
    }
    
    const supabase = await createClient()

    // Send password reset email
    // Supabase handles token generation and email sending
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/reset-password`,
    })

    if (error) {
      logger.error('Password reset request failed', error)
      // Don't reveal if email exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, we sent a password reset link.',
      })
    }

    logger.info('Password reset email sent', { data: { email } })

    // Always return success message (even if email doesn't exist)
    // This prevents email enumeration attacks
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, we sent a password reset link. Please check your inbox.',
    })
  } catch (error) {
    logger.error('Forgot password error', { error: error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
