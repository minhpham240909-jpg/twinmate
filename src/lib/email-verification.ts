import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * Email Verification Enforcement
 * 
 * Blocks unverified users from accessing critical features
 * that require verified email addresses.
 */

/**
 * Check if user's email is verified
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  try {
    // Check Supabase auth metadata
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user || user.id !== userId) {
      return false
    }

    // Supabase users have email_confirmed_at field
    if (user.email_confirmed_at) {
      // Update database if not already marked as verified
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      }).catch(() => {
        // Silently fail - verification status is primarily from Supabase
      })
      return true
    }

    // Fallback to database check
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    })

    return dbUser?.emailVerified || false
  } catch (error) {
    console.error('Error checking email verification:', error)
    return false
  }
}

/**
 * Middleware to require email verification
 * Use this to protect API routes that need verified emails
 */
export async function requireEmailVerification(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if email is verified
    const verified = await isEmailVerified(user.id)
    
    if (!verified) {
      return NextResponse.json(
        {
          error: 'Email verification required',
          message: 'Please verify your email address to access this feature',
          needsVerification: true,
        },
        { status: 403 }
      )
    }

    return handler()
  } catch (error) {
    console.error('Email verification middleware error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Features that require email verification
 */
export const FEATURES_REQUIRING_VERIFICATION = {
  CREATE_SESSION: 'create study sessions',
  JOIN_SESSION: 'join study sessions',
  SEND_MESSAGE: 'send messages',
  CREATE_GROUP: 'create groups',
  SEND_CONNECTION: 'send connection requests',
  UPLOAD_FILES: 'upload files',
  CREATE_POST: 'create posts',
  COMMENT: 'comment on posts',
} as const

/**
 * Get user-friendly error message for verification requirement
 */
export function getVerificationErrorMessage(feature: keyof typeof FEATURES_REQUIRING_VERIFICATION): string {
  return `Please verify your email address to ${FEATURES_REQUIRING_VERIFICATION[feature]}`
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
      },
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error resending verification email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resend email',
    }
  }
}
