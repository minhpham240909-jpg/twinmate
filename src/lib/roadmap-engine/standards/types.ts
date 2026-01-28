/**
 * CLERVA STANDARDS - TYPE DEFINITIONS
 *
 * These types define the structure of the Clerva content quality system.
 * They are used by the doctrine, evaluator, and generator.
 */

// ============================================
// DOCTRINE TYPES
// ============================================

export interface DoctrinePhilosophy {
  failureFirst: string
  identityBased: string
  consequencesDriven: string
  actionable: string
  progressive: string
}

export interface DoctrineQualityRules {
  /** Verbs that indicate vague, non-actionable content */
  noVagueVerbs: string[]
  /** Fields that must be present in every step */
  requiredFields: string[]
  /** Minimum number of common mistakes per step */
  minimumMistakes: number
  /** Minimum number of abilities unlocked per step */
  minimumAbilities: number
  /** Whether consequences are required for warnings */
  consequenceRequired: boolean
}

export interface Doctrine {
  philosophy: DoctrinePhilosophy
  qualityRules: DoctrineQualityRules
  /** Patterns that are forbidden in any content */
  forbidden: string[]
  /** Patterns that should be used (with placeholders) */
  required: string[]
  /** Tone and voice guidelines */
  voice: {
    style: string
    avoid: string[]
    prefer: string[]
  }
}

// ============================================
// QUALITY EVALUATION TYPES
// ============================================

export type QualityRuleName =
  | 'noVagueVerbs'
  | 'requiredFields'
  | 'minimumMistakes'
  | 'minimumAbilities'
  | 'consequenceRequired'
  | 'forbiddenPattern'
  | 'identityShift'
  | 'passCondition'
  | 'failCondition'

export interface QualityFailure {
  rule: QualityRuleName
  location?: string
  value: unknown
  fix: string
  severity: 'critical' | 'major' | 'minor'
}

export interface EvaluationResult {
  passed: boolean
  score: number
  failures: QualityFailure[]
  suggestions: string[]
}

// ============================================
// STEP QUALITY TYPES
// ============================================

export interface StepQualityCheck {
  /** Why this step must come first/now */
  hasWhyFirst: boolean
  /** Common mistakes with consequences */
  hasMistakesWithConsequences: boolean
  /** Self-test with pass/fail criteria */
  hasSelfTest: boolean
  /** Abilities unlocked after completion */
  hasAbilities: boolean
  /** Identity shift statement */
  hasIdentityShift: boolean
  /** Clear pass condition */
  hasPassCondition: boolean
  /** Clear fail condition */
  hasFailCondition: boolean
}

export interface StepValidationResult {
  stepOrder: number
  isValid: boolean
  checks: StepQualityCheck
  failures: QualityFailure[]
}

// ============================================
// CONTENT AUTHORITY TYPES
// ============================================

export interface AuthorityMarker {
  type: 'opinion' | 'warning' | 'rejection' | 'correction'
  content: string
}

export interface ContentAuthority {
  /** Does this sound like an expert? */
  hasAuthority: boolean
  /** Markers of authority found */
  markers: AuthorityMarker[]
  /** Missing authority elements */
  missing: string[]
}

// ============================================
// IDENTITY & CAPABILITY TYPES
// ============================================

export interface IdentityGoal {
  /** Who the user becomes (not what they learn) */
  identity: string
  /** e.g., "Early English Speaker", "Independent Web Builder" */
  examples: string[]
}

export interface Capability {
  /** What the user can DO under pressure */
  description: string
  /** Conditions under which they can do it */
  conditions: string[]
  /** How to verify they can do it */
  verification: string
}

export interface Phase {
  /** Phase number */
  order: number
  /** Primary failure mode this phase eliminates */
  failureToEliminate: string
  /** Capability gained after this phase */
  capabilityGained: Capability
  /** Identity shift after completion */
  identityShift: {
    from: string
    to: string
  }
}

// ============================================
// TRAINING LOOP TYPES
// ============================================

export interface TrainingLoop {
  /** Input: What to observe */
  input: {
    action: string
    focus: string
  }
  /** Output: What to produce */
  output: {
    action: string
    constraint: string
  }
  /** Pressure: What makes it challenging */
  pressure: {
    type: 'time' | 'constraint' | 'random' | 'public'
    description: string
  }
  /** Validation: Pass/fail criteria */
  validation: {
    passCondition: string
    failCondition: string
    repeatInstruction: string
  }
}

// ============================================
// STANDARD THRESHOLDS
// ============================================

export const QUALITY_THRESHOLDS = {
  /** Minimum score to proceed */
  PASS: 70,
  /** Score range that triggers regeneration */
  REGENERATE_MIN: 50,
  REGENERATE_MAX: 69,
  /** Score below which we use fallback */
  FAIL: 49,
} as const

export const MAX_REGENERATION_ATTEMPTS = 3
