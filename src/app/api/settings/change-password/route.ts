import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { passwordSchema } from '@/lib/password-validation'
import { withCsrfProtection } from '@/lib/csrf'
import { prisma } from '@/lib/prisma'
import { logPasswordChange, logLogout } from '@/lib/security/audit-logger'
import logger from '@/lib/logger'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  // Optional: allow user to keep current session
  logoutOtherSessions: z.boolean().optional().default(true),
})

export async function POST(request: NextRequest) {
  // Rate limiting (outside CSRF check for proper 429 response)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.auth)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  // Extract IP for audit logging
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
             request.headers.get('x-real-ip') ||
             'unknown'

  return withCsrfProtection(request, async () => {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // OAuth users don't have passwords
      if (!user.email || user.app_metadata?.provider === 'google') {
        return NextResponse.json(
          { error: 'Password change is not available for OAuth accounts' },
          { status: 400 }
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
      
      const validation = changePasswordSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error.issues[0].message },
          { status: 400 }
        )
      }

      const { currentPassword, newPassword, logoutOtherSessions } = validation.data

      // Verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      })

      if (verifyError) {
        // Log failed password change attempt
        await logPasswordChange({
          userId: user.id,
          success: false,
          ip,
        })
        
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 401 }
        )
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        console.error('Password update error:', updateError)
        
        // Log failed password change
        await logPasswordChange({
          userId: user.id,
          success: false,
          ip,
        })
        
        return NextResponse.json(
          { error: 'Failed to update password. Please try again.' },
          { status: 500 }
        )
      }

      // SECURITY FIX: Invalidate all other sessions on password change
      // This prevents unauthorized access if password was compromised
      let invalidatedSessionCount = 0
      
      if (logoutOtherSessions) {
        try {
          // Invalidate all device sessions in our database
          const result = await prisma.deviceSession.updateMany({
            where: {
              userId: user.id,
              isActive: true,
            },
            data: {
              isActive: false,
              updatedAt: new Date(),
            },
          })
          invalidatedSessionCount = result.count
          
          // Also invalidate Supabase sessions using admin client
          // This forces re-authentication on all devices
          try {
            const adminSupabase = await createAdminClient()
            // Sign out all sessions except current (Supabase doesn't have selective logout)
            // The user will need to re-login on other devices
            await adminSupabase.auth.admin.signOut(user.id, 'others')
          } catch (supabaseError) {
            // Log but don't fail - device sessions are already invalidated
            logger.warn('Failed to invalidate Supabase sessions', {
              userId: user.id,
              error: supabaseError instanceof Error ? supabaseError.message : 'Unknown error',
            })
          }
          
          // Log session invalidation
          await logLogout({
            userId: user.id,
            reason: 'password_changed',
            ip,
          })
          
          logger.info('Sessions invalidated after password change', {
            userId: user.id,
            invalidatedCount: invalidatedSessionCount,
          })
        } catch (sessionError) {
          // Log but don't fail the password change
          logger.error('Failed to invalidate sessions after password change', {
            userId: user.id,
            error: sessionError instanceof Error ? sessionError.message : 'Unknown error',
          })
        }
      }

      // Log successful password change
      await logPasswordChange({
        userId: user.id,
        success: true,
        ip,
        invalidatedSessions: invalidatedSessionCount,
      })

      return NextResponse.json({
        success: true,
        message: 'Password changed successfully',
        sessionsInvalidated: invalidatedSessionCount,
        requiresRelogin: logoutOtherSessions && invalidatedSessionCount > 0,
      })
    } catch (error) {
      console.error('Change password error:', error)
      return NextResponse.json(
        { error: 'An unexpected error occurred' },
        { status: 500 }
      )
    }
  })
}
