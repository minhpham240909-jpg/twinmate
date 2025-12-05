import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { passwordSchema } from '@/lib/password-validation'
import { withCsrfProtection } from '@/lib/csrf'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
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

      const body = await request.json()
      const validation = changePasswordSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error.issues[0].message },
          { status: 400 }
        )
      }

      const { currentPassword, newPassword } = validation.data

      // Verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      })

      if (verifyError) {
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
        return NextResponse.json(
          { error: 'Failed to update password. Please try again.' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Password changed successfully',
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
