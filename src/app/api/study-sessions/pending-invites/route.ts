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
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Get inviter details for each invitation
    const invitesWithInviter = await Promise.all(
      pendingInvites.map(async (invite) => {
        const inviter = await prisma.user.findUnique({
          where: { id: invite.session.createdBy },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        })

        return {
          sessionId: invite.session.id,
          title: invite.session.title,
          description: invite.session.description,
          type: invite.session.type,
          subject: invite.session.subject,
          createdAt: invite.session.createdAt,
          inviter: inviter,
        }
      })
    )

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
