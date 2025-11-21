// API Route: Sign Up with Email/Password
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { passwordSchema } from '@/lib/password-validation'

const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  name: z.string().min(2, 'Name must be at least 2 characters'),
})

export async function POST(request: NextRequest) {
  // Rate limiting: 3 signup attempts per minute
  const rateLimitResult = await rateLimit(request, RateLimitPresets.auth)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again later.' },
      {
        status: 429,
        headers: rateLimitResult.headers
      }
    )
  }

  let createdAuthUser: { id: string } | null = null
  const supabase = await createClient()

  try {
    const body = await request.json()

    // Validate input
    const validation = signUpSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { email, password, name } = validation.data

    // Check if email already exists in database (Facebook approach)
    // This prevents duplicate accounts and provides clear error message
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in or use a different email.' },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user in Supabase Auth
    // Supabase will send verification email automatically
    // If email is invalid/doesn't exist, Supabase handles bounced emails
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
      },
    })

    if (authError) {
      // Handle specific Supabase auth errors
      let errorMessage = authError.message

      // Check if it's a duplicate email error from Supabase
      if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
        errorMessage = 'An account with this email already exists. Please sign in or use a different email.'
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create auth user' },
        { status: 500 }
      )
    }

    createdAuthUser = { id: authData.user.id }

    // Create user and profile in a single transaction
    // This handles race conditions and ensures atomicity
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Create user in database
        const user = await tx.user.create({
          data: {
            id: authData.user!.id,
            email,
            passwordHash,
            name,
            // avatarUrl is null - users can upload their own avatar later
            role: 'FREE',
          },
        })

        // Create empty profile
        const profile = await tx.profile.create({
          data: {
            userId: user.id,
          },
        })

        return { user, profile }
      })

      return NextResponse.json({
        success: true,
        message: 'Account created successfully. Please check your email for verification.',
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
        },
      })
    } catch (dbError) {
      // Transaction failed - clean up Supabase auth user
      console.error('Database transaction failed, cleaning up auth user:', dbError)

      // Check if it's a unique constraint violation (race condition)
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        // Delete the Supabase auth user we just created
        try {
          const { error: deleteError } = await supabase.auth.admin.deleteUser(createdAuthUser.id)
          if (deleteError) {
            console.error('Failed to delete orphaned auth user:', deleteError)
          }
        } catch (cleanupError) {
          console.error('Error during auth user cleanup:', cleanupError)
        }

        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 409 }
        )
      }

      // For other database errors, attempt cleanup
      if (createdAuthUser) {
        try {
          const { error: deleteError } = await supabase.auth.admin.deleteUser(createdAuthUser.id)
          if (deleteError) {
            console.error('Failed to delete orphaned auth user after DB error:', deleteError)
          }
        } catch (cleanupError) {
          console.error('Error during auth user cleanup:', cleanupError)
        }
      }

      // Re-throw to be caught by outer catch
      throw dbError
    }
  } catch (error) {
    console.error('Sign up error:', error)

    // If we have an orphaned auth user and haven't cleaned it up yet, try once more
    if (createdAuthUser && !(error instanceof Prisma.PrismaClientKnownRequestError)) {
      try {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(createdAuthUser.id)
        if (deleteError) {
          console.error('Final attempt to delete orphaned auth user failed:', deleteError)
        }
      } catch (cleanupError) {
        console.error('Final cleanup error:', cleanupError)
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}