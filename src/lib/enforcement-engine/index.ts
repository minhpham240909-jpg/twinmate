/**
 * CLERVA ENFORCEMENT ENGINE
 *
 * The enforcement layer that gives the Mission Engine "teeth".
 *
 * Philosophy:
 * - Skips have consequences
 * - Failures require remediation
 * - Patterns are tracked
 * - Identity is reinforced through actions
 *
 * This is what makes Clerva different from ChatGPT.
 * ChatGPT: "Sure, you can skip that!"
 * Clerva: "Skip this, and you'll owe study debt. Your choice."
 */

import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'
import type {
  SkipReason,
  ConsequenceType,
  AttemptResult,
  SkipRecord,
  MissionAttempt,
  LearnerIdentity,
  EnforcementAction,
} from '@prisma/client'

// Re-export types for convenience
export type { SkipReason, ConsequenceType, AttemptResult }

// ============================================
// CONFIGURATION
// ============================================

const ENFORCEMENT_CONFIG = {
  // Minimum time required on a step before completion is allowed (minutes)
  minimumStepTimeMinutes: 2,

  // Number of skips before serious consequences
  skipWarningThreshold: 2,
  skipConsequenceThreshold: 3,

  // Failure thresholds
  failuresBeforeRemediation: 2,
  failuresBeforeSlowdown: 4,

  // Study debt calculation
  skipDebtMinutes: 10,      // Minutes added per skip
  failureDebtMinutes: 15,   // Minutes added per failure
  abandonDebtMinutes: 20,   // Minutes added for abandonment

  // Time gap thresholds (days)
  inactivityWarningDays: 3,
  inactivityConsequenceDays: 7,

  // Proof requirements
  minExplanationLength: 100, // Must match UI (RemediationModal.tsx shows 100)
  minQuizScore: 70,
}

// ============================================
// TYPES
// ============================================

export interface SkipDecision {
  allowed: boolean
  consequence?: ConsequenceType
  message: string
  debtMinutes?: number
  requiresRemediation?: boolean
}

export interface CompletionValidation {
  valid: boolean
  reason?: string
  minimumTimeMet: boolean
  proofValidated: boolean
  warnings: string[]
}

export interface UserEnforcementState {
  identity: LearnerIdentity | null
  pendingActions: EnforcementAction[]
  activeDebts: number // Total minutes of study debt
  skipCount: number   // Skips in current roadmap
  failureCount: number // Failures in current roadmap
  streakAtRisk: boolean
}

export interface AuthorityResponse {
  message: string
  tone: 'encouragement' | 'warning' | 'consequence' | 'neutral'
  actionRequired?: string
}

// ============================================
// ENFORCEMENT ENGINE
// ============================================

export class EnforcementEngine {

  // ============================================
  // SKIP HANDLING
  // ============================================

  /**
   * Evaluate a skip request and determine consequences
   * This is where the "teeth" live
   */
  static async evaluateSkip(
    userId: string,
    roadmapId: string,
    stepId: string,
    reason: SkipReason,
    _userExplanation?: string
  ): Promise<SkipDecision> {

    // OPTIMIZED: Parallel queries to avoid sequential round trips
    const [skipCount, step, attempts] = await Promise.all([
      prisma.skipRecord.count({
        where: { userId, roadmapId }
      }),
      prisma.roadmapStep.findUnique({
        where: { id: stepId },
        include: { roadmap: true }
      }),
      prisma.missionAttempt.count({
        where: { userId, stepId }
      })
    ])

    if (!step) {
      return {
        allowed: false,
        message: 'Step not found.',
      }
    }

    if (attempts === 0 && reason !== 'ALREADY_KNOW') {
      return {
        allowed: false,
        message: 'You must attempt this step before skipping. No shortcuts.',
      }
    }

    // Handle "already know" claims with verification requirement
    if (reason === 'ALREADY_KNOW') {
      return {
        allowed: true,
        consequence: 'PROOF_REQUIRED',
        message: 'Prove it. Pass a quick assessment on this topic to skip.',
        requiresRemediation: false,
      }
    }

    // Determine consequences based on skip count (this will be the skipCount+1'th skip)
    // skipCount = 0: First skip, warning only
    // skipCount = 1: Second skip, debt added
    // skipCount >= 2: Third+ skip, serious consequences (remediation required)

    if (skipCount === 0) {
      // First skip: warning only
      return {
        allowed: true,
        consequence: undefined,
        message: 'First skip noted. Clerva tracks patterns. This will return later.',
        requiresRemediation: false,
      }
    }

    if (skipCount === 1) {
      // Second skip: debt added
      return {
        allowed: true,
        consequence: 'DEBT_ADDED',
        message: `Skip accepted. ${ENFORCEMENT_CONFIG.skipDebtMinutes} minutes added to your study debt.`,
        debtMinutes: ENFORCEMENT_CONFIG.skipDebtMinutes,
        requiresRemediation: false,
      }
    }

    // Third+ skip (skipCount >= 2): serious consequences
    return {
      allowed: true,
      consequence: 'REMEDIATION',
      message: `Pattern detected: ${skipCount + 1} skips. You'll need to complete remediation before moving forward.`,
      debtMinutes: ENFORCEMENT_CONFIG.skipDebtMinutes * 2,
      requiresRemediation: true,
    }
  }

