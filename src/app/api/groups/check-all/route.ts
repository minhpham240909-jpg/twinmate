import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CHECK GROUPS] Checking all groups in database...')
    console.log('[CHECK GROUPS] Current user ID:', user.id)

    const allGroups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            messages: true,
            invites: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log(`[CHECK GROUPS] Total groups in database: ${allGroups.length}`)

    // Mark which groups belong to current user
    const groupsWithOwnership = allGroups.map(group => ({
      ...group,
      isYours: group.ownerId === user.id,
    }))

    const yourGroups = groupsWithOwnership.filter(g => g.isYours)

    return NextResponse.json({
      success: true,
      currentUserId: user.id,
      totalGroups: allGroups.length,
      yourGroups: yourGroups.length,
      groups: groupsWithOwnership,
      message: allGroups.length === 0
        ? 'No groups in database - all deletions worked!'
        : `Found ${allGroups.length} groups (${yourGroups.length} owned by you)`,
    })
  } catch (error) {
    console.error('[CHECK GROUPS] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check groups' },
      { status: 500 }
    )
  }
}
