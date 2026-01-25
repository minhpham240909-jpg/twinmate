import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/user/customizations - Get user's purchased and active customizations
 *
 * Returns:
 * - Purchased theme IDs
 * - Purchased sound IDs
 * - Active theme ID (if any)
 * - Active sound ID (if any)
 * - User's total points (for checking affordability)
 * - All available items with prices (for locking unpurchased items)
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting - lenient for customization reads
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's profile (for points) and unlocks in parallel
    const [profile, unlockables] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId: user.id },
        select: {
          totalPoints: true,
        },
      }),
      prisma.unlockable.findMany({
        where: {
          isActive: true,
          category: { in: ['THEME', 'SOUND'] },
        },
        orderBy: [
          { category: 'asc' },
          { sortOrder: 'asc' },
        ],
        include: {
          userUnlocks: {
            where: { userId: user.id },
            select: {
              id: true,
              isActive: true,
            },
          },
        },
      }),
    ])

    // Transform data for themes
    const themes = unlockables
      .filter(item => item.category === 'THEME')
      .map(item => ({
        id: item.id,
        itemId: item.itemId,
        name: item.name,
        description: item.description,
        icon: item.icon,
        pointsCost: item.pointsCost,
        previewUrl: item.previewUrl,
        isOwned: item.userUnlocks.length > 0,
        isActive: item.userUnlocks[0]?.isActive || false,
        canAfford: (profile?.totalPoints || 0) >= item.pointsCost,
      }))

    // Transform data for sounds
    const sounds = unlockables
      .filter(item => item.category === 'SOUND')
      .map(item => ({
        id: item.id,
        itemId: item.itemId,
        name: item.name,
        description: item.description,
        icon: item.icon,
        pointsCost: item.pointsCost,
        previewUrl: item.previewUrl,
        isOwned: item.userUnlocks.length > 0,
        isActive: item.userUnlocks[0]?.isActive || false,
        canAfford: (profile?.totalPoints || 0) >= item.pointsCost,
      }))

    // Get active theme and sound
    const activeTheme = themes.find(t => t.isActive)
    const activeSound = sounds.find(s => s.isActive)

    // Get lists of owned item IDs for quick lookup
    const ownedThemeIds = themes.filter(t => t.isOwned).map(t => t.itemId)
    const ownedSoundIds = sounds.filter(s => s.isOwned).map(s => s.itemId)

    return NextResponse.json({
      success: true,
      userPoints: profile?.totalPoints || 0,
      themes,
      sounds,
      ownedThemeIds,
      ownedSoundIds,
      activeThemeId: activeTheme?.itemId || null,
      activeSoundId: activeSound?.itemId || null,
    })
  } catch (error) {
    console.error('[User Customizations] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customizations' },
      { status: 500 }
    )
  }
}
