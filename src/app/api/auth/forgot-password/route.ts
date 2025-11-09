import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import logger from '@/lib/logger'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function POST(request: NextRequest) {
  // Rate limiting: 3 attempts per 15 minutes to prevent abuse
  const rateLimitResult = await rateLimit(request, {
    max: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyPrefix: 'forgot-password',
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
