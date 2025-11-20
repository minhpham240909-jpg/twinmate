// API Route: Sign In with Email/Password
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { authenticator } from 'otplib'
import crypto from 'crypto'

// Encryption helpers for decrypting 2FA secret
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
const ALGORITHM = 'aes-256-cbc'

function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required for 2FA')
  }
  if (ENCRYPTION_KEY === 'your-32-character-secret-key-here!' || ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters and not the default value')
  }
  return Buffer.from(ENCRYPTION_KEY).slice(0, 32)
}

function decrypt(text: string): string {
  const key = getEncryptionKey()
  const parts = text.split(':')
  const iv = Buffer.from(parts.shift()!, 'hex')
  const encryptedText = Buffer.from(parts.join(':'), 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString()
}

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  twoFactorCode: z.string().optional(), // Optional 2FA code
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

    const { email, password, twoFactorCode } = validation.data

    // Check if user exists in database first and get 2FA status
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerified: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
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

    // Check if 2FA is enabled
    if (existingUser.twoFactorEnabled && existingUser.twoFactorSecret) {
      // 2FA is enabled - verify the code
      if (!twoFactorCode) {
        // No code provided - sign out and request 2FA
        await supabase.auth.signOut()
        return NextResponse.json({
          success: false,
          requires2FA: true,
          message: 'Two-factor authentication code required',
        })
      }

      // Verify the 2FA code
      try {
        const decryptedSecret = decrypt(existingUser.twoFactorSecret)

        // Check if it's a valid TOTP code
        const isValidTOTP = authenticator.verify({
          token: twoFactorCode,
          secret: decryptedSecret,
        })

        // Check if it's a backup code
        const isBackupCode = existingUser.twoFactorBackupCodes.includes(twoFactorCode.toUpperCase())

        if (!isValidTOTP && !isBackupCode) {
          // Invalid 2FA code - sign out
          await supabase.auth.signOut()
          return NextResponse.json(
            { error: 'Invalid two-factor authentication code' },
            { status: 401 }
          )
        }

        // If backup code was used, remove it from the list
        if (isBackupCode) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              twoFactorBackupCodes: existingUser.twoFactorBackupCodes.filter(
                (code) => code !== twoFactorCode.toUpperCase()
              ),
            },
          })
        }
      } catch (error) {
        console.error('2FA verification error:', error)
        await supabase.auth.signOut()
        return NextResponse.json(
          { error: 'Failed to verify two-factor authentication code' },
          { status: 500 }
        )
      }
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
