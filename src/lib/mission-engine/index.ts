/**
 * CLERVA MISSION ENGINE
 *
 * The brain of Clerva. This engine DECIDES what the user does next.
 *
 * Philosophy:
 * - Opinionated, not democratic
 * - Leads, not follows
 * - Enforces progress, not vibes
 * - Remembers failures, celebrates growth
 *
 * ChatGPT mindset: "Respond to whatever user asks"
 * Clerva mindset: "Decide what user needs next"
 */

// ============================================
// TYPES
// ============================================

export type MissionType =
  | 'learn'           // New concept to learn
  | 'practice'        // Apply what was learned
  | 'review'          // Revisit weak spots
  | 'remediate'       // Fix a failure
  | 'test'            // Prove understanding
  | 'reflect'         // Consolidate learning

export type ProofType =
  | 'explanation'     // Explain in own words
  | 'quiz'            // Answer questions correctly
  | 'submission'      // Submit work product
  | 'practice_set'    // Complete practice problems
  | 'self_report'     // Honest self-assessment

export type MissionStatus =
  | 'active'          // Currently working on
  | 'completed'       // Successfully finished
  | 'failed'          // Did not meet criteria
  | 'skipped'         // Intentionally bypassed (rare)

export interface Mission {
  id: string
  type: MissionType
  title: string
  directive: string           // Clear command, not question
  context?: string            // Why this mission matters
  estimatedMinutes: number
  proofRequired: ProofType
  criteria: {
    type: 'score' | 'completion' | 'quality'
    threshold?: number        // e.g., 80% for quiz
    description: string       // Human-readable success criterion
  }
  linkedStep?: {
    roadmapId: string
    stepId: string
    stepOrder: number
  }
  metadata?: {
    isRemediation: boolean
    failedAttempts: number
    relatedWeakSpot?: string
  }
}

export interface MissionResult {
  missionId: string
  status: MissionStatus
  proof?: {
    type: ProofType
    content: string
    score?: number
  }
  completedAt?: Date
  minutesSpent?: number
  feedback?: string
}

export interface UserProgress {
  userId: string
  // Weak spots
  weakSpots: {
    topic: string
    failCount: number
    lastAttempt: Date
    resolved: boolean
  }[]
  // Learning patterns
  patterns: {
    averageSessionMinutes: number
    preferredTime: 'morning' | 'afternoon' | 'evening' | 'night'
    streakDays: number
    longestStreak: number
  }
  // Identity markers (for lock-in)
  identity: {
    strengths: string[]          // "Strong at problem decomposition"
    growthAreas: string[]        // "Improving at time management"
    archetype?: string           // "Systems Thinker", "Detail Master"
  }
  // Recent activity
  recentMissions: MissionResult[]
  lastActiveAt: Date
}

export interface MissionDecision {
  mission: Mission
  reasoning: string              // Internal: why this mission was chosen
  alternativesConsidered: string[] // Internal: what else was considered
}

// ============================================
// MISSION ENGINE
// ============================================

/**
 * The Mission Engine decides what the user should do next.
 * It is opinionated and authoritative.
 */
export class MissionEngine {

  /**
   * CORE FUNCTION: Decide the next mission for a user
   *
   * Priority order:
   * 1. Unresolved failure → Remediation mission
   * 2. Active roadmap step → Continue mission
   * 3. Weak spot detected → Review mission
   * 4. Time gap (>3 days) → Refresh mission
   * 5. Normal progress → Next step mission
   */
  static decideNextMission(
    progress: UserProgress,
    activeRoadmap: {
      id: string
      currentStep: {
        id: string
        order: number
        title: string
        description: string
        method?: string
        avoid?: string
        doneWhen?: string
        duration: number
      } | null
      totalSteps: number
      completedSteps: number
    } | null
  ): MissionDecision {

    const alternatives: string[] = []

    // Priority 1: Check for unresolved failures
    const unresolvedFailure = this.findUnresolvedFailure(progress)
    if (unresolvedFailure) {
      alternatives.push('Normal progress', 'Review', 'New learning')
      return {
        mission: this.createRemediationMission(unresolvedFailure),
        reasoning: `User failed "${unresolvedFailure.topic}" ${unresolvedFailure.failCount} time(s). Must resolve before proceeding.`,
        alternativesConsidered: alternatives,
      }
    }

    // Priority 2: Active roadmap step
    if (activeRoadmap && activeRoadmap.currentStep) {
      const currentStep = activeRoadmap.currentStep
      alternatives.push('Review weak spots', 'Start new topic')
      return {
        mission: this.createStepMission({
          id: activeRoadmap.id,
          currentStep,
          totalSteps: activeRoadmap.totalSteps,
          completedSteps: activeRoadmap.completedSteps,
        }),
        reasoning: `User has active roadmap at step ${currentStep.order}/${activeRoadmap.totalSteps}`,
        alternativesConsidered: alternatives,
      }
    }

    // Priority 3: Weak spots that need review
    const weakSpotToReview = this.findWeakSpotToReview(progress)
    if (weakSpotToReview) {
      alternatives.push('Start new topic', 'Free exploration')
      return {
        mission: this.createReviewMission(weakSpotToReview),
        reasoning: `User has weak spot in "${weakSpotToReview.topic}" that needs reinforcement`,
        alternativesConsidered: alternatives,
      }
    }

    // Priority 4: Time gap recovery
    const daysSinceActive = this.getDaysSinceActive(progress)
    if (daysSinceActive >= 3) {
      alternatives.push('Start fresh', 'New topic')
      return {
        mission: this.createRefreshMission(progress, daysSinceActive),
        reasoning: `User has been away for ${daysSinceActive} days. Need to refresh.`,
        alternativesConsidered: alternatives,
      }
    }

    // Priority 5: No active mission - guide to create one
    return {
      mission: this.createStartMission(progress),
      reasoning: 'No active learning path. Guide user to create one.',
      alternativesConsidered: ['Wait for user input'],
    }
  }