  /**
   * Record a skip and apply consequences
   */
  static async recordSkip(
    userId: string,
    roadmapId: string,
    stepId: string,
    reason: SkipReason,
    decision: SkipDecision,
    userExplanation?: string
  ): Promise<SkipRecord> {

    // Create the skip record
    const skipRecord = await prisma.skipRecord.create({
      data: {
        userId,
        roadmapId,
        stepId,
        reason,
        userExplanation,
        consequenceType: decision.consequence,
        consequenceApplied: !!decision.consequence,
        requiresRemediation: decision.requiresRemediation || false,
        consequenceData: decision.debtMinutes ? { debtMinutes: decision.debtMinutes } : undefined,
      }
    })

    // Apply consequences
    if (decision.consequence === 'DEBT_ADDED' && decision.debtMinutes) {
      await this.addStudyDebt(userId, {
        source: 'INCOMPLETE_GOAL',
        title: `Skipped: Step in learning roadmap`,
        debtMinutes: decision.debtMinutes,
        subject: undefined,
      })
    }

    // Update step status to SKIPPED
    await prisma.roadmapStep.update({
      where: { id: stepId },
      data: { status: 'SKIPPED' }
    })

    // Log enforcement action
    await this.logEnforcementAction(userId, {
      triggerType: 'skip',
      triggerId: skipRecord.id,
      actionType: decision.consequence || 'DEBT_ADDED',
      authorityMessage: decision.message,
    })

    // Update learner identity
    await this.updateIdentityOnSkip(userId)

    logger.info('Skip recorded', { userId, stepId, reason, consequence: decision.consequence })

    return skipRecord
  }

  // ============================================
  // COMPLETION VALIDATION
  // ============================================

  /**
   * Validate if a step completion meets requirements
   * This adds friction to prevent fake progress
   */
  static async validateCompletion(
    userId: string,
    stepId: string,
    minutesSpent: number,
    proof?: { type: string; content: string; score?: number }
  ): Promise<CompletionValidation> {

    const warnings: string[] = []

    // Get the step
    const step = await prisma.roadmapStep.findUnique({
      where: { id: stepId },
    })

    if (!step) {
      return {
        valid: false,
        reason: 'Step not found',
        minimumTimeMet: false,
        proofValidated: false,
        warnings: [],
      }
    }

    // Check minimum time requirement
    const minimumTimeMet = minutesSpent >= ENFORCEMENT_CONFIG.minimumStepTimeMinutes

    if (!minimumTimeMet) {
      warnings.push(`You spent ${minutesSpent} minutes. Minimum is ${ENFORCEMENT_CONFIG.minimumStepTimeMinutes}. Are you rushing?`)
    }

    // Validate proof if provided
    let proofValidated = true
    if (proof) {
      if (proof.type === 'explanation' && proof.content.length < ENFORCEMENT_CONFIG.minExplanationLength) {
        proofValidated = false
        warnings.push('Explanation too brief. Real understanding requires depth.')
      }

      if (proof.type === 'quiz' && (proof.score || 0) < ENFORCEMENT_CONFIG.minQuizScore) {
        proofValidated = false
        warnings.push(`Score of ${proof.score}% is below the ${ENFORCEMENT_CONFIG.minQuizScore}% requirement.`)
      }
    }

    // Determine overall validity
    // Allow completion with warnings, but track pattern
    const valid = minimumTimeMet || proofValidated

    return {
      valid,
      reason: valid ? undefined : 'Completion requirements not met',
      minimumTimeMet,
      proofValidated,
      warnings,
    }
  }

