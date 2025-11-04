// API Route: Block/Unblock Users
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const blockUserSchema = z.object({
  blockedUserId: z.string().uuid(),
  reason: z.string().optional(),
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

    // Parse and validate request body
    const body = await request.json()
    const validation = blockUserSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { blockedUserId, reason } = validation.data

    // Prevent blocking yourself
    if (blockedUserId === user.id) {
      return NextResponse.json(
        { error: 'Cannot block yourself' },
        { status: 400 }
      )
    }

    // Block user using Supabase (RLS protected)
    const { data, error } = await supabase
      .from('BlockedUser')
      .insert({
        userId: user.id,
        blockedUserId,
        reason: reason || null,
      })
      .select('*')
      .single()

    if (error) {
      // Check if already blocked
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'User is already blocked' },
          { status: 409 }
        )
      }

      console.error('[Block User] Error:', error)
      return NextResponse.json(
        { error: 'Failed to block user' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User blocked successfully',
      data,
    })
  } catch (error) {
    console.error('[Block User] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    // Get blockedUserId from URL params
    const { searchParams } = new URL(request.url)
    const blockedUserId = searchParams.get('blockedUserId')

    if (!blockedUserId) {
      return NextResponse.json(
        { error: 'blockedUserId is required' },
        { status: 400 }
      )
    }

    // Unblock user using Supabase (RLS protected)
    const { error } = await supabase
      .from('BlockedUser')
      .delete()
      .eq('userId', user.id)
      .eq('blockedUserId', blockedUserId)

    if (error) {
      console.error('[Unblock User] Error:', error)
      return NextResponse.json(
        { error: 'Failed to unblock user' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User unblocked successfully',
    })
  } catch (error) {
    console.error('[Unblock User] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
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

    // Get blocked users list (RLS protected)
    const { data: blockedUsers, error } = await supabase
      .from('BlockedUser')
      .select(`
        id,
        blockedUserId,
        reason,
        createdAt,
        blockedUser:User!BlockedUser_blockedUserId_fkey(
          id,
          name,
          email,
          avatarUrl
        )
      `)
      .eq('userId', user.id)
      .order('createdAt', { ascending: false })

    if (error) {
      console.error('[Get Blocked Users] Error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch blocked users' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      blockedUsers: blockedUsers || [],
    })
  } catch (error) {
    console.error('[Get Blocked Users] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