  // ============================================
  // MISSION CREATORS
  // ============================================

  private static createRemediationMission(failure: { topic: string; failCount: number }): Mission {
    return {
      id: `remediate-${Date.now()}`,
      type: 'remediate',
      title: `Master: ${failure.topic}`,
      directive: `You struggled with ${failure.topic}. Today, we fix that. No shortcuts.`,
      context: failure.failCount > 1
        ? `This has caused difficulty ${failure.failCount} times. Try a different approach.`
        : `Initial difficulty is normal. Try a different strategy.`,
      estimatedMinutes: 15,
      proofRequired: 'explanation',
      criteria: {
        type: 'quality',
        description: 'Explain the concept in your own words without looking at notes',
      },
      metadata: {
        isRemediation: true,
        failedAttempts: failure.failCount,
        relatedWeakSpot: failure.topic,
      },
    }
  }

  private static createStepMission(roadmap: {
    id: string
    currentStep: {
      id: string
      order: number
      title: string
      description: string
      method?: string
      avoid?: string
      doneWhen?: string
      duration: number
    }
    totalSteps: number
    completedSteps: number
  }): Mission {
    const step = roadmap.currentStep

    return {
      id: `step-${step.id}`,
      type: 'learn',
      title: step.title,
      directive: step.description,
      context: step.method ? `Method: ${step.method}` : undefined,
      estimatedMinutes: step.duration || 10,
      proofRequired: 'self_report',
      criteria: {
        type: 'completion',
        description: step.doneWhen || 'Complete the step and confirm understanding',
      },
      linkedStep: {
        roadmapId: roadmap.id,
        stepId: step.id,
        stepOrder: step.order,
      },
    }
  }

  private static createReviewMission(weakSpot: { topic: string; failCount: number }): Mission {
    return {
      id: `review-${Date.now()}`,
      type: 'review',
      title: `Strengthen: ${weakSpot.topic}`,
      directive: `Time to solidify your understanding of ${weakSpot.topic}.`,
      context: 'Review missions reinforce weak areas before they become problems.',
      estimatedMinutes: 10,
      proofRequired: 'quiz',
      criteria: {
        type: 'score',
        threshold: 80,
        description: 'Score at least 80% on review questions',
      },
      metadata: {
        isRemediation: false,
        failedAttempts: weakSpot.failCount,
        relatedWeakSpot: weakSpot.topic,
      },
    }
  }

  private static createRefreshMission(_progress: UserProgress, daysSinceActive: number): Mission {
    return {
      id: `refresh-${Date.now()}`,
      type: 'review',
      title: 'Welcome Back',
      directive: `${daysSinceActive} days away. Let's see what you remember.`,
      context: 'A quick refresh to rebuild momentum. No judgment.',
      estimatedMinutes: 5,
      proofRequired: 'self_report',
      criteria: {
        type: 'completion',
        description: 'Complete a quick review of recent material',
      },
    }
  }

