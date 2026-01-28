/**
 * DOMAIN INTELLIGENCE - TYPE DEFINITIONS
 *
 * Domain playbooks contain subject-specific knowledge that
 * the AI cannot reliably generate on its own.
 *
 * This includes:
 * - What experts prioritize (that beginners don't know)
 * - Common wrong beliefs beginners have
 * - Specific failure modes per topic
 * - Sequence constraints (what must come before what)
 */

// ============================================
// FAILURE MODE TYPES
// ============================================

export interface FailureTrap {
  /** What the user does wrong */
  trap: string
  /** What happens as a result */
  consequence: string
  /** How common this mistake is */
  frequency?: 'very_common' | 'common' | 'occasional'
}

export interface TopicFailureModes {
  [topic: string]: FailureTrap[]
}

// ============================================
// WRONG BELIEF TYPES
// ============================================

export interface WrongBelief {
  /** What beginners incorrectly believe */
  belief: string
  /** The actual reality */
  reality: string
  /** Why this belief is harmful */
  harm?: string
}

// ============================================
// SEQUENCE CONSTRAINT TYPES
// ============================================

export interface SequenceRule {
  /** Topic that must come first */
  prerequisite: string
  /** Topic that requires the prerequisite */
  required_for: string
  /** Why this order matters */
  reason?: string
}

// ============================================
// DOMAIN PLAYBOOK STRUCTURE
// ============================================

export interface DomainPlaybook {
  /** Domain identifier */
  domain: string

  /** Display name */
  displayName: string

  /** Subdomains covered */
  subdomains: string[]

  /** Keywords that identify this domain */
  keywords: string[]

  /**
   * What experts know that beginners don't
   * Organized by subdomain
   */
  expertPriorities: {
    [subdomain: string]: string[]
  }

  /**
   * Common wrong beliefs beginners have
   * Organized by subdomain
   */
  wrongBeliefs: {
    [subdomain: string]: WrongBelief[]
  }

  /**
   * Specific failure modes per topic
   * Organized by subdomain, then topic
   */
  failureModes: {
    [subdomain: string]: TopicFailureModes
  }

  /**
   * Sequence constraints - what must come before what
   * Organized by subdomain
   */
  sequenceRules: {
    [subdomain: string]: SequenceRule[]
  }

  /**
   * Identity transformations for this domain
   * What users become at each stage
   */
  identityStages: {
    stage: number
    identity: string
    description: string
  }[]

  /**
   * Time estimates for this domain
   */
  timeEstimates: {
    beginner_to_functional: string
    functional_to_proficient: string
    proficient_to_expert: string
  }
}

// ============================================
// DOMAIN SELECTOR TYPES
// ============================================

export interface DomainMatch {
  domain: string
  subdomain: string | null
  confidence: number
  matchedKeywords: string[]
}

export interface DomainSelectionResult {
  primary: DomainMatch
  alternatives: DomainMatch[]
  isVague: boolean
  clarificationNeeded: boolean
}

// ============================================
// GENERIC FALLBACK
// Used when no specific domain matches
// ============================================

export interface GenericPlaybook {
  /** Generic failure modes that apply to any learning */
  universalFailures: FailureTrap[]

  /** Generic wrong beliefs about learning */
  universalWrongBeliefs: WrongBelief[]

  /** Generic expert advice */
  universalPriorities: string[]
}

export const GENERIC_PLAYBOOK: GenericPlaybook = {
  universalFailures: [
    {
      trap: 'Consuming content without practicing',
      consequence: 'Knowledge without skill. Can recognize but cannot produce.',
      frequency: 'very_common',
    },
    {
      trap: 'Skipping fundamentals to reach "interesting" parts',
      consequence: 'Shaky foundation that collapses under complexity.',
      frequency: 'very_common',
    },
    {
      trap: 'Avoiding discomfort and only doing easy tasks',
      consequence: 'Plateau at beginner level. No real growth.',
      frequency: 'common',
    },
    {
      trap: 'Studying without testing understanding',
      consequence: 'Illusion of competence. Fails under real conditions.',
      frequency: 'common',
    },
    {
      trap: 'Collecting resources instead of using them',
      consequence: 'Tutorial hell. Always preparing, never doing.',
      frequency: 'common',
    },
  ],

  universalWrongBeliefs: [
    {
      belief: 'More hours = more learning',
      reality: 'Focused practice quality matters more than time spent',
      harm: 'Burnout without proportional progress',
    },
    {
      belief: 'I need to understand everything before starting',
      reality: 'Understanding comes from doing, not from reading',
      harm: 'Perpetual preparation, never action',
    },
    {
      belief: 'Struggling means I am not talented',
      reality: 'Struggle is where learning happens. Ease means no growth.',
      harm: 'Giving up right before breakthrough',
    },
    {
      belief: 'Following tutorials = learning',
      reality: 'Tutorials create illusion of skill. Building alone = real learning.',
      harm: 'Cannot perform without guidance',
    },
  ],

  universalPriorities: [
    'Master the minimum viable fundamentals before anything else',
    'Practice under realistic conditions, not ideal ones',
    'Test yourself before you feel ready',
    'Teach what you learn to cement understanding',
    'Track failures, not just completions',
  ],
}
