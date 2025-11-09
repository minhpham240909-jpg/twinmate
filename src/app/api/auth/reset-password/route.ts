import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import logger from '@/lib/logger'

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export async function POST(request: NextRequest) {
  // Rate limiting: 5 attempts per 15 minutes
  const rateLimitResult = await rateLimit(request, {
    max: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyPrefix: 'reset-password',
  })

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      {
        status: 429,
        headers: rateLimitResult.headers,
      }
    )
  }

  try {
    const supabase = await createClient()

    // Check if user is authenticated (has valid reset token)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link. Please request a new password reset.' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate input
    const validation = resetPasswordSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { password } = validation.data

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      logger.error('Password update failed', { userId: user.id, error: updateError })
      return NextResponse.json(
        { error: 'Failed to update password. Please try again.' },
        { status: 400 }
      )
    }

    logger.info('Password reset successfully', { data: { userId: user.id } })

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully. You can now sign in with your new password.',
    })
  } catch (error) {
    logger.error('Reset password error', { error: error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
