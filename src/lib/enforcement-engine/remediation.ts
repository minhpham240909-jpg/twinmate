/**
 * REMEDIATION WORKFLOW
 *
 * Creates and manages remediation missions for users who:
 * - Failed a step multiple times
 * - Skipped too many steps
 * - Have unresolved weak spots
 *
 * Remediation missions are:
 * - Mandatory before continuing
 * - Focused on the specific gap
 * - Require proof of understanding
 */

import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'
import {
  sanitizeUserInput,
  validateExplanationQuality,
  validateQuizScore,
  validatePracticeSubmission
} from '@/lib/validation'
import type { WeakSpot, RoadmapStep } from '@prisma/client'

// ============================================
// TYPES
// ============================================

export interface RemediationMission {
  id: string
  type: 'SKILL_GAP' | 'PATTERN_FIX' | 'CONCEPT_REVIEW'
  title: string
  directive: string
  context: string
  estimatedMinutes: number
  proofRequired: 'explanation' | 'quiz' | 'practice'
  criteria: {
    type: 'score' | 'completion' | 'quality'
    threshold?: number
    description: string
  }
  linkedWeakSpot?: {
    id: string
    topic: string
    failedAttempts: number
  }
  mandatory: boolean
}

export interface RemediationResult {
  missionId: string
  passed: boolean
  feedback: string
  weakSpotResolved: boolean
}

// ============================================
// REMEDIATION ENGINE
// ============================================

export class RemediationEngine {

