import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // SCALABILITY: Rate limit account reactivation (auth preset - sensitive operation)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.auth)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if account is deactivated
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        deactivatedAt: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!dbUser.deactivatedAt) {
      return NextResponse.json(
        { error: 'Account is not deactivated' },
        { status: 400 }
      )
    }

    // Reactivate account
    await prisma.user.update({
      where: { id: user.id },
      data: {
        deactivatedAt: null,
        deactivationReason: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Account reactivated successfully! Welcome back!',
    })
  } catch (error) {
    console.error('Reactivate account error:', error)
    return NextResponse.json(
      { error: 'Failed to reactivate account' },
      { status: 500 }
    )
  }
}
