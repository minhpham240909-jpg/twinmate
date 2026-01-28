/**
 * QUALITY EVALUATOR
 *
 * Layer 4 of the Clerva content quality system.
 * Programmatic quality checks that reject bad content.
 *
 * This is the gatekeeper. If content fails here, it gets regenerated.
 */

import { ClervaDoctrine, StepRequirements, AuthorityRequirements } from '../standards/clerva-doctrine'
import {
  QualityFailure,
  EvaluationResult,
  StepQualityCheck,
  StepValidationResult,
  ContentAuthority,
  AuthorityMarker,
  QUALITY_THRESHOLDS,
} from '../standards/types'

// ============================================
// TYPES FOR EVALUATION
// ============================================

interface RoadmapStep {
  order: number
  title: string
  description: string
  duration?: number
  whyFirst?: string
  method?: string
  avoid?: string
  doneWhen?: string
  commonMistakes?: { trap: string; consequence: string }[] | string[]
  selfTest?: { challenge: string; passCriteria: string; failCriteria?: string }
  abilities?: string[]
  resources?: unknown[]
  phase?: string
  risk?: { warning: string; consequence: string; severity?: string }
}

interface GeneratedRoadmap {
  title: string
  overview?: string
  vision?: string
  targetUser?: string
  successMetrics?: string[]
  estimatedDays?: number
  dailyCommitment?: string
  criticalWarning?: { warning: string; consequence: string }
  steps: RoadmapStep[]
}

// ============================================
// QUALITY EVALUATOR CLASS
// ============================================

export class QualityEvaluator {
  private doctrine = ClervaDoctrine

  /**
   * Main evaluation entry point
   */
  evaluate(roadmap: GeneratedRoadmap): EvaluationResult {
    const failures: QualityFailure[] = []
    const suggestions: string[] = []

    // 1. Evaluate roadmap-level fields
    this.evaluateRoadmapLevel(roadmap, failures, suggestions)

    // 2. Evaluate each step
    for (const step of roadmap.steps) {
      this.evaluateStep(step, failures, suggestions)
    }

    // 3. Check for forbidden patterns
    this.checkForbiddenPatterns(roadmap, failures)

    // 4. Check for authority markers
    const authority = this.checkAuthority(roadmap)
    if (!authority.hasAuthority) {
      failures.push({
        rule: 'identityShift',
        value: null,
        fix: 'Add authority markers: strong opinions, warnings, or corrections',
        severity: 'major',
      })
      suggestions.push(...authority.missing)
    }

    // Calculate score
    const score = this.calculateScore(failures, roadmap)

    return {
      passed: score >= QUALITY_THRESHOLDS.PASS,
      score,
      failures,
      suggestions,
    }
  }

  /**
   * Evaluate individual step
   */
  evaluateStepOnly(step: RoadmapStep): StepValidationResult {
    const failures: QualityFailure[] = []
    this.evaluateStep(step, failures, [])

    const checks: StepQualityCheck = {
      hasWhyFirst: !!step.whyFirst && step.whyFirst.length > 20,
      hasMistakesWithConsequences: this.hasMistakesWithConsequences(step),
      hasSelfTest: this.hasValidSelfTest(step),
      hasAbilities: (step.abilities?.length || 0) >= 1,
      hasIdentityShift: false, // Checked at roadmap level
      hasPassCondition: !!step.selfTest?.passCriteria,
      hasFailCondition: !!step.selfTest?.failCriteria || !!step.doneWhen,
    }

    return {
      stepOrder: step.order,
      isValid: failures.length === 0,
      checks,
      failures,
    }
  }

  // ============================================
  // PRIVATE EVALUATION METHODS
  // ============================================

  private evaluateRoadmapLevel(
    roadmap: GeneratedRoadmap,
    failures: QualityFailure[],
    suggestions: string[]
  ): void {
    // Check title for vague verbs
    if (this.containsVagueVerbs(roadmap.title)) {
      failures.push({
        rule: 'noVagueVerbs',
        location: 'roadmap.title',
        value: roadmap.title,
        fix: 'Replace vague verbs (understand, learn, know) with action verbs',
        severity: 'major',
      })
    }

    // Check for vision
    if (!roadmap.vision) {
      suggestions.push('Add a vision statement explaining why this journey matters')
    }

    // Check for critical warning
    if (!roadmap.criticalWarning) {
      suggestions.push('Add a critical warning about what causes failure')
    } else if (!roadmap.criticalWarning.consequence) {
      failures.push({
        rule: 'consequenceRequired',
        location: 'roadmap.criticalWarning',
        value: roadmap.criticalWarning,
        fix: 'Add specific consequence for the critical warning',
        severity: 'major',
      })
    }

    // Check for success metrics
    if (!roadmap.successMetrics || roadmap.successMetrics.length === 0) {
      suggestions.push('Add success metrics to define what success looks like')
    }
  }

