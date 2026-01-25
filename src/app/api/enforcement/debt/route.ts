/**
 * STUDY DEBT API
 *
 * GET /api/enforcement/debt - Get user's study debt
 * POST /api/enforcement/debt/pay - Pay down study debt with study time
 *
 * Study debt is accumulated from:
 * - Skipping steps
 * - Failing attempts
 * - Breaking streaks
 * - Abandoning roadmaps
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EnforcementEngine } from '@/lib/enforcement-engine'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

// GET: Get user's study debt
export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Get all active debts
    const debts = await prisma.studyDebt.findMany({
      where: {
        userId: user.id,
        status: { in: ['QUEUED', 'IN_PROGRESS'] }
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    // Calculate totals
    const totalOwed = debts.reduce((sum, d) => sum + d.debtMinutes, 0)
    const totalPaid = debts.reduce((sum, d) => sum + d.paidMinutes, 0)
    const totalRemaining = totalOwed - totalPaid

    // Get authority message
    const debtMessage = EnforcementEngine.getAuthorityMessage('debt', {
      debtMinutes: totalRemaining,
    })

    log.info('Debt retrieved', {
      userId: user.id,
      debtCount: debts.length,
      totalRemaining,
    })

    return NextResponse.json({
      success: true,
      debt: {
        totalOwed,
        totalPaid,
        totalRemaining,
        itemCount: debts.length,
        items: debts.map(d => ({
          id: d.id,
          title: d.title,
          description: d.description,
          source: d.source,
          status: d.status,
          debtMinutes: d.debtMinutes,
          paidMinutes: d.paidMinutes,
          progressPercent: d.progressPercent,
          subject: d.subject,
          priority: d.priority,
          expiresAt: d.expiresAt,
          createdAt: d.createdAt,
        })),
        message: debtMessage.message,
        tone: debtMessage.tone,
      },
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to get study debt', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get study debt' },
      { status: 500 }
    )
  }
}

// POST: Pay down study debt
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Parse request
    const body = await request.json()
    const { minutesStudied } = body

    if (!minutesStudied || minutesStudied <= 0) {
      return NextResponse.json(
        { error: 'minutesStudied must be a positive number' },
        { status: 400 }
      )
    }

    // Pay down debt
    const debtsPaid = await EnforcementEngine.payStudyDebt(user.id, minutesStudied)

    // Get updated debt status
    const debtInfo = await EnforcementEngine.getStudyDebt(user.id)

    log.info('Debt payment recorded', {
      userId: user.id,
      minutesStudied,
      debtsPaid,
      remainingDebt: debtInfo.total,
    })

    return NextResponse.json({
      success: true,
      payment: {
        minutesApplied: minutesStudied,
        debtsFullyPaid: debtsPaid,
        remainingDebtMinutes: debtInfo.total,
        remainingDebtItems: debtInfo.items,
      },
      message: debtsPaid > 0
        ? `Debt paid. ${debtsPaid} item(s) fully cleared.`
        : `${minutesStudied} minutes applied to debt. ${debtInfo.total} minutes remaining.`,
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to pay study debt', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to pay study debt' },
      { status: 500 }
    )
  }
}
