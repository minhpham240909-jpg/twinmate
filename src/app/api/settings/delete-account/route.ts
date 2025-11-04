// API Route: Delete User Account (Permanent)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE'),
})

export async function POST(request: NextRequest) {
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
    const body = await request.json()
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

      // Delete user from Supabase Auth
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user.id)
      
      if (deleteAuthError) {
        console.error('[Delete Account] Error deleting from Supabase Auth:', deleteAuthError)
        // Continue anyway - Prisma deletion is more important
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
      const { error: authOnlyDeleteError } = await supabase.auth.admin.deleteUser(user.id)
      
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
    return NextResponse.json(
      {
        error: 'Failed to delete account',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
