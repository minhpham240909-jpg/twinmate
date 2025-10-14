import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params

    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { avatarUrl } = body

    if (!avatarUrl) {
      return NextResponse.json(
        { error: 'Avatar URL is required' },
        { status: 400 }
      )
    }

    // Check if user is the group owner
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { ownerId: true }
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    if (group.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Only group owner can update avatar' },
        { status: 403 }
      )
    }

    // Update group avatar
    await prisma.group.update({
      where: { id: groupId },
      data: { avatarUrl }
    })

    return NextResponse.json({
      success: true,
      message: 'Avatar updated successfully'
    })
  } catch (error) {
    console.error('Error updating group avatar:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
