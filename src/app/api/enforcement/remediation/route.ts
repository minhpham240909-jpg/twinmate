/**
 * REMEDIATION API
 *
 * GET /api/enforcement/remediation - Check if remediation is required
 * POST /api/enforcement/remediation - Submit remediation proof
 *
 * Remediation is required when users:
 * - Have active weak spots with severity >= 2
 * - Have pending skip remediations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RemediationEngine } from '@/lib/enforcement-engine/remediation'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

// GET: Check if remediation is required
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

    // OPTIMIZED: Parallel queries
    const [remediationStatus, weakSpots] = await Promise.all([
      RemediationEngine.checkRemediationRequired(user.id),
      RemediationEngine.getWeakSpots(user.id)
    ])

    log.info('Remediation status checked', {
      userId: user.id,
      required: remediationStatus.required,
      missionCount: remediationStatus.missions.length,
      activeWeakSpots: weakSpots.active.length,
    })

    return NextResponse.json({
      success: true,
      remediation: {
        required: remediationStatus.required,
        message: remediationStatus.message,
        missions: remediationStatus.missions.map(m => ({
          id: m.id,
          type: m.type,
          title: m.title,
          directive: m.directive,
          context: m.context,
          estimatedMinutes: m.estimatedMinutes,
          proofRequired: m.proofRequired,
          criteria: m.criteria,
          mandatory: m.mandatory,
          linkedWeakSpot: m.linkedWeakSpot,
        })),
      },
      weakSpots: {
        active: weakSpots.active.map(ws => ({
          id: ws.id,
          subject: ws.subject,
          topic: ws.topic,
          severity: ws.severity,
          failedAttempts: ws.failedAttempts,
          lastFailedAt: ws.lastFailedAt,
        })),
        remediatedCount: weakSpots.remediated.length,
        resolvedCount: weakSpots.resolved.length,
      },
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to check remediation status', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to check remediation status' },
      { status: 500 }
    )
  }
}

// POST: Submit remediation proof
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
    const { missionId, proof } = body

    if (!missionId || !proof) {
      return NextResponse.json(
        { error: 'Missing required fields: missionId and proof' },
        { status: 400 }
      )
    }

    if (!proof.type || !proof.content) {
      return NextResponse.json(
        { error: 'Proof must include type and content' },
        { status: 400 }
      )
    }

    // Validate proof type
    const validProofTypes = ['explanation', 'quiz', 'practice']
    if (!validProofTypes.includes(proof.type)) {
      return NextResponse.json(
        { error: 'Invalid proof type. Must be: explanation, quiz, or practice' },
        { status: 400 }
      )
    }

    // Submit remediation
    const result = await RemediationEngine.submitRemediation(user.id, missionId, proof)

    log.info('Remediation submitted', {
      userId: user.id,
      missionId,
      passed: result.passed,
      weakSpotResolved: result.weakSpotResolved,
    })

    // Check if more remediation is needed
    const remainingRemediation = await RemediationEngine.checkRemediationRequired(user.id)

    return NextResponse.json({
      success: true,
      result: {
        missionId: result.missionId,
        passed: result.passed,
        feedback: result.feedback,
        weakSpotResolved: result.weakSpotResolved,
      },
      remainingRemediation: {
        required: remainingRemediation.required,
        count: remainingRemediation.missions.length,
        message: remainingRemediation.message,
      },
      authorityMessage: result.passed
        ? 'Gap addressed. You may continue.'
        : 'Not sufficient. Review the material and try again.',
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to submit remediation', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to submit remediation' },
      { status: 500 }
    )
  }
}
