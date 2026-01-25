/**
 * ENFORCEMENT STATE API
 *
 * GET /api/enforcement/state - Get user's enforcement state
 *
 * Returns:
 * - User identity (archetype, strengths, growth areas)
 * - Pending enforcement actions
 * - Study debt status
 * - Skip/failure counts
 * - Streak status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EnforcementEngine } from '@/lib/enforcement-engine'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

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

    // Rate limiting - lenient for status checks
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Get enforcement state
    const state = await EnforcementEngine.getUserState(user.id)

    // Check for inactivity and get authority message
    const inactivityMessage = await EnforcementEngine.checkInactivity(user.id)

    // Get authority messages for current state
    const debtMessage = EnforcementEngine.getAuthorityMessage('debt', {
      debtMinutes: state.activeDebts,
    })

    const streakMessage = state.identity ? EnforcementEngine.getAuthorityMessage('streak', {
      streak: state.identity.currentStreak,
    }) : null

    log.info('Enforcement state retrieved', {
      userId: user.id,
      hasDebt: state.activeDebts > 0,
      pendingActions: state.pendingActions.length,
      streakAtRisk: state.streakAtRisk,
    })

    return NextResponse.json({
      success: true,
      state: {
        identity: state.identity ? {
          archetype: state.identity.archetype,
          strengths: state.identity.strengths,
          growthAreas: state.identity.growthAreas,
          currentStreak: state.identity.currentStreak,
          longestStreak: state.identity.longestStreak,
          totalMissionsCompleted: state.identity.totalMissionsCompleted,
          totalMissionsFailed: state.identity.totalMissionsFailed,
          totalMissionsSkipped: state.identity.totalMissionsSkipped,
          daysSinceLastMission: state.identity.daysSinceLastMission,
          consistencyScore: state.identity.consistencyScore,
        } : null,
        pendingActions: state.pendingActions.map(action => ({
          id: action.id,
          type: action.actionType,
          message: action.authorityMessage,
          acknowledged: action.acknowledged,
          createdAt: action.createdAt,
        })),
        debt: {
          totalMinutes: state.activeDebts,
          message: debtMessage.message,
          tone: debtMessage.tone,
        },
        metrics: {
          skipCount: state.skipCount,
          failureCount: state.failureCount,
        },
        streak: {
          current: state.identity?.currentStreak || 0,
          atRisk: state.streakAtRisk,
          message: streakMessage?.message || null,
        },
        inactivityAlert: inactivityMessage,
      },
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to get enforcement state', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get enforcement state' },
      { status: 500 }
    )
  }
}
