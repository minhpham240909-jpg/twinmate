import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { title, description, type, subject, tags, inviteUserIds } = body

    // Validate required fields
    if (!title || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: title, type' },
        { status: 400 }
      )
    }

    // Generate unique Agora channel name
    const agoraChannel = `study${user.id.replace(/-/g, '').slice(0, 30)}${Date.now().toString().slice(-6)}`

    // Create study session
    const session = await prisma.studySession.create({
      data: {
        title,
        description: description || null,
        type,
        status: 'SCHEDULED',
        createdBy: user.id,
        userId: user.id, // For backward compatibility
        subject: subject || null,
        tags: tags || [],
        agoraChannel,
        maxParticipants: 10,
        isPublic: false,
      },
    })

    // Add creator as first participant (HOST)
    await prisma.sessionParticipant.create({
      data: {
        sessionId: session.id,
        userId: user.id,
        role: 'HOST',
        status: 'JOINED',
        joinedAt: new Date(),
      },
    })

    // Invite other users if provided
    let invitesSent = 0
    if (inviteUserIds && Array.isArray(inviteUserIds)) {
      for (const inviteeId of inviteUserIds) {
        try {
          await prisma.sessionParticipant.create({
            data: {
              sessionId: session.id,
              userId: inviteeId,
              role: 'PARTICIPANT',
              status: 'INVITED',
            },
          })

          // Get inviter info
          const inviter = await prisma.user.findUnique({
            where: { id: user.id },
            select: { name: true },
          })

          // Create notification
          await prisma.notification.create({
            data: {
              userId: inviteeId,
              type: 'SESSION_INVITE',
              title: 'Study Session Invite',
              message: `${inviter?.name || 'Someone'} invited you to "${session.title}"`,
              actionUrl: `/study-sessions`,
              relatedUserId: user.id,
            },
          })

          invitesSent++
        } catch (error) {
          console.error('Error inviting user:', error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
        agoraChannel: session.agoraChannel,
        createdAt: session.createdAt,
      },
      invitesSent,
    })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
