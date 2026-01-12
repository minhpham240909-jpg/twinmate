// API Route: Sign In with Email/Password
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { authenticator } from 'otplib'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { isAccountLocked, recordFailedAttempt, clearLockout, formatLockoutMessage } from '@/lib/account-lockout'
// Note: CSRF protection handled by middleware origin check + Supabase's own auth security

// Configure TOTP with time window tolerance for clock drift
// window: 1 means accept codes from 1 step before and 1 step after (±30 seconds)
// This helps prevent "Invalid code" errors due to slight time differences
authenticator.options = {
  window: 1, // Accept codes within ±30 seconds of current time
  step: 30,  // 30-second time step (standard TOTP)
}

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
  // SECURITY: Use SHA256 hash instead of truncation to ensure consistent 32-byte key
  // This prevents issues with keys longer than 32 bytes and ensures proper key derivation
  const hash = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
  return hash.slice(0, 32) // SHA256 produces 32 bytes, so this is safe
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

    // Check if account is locked
    const lockoutStatus = await isAccountLocked(email)
    if (lockoutStatus.locked) {
      return NextResponse.json(
        {
          error: formatLockoutMessage(lockoutStatus.remainingMinutes!),
          locked: true,
          remainingMinutes: lockoutStatus.remainingMinutes,
        },
        { status: 429 }
      )
    }

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
      // Record failed attempt (account not found)
      await recordFailedAttempt(email)
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    // Sign in with Supabase Auth
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      // Record failed attempt
      const failureResult = await recordFailedAttempt(email)

      // Check if it's an email verification issue
      if (authError.message.includes('Email not confirmed')) {
        return NextResponse.json(
          { error: 'Please confirm your email before signing in. Check your inbox for the confirmation link.' },
          { status: 401 }
        )
      }

      // Wrong password - include remaining attempts warning
      const remainingAttempts = failureResult.remainingAttempts
      let errorMessage = 'Invalid email or password.'

      if (failureResult.locked) {
        errorMessage = formatLockoutMessage(15) // 15 minutes lockout
        return NextResponse.json(
          {
            error: errorMessage,
            locked: true,
            remainingMinutes: 15,
          },
          { status: 429 }
        )
      } else if (remainingAttempts <= 2 && remainingAttempts > 0) {
        errorMessage += ` ${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining before account is temporarily locked.`
      }

      return NextResponse.json(
        {
          error: errorMessage,
          remainingAttempts,
        },
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

        // Check if it's a backup code (backup codes are stored hashed with bcrypt)
        let matchedBackupCodeIndex = -1
        if (!isValidTOTP) {
          for (let i = 0; i < existingUser.twoFactorBackupCodes.length; i++) {
            const isMatch = await bcrypt.compare(
              twoFactorCode.toUpperCase(),
              existingUser.twoFactorBackupCodes[i]
            )
            if (isMatch) {
              matchedBackupCodeIndex = i
              break
            }
          }
        }
        const isBackupCode = matchedBackupCodeIndex !== -1

        if (!isValidTOTP && !isBackupCode) {
          // Invalid 2FA code - sign out and record failed attempt
          await supabase.auth.signOut()
          const failureResult = await recordFailedAttempt(email)

          let errorMessage = 'Invalid two-factor authentication code'
          if (failureResult.locked) {
            errorMessage = formatLockoutMessage(15)
            return NextResponse.json(
              {
                error: errorMessage,
                locked: true,
                remainingMinutes: 15,
              },
              { status: 429 }
            )
          } else if (failureResult.remainingAttempts <= 2) {
            errorMessage += `. ${failureResult.remainingAttempts} attempt${failureResult.remainingAttempts > 1 ? 's' : ''} remaining.`
          }

          return NextResponse.json(
            {
              error: errorMessage,
              remainingAttempts: failureResult.remainingAttempts,
            },
            { status: 401 }
          )
        }

        // If backup code was used, remove it from the list
        if (isBackupCode && matchedBackupCodeIndex !== -1) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              twoFactorBackupCodes: existingUser.twoFactorBackupCodes.filter(
                (_, index) => index !== matchedBackupCodeIndex
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

    // Successful login - clear any lockout
    await clearLockout(email)

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
