import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'

// SECURITY: Email validation with additional checks
const changeEmailSchema = z.object({
  newEmail: z.string()
    .email('Invalid email address')
    .max(254, 'Email address too long') // RFC 5321 max length
    .transform(email => email.toLowerCase().trim()),
  password: z.string().min(1, 'Current password is required'),
})

// Token expiration: 24 hours (used by Supabase's built-in flow)
const TOKEN_EXPIRATION_HOURS = 24

export async function POST(request: NextRequest) {
  // Rate limiting - stricter for email changes (3 attempts per hour)
  const rateLimitResult = await rateLimit(request, {
    max: 3,
    windowMs: 60 * 60 * 1000, // 1 hour in milliseconds
    keyPrefix: 'email-change',
  })
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many email change attempts. Please try again in an hour.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    const validation = changeEmailSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { newEmail, password } = validation.data
    // newEmail is already normalized by the schema transform
    const normalizedEmail = newEmail

    // SECURITY: Verify current password before allowing email change
    // This prevents email hijacking if someone has session access
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email || '',
      password: password,
    })

    if (signInError) {
      // Log failed attempt for security monitoring
      console.warn(`[Email Change] Password verification failed for user ${user.id}`)
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    // Check if email is the same as current
    if (normalizedEmail === user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: 'This is already your current email address' },
        { status: 400 }
      )
    }

    // Check if new email is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (existingUser && existingUser.id !== user.id) {
      // Generic message to prevent email enumeration
      return NextResponse.json(
        { error: 'Unable to change email. Please try a different email address.' },
        { status: 400 }
      )
    }

    // SECURITY: Use Supabase's built-in email change flow
    // This requires user to confirm from BOTH old and new email addresses
    // Supabase handles token generation, storage, and validation securely
    const { error: updateError } = await supabase.auth.updateUser({
      email: normalizedEmail,
    }, {
      // Supabase sends confirmation emails to both addresses
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?type=email_change`,
    })

    if (updateError) {
      console.error('Email update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to initiate email change. Please try again.' },
        { status: 500 }
      )
    }

    // Log security event
    console.info(`[Email Change] Initiated for user ${user.id}: ${user.email} -> ${normalizedEmail}`)

    return NextResponse.json({
      success: true,
      message: 'Verification emails sent! Please check both your current and new email addresses to confirm the change.',
      requiresVerification: true,
      expiresIn: `${TOKEN_EXPIRATION_HOURS} hours`,
    })
  } catch (error) {
    console.error('Change email error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// GET - Check pending email change status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if there's a pending email change in Supabase
    // Supabase stores this in user.new_email when email change is pending
    const newEmail = user.new_email

    return NextResponse.json({
      success: true,
      hasPendingChange: !!newEmail,
      pendingEmail: newEmail || null,
      currentEmail: user.email,
    })
  } catch (error) {
    console.error('Check email change status error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// DELETE - Cancel pending email change
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Cancel by re-setting email to current email
    // This effectively cancels any pending change
    if (user.email) {
      await supabase.auth.updateUser({
        email: user.email,
      })
    }

    console.info(`[Email Change] Cancelled by user ${user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Email change cancelled',
    })
  } catch (error) {
    console.error('Cancel email change error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
