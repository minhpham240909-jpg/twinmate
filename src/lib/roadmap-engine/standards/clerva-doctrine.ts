/**
 * CLERVA DOCTRINE
 *
 * The constitution of Clerva content quality.
 * These rules NEVER change per user. They define what Clerva is.
 *
 * Core Belief:
 * Clerva does not teach knowledge.
 * Clerva installs decision-making systems.
 *
 * Why this matters:
 * - Most learning apps fail because they reward completion, not competence
 * - They avoid discomfort and optimize for friendliness, not effectiveness
 * - Clerva does the opposite
 */

import { Doctrine } from './types'

export const ClervaDoctrine: Doctrine = {
  // ============================================
  // CORE PHILOSOPHY
  // ============================================
  philosophy: {
    failureFirst:
      "Every step must address: 'What causes people to fail here?' Design backwards from failure.",
    identityBased:
      "Learning is about WHO you become, not WHAT you learn. Users commit to identities, not checklists.",
    consequencesDriven:
      "Every warning must have real-world consequences. Vague warnings are ignored.",
    actionable:
      "No step without a clear, verifiable action. If it can't be proven, it can't be tracked.",
    progressive:
      "Each step unlocks abilities for the next step. Learning is cumulative, not random.",
  },

  // ============================================
  // NON-NEGOTIABLE QUALITY RULES
  // ============================================
  qualityRules: {
    // Verbs that indicate vague, non-actionable content
    noVagueVerbs: [
      'understand',
      'learn',
      'know',
      'study',
      'explore',
      'familiarize',
      'grasp',
      'comprehend',
      'appreciate',
      'consider',
      'think about',
      'look into',
      'get familiar with',
      'become aware of',
    ],

    // Fields that MUST be present in every step
    requiredFields: [
      'whyFirst',        // Why this step matters NOW
      'commonMistakes',  // Specific mistakes with consequences
      'selfTest',        // Provable mastery test
      'abilities',       // What you unlock after completing
    ],

    // Every step needs at least 2 specific mistakes
    minimumMistakes: 2,

    // Every step unlocks at least 1 ability
    minimumAbilities: 1,

    // Every warning needs a consequence
    consequenceRequired: true,
  },

  // ============================================
  // FORBIDDEN PATTERNS
  // These phrases indicate weak, generic content
  // ============================================
  forbidden: [
    // Vague actions
    'Practice until comfortable',
    'Practice until confident',
    'Read documentation',
    'Study the basics',
    'Understand the concepts',
    'Learn as needed',
    'Explore on your own',
    'Get familiar with',

    // Weak time references
    'When you feel ready',
    'At your own pace',
    'Take your time',
    'As long as you need',

    // Generic advice
    'Just practice more',
    'Keep trying',
    'Do your best',
    'Try to remember',

    // Passive learning
    'Watch tutorials',
    'Read articles',
    'Review materials',
    'Go through the content',

    // Hedging
    'You might want to',
    'Consider trying',
    'Perhaps look at',
    'You could try',

    // Empty encouragement
    'You can do it!',
    'Believe in yourself',
    'Stay positive',
    'Don\'t give up',
  ],

  // ============================================
  // REQUIRED PATTERNS
  // Content should follow these structures
  // ============================================
  required: [
    // Specific actions with deliverables
    'Build [specific thing]',
    'Complete [specific number] of [specific exercises]',
    'Write [specific output] that [specific criteria]',
    'Ship [deliverable] by [checkpoint]',

    // Provable outcomes
    'Explain [concept] to [audience] without notes',
    'Debug [specific error type] within [time limit]',
    'Solve [problem type] without references',

    // Failure conditions
    'If you [specific failure], you must [specific action]',
    'You have NOT passed if [specific condition]',
    'Repeat until [specific measurable outcome]',

    // Identity statements
    'At this stage, you are no longer [X]; you are now [Y]',
    'After this phase, you are [new identity]',
  ],

  // ============================================
  // VOICE & TONE
  // How Clerva speaks
  // ============================================
  voice: {
    style: 'Senior mentor, not influencer. Calm, direct, slightly strict. Non-cheerleading.',

    avoid: [
      'Excessive emojis',
      'Overly enthusiastic language',
      'Filler motivation',
      'Hedging words (maybe, perhaps, might)',
      'Apologetic tone',
      'Casual slang',
      'Empty praise',
    ],

    prefer: [
      'Direct statements',
      'Clear commands',
      'Specific warnings with consequences',
      'Measurable criteria',
      'Identity-focused language',
      'Professional authority',
      'Honest assessment',
    ],
  },
}

// ============================================
// CLERVA PROMISES
// What Clerva guarantees to users
// ============================================
export const ClervaPromises = {
  everyStepHasReason: 'Every step has a reason for its placement',
  everyTaskChangesBehavior: 'Every task changes observable behavior',
  everyPhaseUpgradesIdentity: 'Every phase upgrades who you are',
  progressIsInevitable: 'If you follow the plan, progress is inevitable',
}

// ============================================
// CLERVA REFUSES
// What Clerva will NOT do
// ============================================
export const ClervaRefuses = {
  genericAdvice: 'No generic advice that could apply to anyone',
  infiniteOptions: 'No infinite options - we make choices for you',
  uncappedFreedom: 'No "learn at your own pace" without constraints',
  contentWithoutQualityBar: 'No content without a quality bar',
  comfortableProgress: 'No comfortable progress without real challenges',
}

// ============================================
// AUTHORITY REQUIREMENTS
// What makes content feel expert-level
// ============================================
export const AuthorityRequirements = {
  // Must include at least ONE of these per step
  authorityMarkers: [
    'A strong opinion (e.g., "90% of beginners fail because...")',
    'A specific warning with consequence',
    'A rejection of common advice',
    'A correction of a popular belief',
    'A non-negotiable standard',
  ],

  // Signs of weak authority (reject if found)
  weaknessMarkers: [
    'No judgment or opinion',
    'All options presented equally',
    'No failure conditions',
    'No identity transformation',
    'Generic encouragement',
  ],
}

// ============================================
// STEP STRUCTURE REQUIREMENTS
// What every step MUST contain
// ============================================
export const StepRequirements = {
  // Core fields
  title: {
    required: true,
    rule: 'Must use action verb (not vague verbs). Format: "[Verb] [Specific Object]"',
  },
  whyFirst: {
    required: true,
    rule: 'Explain why THIS step comes NOW, not later. Reference failure prevention.',
  },
  description: {
    required: true,
    rule: 'Clear directive, not suggestion. What to DO, not what to think about.',
  },
  duration: {
    required: true,
    rule: 'Specific minutes. No ranges longer than 10 min (e.g., "15-20 min" ok, "1-2 hours" not ok).',
  },

  // Quality fields
  commonMistakes: {
    required: true,
    minimum: 2,
    rule: 'Each mistake must have: trap (what user does wrong) + consequence (what happens)',
  },
  selfTest: {
    required: true,
    rule: 'Must include: challenge + passCriteria + failCriteria',
  },
  abilities: {
    required: true,
    minimum: 1,
    rule: 'What user CAN DO after this step. Not what they "understand".',
  },

  // Optional but encouraged
  method: {
    required: false,
    rule: 'Exact daily breakdown if step spans multiple days',
  },
  avoid: {
    required: false,
    rule: 'What NOT to do during this step',
  },
  resources: {
    required: false,
    rule: 'Curated, opinionated resources. Max 3. With direct links.',
  },
}

// ============================================
// EXPORT ALL
// ============================================
export default ClervaDoctrine
