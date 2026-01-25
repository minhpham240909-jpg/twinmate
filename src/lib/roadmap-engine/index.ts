/**
 * CLERVA ROADMAP ENGINE
 *
 * The BRAIN of Clerva. This is NOT AI - this is system logic.
 *
 * PHILOSOPHY:
 * - The System decides: goals, steps, progression, constraints
 * - The AI only: fills in content within strict boundaries
 *
 * This engine controls:
 * 1. Roadmap structure (what steps exist)
 * 2. Step progression (what's unlocked, what's next)
 * 3. User state (where they are, what they've done)
 * 4. Rules (what AI can/cannot say at each step)
 * 5. Output format (exact structure, no deviation)
 */

// ============================================
// TYPES - Strict, non-negotiable structures
// ============================================

export interface RoadmapStep {
  id: string
  order: number
  title: string
  description: string
  timeframe: string // "Day 1-3", "Week 1", "Hour 1-2"
  status: 'locked' | 'current' | 'completed' | 'skipped'

  // What AI can generate for this step
  allowedContent: {
    explanation: boolean
    practice: boolean
    examples: boolean
    fullSolutions: boolean // Usually false
  }

  // Success criteria (system checks, not AI)
  completionCriteria: {
    type: 'time_spent' | 'practice_done' | 'self_report' | 'quiz_passed'
    threshold: number // minutes, count, or percentage
  }

  // What to avoid (shown to user, enforced by system)
  pitfalls: string[]

  // How user knows they're done
  doneWhen: string
}

export interface Roadmap {
  id: string
  userId: string
  goal: string // User's stated goal
  parsedGoal: {
    subject: string
    level: 'beginner' | 'intermediate' | 'advanced'
    timeframe: string // "1 week", "1 month", etc.
    specificTarget?: string // "Pass exam", "Build project", etc.
  }

  steps: RoadmapStep[]
  currentStepIndex: number

  // System-controlled state
  createdAt: Date
  lastActivityAt: Date
  totalTimeSpent: number // minutes

  // What the user should see RIGHT NOW
  todaysMission: TodaysMission | null
}

export interface TodaysMission {
  stepId: string
  title: string
  description: string
  estimatedMinutes: number

  // Exactly what to do (no questions, pure direction)
  actions: {
    order: number
    instruction: string // "Read section 2.1", "Complete 5 practice problems"
    type: 'read' | 'practice' | 'review' | 'create' | 'test'
  }[]

  // What NOT to do
  avoid: string[]

  // Clear success indicator
  doneWhen: string
}

// ============================================
// AI ROLE DEFINITIONS
// Each role has ONE job, strict input, strict output
// ============================================

export type AIRole =
  | 'roadmap_builder'      // Creates roadmap structure from goal
  | 'mission_generator'    // Creates today's mission from current step
  | 'explainer'            // Explains concept (NO full solutions)
  | 'practice_generator'   // Creates practice problems (NO answers unless allowed)
  | 'confusion_detector'   // Detects where user is stuck
  | 'progress_checker'     // Validates if step is complete
  | 'constraint_detector'  // Detects deadlines, rules, prerequisites, policies
  | 'risk_analyzer'        // Analyzes risks and consequences for each step
  | 'tradeoff_analyzer'    // Analyzes tradeoffs between different approaches

export interface AIRoleConfig {
  role: AIRole

  // What system provides to AI (context)
  input: {
    userGoal?: string
    currentStep?: RoadmapStep
    userLevel?: string
    previousAttempts?: string[]
    constraints: string[] // "No full solutions", "Beginner level", etc.
  }

  // What AI must return (strict format)
  outputSchema: Record<string, unknown>

  // Hard rules the AI must follow
  rules: string[]

  // Maximum tokens (keep it tight)
  maxTokens: number
}

// ============================================
// SYSTEM RULES - These are NOT suggestions
// ============================================

export const SYSTEM_RULES = {
  // AI can NEVER decide these
  AI_CANNOT_DECIDE: [
    'What the goal is',
    'What step comes next',
    'How much to explain',
    'Whether to give full solutions',
    'If user should skip ahead',
    'What difficulty level to use',
  ],

  // AI can ONLY do these
  AI_CAN_ONLY: [
    'Fill in content within boundaries',
    'Generate examples at specified difficulty',
    'Explain concepts without giving answers',
    'Create practice problems',
    'Detect confusion patterns',
  ],

  // Default constraints for all AI calls
  DEFAULT_CONSTRAINTS: [
    'Never provide complete solutions unless explicitly allowed',
    'Never suggest skipping steps',
    'Never change the roadmap structure',
    'Never give vague advice - be specific',
    'Never ask questions - give directions',
  ],
} as const

