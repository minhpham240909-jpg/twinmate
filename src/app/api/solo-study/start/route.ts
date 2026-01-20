import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { notifyPartnersStartedStudying } from '@/lib/notifications/send'

/**
 * POST /api/solo-study/start - Start a Solo Study session
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { focusMinutes = 25, breakMinutes = 5, background = 'library' } = body

    // Create focus session record (using existing FocusSession model)
    const session = await prisma.focusSession.create({
      data: {
        userId: user.id,
        durationMinutes: focusMinutes,
        startedAt: new Date(),
        status: 'ACTIVE',
        mode: 'solo',
        label: `Solo Study - ${background}`,
      },
      select: {
        id: true,
        durationMinutes: true,
        startedAt: true,
        status: true,
      },
    })

    // Notify partners that user started studying (async, don't wait)
    notifyPartnersStartedStudying(user.id, 'solo_study').catch(() => {})

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      session,
    })
  } catch (error) {
    console.error('Start solo study error:', error)
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500 }
    )
  }
}