  private evaluateStep(
    step: RoadmapStep,
    failures: QualityFailure[],
    suggestions: string[]
  ): void {
    const stepLocation = `step.${step.order}`

    // Rule: No vague verbs in title
    if (this.containsVagueVerbs(step.title)) {
      failures.push({
        rule: 'noVagueVerbs',
        location: `${stepLocation}.title`,
        value: step.title,
        fix: `Replace vague verb in "${step.title}" with specific action verb`,
        severity: 'major',
      })
    }

    // Rule: Required fields
    for (const field of this.doctrine.qualityRules.requiredFields) {
      const value = step[field as keyof RoadmapStep]
      if (!value || (Array.isArray(value) && value.length === 0)) {
        failures.push({
          rule: 'requiredFields',
          location: `${stepLocation}.${field}`,
          value: null,
          fix: `Add ${field} with substantive content`,
          severity: 'critical',
        })
      }
    }

    // Rule: WhyFirst must be substantive
    if (step.whyFirst && step.whyFirst.length < 50) {
      failures.push({
        rule: 'requiredFields',
        location: `${stepLocation}.whyFirst`,
        value: step.whyFirst,
        fix: 'WhyFirst must explain why this step comes NOW. Expand explanation.',
        severity: 'major',
      })
    }

    // Rule: Minimum mistakes
    const mistakesCount = step.commonMistakes?.length || 0
    if (mistakesCount < this.doctrine.qualityRules.minimumMistakes) {
      failures.push({
        rule: 'minimumMistakes',
        location: `${stepLocation}.commonMistakes`,
        value: mistakesCount,
        fix: `Add at least ${this.doctrine.qualityRules.minimumMistakes} specific mistakes with consequences`,
        severity: 'major',
      })
    }

    // Rule: Mistakes must have consequences
    if (step.commonMistakes && !this.hasMistakesWithConsequences(step)) {
      failures.push({
        rule: 'consequenceRequired',
        location: `${stepLocation}.commonMistakes`,
        value: step.commonMistakes,
        fix: 'Each mistake must have a trap AND consequence, not just a string',
        severity: 'major',
      })
    }

    // Rule: Minimum abilities
    const abilitiesCount = step.abilities?.length || 0
    if (abilitiesCount < this.doctrine.qualityRules.minimumAbilities) {
      failures.push({
        rule: 'minimumAbilities',
        location: `${stepLocation}.abilities`,
        value: abilitiesCount,
        fix: `Add at least ${this.doctrine.qualityRules.minimumAbilities} ability unlocked after this step`,
        severity: 'major',
      })
    }

    // Rule: Self-test must have criteria
    if (!this.hasValidSelfTest(step)) {
      failures.push({
        rule: 'passCondition',
        location: `${stepLocation}.selfTest`,
        value: step.selfTest,
        fix: 'SelfTest must have challenge, passCriteria, and ideally failCriteria',
        severity: 'major',
      })
    }

    // Rule: Risk must have consequence
    if (step.risk && !step.risk.consequence) {
      failures.push({
        rule: 'consequenceRequired',
        location: `${stepLocation}.risk`,
        value: step.risk,
        fix: 'Add specific consequence for this risk/warning',
        severity: 'minor',
      })
    }

    // Check for vague verbs in description
    if (this.containsVagueVerbs(step.description)) {
      suggestions.push(`Step ${step.order}: Consider replacing vague verbs in description`)
    }
  }

  private checkForbiddenPatterns(
    roadmap: GeneratedRoadmap,
    failures: QualityFailure[]
  ): void {
    const fullText = JSON.stringify(roadmap).toLowerCase()

    for (const pattern of this.doctrine.forbidden) {
      if (fullText.includes(pattern.toLowerCase())) {
        failures.push({
          rule: 'forbiddenPattern',
          value: pattern,
          fix: `Replace "${pattern}" with specific, actionable alternative`,
          severity: 'major',
        })
      }
    }
  }

