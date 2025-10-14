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
    })

    if (!participant) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    if (participant.status !== 'INVITED') {
      return NextResponse.json({ error: 'Invalid invitation status' }, { status: 400 })
    }

    // Delete the invitation in a transaction (or set to LEFT status)
    await prisma.$transaction(async (tx) => {
      // Remove the participant record (declining = removing the invite)
      await tx.sessionParticipant.delete({
        where: { id: participant.id },
      })

      // Create a notification for the session host
      const session = await tx.studySession.findUnique({
        where: { id: sessionId },
        select: { createdBy: true, title: true },
      })

      if (session && session.createdBy !== user.id) {
        const decliningUser = await tx.user.findUnique({
          where: { id: user.id },
          select: { name: true },
        })

        await tx.notification.create({
          data: {
            userId: session.createdBy,
            type: 'SESSION_ENDED',
            title: 'Invitation Declined',
            message: `${decliningUser?.name || 'Someone'} declined the invitation to ${session.title}`,
            isRead: false,
          },
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Invitation declined',
    })
  } catch (error) {
    console.error('Error declining invitation:', error)
    return NextResponse.json(
      { error: 'Failed to decline invitation' },
      { status: 500 }
    )
  }
}
