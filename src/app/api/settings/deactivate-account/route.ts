import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { withCsrfProtection } from '@/lib/csrf'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

const deactivateSchema = z.object({
  confirmation: z.literal('DEACTIVATE'),
  reason: z.string().optional(),
})

export async function POST(request: NextRequest) {
  // SCALABILITY: Rate limit account deactivation (auth preset - sensitive operation)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.auth)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  return withCsrfProtection(request, async () => {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      let body
      try {
        body = await request.json()
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid JSON in request body' },
          { status: 400 }
        )
      }

      const validation = deactivateSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid confirmation. Type DEACTIVATE to confirm.' },
          { status: 400 }
        )
      }

      const { reason } = validation.data

      // Mark account as deactivated in database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          deactivatedAt: new Date(),
          deactivationReason: reason || 'User requested deactivation',
        },
      })

      // Deactivate all device sessions
      await prisma.deviceSession.updateMany({
        where: { userId: user.id },
        data: { isActive: false },
      })

      // Update presence to offline
      await prisma.userPresence.updateMany({
        where: { userId: user.id },
        data: { status: 'offline' },
      })

      // Sign out from Supabase
      await supabase.auth.signOut()

      return NextResponse.json({
        success: true,
        message: 'Account deactivated successfully. You can reactivate by signing in again.',
      })
    } catch (error) {
      console.error('Deactivate account error:', error)
      return NextResponse.json(
        { error: 'Failed to deactivate account' },
        { status: 500 }
      )
    }
  })
}