  private checkAuthority(roadmap: GeneratedRoadmap): ContentAuthority {
    const markers: AuthorityMarker[] = []
    const missing: string[] = []
    const fullText = JSON.stringify(roadmap)

    // Check for strong opinions
    const opinionPatterns = [
      /\d+%\s+of\s+(beginners?|people|learners?)\s+(fail|struggle|quit)/i,
      /most\s+(beginners?|people|learners?)\s+(fail|make|skip)/i,
      /critical|essential|non-negotiable|mandatory|must/i,
    ]

    for (const pattern of opinionPatterns) {
      if (pattern.test(fullText)) {
        markers.push({ type: 'opinion', content: 'Strong opinion found' })
        break
      }
    }

    // Check for warnings
    const warningPatterns = [
      /if\s+you\s+(skip|ignore|avoid|fail)/i,
      /warning|danger|caution|careful/i,
      /consequence|result\s+in|lead\s+to/i,
    ]

    for (const pattern of warningPatterns) {
      if (pattern.test(fullText)) {
        markers.push({ type: 'warning', content: 'Warning found' })
        break
      }
    }

    // Check for rejections
    const rejectionPatterns = [
      /don't\s+(do|use|try|learn|focus)/i,
      /avoid|ignore|skip|forget\s+about/i,
      /not\s+recommended|waste\s+of\s+time/i,
    ]

    for (const pattern of rejectionPatterns) {
      if (pattern.test(fullText)) {
        markers.push({ type: 'rejection', content: 'Rejection of common advice found' })
        break
      }
    }

    // Check for corrections
    const correctionPatterns = [
      /common\s+(belief|misconception|mistake)\s+is/i,
      /actually|in\s+reality|contrary\s+to/i,
      /wrong\s+(belief|assumption|approach)/i,
    ]

    for (const pattern of correctionPatterns) {
      if (pattern.test(fullText)) {
        markers.push({ type: 'correction', content: 'Correction of popular belief found' })
        break
      }
    }

    // Determine missing markers
    const hasAuthority = markers.length >= 2 // Need at least 2 authority markers

    if (!markers.some(m => m.type === 'opinion')) {
      missing.push('Add a strong opinion (e.g., "90% of beginners fail because...")')
    }
    if (!markers.some(m => m.type === 'warning')) {
      missing.push('Add specific warnings with consequences')
    }
    if (!markers.some(m => m.type === 'rejection')) {
      missing.push('Add rejection of common advice')
    }

    return {
      hasAuthority,
      markers,
      missing,
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private containsVagueVerbs(text: string): boolean {
    if (!text) return false
    const lowerText = text.toLowerCase()
    return this.doctrine.qualityRules.noVagueVerbs.some(verb =>
      // Check for word boundaries to avoid false positives
      new RegExp(`\\b${verb}\\b`, 'i').test(lowerText)
    )
  }

  private hasMistakesWithConsequences(step: RoadmapStep): boolean {
    if (!step.commonMistakes || step.commonMistakes.length === 0) {
      return false
    }

    // Check if mistakes are objects with trap and consequence
    return step.commonMistakes.every(mistake => {
      if (typeof mistake === 'string') {
        return false
      }
      return !!(mistake as { trap: string; consequence: string }).trap &&
             !!(mistake as { trap: string; consequence: string }).consequence
    })
  }

  private hasValidSelfTest(step: RoadmapStep): boolean {
    if (!step.selfTest) return false
    return !!step.selfTest.challenge && !!step.selfTest.passCriteria
  }

  private calculateScore(failures: QualityFailure[], roadmap: GeneratedRoadmap): number {
    // Weight failures by severity
    const severityWeights = {
      critical: 15,
      major: 10,
      minor: 5,
    }

    let penaltyPoints = 0
    for (const failure of failures) {
      penaltyPoints += severityWeights[failure.severity] || 10
    }

    // Base score from step count (more steps = more potential checks)
    const baseScore = 100
    const maxPenalty = roadmap.steps.length * 50 // Max penalty scales with steps

    // Calculate score
    const score = Math.max(0, baseScore - (penaltyPoints / maxPenalty) * 100)

    return Math.round(score)
  }

  // ============================================
  // REGENERATION FEEDBACK
  // ============================================

  /**
   * Generate feedback for AI regeneration
   */
  generateRegenerationFeedback(result: EvaluationResult): string {
    if (result.passed) {
      return 'Content passed quality checks.'
    }

    const criticalFailures = result.failures.filter(f => f.severity === 'critical')
    const majorFailures = result.failures.filter(f => f.severity === 'major')

    let feedback = `Quality score: ${result.score}/100 (need ${QUALITY_THRESHOLDS.PASS}+)\n\n`

    if (criticalFailures.length > 0) {
      feedback += 'CRITICAL ISSUES (must fix):\n'
      for (const f of criticalFailures) {
        feedback += `- ${f.fix}\n`
      }
      feedback += '\n'
    }

    if (majorFailures.length > 0) {
      feedback += 'MAJOR ISSUES:\n'
      for (const f of majorFailures.slice(0, 5)) { // Limit to avoid prompt bloat
        feedback += `- ${f.fix}\n`
      }
    }

    if (result.suggestions.length > 0) {
      feedback += '\nSUGGESTIONS:\n'
      for (const s of result.suggestions.slice(0, 3)) {
        feedback += `- ${s}\n`
      }
    }

    return feedback
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let evaluatorInstance: QualityEvaluator | null = null

export function getQualityEvaluator(): QualityEvaluator {
  if (!evaluatorInstance) {
    evaluatorInstance = new QualityEvaluator()
  }
  return evaluatorInstance
}

export default QualityEvaluator
