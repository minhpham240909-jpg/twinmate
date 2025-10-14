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

    // Count active study partners (ACCEPTED matches where user is sender or receiver)
    const activePartnersCount = await prisma.match.count({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: user.id },
          { receiverId: user.id }
        ]
      }
    })

    return NextResponse.json({
      success: true,
      count: activePartnersCount
    })
  } catch (error) {
    console.error('Fetch partners count error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
