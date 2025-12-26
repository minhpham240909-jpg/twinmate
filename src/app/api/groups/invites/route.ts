import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
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

    // PERF: Get pending group invites with inviter info in a single query (avoids extra query)
    const invites = await prisma.groupInvite.findMany({
      where: {
        inviteeId: user.id,
        status: 'PENDING'
      },
      include: {
        group: {
          select: {
            id: true,
            name: true
          }
        },
        inviter: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const formattedInvites = invites.map(invite => ({
      id: invite.id,
      groupId: invite.groupId,
      groupName: invite.group.name,
      inviterName: invite.inviter?.name || 'Unknown',
      createdAt: invite.createdAt.toISOString()
    }))

    return NextResponse.json({
      success: true,
      invites: formattedInvites
    })
  } catch (error) {
    console.error('Error fetching group invites:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
