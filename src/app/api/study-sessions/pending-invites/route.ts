import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get pending invitations for the user
    // SCALABILITY: Limit to prevent unbounded queries
    const pendingInvites = await prisma.sessionParticipant.findMany({
      where: {
        userId: user.id,
        status: 'INVITED',
      },
      include: {
        session: {
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            subject: true,
            createdAt: true,
            createdBy: true,
            creator: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    })

    // Get inviter details for each invitation (no more async/await needed!)
    const invitesWithInviter = pendingInvites.map((invite) => {
      return {
        sessionId: invite.session.id,
        title: invite.session.title,
        description: invite.session.description,
        type: invite.session.type,
        subject: invite.session.subject,
        createdAt: invite.session.createdAt,
        inviter: invite.session.creator,
      }
    })

    return NextResponse.json({
      success: true,
      invites: invitesWithInviter,
    })
  } catch (error) {
    console.error('Error fetching pending invites:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending invites' },
      { status: 500 }
    )
  }
}