  /**
   * Record a mission attempt
   */
  static async recordAttempt(
    userId: string,
    stepId: string,
    result: AttemptResult,
    data: {
      minutesSpent: number
      minimumTimeMet: boolean
      proofType?: string
      proofData?: Record<string, unknown>
      proofValidated?: boolean
      difficultyRating?: number
      confidenceLevel?: number
      failureReason?: string
    }
  ): Promise<MissionAttempt> {

    // Get current attempt count
    const attemptCount = await prisma.missionAttempt.count({
      where: { userId, stepId }
    })

    // Create the attempt record
    const attempt = await prisma.missionAttempt.create({
      data: {
        userId,
        stepId,
        attemptNumber: attemptCount + 1,
        result,
        minutesSpent: data.minutesSpent,
        minimumTimeMet: data.minimumTimeMet,
        proofType: data.proofType,
        proofData: data.proofData as object | undefined,
        proofValidated: data.proofValidated || false,
        difficultyRating: data.difficultyRating,
        confidenceLevel: data.confidenceLevel,
        failureReason: data.failureReason,
        completedAt: result === 'SUCCESS' ? new Date() : undefined,
        needsRemediation: result === 'FAILED' && attemptCount >= ENFORCEMENT_CONFIG.failuresBeforeRemediation,
      }
    })

    // Handle failure consequences
    if (result === 'FAILED') {
      await this.handleFailure(userId, stepId, attemptCount + 1)
    }

    // Handle success - update identity
    if (result === 'SUCCESS') {
      await this.updateIdentityOnSuccess(userId)
    }

    return attempt
  }

  // ============================================
  // FAILURE HANDLING
  // ============================================

  /**
   * Handle a mission failure and determine consequences
   */
  private static async handleFailure(
    userId: string,
    stepId: string,
    attemptNumber: number
  ): Promise<void> {

    const step = await prisma.roadmapStep.findUnique({
      where: { id: stepId },
      include: { roadmap: true }
    })

    if (!step) return

    // Record or update weak spot
    const subject = step.roadmap.subject || 'General'
    const topic = step.title

    await prisma.weakSpot.upsert({
      where: {
        userId_subject_topic: { userId, subject, topic }
      },
      create: {
        userId,
        subject,
        topic,
        failedAttempts: 1,
        sourceStepId: stepId,
        sourceRoadmapId: step.roadmapId,
        severity: 1,
      },
      update: {
        failedAttempts: { increment: 1 },
        lastFailedAt: new Date(),
        severity: Math.min(5, attemptNumber), // Increase severity with failures
        status: 'ACTIVE',
      }
    })

    // Apply consequences based on failure count
    if (attemptNumber >= ENFORCEMENT_CONFIG.failuresBeforeRemediation) {
      await this.addStudyDebt(userId, {
        source: 'INCOMPLETE_GOAL',
        title: `Failed: ${topic}`,
        debtMinutes: ENFORCEMENT_CONFIG.failureDebtMinutes,
        subject,
      })

      // Log enforcement action
      await this.logEnforcementAction(userId, {
        triggerType: 'failure',
        triggerId: stepId,
        actionType: 'REMEDIATION',
        authorityMessage: `${attemptNumber} failed attempts on "${topic}". Remediation required.`,
      })
    }

    if (attemptNumber >= ENFORCEMENT_CONFIG.failuresBeforeSlowdown) {
      await this.logEnforcementAction(userId, {
        triggerType: 'repeated_failure',
        triggerId: stepId,
        actionType: 'SLOWDOWN',
        authorityMessage: 'Your pace is being adjusted. Depth over speed.',
      })
    }
  }

  // ============================================
  // STUDY DEBT MANAGEMENT
  // ============================================

