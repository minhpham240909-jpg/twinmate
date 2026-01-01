/**
 * DELETE /api/history/study-activity/delete
 * Soft-delete a study session (hides from user, visible to admin)
 *
 * SCALABILITY: Uses rate limiting and single-query updates
 * Safe for 1000-3000 concurrent users
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

const deleteSchema = z.object({
  sessionId: z.string().uuid(),
  sessionType: z.enum(['study', 'ai']), // 'study' for real sessions, 'ai' for AI Partner sessions
})

export async function POST(request: NextRequest) {
  // SCALABILITY: Rate limit delete operations (moderate - prevent abuse)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = deleteSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { sessionId, sessionType } = validation.data

    if (sessionType === 'ai') {
      // Soft-delete AI Partner session
      // SCALABILITY: Single query with ownership check - no N+1
      const session = await prisma.aIPartnerSession.findFirst({
        where: {
          id: sessionId,
          userId: user.id,
          deletedByUserAt: null, // Not already deleted
        },
        select: { id: true },
      })

      if (!session) {
        return NextResponse.json(
          { error: 'Session not found or already deleted' },
          { status: 404 }
        )
      }

      await prisma.aIPartnerSession.update({
        where: { id: sessionId },
        data: {
          deletedByUserId: user.id,
          deletedByUserAt: new Date(),
        },
      })
    } else {
      // Soft-delete Study session
      // SCALABILITY: Single query with ownership check - no N+1
      const session = await prisma.studySession.findFirst({
        where: {
          id: sessionId,
          OR: [
            { userId: user.id },
            { createdBy: user.id },
          ],
          deletedByUserAt: null, // Not already deleted
        },
        select: { id: true },
      })

      if (!session) {
        return NextResponse.json(
          { error: 'Session not found or already deleted' },
          { status: 404 }
        )
      }

      await prisma.studySession.update({
        where: { id: sessionId },
        data: {
          deletedByUserId: user.id,
          deletedByUserAt: new Date(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
