/**
 * ENFORCEMENT ACTION API
 *
 * GET /api/enforcement/action - Get pending enforcement actions
 * POST /api/enforcement/action/acknowledge - Acknowledge an action
 * POST /api/enforcement/action/resolve - Mark an action as resolved
 *
 * Enforcement actions are consequences that require user attention:
 * - Remediation missions
 * - Study debt notifications
 * - Streak reset notifications
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EnforcementEngine } from '@/lib/enforcement-engine'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

// GET: Get pending enforcement actions
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

    // Get pending actions
    const actions = await EnforcementEngine.getPendingActions(user.id)

    // Separate by urgency
    const urgent = actions.filter(a => !a.acknowledged)
    const acknowledged = actions.filter(a => a.acknowledged && !a.resolved)

    log.info('Enforcement actions retrieved', {
      userId: user.id,
      urgentCount: urgent.length,
      acknowledgedCount: acknowledged.length,
    })

    return NextResponse.json({
      success: true,
      actions: {
        urgent: urgent.map(a => ({
          id: a.id,
          type: a.actionType,
          triggerType: a.triggerType,
          message: a.authorityMessage,
          createdAt: a.createdAt,
        })),
        acknowledged: acknowledged.map(a => ({
          id: a.id,
          type: a.actionType,
          triggerType: a.triggerType,
          message: a.authorityMessage,
          acknowledgedAt: a.acknowledgedAt,
        })),
        totalPending: actions.length,
      },
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to get enforcement actions', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get enforcement actions' },
      { status: 500 }
    )
  }
}

// POST: Acknowledge or resolve an action
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
    const { actionId, operation } = body

    if (!actionId || !operation) {
      return NextResponse.json(
        { error: 'Missing required fields: actionId and operation' },
        { status: 400 }
      )
    }

    if (!['acknowledge', 'resolve'].includes(operation)) {
      return NextResponse.json(
        { error: 'operation must be "acknowledge" or "resolve"' },
        { status: 400 }
      )
    }

    // Perform operation
    if (operation === 'acknowledge') {
      await EnforcementEngine.acknowledgeAction(actionId)
      log.info('Action acknowledged', { userId: user.id, actionId })
    } else {
      await EnforcementEngine.resolveAction(actionId)
      log.info('Action resolved', { userId: user.id, actionId })
    }

    return NextResponse.json({
      success: true,
      actionId,
      operation,
      message: operation === 'acknowledge'
        ? 'Action acknowledged. Complete the required task to resolve it.'
        : 'Action resolved. Well done.',
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to update enforcement action', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to update enforcement action' },
      { status: 500 }
    )
  }
}
