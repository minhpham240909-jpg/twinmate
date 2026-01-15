import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/shop/purchase - Purchase an unlockable item
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

    if (!unlockable || !unlockable.isActive) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Get user's profile with current points
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: {
        totalPoints: true,
        streakShields: true,
      },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if user can afford the item
    if (profile.totalPoints < unlockable.pointsCost) {
      return NextResponse.json({
        error: 'Not enough points',
        required: unlockable.pointsCost,
        current: profile.totalPoints,
      }, { status: 400 })
    }

    // Check if already owned (for non-consumables)
    const existingUnlock = await prisma.userUnlock.findUnique({
      where: {
        userId_unlockableId: {
          userId: user.id,
          unlockableId: unlockable.id,
        },
      },
    })

    // Handle consumables (streak shields) vs regular unlockables
    if (unlockable.category === 'STREAK_SHIELD') {
      // Consumables can be purchased multiple times
      await prisma.$transaction([
        // Deduct points
        prisma.profile.update({
          where: { userId: user.id },
          data: {
            totalPoints: { decrement: unlockable.pointsCost },
            streakShields: { increment: 1 },
          },
        }),
        // Update or create unlock record
        existingUnlock
          ? prisma.userUnlock.update({
              where: { id: existingUnlock.id },
              data: {
                quantity: { increment: 1 },
                pointsSpent: { increment: unlockable.pointsCost },
              },
            })
          : prisma.userUnlock.create({
              data: {
                userId: user.id,
                unlockableId: unlockable.id,
                pointsSpent: unlockable.pointsCost,
                quantity: 1,
              },
            }),
      ])

      return NextResponse.json({
        success: true,
        message: 'Streak Shield purchased!',
        newBalance: profile.totalPoints - unlockable.pointsCost,
        streakShields: profile.streakShields + 1,
      })
    } else {
      // Non-consumables can only be purchased once
      if (existingUnlock) {
        return NextResponse.json({ error: 'Already owned' }, { status: 400 })
      }

      await prisma.$transaction([
        // Deduct points
        prisma.profile.update({
          where: { userId: user.id },
          data: {
            totalPoints: { decrement: unlockable.pointsCost },
          },
        }),
        // Create unlock record
        prisma.userUnlock.create({
          data: {
            userId: user.id,
            unlockableId: unlockable.id,
            pointsSpent: unlockable.pointsCost,
            quantity: 1,
          },
        }),
      ])

      return NextResponse.json({
        success: true,
        message: `${unlockable.name} unlocked!`,
        newBalance: profile.totalPoints - unlockable.pointsCost,
      })
    }
  } catch (error) {
    console.error('[Shop Purchase] Error:', error)
    return NextResponse.json(
      { error: 'Failed to complete purchase' },
      { status: 500 }
    )
  }
}