// ============================================
// STEP TEMPLATES - Pre-defined structures
// ============================================

export const STEP_TEMPLATES = {
  // For learning a new subject
  LEARN_SUBJECT: [
    {
      title: 'Foundation',
      description: 'Master the core concepts and vocabulary',
      timeframePattern: 'Days 1-{n}',
      allowedContent: { explanation: true, practice: true, examples: true, fullSolutions: false },
      completionType: 'practice_done' as const,
    },
    {
      title: 'Application',
      description: 'Apply concepts to real problems',
      timeframePattern: 'Days {n}-{m}',
      allowedContent: { explanation: true, practice: true, examples: true, fullSolutions: false },
      completionType: 'practice_done' as const,
    },
    {
      title: 'Mastery',
      description: 'Solve complex problems independently',
      timeframePattern: 'Days {m}-{end}',
      allowedContent: { explanation: true, practice: true, examples: true, fullSolutions: true },
      completionType: 'quiz_passed' as const,
    },
  ],

  // For test preparation
  TEST_PREP: [
    {
      title: 'Assess Gaps',
      description: 'Identify what you don\'t know',
      timeframePattern: 'Day 1',
      allowedContent: { explanation: false, practice: true, examples: false, fullSolutions: false },
      completionType: 'self_report' as const,
    },
    {
      title: 'Fill Gaps',
      description: 'Learn the concepts you\'re missing',
      timeframePattern: 'Days 2-{n}',
      allowedContent: { explanation: true, practice: true, examples: true, fullSolutions: false },
      completionType: 'practice_done' as const,
    },
    {
      title: 'Practice Under Pressure',
      description: 'Timed practice to build speed',
      timeframePattern: 'Days {n}-{end}',
      allowedContent: { explanation: false, practice: true, examples: false, fullSolutions: true },
      completionType: 'time_spent' as const,
    },
  ],

  // For skill building
  SKILL_BUILD: [
    {
      title: 'Learn the Basics',
      description: 'Understand fundamental techniques',
      timeframePattern: 'Week 1',
      allowedContent: { explanation: true, practice: true, examples: true, fullSolutions: true },
      completionType: 'practice_done' as const,
    },
    {
      title: 'Deliberate Practice',
      description: 'Focused repetition on weak areas',
      timeframePattern: 'Weeks 2-3',
      allowedContent: { explanation: true, practice: true, examples: true, fullSolutions: false },
      completionType: 'time_spent' as const,
    },
    {
      title: 'Real Application',
      description: 'Apply skills to real projects',
      timeframePattern: 'Week 4+',
      allowedContent: { explanation: true, practice: true, examples: true, fullSolutions: true },
      completionType: 'self_report' as const,
    },
  ],
} as const

// ============================================
// OUTPUT SCHEMAS - Exact formats, no deviation
// ============================================

export const OUTPUT_SCHEMAS = {
  // What roadmap_builder must return
  ROADMAP: {
    goal: 'string - user\'s goal restated clearly',
    totalDuration: 'string - "2 weeks", "1 month", etc.',
    steps: [
      {
        order: 'number',
        title: 'string - specific action title',
        timeframe: 'string - "Days 1-3", "Week 1"',
        description: 'string - what to do',
        method: 'string - how to do it',
        avoid: 'string[] - what NOT to do',
        doneWhen: 'string - success criterion',
      },
    ],
    overallPitfalls: 'string[] - 2-3 things to avoid',
    successLooksLike: 'string - end state description',
  },

  // What mission_generator must return
  MISSION: {
    title: 'string - today\'s focus',
    estimatedMinutes: 'number',
    actions: [
      {
        order: 'number',
        instruction: 'string - exact action',
        type: 'read | practice | review | create | test',
      },
    ],
    avoid: 'string[] - what not to do today',
    doneWhen: 'string - how to know you\'re done',
  },

  // What explainer must return
  EXPLANATION: {
    concept: 'string - the concept being explained',
    coreIdea: 'string - one sentence summary',
    breakdown: [
      {
        point: 'string - key point',
        why: 'string - why it matters',
      },
    ],
    commonMistake: 'string - what to avoid',
    checkYourself: 'string - how to verify understanding',
  },

  // What practice_generator must return
  PRACTICE: {
    problems: [
      {
        id: 'string',
        problem: 'string - the problem',
        difficulty: 'easy | medium | hard',
        hint: 'string - optional hint',
        // NO answer field unless fullSolutions allowed
      },
    ],
    focusArea: 'string - what this practice targets',
  },
}

