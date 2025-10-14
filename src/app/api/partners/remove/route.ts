import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { matchId } = body

    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      )
    }

    // Verify the match exists and user is part of it
    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        OR: [
          { senderId: user.id },
          { receiverId: user.id }
        ]
      }
    })

    if (!match) {
      return NextResponse.json(
        { error: 'Partnership not found' },
        { status: 404 }
      )
    }

    // Delete the match (remove partnership)
    await prisma.match.delete({
      where: {
        id: matchId
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Partnership removed successfully'
    })
  } catch (error) {
    console.error('Remove partner error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