  private static createStartMission(progress: UserProgress): Mission {
    // Check if user has any history
    const hasHistory = progress.recentMissions.length > 0

    if (hasHistory && progress.identity.strengths.length > 0) {
      // Returning user with identity
      return {
        id: `start-${Date.now()}`,
        type: 'learn',
        title: 'Ready for Your Next Challenge',
        directive: 'What would you like to master next? Pick something that excites you.',
        context: `You've already shown strength in ${progress.identity.strengths[0]}. Let's build on that momentum.`,
        estimatedMinutes: 5,
        proofRequired: 'submission',
        criteria: {
          type: 'completion',
          description: 'Share your next learning goal',
        },
      }
    }

    // New user - warm, welcoming, exciting first experience
    return {
      id: `start-${Date.now()}`,
      type: 'learn',
      title: 'Welcome to Clerva',
      directive: 'What do you want to learn? It can be anything - a skill, a subject, or a goal you\'ve been putting off.',
      context: 'I\'ll create a personalized roadmap just for you. Small steps, real progress, no overwhelm.',
      estimatedMinutes: 5,
      proofRequired: 'submission',
      criteria: {
        type: 'completion',
        description: 'Tell me what you want to learn',
      },
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private static findUnresolvedFailure(progress: UserProgress): { topic: string; failCount: number } | null {
    // Find weak spots with recent failures that aren't resolved
    const unresolved = progress.weakSpots
      .filter(ws => !ws.resolved && ws.failCount > 0)
      .sort((a, b) => b.failCount - a.failCount)[0]

    return unresolved || null
  }

  private static findWeakSpotToReview(progress: UserProgress): { topic: string; failCount: number } | null {
    // Find weak spots that are resolved but might need reinforcement
    // (last attempt was more than 7 days ago)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const needsReview = progress.weakSpots
      .filter(ws => ws.resolved && new Date(ws.lastAttempt) < sevenDaysAgo)
      .sort((a, b) => new Date(a.lastAttempt).getTime() - new Date(b.lastAttempt).getTime())[0]

    return needsReview || null
  }

  private static getDaysSinceActive(progress: UserProgress): number {
    const now = new Date()
    const lastActive = new Date(progress.lastActiveAt)
    const diffMs = now.getTime() - lastActive.getTime()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }

  // ============================================
  // PROOF EVALUATION
  // ============================================

  /**
   * Evaluate proof submitted for a mission
   * Returns whether the mission was passed or failed
   */
  static evaluateProof(
    mission: Mission,
    proof: { type: ProofType; content: string; score?: number }
  ): { passed: boolean; feedback: string } {

    switch (mission.criteria.type) {
      case 'score':
        const threshold = mission.criteria.threshold || 70
        const passed = (proof.score || 0) >= threshold
        return {
          passed,
          feedback: passed
            ? `Solid work. ${proof.score}% shows understanding.`
            : `${proof.score}% isn't enough. You need ${threshold}%. Let's review what tripped you up.`,
        }

      case 'completion':
        // For completion-based, check if user self-reported as completed or struggled
        const userCompleted = proof.content !== 'struggled'
        return {
          passed: userCompleted,
          feedback: userCompleted
            ? 'Marked complete. Your consistency builds momentum.'
            : 'Noted. Let\'s work through this. The step remains active until you\'re ready.',
        }

      case 'quality':
        // Quality assessment would need AI evaluation
        // For now, trust but verify pattern
        return {
          passed: proof.content.length > 50, // Basic check
          feedback: proof.content.length > 50
            ? 'Good explanation. Understanding is evident.'
            : 'Too brief. Real understanding requires more depth. Try again.',
        }

      default:
        return { passed: true, feedback: 'Completed.' }
    }
  }

  // ============================================
  // IDENTITY FORMATION
  // ============================================

  /**
   * Update user identity based on their learning patterns
   * This creates the "lock-in" effect
   */
  static updateIdentity(
    currentIdentity: UserProgress['identity'],
    recentResults: MissionResult[]
  ): UserProgress['identity'] {
    const updated = { ...currentIdentity }

    // Analyze recent patterns
    const completedCount = recentResults.filter(r => r.status === 'completed').length
    const totalCount = recentResults.length
    const completionRate = totalCount > 0 ? completedCount / totalCount : 0

    // Update strengths based on success patterns
    if (completionRate >= 0.8 && totalCount >= 5) {
      if (!updated.strengths.includes('Consistent learner')) {
        updated.strengths.push('Consistent learner')
      }
    }

    // Determine archetype based on behavior
    if (!updated.archetype && totalCount >= 10) {
      if (completionRate >= 0.9) {
        updated.archetype = 'The Methodical Master'
      } else if (completionRate >= 0.7) {
        updated.archetype = 'The Steady Climber'
      } else {
        updated.archetype = 'The Resilient Learner'
      }
    }

    return updated
  }

  // ============================================
  // AUTHORITY MESSAGES
  // ============================================

  /**
   * Generate authoritative feedback messages
   * These are direct, not hedging
   */
  static getAuthorityMessage(
    context: 'success' | 'failure' | 'progress' | 'return',
    data?: { topic?: string; streak?: number; failCount?: number }
  ): string {
    switch (context) {
      case 'success':
        return data?.streak && data.streak > 3
          ? `${data.streak} days consistent. That's how mastery is built.`
          : 'Complete. Next step unlocked.'

      case 'failure':
        return data?.failCount && data.failCount > 1
          ? `This is your ${data.failCount}${getOrdinalSuffix(data.failCount)} attempt. The approach changes now.`
          : 'Not there yet. Here\'s what to focus on.'

      case 'progress':
        return 'Progress is measured by depth, not speed. You\'re on track.'

      case 'return':
        return data?.topic
          ? `Welcome back. You were working on ${data.topic}. Let's continue.`
          : 'Welcome back. Let\'s pick up where you left off.'

      default:
        return ''
    }
  }
}

// Helper function
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

export default MissionEngine
