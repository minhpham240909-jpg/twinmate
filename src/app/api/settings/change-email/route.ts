import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

const changeEmailSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
})

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimit(request, RateLimitPresets.auth)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
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

    const body = await request.json()
    const validation = changeEmailSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { newEmail } = validation.data

    // Check if email is the same as current
    if (newEmail.toLowerCase() === user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: 'This is already your current email address' },
        { status: 400 }
      )
    }

    // Check if new email is already in use (prevent enumeration by doing generic check)
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail.toLowerCase() },
      select: { id: true },
    })

    if (existingUser && existingUser.id !== user.id) {
      // Generic message to prevent email enumeration
      return NextResponse.json(
        { error: 'Unable to change email. Please try a different email address.' },
        { status: 400 }
      )
    }

    // Send verification email to new address using Supabase
    // User will need to click link in email to confirm change
    const { error: updateError } = await supabase.auth.updateUser({
      email: newEmail,
    })

    if (updateError) {
      console.error('Email update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to initiate email change. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent to your new address. Please check your inbox and click the confirmation link.',
      requiresVerification: true,
    })
  } catch (error) {
    console.error('Change email error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
