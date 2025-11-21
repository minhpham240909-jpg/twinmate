import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isEmailVerified, resendVerificationEmail } from '@/lib/email-verification'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

/**
 * GET /api/auth/verify-email - Check email verification status
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const verified = await isEmailVerified(user.id)

    return NextResponse.json({
      verified,
      email: user.email,
    })
  } catch (error) {
    console.error('Error checking email verification:', error)
    return NextResponse.json(
      { error: 'Failed to check verification status' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/verify-email - Resend verification email
 */
export async function POST(req: NextRequest) {
  // Rate limit: 3 resend attempts per hour
  const rateLimitResult = await rateLimit(req, {
    max: 3,
    windowMs: 3600000, // 1 hour
    keyPrefix: 'resend-verification',
  })

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: 'Too many verification email requests',
        message: 'Please wait before requesting another verification email',
      },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.email) {
      return NextResponse.json({ error: 'No email address found' }, { status: 400 })
    }

    // Check if already verified
    const verified = await isEmailVerified(user.id)
    if (verified) {
      return NextResponse.json({
        success: false,
        message: 'Email is already verified',
      })
    }

    // Resend verification email
    const result = await resendVerificationEmail(user.email)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to resend verification email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully',
    })
  } catch (error) {
    console.error('Error resending verification email:', error)
    return NextResponse.json(
      { error: 'Failed to resend verification email' },
      { status: 500 }
    )
  }
}
