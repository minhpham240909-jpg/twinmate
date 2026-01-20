/**
 * Study Debt API
 * 
 * GET: Fetch user's study debt queue
 * POST: Create new study debt item
 * 
 * Study Debt creates accountability without shame - users queue their own debt
 * and pay it back at their own pace.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for creating study debt
const createDebtSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  debtMinutes: z.number().int().min(5).max(480), // 5 min to 8 hours
  source: z.enum(['MISSED_SESSION', 'BROKEN_STREAK', 'INCOMPLETE_GOAL', 'SELF_ADDED']),
  subject: z.string().max(100).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  expiresAt: z.string().datetime().optional(),
})

/**
 * GET /api/study-debt
 * Fetch user's study debt queue with progress
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'QUEUED', 'IN_PROGRESS', 'COMPLETED', etc.
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build where clause
    const where: Record<string, unknown> = { userId: user.id }
    if (status) {
      where.status = status
    } else {
      // Default: show active debts (queued + in progress)
      where.status = { in: ['QUEUED', 'IN_PROGRESS'] }
    }

    // Fetch debts with priority ordering
    const debts = await prisma.studyDebt.findMany({
      where,
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    })

    // Calculate summary stats
    const stats = await prisma.studyDebt.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _sum: { debtMinutes: true, paidMinutes: true },
      _count: { id: true },
    })

    const summary = {
      totalQueuedMinutes: 0,
      totalPaidMinutes: 0,
      queuedCount: 0,
      inProgressCount: 0,
      completedCount: 0,
      overallProgress: 0,
    }

    stats.forEach(stat => {
      if (stat.status === 'QUEUED') {
        summary.queuedCount = stat._count.id
        summary.totalQueuedMinutes += stat._sum.debtMinutes || 0
      } else if (stat.status === 'IN_PROGRESS') {
        summary.inProgressCount = stat._count.id
        summary.totalQueuedMinutes += stat._sum.debtMinutes || 0
        summary.totalPaidMinutes += stat._sum.paidMinutes || 0
      } else if (stat.status === 'COMPLETED') {
        summary.completedCount = stat._count.id
        summary.totalPaidMinutes += stat._sum.paidMinutes || 0
      }
    })

    // Calculate overall progress
    const totalDebt = summary.totalQueuedMinutes + summary.totalPaidMinutes
    summary.overallProgress = totalDebt > 0 
      ? Math.round((summary.totalPaidMinutes / totalDebt) * 100) 
      : 100

    return NextResponse.json({
      success: true,
      debts,
      summary,
    })
  } catch (error) {
    console.error('[Study Debt GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch study debts' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/study-debt
 * Create a new study debt item
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createDebtSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { title, description, debtMinutes, source, subject, priority, expiresAt } = validation.data

    // Create the debt
    const debt = await prisma.studyDebt.create({
      data: {
        userId: user.id,
        title,
        description,
        debtMinutes,
        source,
        subject,
        priority: priority || 0,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })

    return NextResponse.json({
      success: true,
      debt,
      message: 'Study debt added to your queue. You\'ve got this! 💪',
    })
  } catch (error) {
    console.error('[Study Debt POST] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create study debt' },
      { status: 500 }
    )
  }
}
