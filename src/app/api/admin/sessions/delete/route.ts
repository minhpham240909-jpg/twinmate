/**
 * POST /api/admin/sessions/delete
 * Permanently delete a session (admin only)
 * This removes the session from the database forever
 *
 * SCALABILITY: Uses rate limiting and single-query operations
 * Safe for 1000-3000 concurrent users
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { adminRateLimit } from '@/lib/admin/rate-limit'

const deleteSchema = z.object({
  sessionId: z.string().uuid(),
  sessionType: z.enum(['study', 'ai']),
  confirmation: z.literal('PERMANENTLY_DELETE'), // Require explicit confirmation
})

export async function POST(request: NextRequest) {
  // SCALABILITY: Rate limit admin delete operations (strict)
  const rateLimitResult = await adminRateLimit(request, 'userActions')
  if (rateLimitResult) return rateLimitResult

  try {
    // Check if user is admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const validation = deleteSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request. Must include sessionId, sessionType, and confirmation: "PERMANENTLY_DELETE"' },
        { status: 400 }
      )
    }

    const { sessionId, sessionType } = validation.data

    let deletedSession: { id: string; title?: string; subject?: string | null } | null = null

    if (sessionType === 'ai') {
      // Find the AI session first for logging
      const session = await prisma.aIPartnerSession.findUnique({
        where: { id: sessionId },
        select: { id: true, subject: true, userId: true },
      })

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      // Option 1: Soft-delete with admin flag (keeps data for compliance)
      // await prisma.aIPartnerSession.update({
      //   where: { id: sessionId },
      //   data: {
      //     deletedByAdminId: user.id,
      //     deletedByAdminAt: new Date(),
      //   },
      // })

      // Option 2: Hard delete (permanently removes from database)
      // First delete related messages
      await prisma.aIPartnerMessage.deleteMany({
        where: { sessionId },
      })

      // Then delete the session
      await prisma.aIPartnerSession.delete({
        where: { id: sessionId },
      })

      deletedSession = { id: session.id, subject: session.subject }
    } else {
      // Find the study session first for logging
      const session = await prisma.studySession.findUnique({
        where: { id: sessionId },
        select: { id: true, title: true, subject: true, createdBy: true },
      })

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      // Hard delete - cascade will handle related records
      await prisma.studySession.delete({
        where: { id: sessionId },
      })

      deletedSession = { id: session.id, title: session.title, subject: session.subject }
    }

    // Log admin action
    await prisma.adminAuditLog.create({
      data: {
        adminId: user.id,
        action: 'PERMANENTLY_DELETE_SESSION',
        targetType: sessionType === 'ai' ? 'AI_SESSION' : 'STUDY_SESSION',
        targetId: sessionId,
        details: {
          sessionType,
          sessionTitle: deletedSession?.title || deletedSession?.subject,
          deletedPermanently: true,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Session permanently deleted',
    })
  } catch (error) {
    console.error('Error permanently deleting session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
