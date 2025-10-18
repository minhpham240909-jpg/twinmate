// API Route: Sign In with Email/Password
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(request: NextRequest) {
  // Rate limiting: 5 signin attempts per minute
  const rateLimitResult = await rateLimit(request, RateLimitPresets.auth)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      {
        status: 429,
        headers: rateLimitResult.headers
      }
    )
  }

  try {
    const body = await request.json()

    // Validate input
    const validation = signInSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { email, password } = validation.data

    // Check if user exists in database first
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Account not found. Please sign up to access the app.' },
        { status: 404 }
      )
    }

    // Sign in with Supabase Auth
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      // Check if it's an email verification issue
      if (authError.message.includes('Email not confirmed')) {
        return NextResponse.json(
          { error: 'Please confirm your email before signing in. Check your inbox for the confirmation link.' },
          { status: 401 }
        )
      }

      // Wrong password
      return NextResponse.json(
        { error: 'Invalid password. Please try again.' },
        { status: 401 }
      )
    }

    // Update last login
    await prisma.user.update({
      where: { id: authData.user.id },
      data: { lastLoginAt: new Date() },
    })

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: authData.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Signed in successfully',
      user,
    })
  } catch (error) {
    console.error('Sign in error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}