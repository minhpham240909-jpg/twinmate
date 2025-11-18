import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

// POST - Create a new goal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  // SECURITY: Rate limiting to prevent goal spam (20 goals per minute)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many goal creation requests. Please slow down.' },
      {
        status: 429,
        headers: rateLimitResult.headers
      }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const { title, description } = await request.json()

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Goal title required' }, { status: 400 })
    }

    // Verify user is a participant
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
        status: 'JOINED',
      },
    })

    if (!participant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }

    // Get the current max order for goals in this session
    const maxOrderGoal = await prisma.sessionGoal.findFirst({
      where: { sessionId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const nextOrder = (maxOrderGoal?.order ?? -1) + 1

    // Create goal
    const goal = await prisma.sessionGoal.create({
      data: {
        sessionId,
        title: title.trim(),
        description: description?.trim() || null,
        order: nextOrder,
        isCompleted: false,
      },
    })

    return NextResponse.json({
      success: true,
      goal,
    })
  } catch (error) {
    console.error('Error creating goal:', error)
    return NextResponse.json(
      { error: 'Failed to create goal' },
      { status: 500 }
    )
  }
}
