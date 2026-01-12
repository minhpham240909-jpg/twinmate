// Study Circle Join API - Join circle by invite code
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// POST /api/study-circles/join - Join a circle by invite code
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { inviteCode } = body

    if (!inviteCode || typeof inviteCode !== 'string') {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })
    }

    // Find circle by invite code
    const circle = await prisma.studyCircle.findUnique({
      where: { inviteCode: inviteCode.trim() },
      select: {
        id: true,
        name: true,
        maxMembers: true,
        status: true,
        members: {
          where: { status: 'ACTIVE' },
          select: { userId: true },
        },
      },
    })

    if (!circle) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
    }

    if (circle.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'This circle is not accepting new members' }, { status: 400 })
    }

    // Check if already a member
    const existingMembership = await prisma.studyCircleMember.findUnique({
      where: {
        circleId_userId: {
          circleId: circle.id,
          userId: user.id,
        },
      },
    })

    if (existingMembership) {
      if (existingMembership.status === 'ACTIVE') {
        return NextResponse.json({ error: 'You are already a member of this circle' }, { status: 400 })
      }
      // If previously left/removed, allow rejoin
    }

    // Check if circle is full
    if (circle.members.length >= circle.maxMembers) {
      return NextResponse.json({ error: 'This circle is full' }, { status: 400 })
    }

    // Check user's circle limit
    const userCircleCount = await prisma.studyCircleMember.count({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        circle: { status: 'ACTIVE' },
      },
    })

    if (userCircleCount >= 10) {
      return NextResponse.json(
        { error: 'You can only be in up to 10 active study circles' },
        { status: 400 }
      )
    }

    // Join or rejoin the circle
    if (existingMembership) {
      await prisma.studyCircleMember.update({
        where: { id: existingMembership.id },
        data: {
          status: 'ACTIVE',
          role: 'MEMBER',
          leftAt: null,
          joinedAt: new Date(),
        },
      })
    } else {
      await prisma.studyCircleMember.create({
        data: {
          circleId: circle.id,
          userId: user.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      })
    }

    // Update circle's last activity
    await prisma.studyCircle.update({
      where: { id: circle.id },
      data: { lastActivityAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      data: {
        circleId: circle.id,
        circleName: circle.name,
      },
      message: `Successfully joined ${circle.name}!`,
    })
  } catch (error) {
    console.error('[Study Circle Join] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
