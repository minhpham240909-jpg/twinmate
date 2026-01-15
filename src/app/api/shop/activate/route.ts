import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/shop/activate - Activate a theme or sound
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { itemId } = await req.json()

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    // Get the unlockable item
    const unlockable = await prisma.unlockable.findUnique({
      where: { itemId },
    })

    if (!unlockable) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Only themes and sounds can be activated
    if (unlockable.category !== 'THEME' && unlockable.category !== 'SOUND') {
      return NextResponse.json({ error: 'This item cannot be activated' }, { status: 400 })
    }

    // Check if user owns the item (free items are always accessible)
    if (unlockable.pointsCost > 0) {
      const userUnlock = await prisma.userUnlock.findUnique({
        where: {
          userId_unlockableId: {
            userId: user.id,
            unlockableId: unlockable.id,
          },
        },
      })

      if (!userUnlock) {
        return NextResponse.json({ error: 'You do not own this item' }, { status: 403 })
      }
    }

    // Deactivate all other items in the same category for this user
    // Then activate the selected one
    await prisma.$transaction([
      // Deactivate all items in this category
      prisma.userUnlock.updateMany({
        where: {
          userId: user.id,
          unlockable: {
            category: unlockable.category,
          },
        },
        data: {
          isActive: false,
        },
      }),
      // Activate the selected item (upsert for free items)
      prisma.userUnlock.upsert({
        where: {
          userId_unlockableId: {
            userId: user.id,
            unlockableId: unlockable.id,
          },
        },
        update: {
          isActive: true,
        },
        create: {
          userId: user.id,
          unlockableId: unlockable.id,
          pointsSpent: 0,
          quantity: 1,
          isActive: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: `${unlockable.name} activated!`,
      activeItemId: itemId,
    })
  } catch (error) {
    console.error('[Shop Activate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to activate item' },
      { status: 500 }
    )
  }
}
