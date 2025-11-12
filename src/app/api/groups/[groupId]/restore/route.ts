import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// POST /api/groups/[groupId]/restore - Restore a deleted group
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupId } = await params

    // Get the group
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    }) as any

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Check if group is deleted
    if (!group.isDeleted) {
      return NextResponse.json({ error: 'Group is not deleted' }, { status: 400 })
    }

    // Check if user is the owner
    if (group.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Only the group owner can restore the group' },
        { status: 403 }
      )
    }

    // Check if 30 days have passed
    if (group.deletedAt) {
      const daysSinceDeletion = Math.floor(
        (Date.now() - new Date(group.deletedAt).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSinceDeletion > 30) {
        return NextResponse.json(
          { error: 'Group cannot be restored after 30 days' },
          { status: 400 }
        )
      }
    }

    // Restore the group
    const restoredGroup = await prisma.group.update({
      where: { id: groupId },
      data: {
        isDeleted: false,
        deletedAt: null,
      } as any,
    })

    return NextResponse.json({
      success: true,
      message: 'Group restored successfully',
      group: restoredGroup,
    })
  } catch (error) {
    console.error('Error restoring group:', error)
    return NextResponse.json(
      { error: 'Failed to restore group' },
      { status: 500 }
    )
  }
}

