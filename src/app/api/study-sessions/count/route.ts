import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fast single-query count of user's active/scheduled sessions
    const count = await prisma.sessionParticipant.count({
      where: {
        userId: user.id,
        status: 'JOINED',
        session: {
          status: {
            in: ['ACTIVE', 'SCHEDULED'],
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      count,
    })
  } catch (error) {
    console.error('Error fetching sessions count:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions count' },
      { status: 500 }
    )
  }
}