// ============================================
// ENGINE FUNCTIONS
// ============================================

/**
 * Get what the user should see RIGHT NOW
 * This is the core function - it returns exactly what to display
 */
export function getCurrentView(roadmap: Roadmap): {
  overview: {
    goal: string
    progress: number // percentage
    currentStep: string
    nextMilestone: string
  }
  todaysMission: TodaysMission | null
  currentStepDetails: RoadmapStep | null
} {
  const currentStep = roadmap.steps[roadmap.currentStepIndex] || null
  const completedSteps = roadmap.steps.filter(s => s.status === 'completed').length
  const progress = Math.round((completedSteps / roadmap.steps.length) * 100)

  return {
    overview: {
      goal: roadmap.goal,
      progress,
      currentStep: currentStep?.title || 'Not started',
      nextMilestone: getNextMilestone(roadmap),
    },
    todaysMission: roadmap.todaysMission,
    currentStepDetails: currentStep,
  }
}

/**
 * Determine what AI role to use based on user action
 */
export function getAIRole(
  action: 'create_roadmap' | 'get_mission' | 'explain' | 'practice' | 'check_progress',
  currentStep: RoadmapStep | null
): AIRoleConfig {
  const baseConstraints: string[] = [...SYSTEM_RULES.DEFAULT_CONSTRAINTS]

  // Add step-specific constraints
  if (currentStep && !currentStep.allowedContent.fullSolutions) {
    baseConstraints.push('Do NOT provide complete solutions or answers')
  }

  switch (action) {
    case 'create_roadmap':
      return {
        role: 'roadmap_builder',
        input: { constraints: baseConstraints },
        outputSchema: OUTPUT_SCHEMAS.ROADMAP,
        rules: [
          'Create 3-5 specific, time-boxed steps',
          'Each step must have clear success criteria',
          'Include what to avoid for each step',
          'No vague advice - be specific about methods',
        ],
        maxTokens: 800,
      }

    case 'get_mission':
      return {
        role: 'mission_generator',
        input: { currentStep: currentStep || undefined, constraints: baseConstraints },
        outputSchema: OUTPUT_SCHEMAS.MISSION,
        rules: [
          'Create 2-4 specific actions for today',
          'Each action is an instruction, not a question',
          'Include what to avoid today',
          'Clear done-when criterion',
        ],
        maxTokens: 400,
      }

    case 'explain':
      return {
        role: 'explainer',
        input: { currentStep: currentStep || undefined, constraints: baseConstraints },
        outputSchema: OUTPUT_SCHEMAS.EXPLANATION,
        rules: [
          'Explain the concept, not the answer',
          'Include common mistakes to avoid',
          'Keep it focused - one concept at a time',
          'End with a self-check, not a solution',
        ],
        maxTokens: 500,
      }

    case 'practice':
      return {
        role: 'practice_generator',
        input: { currentStep: currentStep || undefined, constraints: baseConstraints },
        outputSchema: OUTPUT_SCHEMAS.PRACTICE,
        rules: [
          'Generate 2-3 problems at appropriate difficulty',
          'Include hints, not answers',
          'Problems should test understanding, not memory',
          'Focus on the current step\'s topic only',
        ],
        maxTokens: 400,
      }

    case 'check_progress':
      return {
        role: 'progress_checker',
        input: { currentStep: currentStep || undefined, constraints: baseConstraints },
        outputSchema: { ready: 'boolean', reason: 'string', suggestion: 'string' },
        rules: [
          'Evaluate if user is ready to move on',
          'Be honest about gaps',
          'Suggest specific actions if not ready',
        ],
        maxTokens: 200,
      }
  }
}

/**
 * Validate AI output against schema
 * Rejects anything that doesn't match exactly
 */
