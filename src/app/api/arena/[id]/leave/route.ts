/**
 * Leave Arena API
 *
 * POST /api/arena/[id]/leave
 *
 * Removes participant from arena.
 * If host leaves and game hasn't started, cancels the arena.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { broadcastPlayerLeft } from '@/lib/arena/broadcast'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  try {
    const { id: arenaId } = await params

    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch arena and participant
    const arena = await prisma.arenaSession.findUnique({
      where: { id: arenaId },
      include: {
        participants: {
          where: { userId: user.id },
        },
        _count: {
          select: { participants: true },
        },
      },
    })

    if (!arena) {
      return NextResponse.json(
        { success: false, error: 'Arena not found' },
        { status: 404 }
      )
    }

    const participant = arena.participants[0]
    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'You are not in this arena' },
        { status: 400 }
      )
    }

    const isHost = arena.hostId === user.id
    const isLobby = arena.status === 'LOBBY'

    // If host leaves during lobby, cancel the arena
    if (isHost && isLobby) {
      await prisma.arenaSession.update({
        where: { id: arenaId },
        data: {
          status: 'CANCELLED',
          endedAt: new Date(),
        },
      })

      // Delete all participants (cascade should handle this, but explicit is better)
      await prisma.arenaParticipant.deleteMany({
        where: { arenaId },
      })

      console.log(`[Arena Leave] Host left, arena ${arenaId} cancelled`)

      return NextResponse.json({
        success: true,
        message: 'Arena cancelled',
        arenaCancelled: true,
      })
    }

    // If game is in progress, just mark as disconnected
    if (arena.status === 'IN_PROGRESS' || arena.status === 'STARTING') {
      await prisma.arenaParticipant.update({
        where: { id: participant.id },
        data: { isConnected: false },
      })

      const newCount = arena._count.participants // Still counted, just disconnected

      await broadcastPlayerLeft(
        arenaId,
        participant.id,
        participant.userName,
        newCount
      )

      console.log(`[Arena Leave] User ${user.id} disconnected from arena ${arenaId}`)

      return NextResponse.json({
        success: true,
        message: 'Marked as disconnected',
        arenaCancelled: false,
      })
    }

    // If in lobby, remove participant
    await prisma.arenaParticipant.delete({
      where: { id: participant.id },
    })

    const newCount = arena._count.participants - 1

    await broadcastPlayerLeft(
      arenaId,
      participant.id,
      participant.userName,
      newCount
    )

    console.log(`[Arena Leave] User ${user.id} left arena ${arenaId}`)

    return NextResponse.json({
      success: true,
      message: 'Left arena',
      arenaCancelled: false,
    })
  } catch (error) {
    console.error('[Arena Leave] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    })

    return NextResponse.json(
      { success: false, error: 'Failed to leave arena' },
      { status: 500 }
    )
  }
}
