import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET /api/history/deleted-groups - Get user's deleted groups
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // First, cleanup groups older than 30 days (automatic cleanup)
    const expiredGroups = await prisma.group.findMany({
      where: {
        ownerId: user.id,
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      },
      select: {
        id: true,
        avatarUrl: true,
      },
    })

    // Delete avatar from storage for expired groups
    for (const group of expiredGroups) {
      if (group.avatarUrl) {
        try {
          const urlParts = group.avatarUrl.split('/')
          const fileName = urlParts[urlParts.length - 1]
          if (fileName) {
            await supabase.storage.from('groups').remove([fileName])
          }
        } catch (error) {
          console.error('Error deleting group avatar:', error)
        }
      }
    }

    // Permanently delete expired groups (cascade will handle members, messages, invites)
    await prisma.group.deleteMany({
      where: {
        ownerId: user.id,
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      },
    })

    // Get remaining deleted groups (within 30 days)
    const deletedGroups = await prisma.group.findMany({
      where: {
        ownerId: user.id,
        isDeleted: true,
        deletedAt: {
          gt: thirtyDaysAgo,
        },
      },
      include: {
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
      orderBy: {
        deletedAt: 'desc',
      },
    })

    // Calculate days remaining for each group
    const groupsWithDaysRemaining = deletedGroups.map(group => {
      const daysRemaining = group.deletedAt
        ? 30 - Math.floor((Date.now() - new Date(group.deletedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 30

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        subject: group.subject,
        avatarUrl: group.avatarUrl,
        privacy: group.privacy,
        createdAt: group.createdAt,
        deletedAt: group.deletedAt,
        daysRemaining: Math.max(0, daysRemaining),
        _count: group._count,
      }
    })

    return NextResponse.json({
      groups: groupsWithDaysRemaining,
      count: groupsWithDaysRemaining.length,
    })
  } catch (error) {
    console.error('Error fetching deleted groups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deleted groups' },
      { status: 500 }
    )
  }
}

