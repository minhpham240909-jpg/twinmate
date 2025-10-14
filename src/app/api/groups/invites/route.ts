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

    // Get pending group invites for the user
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Get inviter names
    const inviterIds = invites.map(inv => inv.inviterId)
    const inviters = await prisma.user.findMany({
      where: {
        id: { in: inviterIds }
      },
      select: {
        id: true,
        name: true
      }
    })

    const inviterMap = new Map(inviters.map(u => [u.id, u.name]))

    const formattedInvites = invites.map(invite => ({
      id: invite.id,
      groupId: invite.groupId,
      groupName: invite.group.name,
      inviterName: inviterMap.get(invite.inviterId) || 'Unknown',
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
