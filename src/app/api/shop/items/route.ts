import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/shop/items - Get all available unlockable items with user's unlock status
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all active unlockables with user's unlock status in a single query
    const unlockables = await prisma.unlockable.findMany({
      where: { isActive: true },
      orderBy: [
        { category: 'asc' },
        { sortOrder: 'asc' },
      ],
      include: {
        userUnlocks: {
          where: { userId: user.id },
          select: {
            id: true,
            quantity: true,
            isActive: true,
            unlockedAt: true,
          },
        },
      },
    })

    // Get user's current points and count completed sessions
    const [profile, totalCompletedSessions] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId: user.id },
        select: {
          totalPoints: true,
          streakShields: true,
        },
      }),
      prisma.focusSession.count({
        where: {
          userId: user.id,
          status: 'COMPLETED',
        },
      }),
    ])

    // Transform to cleaner response format
    const items = unlockables.map(item => ({
      id: item.id,
      itemId: item.itemId,
      name: item.name,
      description: item.description,
      category: item.category,
      pointsCost: item.pointsCost,
      icon: item.icon,
      previewUrl: item.previewUrl,
      // User-specific data
      isOwned: item.userUnlocks.length > 0,
      isActive: item.userUnlocks[0]?.isActive || false,
      quantity: item.userUnlocks[0]?.quantity || 0,
      canAfford: (profile?.totalPoints || 0) >= item.pointsCost,
    }))

    // Group by category
    const grouped = {
      THEME: items.filter(i => i.category === 'THEME'),
      SOUND: items.filter(i => i.category === 'SOUND'),
      STREAK_SHIELD: items.filter(i => i.category === 'STREAK_SHIELD'),
      FEATURE: items.filter(i => i.category === 'FEATURE'),
    }

    return NextResponse.json({
      success: true,
      items: grouped,
      userPoints: profile?.totalPoints || 0,
      streakShields: profile?.streakShields || 0,
      totalCompletedSessions,
    })
  } catch (error) {
    console.error('[Shop Items] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shop items' },
      { status: 500 }
    )
  }
}
