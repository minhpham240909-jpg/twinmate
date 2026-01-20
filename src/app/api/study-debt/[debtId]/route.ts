/**
 * Study Debt Item API
 * 
 * GET: Get single debt details
 * PATCH: Update debt (start, log time, complete, forgive)
 * DELETE: Remove debt from queue
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

interface RouteContext {
  params: Promise<{ debtId: string }>
}

// Validation schema for updating debt
const updateDebtSchema = z.object({
  action: z.enum(['start', 'log_time', 'complete', 'forgive', 'update_priority']),
  minutes: z.number().int().min(1).optional(), // For log_time action
  priority: z.number().int().min(0).max(10).optional(), // For update_priority action
})

/**
 * GET /api/study-debt/[debtId]
 * Get single debt details
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { debtId } = await context.params

    const debt = await prisma.studyDebt.findFirst({
      where: {
        id: debtId,
        userId: user.id,
      },
    })

    if (!debt) {
      return NextResponse.json({ error: 'Debt not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, debt })
  } catch (error) {
    console.error('[Study Debt GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch debt' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/study-debt/[debtId]
 * Update debt status or log time
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { debtId } = await context.params
    const body = await request.json()
    const validation = updateDebtSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { action, minutes, priority } = validation.data

    // Verify debt belongs to user
    const debt = await prisma.studyDebt.findFirst({
      where: {
        id: debtId,
        userId: user.id,
      },
    })

    if (!debt) {
      return NextResponse.json({ error: 'Debt not found' }, { status: 404 })
    }

    let updatedDebt
    let message = ''

    switch (action) {
      case 'start':
        // Mark debt as in progress
        if (debt.status !== 'QUEUED') {
          return NextResponse.json(
            { error: 'Can only start queued debts' },
            { status: 400 }
          )
        }
        updatedDebt = await prisma.studyDebt.update({
          where: { id: debtId },
          data: {
            status: 'IN_PROGRESS',
            startedAt: new Date(),
          },
        })
        message = 'Started paying back your study debt. Let\'s go! 🚀'
        break

      case 'log_time':
        // Log study time against this debt
        if (!minutes) {
          return NextResponse.json(
            { error: 'Minutes required for log_time action' },
            { status: 400 }
          )
        }
        if (debt.status === 'COMPLETED' || debt.status === 'FORGIVEN') {
          return NextResponse.json(
            { error: 'Cannot log time on completed or forgiven debts' },
            { status: 400 }
          )
        }

        const newPaidMinutes = debt.paidMinutes + minutes
        const newProgress = Math.min((newPaidMinutes / debt.debtMinutes) * 100, 100)
        const isComplete = newPaidMinutes >= debt.debtMinutes

        updatedDebt = await prisma.studyDebt.update({
          where: { id: debtId },
          data: {
            paidMinutes: newPaidMinutes,
            progressPercent: newProgress,
            status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
            completedAt: isComplete ? new Date() : null,
            startedAt: debt.startedAt || new Date(),
          },
        })

        message = isComplete
          ? `🎉 Debt paid off! You studied ${newPaidMinutes} minutes.`
          : `Logged ${minutes} minutes. ${Math.round(newProgress)}% complete!`
        break

      case 'complete':
        // Force complete the debt (even if not fully paid)
        updatedDebt = await prisma.studyDebt.update({
          where: { id: debtId },
          data: {
            status: 'COMPLETED',
            progressPercent: 100,
            completedAt: new Date(),
          },
        })
        message = '✅ Marked as complete. Great work!'
        break

      case 'forgive':
        // Forgive the debt (user decided to let it go)
        updatedDebt = await prisma.studyDebt.update({
          where: { id: debtId },
          data: {
            status: 'FORGIVEN',
            completedAt: new Date(),
          },
        })
        message = '🕊️ Debt forgiven. Sometimes it\'s okay to let go and move forward.'
        break

      case 'update_priority':
        // Update debt priority
        if (priority === undefined) {
          return NextResponse.json(
            { error: 'Priority required for update_priority action' },
            { status: 400 }
          )
        }
        updatedDebt = await prisma.studyDebt.update({
          where: { id: debtId },
          data: { priority },
        })
        message = 'Priority updated'
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      debt: updatedDebt,
      message,
    })
  } catch (error) {
    console.error('[Study Debt PATCH] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update debt' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/study-debt/[debtId]
 * Remove debt from queue
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { debtId } = await context.params

    // Verify debt belongs to user
    const debt = await prisma.studyDebt.findFirst({
      where: {
        id: debtId,
        userId: user.id,
      },
    })

    if (!debt) {
      return NextResponse.json({ error: 'Debt not found' }, { status: 404 })
    }

    await prisma.studyDebt.delete({
      where: { id: debtId },
    })

    return NextResponse.json({
      success: true,
      message: 'Debt removed from queue',
    })
  } catch (error) {
    console.error('[Study Debt DELETE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete debt' },
      { status: 500 }
    )
  }
}