export function validateAIOutput(
  output: unknown,
  role: AIRole
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!output || typeof output !== 'object') {
    return { valid: false, errors: ['Output is not an object'] }
  }

  // Get expected schema
  const schemaMap: Record<AIRole, Record<string, unknown>> = {
    roadmap_builder: OUTPUT_SCHEMAS.ROADMAP,
    mission_generator: OUTPUT_SCHEMAS.MISSION,
    explainer: OUTPUT_SCHEMAS.EXPLANATION,
    practice_generator: OUTPUT_SCHEMAS.PRACTICE,
    confusion_detector: { confused: 'boolean', area: 'string', suggestion: 'string' },
    progress_checker: { ready: 'boolean', reason: 'string', suggestion: 'string' },
    constraint_detector: { explicit: 'array', inferred: 'array', assumptions: 'array' },
    risk_analyzer: { stepTitle: 'string', risks: 'array', commonMistakes: 'array' },
    tradeoff_analyzer: { decision: 'string', options: 'array', recommendation: 'object' },
  }

  const schema = schemaMap[role]
  const out = output as Record<string, unknown>

  // Check required top-level fields
  for (const key of Object.keys(schema)) {
    if (!(key in out)) {
      errors.push(`Missing required field: ${key}`)
    }
  }

  // Specific validations per role
  if (role === 'roadmap_builder') {
    const roadmapOut = out as { steps?: unknown[] }
    if (!Array.isArray(roadmapOut.steps) || roadmapOut.steps.length < 2) {
      errors.push('Roadmap must have at least 2 steps')
    }
    if (Array.isArray(roadmapOut.steps)) {
      for (const step of roadmapOut.steps) {
        const s = step as Record<string, unknown>
        if (!s.title || !s.timeframe || !s.doneWhen) {
          errors.push('Each step must have title, timeframe, and doneWhen')
          break
        }
      }
    }
  }

  if (role === 'mission_generator') {
    const missionOut = out as { actions?: unknown[] }
    if (!Array.isArray(missionOut.actions) || missionOut.actions.length < 1) {
      errors.push('Mission must have at least 1 action')
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Progress to next step (system decision)
 */
export function progressToNextStep(roadmap: Roadmap): Roadmap {
  const currentStep = roadmap.steps[roadmap.currentStepIndex]
  if (!currentStep) return roadmap

  // Mark current as completed
  currentStep.status = 'completed'

  // Find next step
  const nextIndex = roadmap.currentStepIndex + 1
  if (nextIndex < roadmap.steps.length) {
    roadmap.currentStepIndex = nextIndex
    roadmap.steps[nextIndex].status = 'current'
  }

  // Clear today's mission (will be regenerated)
  roadmap.todaysMission = null

  return roadmap
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getNextMilestone(roadmap: Roadmap): string {
  const currentStep = roadmap.steps[roadmap.currentStepIndex]
  if (!currentStep) return 'Complete your roadmap'

  const nextStep = roadmap.steps[roadmap.currentStepIndex + 1]
  if (nextStep) {
    return `Complete "${currentStep.title}" to unlock "${nextStep.title}"`
  }

  return `Complete "${currentStep.title}" to finish your roadmap`
}

/**
 * Determine roadmap type from goal
 * This is system logic, not AI
 */
export function categorizeGoal(goal: string): {
  type: 'learn_subject' | 'test_prep' | 'skill_build' | 'general'
  template: typeof STEP_TEMPLATES[keyof typeof STEP_TEMPLATES] | null
} {
  const g = goal.toLowerCase()

  // Test prep indicators
  if (g.includes('test') || g.includes('exam') || g.includes('quiz') ||
      g.includes('prepare') || g.includes('study for')) {
    return { type: 'test_prep', template: STEP_TEMPLATES.TEST_PREP }
  }

  // Skill building indicators
  if (g.includes('learn how to') || g.includes('become') || g.includes('master') ||
      g.includes('improve my') || g.includes('get better at')) {
    return { type: 'skill_build', template: STEP_TEMPLATES.SKILL_BUILD }
  }

  // Learning subject indicators
  if (g.includes('learn') || g.includes('understand') || g.includes('study')) {
    return { type: 'learn_subject', template: STEP_TEMPLATES.LEARN_SUBJECT }
  }

  return { type: 'general', template: STEP_TEMPLATES.LEARN_SUBJECT }
}
