/**
 * AI Partner Check Availability API
 * GET /api/ai-partner/check-availability - Check if matching partners are now available
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET: Check if partners matching the AI session criteria are now available
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Get the AI session details
    const aiSession = await prisma.aIPartnerSession.findUnique({
      where: { id: sessionId },
      select: {
        userId: true,
        subject: true,
        skillLevel: true,
        status: true,
      },
    })

    if (!aiSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (aiSession.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // If session is no longer active, don't check
    if (aiSession.status !== 'ACTIVE') {
      return NextResponse.json({ available: false, partners: [] })
    }

    // Get online users from UserPresence (active in last 5 minutes)
    const onlinePresence = await prisma.userPresence.findMany({
      where: {
        userId: { not: user.id },
        status: 'online',
        lastSeenAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000)
        }
      },
      select: { userId: true }
    })

    const onlineUserIds = onlinePresence.map(p => p.userId)

    if (onlineUserIds.length === 0) {
      return NextResponse.json({ available: false, partners: [] })
    }

    // Get users who are online
    const onlineUsers = await prisma.user.findMany({
      where: {
        id: { in: onlineUserIds }
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      }
    })

    // Get profiles for online users that match criteria
    const matchingProfiles = await prisma.profile.findMany({
      where: {
        userId: { in: onlineUserIds },
        // Match by subject if specified
        ...(aiSession.subject ? {
          subjects: { hasSome: [aiSession.subject] }
        } : {}),
        // Match by skill level if specified
        ...(aiSession.skillLevel ? {
          skillLevel: aiSession.skillLevel
        } : {}),
      },
      take: 5,
      select: {
        id: true,
        userId: true,
        subjects: true,
        skillLevel: true,
      }
    })

    // Combine profile data with user data
    const partners = matchingProfiles.map(profile => {
      const userData = onlineUsers.find(u => u.id === profile.userId)
      return {
        id: profile.id,
        userId: profile.userId,
        name: userData?.name || 'Unknown',
        avatarUrl: userData?.avatarUrl || null,
        subjects: profile.subjects,
        skillLevel: profile.skillLevel,
      }
    })

    return NextResponse.json({
      available: partners.length > 0,
      partners,
    })
  } catch (error) {
    console.error('[AI Partner] Check availability error:', error)
    return NextResponse.json(
      { error: 'Failed to check availability' },
      { status: 500 }
    )
  }
}