  /**
   * Add study debt to user's account
   */
  static async addStudyDebt(
    userId: string,
    data: {
      source: 'MISSED_SESSION' | 'BROKEN_STREAK' | 'INCOMPLETE_GOAL' | 'SELF_ADDED'
      title: string
      debtMinutes: number
      subject?: string
      description?: string
    }
  ): Promise<void> {

    await prisma.studyDebt.create({
      data: {
        userId,
        source: data.source,
        status: 'QUEUED',
        title: data.title,
        description: data.description,
        debtMinutes: data.debtMinutes,
        paidMinutes: 0,
        progressPercent: 0,
        subject: data.subject,
        priority: data.source === 'BROKEN_STREAK' ? 0 : 1, // Streak debts are highest priority
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
      }
    })

    logger.info('Study debt added', { userId, title: data.title, minutes: data.debtMinutes })
  }

  /**
   * Get user's total study debt
   */
  static async getStudyDebt(userId: string): Promise<{ total: number; items: number }> {
    const debts = await prisma.studyDebt.findMany({
      where: {
        userId,
        status: { in: ['QUEUED', 'IN_PROGRESS'] }
      }
    })

    const total = debts.reduce((sum, d) => sum + (d.debtMinutes - d.paidMinutes), 0)
    return { total, items: debts.length }
  }

