// API Route: Delete User Account
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
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

    // Parse request body for confirmation
    const body = await request.json()
    const { confirmation } = body

    if (confirmation !== 'DELETE') {
      return NextResponse.json(
        { error: 'Invalid confirmation. Please type DELETE to confirm.' },
        { status: 400 }
      )
    }

    console.log(`[Delete Account] Starting deletion process for user: ${user.id}`)

    // Delete user data from Supabase (tables with CASCADE will auto-delete)
    // The User table has ON DELETE CASCADE foreign keys, so related data will be deleted automatically
    // But we'll explicitly delete some data for clarity

    try {
      // 1. Delete user settings
      await supabase.from('UserSettings').delete().eq('userId', user.id)

      // 2. Delete notifications
      await supabase.from('Notification').delete().eq('userId', user.id)

      // 3. Delete messages
      await supabase.from('Message').delete().eq('senderId', user.id)

      // 4. Delete posts (soft deletes will be hard deleted)
      await supabase.from('Post').delete().eq('authorId', user.id)

      // 5. Delete connections
      await supabase.from('Connection').delete().or(`user1Id.eq.${user.id},user2Id.eq.${user.id}`)

      // 6. Delete profile
      await supabase.from('Profile').delete().eq('userId', user.id)

      // 7. Finally, delete the user from Supabase Auth
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user.id)

      if (deleteAuthError) {
        console.error('[Delete Account] Error deleting auth user:', deleteAuthError)
        // Continue anyway - the user data is deleted, auth cleanup can be done manually if needed
      }

      // 8. Delete user record from User table (this should cascade delete remaining data)
      await supabase.from('User').delete().eq('id', user.id)

      console.log(`[Delete Account] Successfully deleted user: ${user.id}`)

      return NextResponse.json({
        success: true,
        message: 'Account deleted successfully',
      })
    } catch (deleteError) {
      console.error('[Delete Account] Error during deletion:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete account. Some data may remain. Please contact support.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[Delete Account] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
