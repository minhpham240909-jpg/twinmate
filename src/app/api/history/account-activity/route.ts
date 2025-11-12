import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET /api/history/account-activity - Get user's account activity
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user account info
    const userData = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        lastLoginAt: true,
        updatedAt: true,
        role: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        emailVerified: true,
        googleId: true,
      },
    })

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get profile update history (approximate from updatedAt)
    const profile = await prisma.profile.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        updatedAt: true,
        location_last_updated: true,
      },
    })

    return NextResponse.json({
      account: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        createdAt: userData.createdAt,
        lastLoginAt: userData.lastLoginAt,
        updatedAt: userData.updatedAt,
        role: userData.role,
        subscriptionStatus: userData.subscriptionStatus,
        subscriptionEndsAt: userData.subscriptionEndsAt,
        emailVerified: userData.emailVerified,
        hasGoogleAccount: !!userData.googleId,
      },
      activity: {
        accountCreated: userData.createdAt,
        lastLogin: userData.lastLoginAt,
        lastProfileUpdate: profile?.updatedAt,
        lastLocationUpdate: profile?.location_last_updated,
      },
    })
  } catch (error) {
    console.error('Error fetching account activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch account activity' },
      { status: 500 }
    )
  }
}