  /**
   * Pay down study debt (called when user studies)
   * OPTIMIZED: Uses transaction for batch updates
   */
  static async payStudyDebt(userId: string, minutesStudied: number): Promise<number> {
    // Get oldest unpaid debts first
    const debts = await prisma.studyDebt.findMany({
      where: {
        userId,
        status: { in: ['QUEUED', 'IN_PROGRESS'] }
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    if (debts.length === 0) return 0

    let remainingMinutes = minutesStudied
    let debtsPaid = 0
    const updates: Array<ReturnType<typeof prisma.studyDebt.update>> = []

    for (const debt of debts) {
      if (remainingMinutes <= 0) break

      const owedMinutes = debt.debtMinutes - debt.paidMinutes
      const paymentMinutes = Math.min(remainingMinutes, owedMinutes)

      const newPaidMinutes = debt.paidMinutes + paymentMinutes
      const isComplete = newPaidMinutes >= debt.debtMinutes

      // Collect updates instead of executing immediately
      updates.push(
        prisma.studyDebt.update({
          where: { id: debt.id },
          data: {
            paidMinutes: newPaidMinutes,
            progressPercent: (newPaidMinutes / debt.debtMinutes) * 100,
            status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
            startedAt: debt.startedAt || new Date(),
            completedAt: isComplete ? new Date() : undefined,
          }
        })
      )

      if (isComplete) debtsPaid++
      remainingMinutes -= paymentMinutes
    }

    // Execute all updates in a single transaction
    if (updates.length > 0) {
      await prisma.$transaction(updates)
    }

    return debtsPaid
  }

  // ============================================
  // IDENTITY MANAGEMENT
  // ============================================

  /**
   * Get or create learner identity
   */
  static async getIdentity(userId: string): Promise<LearnerIdentity> {
    let identity = await prisma.learnerIdentity.findUnique({
      where: { userId }
    })

    if (!identity) {
      identity = await prisma.learnerIdentity.create({
        data: { userId }
      })
    }

    return identity
  }

  /**
   * Update identity after success
   */
  private static async updateIdentityOnSuccess(userId: string): Promise<void> {
    const identity = await this.getIdentity(userId)

    const newCompleted = identity.totalMissionsCompleted + 1
    const newStreak = identity.currentStreak + 1

    await prisma.learnerIdentity.update({
      where: { userId },
      data: {
        totalMissionsCompleted: newCompleted,
        currentStreak: newStreak,
        longestStreak: Math.max(identity.longestStreak, newStreak),
        lastMissionAt: new Date(),
        daysSinceLastMission: 0,
        // Unlock archetype after 10 missions
        archetype: !identity.archetype && newCompleted >= 10
          ? this.determineArchetype(identity)
          : identity.archetype,
        archetypeUnlockedAt: !identity.archetype && newCompleted >= 10
          ? new Date()
          : identity.archetypeUnlockedAt,
      }
    })
  }

  /**
   * Update identity after skip
   */
  private static async updateIdentityOnSkip(userId: string): Promise<void> {
    const identity = await this.getIdentity(userId)

    await prisma.learnerIdentity.update({
      where: { userId },
      data: {
        totalMissionsSkipped: identity.totalMissionsSkipped + 1,
      }
    })
  }

  /**
   * Determine user's archetype based on behavior
   */
  private static determineArchetype(identity: LearnerIdentity): string {
    const completionRate = identity.totalMissionsCompleted /
      (identity.totalMissionsCompleted + identity.totalMissionsFailed + identity.totalMissionsSkipped || 1)

    if (completionRate >= 0.9 && identity.longestStreak >= 7) {
      return 'The Methodical Master'
    } else if (completionRate >= 0.8) {
      return 'The Steady Climber'
    } else if (identity.totalMissionsFailed > identity.totalMissionsSkipped) {
      return 'The Resilient Learner'
    } else {
      return 'The Curious Explorer'
    }
  }

  // ============================================
  // ENFORCEMENT ACTIONS
  // ============================================

  /**
   * Log an enforcement action
   */
  private static async logEnforcementAction(
    userId: string,
    data: {
      triggerType: string
      triggerId?: string
      actionType: ConsequenceType
      authorityMessage?: string
      actionData?: Record<string, unknown>
    }
  ): Promise<EnforcementAction> {
    return prisma.enforcementAction.create({
      data: {
        userId,
        triggerType: data.triggerType,
        triggerId: data.triggerId,
        actionType: data.actionType,
        actionData: data.actionData as object | undefined,
        authorityMessage: data.authorityMessage,
      }
    })
  }

  /**
   * Get pending enforcement actions for user
   */
  static async getPendingActions(userId: string): Promise<EnforcementAction[]> {
    return prisma.enforcementAction.findMany({
      where: {
        userId,
        resolved: false,
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * Acknowledge an enforcement action (user saw it)
   */
  static async acknowledgeAction(actionId: string): Promise<void> {
    await prisma.enforcementAction.update({
      where: { id: actionId },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
      }
    })
  }

  /**
   * Resolve an enforcement action (user completed consequence)
   */
  static async resolveAction(actionId: string): Promise<void> {
    await prisma.enforcementAction.update({
      where: { id: actionId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
      }
    })
  }

  // ============================================
  // INACTIVITY DETECTION
  // ============================================

  /**
   * Check for inactivity and apply consequences
   * Should be called on user login/activity
   */
  static async checkInactivity(userId: string): Promise<AuthorityResponse | null> {
    const identity = await this.getIdentity(userId)

    if (!identity.lastMissionAt) {
      // New user, no inactivity check needed
      return null
    }

    const daysSince = Math.floor(
      (Date.now() - identity.lastMissionAt.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Update days since last mission
    await prisma.learnerIdentity.update({
      where: { userId },
      data: { daysSinceLastMission: daysSince }
    })

    // Warning threshold
    if (daysSince >= ENFORCEMENT_CONFIG.inactivityWarningDays && daysSince < ENFORCEMENT_CONFIG.inactivityConsequenceDays) {
      return {
        message: `${daysSince} days away. Your streak is at risk. One session today saves it.`,
        tone: 'warning',
      }
    }

    // Consequence threshold
    if (daysSince >= ENFORCEMENT_CONFIG.inactivityConsequenceDays) {
      // Reset streak
      if (identity.currentStreak > 0) {
        await prisma.learnerIdentity.update({
          where: { userId },
          data: { currentStreak: 0 }
        })

        // Add streak debt
        await this.addStudyDebt(userId, {
          source: 'BROKEN_STREAK',
          title: `Streak broken: ${identity.currentStreak} days lost`,
          debtMinutes: Math.min(identity.currentStreak * 5, 60), // 5 min per day, max 60
        })

        await this.logEnforcementAction(userId, {
          triggerType: 'inactivity',
          actionType: 'STREAK_RESET',
          authorityMessage: `Your ${identity.currentStreak}-day streak is gone. Rebuilding starts now.`,
        })

        return {
          message: `Your ${identity.currentStreak}-day streak is gone. Rebuilding starts now.`,
          tone: 'consequence',
          actionRequired: 'Complete one mission to start a new streak.',
        }
      }

      return {
        message: `${daysSince} days away. Let's get back on track.`,
        tone: 'neutral',
      }
    }

    return null
  }

  // ============================================
  // STATE RETRIEVAL
  // ============================================

  /**
   * Get complete enforcement state for a user
   */
  static async getUserState(userId: string): Promise<UserEnforcementState> {
    const [identity, pendingActions, debtInfo, skipCount, failureCount] = await Promise.all([
      this.getIdentity(userId),
      this.getPendingActions(userId),
      this.getStudyDebt(userId),
      prisma.skipRecord.count({
        where: {
          userId,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        }
      }),
      prisma.missionAttempt.count({
        where: {
          userId,
          result: 'FAILED',
          startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      })
    ])

    return {
      identity,
      pendingActions,
      activeDebts: debtInfo.total,
      skipCount,
      failureCount,
      streakAtRisk: identity.daysSinceLastMission >= ENFORCEMENT_CONFIG.inactivityWarningDays,
    }
  }

  // ============================================
  // AUTHORITY MESSAGES
  // ============================================

  /**
   * Generate authority message based on context
   */
  static getAuthorityMessage(
    context: 'skip' | 'failure' | 'success' | 'return' | 'debt' | 'streak',
    data?: Record<string, unknown>
  ): AuthorityResponse {

    switch (context) {
      case 'skip':
        const skipCount = (data?.skipCount as number) || 1
        if (skipCount === 1) {
          return { message: 'First skip noted. This topic will return.', tone: 'warning' }
        } else if (skipCount === 2) {
          return { message: 'Pattern forming. Skipping adds to your debt.', tone: 'consequence' }
        } else {
          return { message: 'Avoidance detected. Remediation required.', tone: 'consequence', actionRequired: 'Complete remediation mission' }
        }

      case 'failure':
        const failCount = (data?.failCount as number) || 1
        if (failCount === 1) {
          return { message: 'Not there yet. One stumble doesn\'t define you.', tone: 'encouragement' }
        } else if (failCount === 2) {
          return { message: `Attempt ${failCount}. The approach changes now.`, tone: 'warning' }
        } else {
          return { message: `${failCount} attempts. This requires a different strategy.`, tone: 'consequence', actionRequired: 'Remediation mission assigned' }
        }

      case 'success':
        const streak = (data?.streak as number) || 1
        if (streak >= 7) {
          return { message: `${streak} days strong. Mastery in progress.`, tone: 'encouragement' }
        } else if (streak >= 3) {
          return { message: 'Momentum building. Keep it going.', tone: 'encouragement' }
        } else {
          return { message: 'Complete. Next step unlocked.', tone: 'neutral' }
        }

      case 'return':
        const days = (data?.daysSince as number) || 0
        if (days >= 7) {
          return { message: `${days} days away. Your streak reset. Start rebuilding.`, tone: 'consequence' }
        } else if (days >= 3) {
          return { message: `${days} days away. Your streak is at risk. Let's fix that today.`, tone: 'warning' }
        } else {
          return { message: 'Welcome back. Let\'s continue where you left off.', tone: 'neutral' }
        }

      case 'debt':
        const debtMinutes = (data?.debtMinutes as number) || 0
        if (debtMinutes > 60) {
          return { message: `${debtMinutes} minutes owed. Time to pay down your debt.`, tone: 'consequence', actionRequired: 'Complete study sessions to reduce debt' }
        } else if (debtMinutes > 0) {
          return { message: `${debtMinutes} minutes of study debt. Each session pays it down.`, tone: 'warning' }
        } else {
          return { message: 'No study debt. Clean slate.', tone: 'encouragement' }
        }

      case 'streak':
        const currentStreak = (data?.streak as number) || 0
        if (currentStreak >= 30) {
          return { message: `${currentStreak} days. Legendary consistency.`, tone: 'encouragement' }
        } else if (currentStreak >= 7) {
          return { message: `${currentStreak} day streak. Keep building.`, tone: 'encouragement' }
        } else if (currentStreak > 0) {
          return { message: `${currentStreak} days. Growing.`, tone: 'neutral' }
        } else {
          return { message: 'No active streak. Start one today.', tone: 'neutral' }
        }

      default:
        return { message: '', tone: 'neutral' }
    }
  }
}

export default EnforcementEngine
