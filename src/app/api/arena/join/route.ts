/**
 * Join Arena API
 *
 * POST /api/arena/join
 *
 * Joins an arena using an invite code.
 * Broadcasts player_joined event to all participants.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { broadcastPlayerJoined } from '@/lib/arena/broadcast'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { inviteCode } = body

    if (!inviteCode || typeof inviteCode !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invite code is required' },
        { status: 400 }
      )
    }

    // Normalize invite code (uppercase, no spaces)
    const normalizedCode = inviteCode.trim().toUpperCase()

    // Find arena by invite code
    const arena = await prisma.arenaSession.findUnique({
      where: { inviteCode: normalizedCode },
      include: {
        participants: {
          select: {
            id: true,
            userId: true,
            userName: true,
            userAvatarUrl: true,
            totalScore: true,
            isConnected: true,
          },
        },
        _count: {
          select: { participants: true },
        },
      },
    })

    if (!arena) {
      return NextResponse.json(
        { success: false, error: 'Arena not found. Check the invite code.' },
        { status: 404 }
      )
    }

    // Check arena status
    if (arena.status !== 'LOBBY') {
      return NextResponse.json(
        { success: false, error: 'Arena has already started or ended' },
        { status: 400 }
      )
    }

    // Check if already a participant
    const existingParticipant = arena.participants.find(p => p.userId === user.id)
    if (existingParticipant) {
      // Already joined - return success with current state
      return NextResponse.json({
        success: true,
        arena: {
          id: arena.id,
          title: arena.title,
          inviteCode: arena.inviteCode,
          questionCount: arena.questionCount,
          timePerQuestion: arena.timePerQuestion,
          maxPlayers: arena.maxPlayers,
          status: arena.status,
          hostId: arena.hostId,
        },
        participant: existingParticipant,
        participants: arena.participants,
        isHost: arena.hostId === user.id,
      })
    }

    // Check max players
    if (arena._count.participants >= arena.maxPlayers) {
      return NextResponse.json(
        { success: false, error: 'Arena is full' },
        { status: 400 }
      )
    }

    // Get user info
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, avatarUrl: true },
    })

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Create participant
    const participant = await prisma.arenaParticipant.create({
      data: {
        arenaId: arena.id,
        userId: user.id,
        userName: dbUser.name || 'Player',
        userAvatarUrl: dbUser.avatarUrl,
      },
    })

    // Get updated participant count
    const newCount = arena._count.participants + 1

    // Broadcast player joined event
    await broadcastPlayerJoined(
      arena.id,
      participant.id,
      participant.userName,
      participant.userAvatarUrl,
      newCount
    )

    // Get all participants for response
    const allParticipants = await prisma.arenaParticipant.findMany({
      where: { arenaId: arena.id },
      select: {
        id: true,
        userId: true,
        userName: true,
        userAvatarUrl: true,
        totalScore: true,
        isConnected: true,
      },
    })

    console.log(`[Arena Join] User ${user.id} joined arena ${arena.id} in ${Date.now() - startTime}ms`)

    return NextResponse.json({
      success: true,
      arena: {
        id: arena.id,
        title: arena.title,
        inviteCode: arena.inviteCode,
        questionCount: arena.questionCount,
        timePerQuestion: arena.timePerQuestion,
        maxPlayers: arena.maxPlayers,
        status: arena.status,
        hostId: arena.hostId,
      },
      participant: {
        id: participant.id,
        userId: participant.userId,
        userName: participant.userName,
        userAvatarUrl: participant.userAvatarUrl,
        totalScore: participant.totalScore,
        isConnected: participant.isConnected,
      },
      participants: allParticipants,
      isHost: false,
    })
  } catch (error) {
    console.error('[Arena Join] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    })

    return NextResponse.json(
      { success: false, error: 'Failed to join arena' },
      { status: 500 }
    )
  }
}
