import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    // Find the invitation
    const participant = await prisma.sessionParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId,
          userId: user.id,
        },
      },
      include: {
        session: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    })

    if (!participant) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    if (participant.status !== 'INVITED') {
      return NextResponse.json({ error: 'Invalid invitation status' }, { status: 400 })
    }

    // Check if invitation has expired (7 days from creation)
    const INVITE_EXPIRATION_DAYS = 7
    const expirationDate = new Date(participant.createdAt)
    expirationDate.setDate(expirationDate.getDate() + INVITE_EXPIRATION_DAYS)
    
    if (new Date() > expirationDate) {
      // Mark as expired and return error
      await prisma.sessionParticipant.update({
        where: { id: participant.id },
        data: { status: 'LEFT' }, // Use LEFT to indicate expired/invalid
      })
      return NextResponse.json({ 
        error: 'This invitation has expired. Please ask the host to send a new invitation.',
        code: 'INVITATION_EXPIRED'
      }, { status: 410 }) // 410 Gone
    }

    // Update status to JOINED
    await prisma.sessionParticipant.update({
      where: { id: participant.id },
      data: {
        status: 'JOINED',
        joinedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      sessionId: sessionId,
      message: 'Invitation accepted',
    })
  } catch (error) {
    console.error('Error accepting invitation:', error)
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    )
  }
}
