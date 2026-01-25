/**
 * Streak Shield API
 *
 * POST: Purchase a streak shield with XP
 * GET: Check streak shield status
 *
 * Streak shields protect the user's streak if they miss a day.
 * Cost: 200 XP per shield
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { cacheDelete, CacheKeys } from '@/lib/redis'

const STREAK_SHIELD_COST = 200

/**
 * GET /api/user/streak-shield
 * Get user's streak shield count
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting - lenient for streak shield status check
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's streak shield count and XP
    const [profile, streakShieldUnlock] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId: user.id },
        select: { totalPoints: true },
      }),
      prisma.userUnlock.findFirst({
        where: {
          userId: user.id,
          unlockable: {
            category: 'STREAK_SHIELD',
          },
        },
        select: {
          quantity: true,
          unlockable: {
            select: { pointsCost: true },
          },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      shields: streakShieldUnlock?.quantity || 0,
      cost: streakShieldUnlock?.unlockable.pointsCost || STREAK_SHIELD_COST,
      currentXp: profile?.totalPoints || 0,
      canAfford: (profile?.totalPoints || 0) >= STREAK_SHIELD_COST,
    })
  } catch (error) {
    console.error('[Streak Shield API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to get streak shield status' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/streak-shield
 * Purchase a streak shield
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - moderate for purchases
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's current XP
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { totalPoints: true },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if user can afford
    if ((profile.totalPoints || 0) < STREAK_SHIELD_COST) {
      return NextResponse.json(
        { error: 'Not enough XP', required: STREAK_SHIELD_COST, current: profile.totalPoints || 0 },
        { status: 400 }
      )
    }

    // Get or create streak shield unlockable
    let streakShieldUnlockable = await prisma.unlockable.findFirst({
      where: { category: 'STREAK_SHIELD' },
    })

    if (!streakShieldUnlockable) {
      // Create if doesn't exist
      streakShieldUnlockable = await prisma.unlockable.create({
        data: {
          category: 'STREAK_SHIELD',
          itemId: 'streak_shield',
          name: 'Streak Shield',
          description: 'Protects your streak if you miss a day',
          icon: 'shield',
          pointsCost: STREAK_SHIELD_COST,
        },
      })
    }

    // Purchase in transaction
    await prisma.$transaction(async (tx) => {
      // Deduct XP
      await tx.profile.update({
        where: { userId: user.id },
        data: {
          totalPoints: { decrement: STREAK_SHIELD_COST },
        },
      })

      // Add or increment streak shield
      const existingUnlock = await tx.userUnlock.findFirst({
        where: {
          userId: user.id,
          unlockableId: streakShieldUnlockable!.id,
        },
      })

      if (existingUnlock) {
        await tx.userUnlock.update({
          where: { id: existingUnlock.id },
          data: {
            quantity: { increment: 1 },
            pointsSpent: { increment: STREAK_SHIELD_COST },
          },
        })
      } else {
        await tx.userUnlock.create({
          data: {
            userId: user.id,
            unlockableId: streakShieldUnlockable!.id,
            quantity: 1,
            pointsSpent: STREAK_SHIELD_COST,
            isActive: true,
          },
        })
      }
    })

    // Invalidate caches
    await Promise.all([
      cacheDelete(CacheKeys.USER_STATS(user.id)),
      cacheDelete(`user:milestones:${user.id}`),
    ])

    return NextResponse.json({
      success: true,
      message: 'Streak shield purchased!',
      cost: STREAK_SHIELD_COST,
      remainingXp: (profile.totalPoints || 0) - STREAK_SHIELD_COST,
    })
  } catch (error) {
    console.error('[Streak Shield API] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to purchase streak shield' },
      { status: 500 }
    )
  }
}
