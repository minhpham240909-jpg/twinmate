// API Route: Delete User Account (Permanent)
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { withCsrfProtection } from '@/lib/csrf'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE'),
})

export async function POST(request: NextRequest) {
  // SCALABILITY: Rate limit delete account (auth preset - prevents abuse)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.auth)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  return withCsrfProtection(request, async () => {
    try {
      // Verify authentication
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Validate confirmation
      let body
      try {
        body = await request.json()
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid JSON in request body' },
          { status: 400 }
        )
      }
      
      const validation = deleteAccountSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { error: 'You must type DELETE to confirm account deletion' },
          { status: 400 }
        )
      }

      console.log(`[Delete Account] Deleting account for user ${user.id}`)

      try {
        // Delete user from Prisma (cascading deletes will handle related data)
        await prisma.user.delete({
          where: { id: user.id },
        })

        // Delete user from Supabase Auth using admin client with service role
        const adminClient = createAdminClient()
        const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id)

        if (deleteAuthError) {
          console.error('[Delete Account] Error deleting from Supabase Auth:', deleteAuthError)
          // Log error but continue - Prisma deletion is more important
        } else {
          console.log(`[Delete Account] Successfully deleted user from Supabase Auth: ${user.id}`)
        }

        // Sign out the user
        await supabase.auth.signOut()

        console.log(`[Delete Account] Successfully deleted account for user ${user.id}`)

        return NextResponse.json({
          success: true,
          message: 'Account deleted successfully',
        })
      } catch (deleteError) {
        console.error('[Delete Account] Error during deletion:', deleteError)

        // If user doesn't exist in Prisma, try to delete from Supabase Auth only
        const adminClient = createAdminClient()
        const { error: authOnlyDeleteError } = await adminClient.auth.admin.deleteUser(user.id)

        if (authOnlyDeleteError) {
          throw new Error('Failed to delete account from both systems')
        }

        return NextResponse.json({
          success: true,
          message: 'Account deleted successfully',
        })
      }
    } catch (error) {
      console.error('[Delete Account] Error:', error)
      // SECURITY: Don't expose internal error details to client
      return NextResponse.json(
        { error: 'Failed to delete account. Please try again or contact support.' },
        { status: 500 }
      )
    }
  })
}