  /**
   * Check if user needs remediation before continuing
   */
  static async checkRemediationRequired(userId: string): Promise<{
    required: boolean
    missions: RemediationMission[]
    message: string
  }> {
    // Get unresolved weak spots
    const activeWeakSpots = await prisma.weakSpot.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        severity: { gte: 2 }, // Only severity 2+ requires remediation
      },
      orderBy: { severity: 'desc' },
      take: 3, // Max 3 concurrent remediations
    })

    // Get pending remediation skip records
    const pendingRemediations = await prisma.skipRecord.findMany({
      where: {
        userId,
        requiresRemediation: true,
        remediationCompleted: false,
      },
      take: 3,
    })

    if (activeWeakSpots.length === 0 && pendingRemediations.length === 0) {
      return {
        required: false,
        missions: [],
        message: 'No remediation required. Continue with your roadmap.',
      }
    }

    // Create remediation missions
    const missions: RemediationMission[] = []

    // From weak spots
    for (const weakSpot of activeWeakSpots) {
      missions.push(this.createWeakSpotRemediation(weakSpot))
    }

    // From skips - OPTIMIZED: Batch fetch all steps in one query
    if (pendingRemediations.length > 0) {
      const stepIds = pendingRemediations.map(r => r.stepId)
      const steps = await prisma.roadmapStep.findMany({
        where: { id: { in: stepIds } }
      })
      const stepsMap = new Map(steps.map(s => [s.id, s]))

      for (const skipRecord of pendingRemediations) {
        const step = stepsMap.get(skipRecord.stepId)
        if (step) {
          missions.push(this.createSkipRemediation(skipRecord.id, step))
        }
      }
    }

    return {
      required: true,
      missions,
      message: `${missions.length} remediation mission(s) required before continuing.`,
    }
  }

  /**
   * Create a remediation mission for a weak spot
   */
  private static createWeakSpotRemediation(weakSpot: WeakSpot): RemediationMission {
    const severity = weakSpot.severity

    // Higher severity = more rigorous proof required
    const proofRequired = severity >= 4 ? 'quiz' : severity >= 2 ? 'practice' : 'explanation'
    const threshold = severity >= 4 ? 90 : severity >= 2 ? 80 : undefined

    return {
      id: `remediate-ws-${weakSpot.id}`,
      type: 'SKILL_GAP',
      title: `Master: ${weakSpot.topic}`,
      directive: this.getRemediationDirective(weakSpot),
      context: this.getRemediationContext(weakSpot),
      estimatedMinutes: 15 + (severity * 5), // 20-40 minutes based on severity
      proofRequired,
      criteria: {
        type: proofRequired === 'quiz' ? 'score' : proofRequired === 'practice' ? 'completion' : 'quality',
        threshold,
        description: this.getCriteriaDescription(proofRequired, threshold),
      },
      linkedWeakSpot: {
        id: weakSpot.id,
        topic: weakSpot.topic,
        failedAttempts: weakSpot.failedAttempts,
      },
      mandatory: severity >= 3,
    }
  }

  /**
   * Create a remediation mission for a skipped step
   */
  private static createSkipRemediation(skipRecordId: string, step: RoadmapStep): RemediationMission {
    return {
      id: `remediate-skip-${skipRecordId}`,
      type: 'CONCEPT_REVIEW',
      title: `Review: ${step.title}`,
      directive: `You skipped "${step.title}". Before moving forward, demonstrate understanding of this concept.`,
      context: step.description,
      estimatedMinutes: step.duration || 15,
      proofRequired: 'explanation',
      criteria: {
        type: 'quality',
        description: 'Explain the key concepts in your own words without looking at notes.',
      },
      mandatory: true,
    }
  }

  /**
   * Get directive based on weak spot characteristics
   */
  private static getRemediationDirective(weakSpot: WeakSpot): string {
    const attempts = weakSpot.failedAttempts

    if (attempts >= 4) {
      return `${weakSpot.topic}: ${attempts} unsuccessful attempts recorded. Focused review required before proceeding.`
    } else if (attempts >= 2) {
      return `${weakSpot.topic}: ${attempts} unsuccessful attempts. Alternative approach recommended.`
    } else {
      return `${weakSpot.topic}: Reinforcement required.`
    }
  }

  /**
   * Get context based on weak spot characteristics
   */
  private static getRemediationContext(weakSpot: WeakSpot): string {
    const remediationCount = weakSpot.remediationCount

    if (remediationCount > 0) {
      return `Remediation attempt #${remediationCount + 1}. Previous approach unsuccessful. Recommended: use alternative explanations, different examples, or teach the concept to verify understanding.`
    }

    return `Remediation targets specific knowledge gaps. Depth of understanding is prioritized over completion speed.`
  }

  /**
   * Get criteria description
   */
  private static getCriteriaDescription(proofType: string, threshold?: number): string {
    switch (proofType) {
      case 'quiz':
        return `Score at least ${threshold}% on assessment questions.`
      case 'practice':
        return 'Complete all practice problems correctly.'
      case 'explanation':
        return 'Explain the concept in your own words with enough depth to show understanding.'
      default:
        return 'Complete the remediation task.'
    }
  }

  /**
   * Submit remediation proof and evaluate
   */
  static async submitRemediation(
    userId: string,
    missionId: string,
    proof: {
      type: 'explanation' | 'quiz' | 'practice'
      content: string
      score?: number
    }
  ): Promise<RemediationResult> {

    // Parse mission ID to determine type
    const isWeakSpotRemediation = missionId.startsWith('remediate-ws-')
    const isSkipRemediation = missionId.startsWith('remediate-skip-')

    // SECURITY: Verify ownership before processing
    if (isWeakSpotRemediation) {
      const weakSpotId = missionId.replace('remediate-ws-', '')
      const weakSpot = await prisma.weakSpot.findUnique({
        where: { id: weakSpotId },
        select: { userId: true }
      })
      if (!weakSpot || weakSpot.userId !== userId) {
        logger.warn('Unauthorized remediation attempt', { userId, missionId })
        return {
          missionId,
          passed: false,
          feedback: 'Invalid mission. This remediation does not belong to you.',
          weakSpotResolved: false,
        }
      }
    }

    if (isSkipRemediation) {
      const skipRecordId = missionId.replace('remediate-skip-', '')
      const skipRecord = await prisma.skipRecord.findUnique({
        where: { id: skipRecordId },
        select: { userId: true }
      })
      if (!skipRecord || skipRecord.userId !== userId) {
        logger.warn('Unauthorized remediation attempt', { userId, missionId })
        return {
          missionId,
          passed: false,
          feedback: 'Invalid mission. This remediation does not belong to you.',
          weakSpotResolved: false,
        }
      }
    }

    // Sanitize input first
    const sanitizedContent = sanitizeUserInput(proof.content)

    // Evaluate proof with semantic validation
    let passed = false
    let feedback = ''

    switch (proof.type) {
      case 'quiz': {
        const quizValidation = validateQuizScore(proof.score, 80)
        passed = quizValidation.valid
        feedback = passed
          ? `${proof.score}% - Threshold met. This topic is now resolved.`
          : quizValidation.reason || 'Quiz score below threshold.'
        break
      }

      case 'practice': {
        const practiceValidation = validatePracticeSubmission(sanitizedContent)
        passed = practiceValidation.valid
        feedback = passed
          ? 'Practice completed. The concept should be clearer now.'
          : practiceValidation.reason || 'Practice submission insufficient.'
        break
      }

      case 'explanation': {
        // Use semantic validation - checks length, word count, uniqueness, etc.
        const explanationValidation = validateExplanationQuality(sanitizedContent, {
          minLength: 100,
          minWords: 15,
          minUniqueWords: 10
        })
        passed = explanationValidation.valid
        feedback = passed
          ? 'Explanation accepted. Understanding demonstrated.'
          : explanationValidation.reason || 'Explanation insufficient.'
        break
      }
    }

    // Update records based on result
    let weakSpotResolved = false

    if (passed) {
      if (isWeakSpotRemediation) {
        const weakSpotId = missionId.replace('remediate-ws-', '')
        await prisma.weakSpot.update({
          where: { id: weakSpotId },
          data: {
            status: 'REMEDIATED',
            lastRemediatedAt: new Date(),
            remediationCount: { increment: 1 },
          }
        })
        weakSpotResolved = true
      }

      if (isSkipRemediation) {
        const skipRecordId = missionId.replace('remediate-skip-', '')
        await prisma.skipRecord.update({
          where: { id: skipRecordId },
          data: {
            remediationCompleted: true,
            resolvedAt: new Date(),
          }
        })
      }

      logger.info('Remediation completed', { userId, missionId, passed })
    } else {
      // Track failed remediation attempt
      if (isWeakSpotRemediation) {
        const weakSpotId = missionId.replace('remediate-ws-', '')
        await prisma.weakSpot.update({
          where: { id: weakSpotId },
          data: {
            remediationCount: { increment: 1 },
            severity: { increment: 1 }, // Increase severity on failed remediation
          }
        })
      }

      logger.info('Remediation failed', { userId, missionId, passed })
    }

    return {
      missionId,
      passed,
      feedback,
      weakSpotResolved,
    }
  }

  /**
   * Get all weak spots for a user
   */
  static async getWeakSpots(userId: string): Promise<{
    active: WeakSpot[]
    remediated: WeakSpot[]
    resolved: WeakSpot[]
  }> {
    const weakSpots = await prisma.weakSpot.findMany({
      where: { userId },
      orderBy: [
        { status: 'asc' },
        { severity: 'desc' },
        { lastFailedAt: 'desc' },
      ]
    })

    return {
      active: weakSpots.filter(ws => ws.status === 'ACTIVE'),
      remediated: weakSpots.filter(ws => ws.status === 'REMEDIATED'),
      resolved: weakSpots.filter(ws => ws.status === 'RESOLVED'),
    }
  }

  /**
   * Resolve a weak spot (called when user demonstrates mastery)
   */
  static async resolveWeakSpot(weakSpotId: string): Promise<void> {
    await prisma.weakSpot.update({
      where: { id: weakSpotId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      }
    })
  }

  /**
   * Check if a weak spot should be reactivated (if user fails again on related topic)
   */
  static async reactivateIfNeeded(
    userId: string,
    subject: string,
    topic: string
  ): Promise<boolean> {
    const existingWeakSpot = await prisma.weakSpot.findUnique({
      where: {
        userId_subject_topic: { userId, subject, topic }
      }
    })

    if (existingWeakSpot && existingWeakSpot.status === 'REMEDIATED') {
      // Reactivate the weak spot
      await prisma.weakSpot.update({
        where: { id: existingWeakSpot.id },
        data: {
          status: 'ACTIVE',
          failedAttempts: { increment: 1 },
          lastFailedAt: new Date(),
          severity: Math.min(5, existingWeakSpot.severity + 1),
        }
      })
      return true
    }

    return false
  }
}

export default RemediationEngine
