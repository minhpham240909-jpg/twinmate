/**
 * EXECUTION PHASE PROMPTS
 *
 * Phase 3 of the multi-phase AI pipeline.
 * Creates the detailed execution plan:
 * - Current step with full detail (GPS-style)
 * - Locked steps with previews
 * - Micro-tasks within each step
 */

import type { DiagnosticResult } from './diagnostic'
import type { StrategyResult } from './strategy'

// ============================================
// TYPES
// ============================================

export interface MicroTask {
  order: number
  title: string
  description: string
  taskType: 'ACTION' | 'LEARN' | 'PRACTICE' | 'TEST' | 'REFLECT'
  duration: number // minutes
  verificationMethod?: string
  proofRequired: boolean
}

export interface StepResource {
  type: 'video' | 'article' | 'exercise' | 'tool' | 'book'
  title: string
  description?: string
  searchQuery: string
  priority: number
}

export interface CurrentStep {
  order: number
  phase: 'NOW'
  title: string
  description: string

  // Deep detail
  whyFirst: string // Why this must come first
  method: string // Exact method with daily breakdown
  timeBreakdown: {
    daily: string
    total: string
    flexible: string
  }

  // Risk & Prevention
  risk: {
    warning: string
    consequence: string
    severity: 'RISK' | 'WARNING'
  }
  commonMistakes: string[] // 3-5 specific mistakes

  // Completion
  doneWhen: string // Verifiable criterion
  selfTest: {
    challenge: string
    passCriteria: string
  }

  // Outcomes
  abilities: string[] // What you unlock
  milestone?: string // Achievement marker

  // Time
  duration: number // Total minutes for step
  timeframe: string // "Days 1-3"

  // Resources
  resources: StepResource[]

  // Micro-tasks
  microTasks: MicroTask[]
}

export interface LockedStep {
  order: number
  phase: 'NEXT' | 'LATER'
  title: string
  whyAfterPrevious: string
  previewAbilities: string[]
  milestone?: string
  estimatedDuration?: number
  resources: StepResource[]
}

export interface ExecutionResult {
  // Roadmap metadata
  title: string
  totalSteps: number
  estimatedDays: number
  dailyCommitment: string
  totalMinutes: number

  // Steps
  currentStep: CurrentStep
  lockedSteps: LockedStep[]

  // Critical warning (carried from strategy)
  criticalWarning: {
    warning: string
    consequence: string
    severity: 'CRITICAL'
  }
}

// ============================================
// PROMPT 5: CURRENT STEP DEEP DIVE
// ============================================

export const CURRENT_STEP_PROMPT = `You are a world-class instructor creating the PERFECT first step. This step must be so clear that a struggling student understands, so rich that a professor approves.

=== CONTEXT ===
{executionContext}

=== YOUR TASK ===
Create ONE step with FULL professor-level detail:

1. WHY FIRST: Deep explanation of why this must come first
   - Not "it's the foundation" - explain the actual DEPENDENCY
   - What breaks if they skip this?

2. METHOD: Exact step-by-step process with ZERO ambiguity
   - Daily breakdown (Day 1: X, Day 2: Y) with EXACT times and actions
   - Every instruction must answer: WHAT, WHERE, HOW LONG, HOW TO VERIFY
   - REQUIRED: Include specific URLs, platform names, or search terms
   - Example: "Day 1 (15 min): Go to youtube.com and search 'JavaScript variables crash course'. Watch the first 10 minutes. Pause and write: What is a variable? What are 3 ways to declare one?"
   - Example: "Day 2 (10 min): Open replit.com. Create a new JavaScript file. Type (don't paste) 5 variable declarations using const, let, and var. Run the code to verify no errors."

3. TIME BREAKDOWN:
   - Daily: How much per day
   - Total: Total for this step
   - Flexible: Alternative schedule

4. RISK & MISTAKES:
   - One risk specific to this step
   - 3-5 common mistakes with consequences
   - Example: "Moving to strings before understanding variable declaration → confusion about types"

5. DONE WHEN: Verifiable criterion
   - Something they can PROVE
   - Not "understand X" but "can do Y without looking"

6. SELF-TEST: Quick challenge
   - A test they can do themselves
   - Clear pass/fail criteria

7. ABILITIES: What they unlock after this step
   - Specific capabilities
   - "Can write basic X" not "understands X"

8. MICRO-TASKS: Break into 3-5 small IMMEDIATELY ACTIONABLE tasks
   - Each task must be completable in ONE sitting (5-15 min max)
   - Each task must have a CLEAR completion criteria
   - Types: ACTION (do something), LEARN (watch/read), PRACTICE (hands-on), TEST (self-check), REFLECT (journal)
   - CRITICAL: Task descriptions must include:
     * WHERE to do it (platform, website, tool)
     * WHAT exactly to do (specific action, not vague "practice")
     * HOW to verify completion (concrete output or proof)
   - EXAMPLE GOOD: "Watch 'JS Variables 101' on youtube.com (10 min), write down 3 key concepts"
   - EXAMPLE BAD: "Learn about variables" (WHERE? HOW? HOW MUCH?)

9. RESOURCES: 1-3 suggested resources
   - Type: video, article, exercise, tool, book
   - Include searchQuery for finding on platforms

=== QUALITY STANDARDS - CRITICAL ===

THE GOLDEN RULE: If a student reads your step and still asks "but what exactly do I DO?", you've failed.

ACTIONABILITY TEST - Every instruction must pass ALL of these:
1. SPECIFIC: Can I do this RIGHT NOW without more info? (Not "learn X" but "watch THIS video, then DO THIS")
2. MEASURABLE: How do I know I'm done? (Not "understand" but "can write without looking")
3. IMMEDIATE: What's my FIRST action in the next 60 seconds? (Not "study" but "open X, type Y")
4. VERIFIABLE: Can I PROVE I did it? (Not "practice" but "complete 5 problems with 80%+ correct")

GOOD EXAMPLES (Students know EXACTLY what to do):
- "Day 1 (15 min): Open your code editor. Create file 'variables.js'. Type these 5 declarations - don't copy-paste: const name = 'Alex'; let age = 21; etc."
- "Day 2 (10 min): Go to freecodecamp.org/challenges/variables. Complete the first 5 challenges. Screenshot your progress."
- "DONE WHEN: You can write 5 different variable declarations from memory in under 2 minutes, choosing const/let correctly."

BAD EXAMPLES (Students don't know what to do):
- "Practice variable declarations" (WHICH declarations? HOW MANY? WHERE?)
- "Study the documentation" (WHICH docs? WHICH sections? FOR HOW LONG?)
- "Understand the concept" (HOW do I know I understand?)
- "Learn about X" (Through video? Reading? Practice? WHERE?)

THE DIFFERENCE: Bad instructions require the student to figure out the HOW. Good instructions ARE the HOW.

=== OUTPUT FORMAT ===
{
  "currentStep": {
    "order": 1,
    "phase": "NOW",
    "title": "Action-oriented title",
    "description": "One sentence command",
    "whyFirst": "Deep explanation of dependency",
    "method": "Day 1: ...\\nDay 2: ...\\nDay 3: ...",
    "timeBreakdown": {
      "daily": "15 min",
      "total": "45 min over 3 days",
      "flexible": "Can do 30 min for 2 days instead"
    },
    "risk": {
      "warning": "Specific risk for this step",
      "consequence": "What happens",
      "severity": "RISK"
    },
    "commonMistakes": [
      "Mistake 1 - consequence",
      "Mistake 2 - consequence",
      "Mistake 3 - consequence"
    ],
    "doneWhen": "Verifiable, provable criterion",
    "selfTest": {
      "challenge": "Quick test to prove mastery",
      "passCriteria": "Exactly what proves you're ready"
    },
    "abilities": [
      "Can do X",
      "Can do Y"
    ],
    "milestone": "Achievement unlocked (optional)",
    "duration": 45,
    "timeframe": "Days 1-3",
    "resources": [
      {"type": "video", "title": "Resource name", "searchQuery": "search term", "priority": 1}
    ],
    "microTasks": [
      {
        "order": 1,
        "title": "Watch 'JavaScript Variables Explained' on YouTube",
        "description": "Go to youtube.com, search 'JavaScript variables for beginners 2024'. Watch the first result under 15 min. Pause at each example and type it yourself.",
        "taskType": "LEARN",
        "duration": 12,
        "verificationMethod": "Write down: 1) What is a variable? 2) What's the difference between const, let, and var?",
        "proofRequired": false
      },
      {
        "order": 2,
        "title": "Practice on Replit",
        "description": "Go to replit.com, create a new JavaScript project. Write 5 lines declaring variables: 2 with const, 2 with let, 1 with var. Run to verify no errors.",
        "taskType": "PRACTICE",
        "duration": 8,
        "verificationMethod": "Code runs without errors. You can explain why you chose const vs let for each.",
        "proofRequired": false
      }
    ]
  }
}

Output valid JSON only.`

// ============================================
// PROMPT 6: LOCKED STEPS PREVIEW
// ============================================

export const LOCKED_STEPS_PROMPT = `You are creating GPS-style previews for upcoming steps. Show just enough to build anticipation without revealing full detail.

=== CONTEXT ===
{executionContext}

Current step is step 1. Create previews for steps 2-{totalSteps}.

=== YOUR TASK ===
For each locked step, provide:
1. Title (action-oriented)
2. Phase: NEXT (immediately after current) or LATER (further out)
3. Why after previous: Why this must come after the step before
4. Preview abilities: What they'll be able to do (2-3 items)
5. Milestone: Achievement marker (if applicable)
6. Resources: 1-2 suggested resources

=== LOCKED STEP RULES ===
- NO full method or daily breakdown (that's revealed when unlocked)
- NO detailed time breakdown
- Build curiosity and motivation
- Show the progression clearly

=== OUTPUT FORMAT ===
{
  "lockedSteps": [
    {
      "order": 2,
      "phase": "NEXT",
      "title": "Step 2 title",
      "whyAfterPrevious": "Why this comes after step 1",
      "previewAbilities": ["What you'll do 1", "What you'll do 2"],
      "milestone": "Achievement (optional)",
      "estimatedDuration": 30,
      "resources": [{"type": "exercise", "title": "Resource", "searchQuery": "search term", "priority": 1}]
    },
    {
      "order": 3,
      "phase": "LATER",
      "title": "Step 3 title",
      "whyAfterPrevious": "Why this comes after step 2",
      "previewAbilities": ["Final ability 1", "Final ability 2"],
      "milestone": "Final achievement",
      "estimatedDuration": 30,
      "resources": [{"type": "article", "title": "Resource", "searchQuery": "search term", "priority": 1}]
    }
  ]
}

Output valid JSON only.`

// ============================================
// COMBINED EXECUTION PROMPT (for efficiency)
// ============================================

export const COMBINED_EXECUTION_PROMPT = `You are a world-class instructor creating a professor-level learning roadmap. Create both the current step (full detail) and locked steps (previews) in GPS style.

=== CONTEXT FROM DIAGNOSTIC ===
{diagnosticContext}

=== CONTEXT FROM STRATEGY ===
{strategyContext}

=== ROADMAP REQUIREMENTS ===
Total steps: {totalSteps} (determined by scope and complexity)
Estimated days: {estimatedDays}
Daily commitment: {dailyCommitment}

=== CURRENT STEP (FULL DETAIL) ===

Create Step 1 with COMPLETE professor-level detail:

1. WHY FIRST: Deep explanation of dependency (not "it's foundational")
2. METHOD: Exact daily breakdown with ZERO AMBIGUITY
   - Every instruction must answer: WHAT, WHERE, HOW LONG, HOW TO VERIFY
   - Include specific platform names, URLs, or search terms
   - "Day 1 (15 min): Go to youtube.com, search 'X beginner tutorial'. Watch first 10 min, pause and write 3 key concepts."
   - "Day 2 (10 min): Open replit.com, create new project. Type (don't paste) 5 examples. Run to verify."
3. TIME BREAKDOWN: {daily, total, flexible}
4. RISK: One specific risk with consequence
5. COMMON MISTAKES: 3-5 specific mistakes with consequences
6. DONE WHEN: Verifiable, PROVABLE criterion (not "understand X" but "can do Y without looking")
7. SELF-TEST: Challenge with MEASURABLE pass criteria
8. ABILITIES: Specific capabilities gained (2-4) as "Can DO X" not "Knows X"
9. MICRO-TASKS: 3-5 small IMMEDIATELY ACTIONABLE tasks
   - Each task must include WHERE (platform/site), WHAT (exact action), HOW TO VERIFY (concrete output)
   - GOOD: "Go to codecademy.com/learn/javascript. Complete lessons 1-3 (20 min). Screenshot completion badge."
   - BAD: "Learn JavaScript basics" (WHERE? HOW MUCH? HOW DO I KNOW I'M DONE?)
10. RESOURCES: 1-3 learning resources with SPECIFIC search queries for finding them

THE GOLDEN RULE: If a student reads an instruction and asks "but what exactly do I DO?", you've failed.
- Every instruction must be doable in the NEXT 60 SECONDS without more info
- "Study X" is NEVER acceptable - WHERE? WHAT SPECIFICALLY? FOR HOW LONG?

=== LOCKED STEPS (PREVIEWS ONLY) ===

For steps 2-{totalSteps}, provide GPS-style previews:
- Title (action-oriented)
- Phase: NEXT or LATER
- Why after previous
- Preview abilities (2-3)
- Milestone (if applicable)
- Resources (1-2)

NO full method or daily breakdown for locked steps.

=== OUTPUT FORMAT ===
{
  "title": "Roadmap title",
  "totalSteps": {totalSteps},
  "estimatedDays": {estimatedDays},
  "dailyCommitment": "{dailyCommitment}",
  "totalMinutes": 180,
  "currentStep": {
    "order": 1,
    "phase": "NOW",
    "title": "Action-oriented title",
    "description": "One sentence command",
    "whyFirst": "Deep explanation of dependency",
    "method": "Day 1: ...\\nDay 2: ...",
    "timeBreakdown": {
      "daily": "15 min",
      "total": "45 min",
      "flexible": "Can do 30 min for 2 days"
    },
    "risk": {
      "warning": "Specific risk",
      "consequence": "What happens",
      "severity": "RISK"
    },
    "commonMistakes": ["Mistake 1 - consequence", "Mistake 2 - consequence"],
    "doneWhen": "Verifiable criterion",
    "selfTest": {
      "challenge": "Test",
      "passCriteria": "Pass criteria"
    },
    "abilities": ["Can do X", "Can do Y"],
    "milestone": "Achievement (optional)",
    "duration": 45,
    "timeframe": "Days 1-3",
    "resources": [
      {"type": "video", "title": "Name", "searchQuery": "query", "priority": 1}
    ],
    "microTasks": [
      {
        "order": 1,
        "title": "Task title",
        "description": "Task description",
        "taskType": "LEARN",
        "duration": 10,
        "verificationMethod": "How to verify",
        "proofRequired": false
      }
    ]
  },
  "lockedSteps": [
    {
      "order": 2,
      "phase": "NEXT",
      "title": "Step 2 title",
      "whyAfterPrevious": "Dependency explanation",
      "previewAbilities": ["Ability 1", "Ability 2"],
      "milestone": "Achievement",
      "estimatedDuration": 30,
      "resources": [{"type": "exercise", "title": "Name", "searchQuery": "query", "priority": 1}]
    }
  ],
  "criticalWarning": {
    "warning": "From strategy risk",
    "consequence": "From strategy",
    "severity": "CRITICAL"
  }
}

=== IMPORTANT ===
- Be specific and actionable
- Quality over quantity
- Output valid JSON only`

// ============================================
// RESPONSE FORMAT SCHEMA
// ============================================

export const EXECUTION_RESPONSE_FORMAT = `{
  "title": "string",
  "totalSteps": "number",
  "estimatedDays": "number",
  "dailyCommitment": "string",
  "totalMinutes": "number",
  "currentStep": {
    "order": "number",
    "phase": "NOW",
    "title": "string",
    "description": "string",
    "whyFirst": "string",
    "method": "string",
    "timeBreakdown": {
      "daily": "string",
      "total": "string",
      "flexible": "string"
    },
    "risk": {
      "warning": "string",
      "consequence": "string",
      "severity": "RISK | WARNING"
    },
    "commonMistakes": ["string"],
    "doneWhen": "string",
    "selfTest": {
      "challenge": "string",
      "passCriteria": "string"
    },
    "abilities": ["string"],
    "milestone": "string",
    "duration": "number",
    "timeframe": "string",
    "resources": [{"type": "string", "title": "string", "searchQuery": "string", "priority": "number"}],
    "microTasks": [{
      "order": "number",
      "title": "string",
      "description": "string",
      "taskType": "ACTION | LEARN | PRACTICE | TEST | REFLECT",
      "duration": "number",
      "verificationMethod": "string",
      "proofRequired": "boolean"
    }]
  },
  "lockedSteps": [{
    "order": "number",
    "phase": "NEXT | LATER",
    "title": "string",
    "whyAfterPrevious": "string",
    "previewAbilities": ["string"],
    "milestone": "string",
    "estimatedDuration": "number",
    "resources": [{"type": "string", "title": "string", "searchQuery": "string", "priority": "number"}]
  }],
  "criticalWarning": {
    "warning": "string",
    "consequence": "string",
    "severity": "CRITICAL"
  }
}`

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate optimal step count based on scope and urgency
 */
export function calculateStepCount(diagnostic: DiagnosticResult): number {
  const { scope, urgency } = diagnostic.goal

  // Base count by scope
  let count = 3
  if (scope === 'moderate') count = 4
  if (scope === 'broad') count = 5

  // Adjust by urgency (immediate = fewer, more focused steps)
  if (urgency === 'immediate') count = Math.max(2, count - 1)
  if (urgency === 'long_term') count = Math.min(6, count + 1)

  return count
}

/**
 * Format context for execution prompts
 */
export function formatExecutionContext(
  diagnostic: DiagnosticResult,
  strategy: StrategyResult
): { diagnosticContext: string; strategyContext: string } {
  const diagnosticContext = `
GOAL: ${diagnostic.goal.clarified}
TYPE: ${diagnostic.goal.type}
LEVEL: ${diagnostic.user.inferredLevel}
CRITICAL GAPS: ${diagnostic.gaps.critical.join(', ')}
PRIORITY ORDER: ${diagnostic.gaps.priorityOrder.join(' → ')}
`.trim()

  const strategyContext = `
VISION: ${strategy.transformation.vision}
SUCCESS LOOKS LIKE: ${strategy.success.looksLike}
ABILITIES TO GAIN: ${strategy.success.abilities.join(', ')}
CRITICAL WARNING: ${strategy.risks.critical.warning}
DAILY COMMITMENT: ${strategy.strategy.dailyCommitment}
ESTIMATED DAYS: ${strategy.strategy.estimatedDays}
PACING: ${strategy.strategy.pacing}
MILESTONES: ${strategy.milestones.map(m => m.title).join(' → ')}
`.trim()

  return { diagnosticContext, strategyContext }
}

/**
 * Parse and validate execution response from AI
 */
export function parseExecutionResponse(response: string): ExecutionResult | null {
  try {
    const parsed = JSON.parse(response)

    // Validate required fields
    if (!parsed.currentStep || !parsed.lockedSteps) {
      console.error('[Execution] Missing currentStep or lockedSteps')
      return null
    }

    // Validate currentStep fields
    const cs = parsed.currentStep
    if (!cs.title || !cs.whyFirst || !cs.doneWhen) {
      console.error('[Execution] Missing required currentStep fields')
      return null
    }

    // Ensure arrays exist
    cs.commonMistakes = cs.commonMistakes || []
    cs.abilities = cs.abilities || []
    cs.resources = cs.resources || []
    cs.microTasks = cs.microTasks || []

    // Validate locked steps
    parsed.lockedSteps = parsed.lockedSteps.map((ls: LockedStep) => ({
      ...ls,
      previewAbilities: ls.previewAbilities || [],
      resources: ls.resources || [],
    }))

    return parsed as ExecutionResult
  } catch (error) {
    console.error('[Execution] Failed to parse response:', error)
    return null
  }
}

/**
 * Create fallback execution if AI fails
 */
export function createFallbackExecution(
  diagnostic: DiagnosticResult,
  strategy: StrategyResult
): ExecutionResult {
  const stepCount = calculateStepCount(diagnostic)

  return {
    title: `Master ${diagnostic.goal.clarified}`,
    totalSteps: stepCount,
    estimatedDays: strategy.strategy.estimatedDays,
    dailyCommitment: strategy.strategy.dailyCommitment,
    totalMinutes: strategy.strategy.estimatedDays * 20, // ~20 min/day

    currentStep: {
      order: 1,
      phase: 'NOW',
      title: 'Build Your Foundation',
      description: `Start with the core fundamentals of ${diagnostic.goal.clarified}`,
      whyFirst: 'Every skill builds on fundamentals. Without this foundation, advanced topics won\'t make sense.',
      method: `Day 1 (15 min): Go to youtube.com and search "${diagnostic.goal.clarified} beginner tutorial 2024". Watch the first video under 15 minutes. Pause every 3 minutes and write down one key concept.

Day 2 (15 min): Open a notes app or grab paper. Write down: 1) What is ${diagnostic.goal.clarified}? 2) What are the 3 most important things to know? 3) One example of how it's used.

Day 3 (15 min): Close your notes. Set a 10-minute timer. Write everything you remember about ${diagnostic.goal.clarified}. Then check your notes - what did you miss?`,
      timeBreakdown: {
        daily: '15 min',
        total: '45 min over 3 days',
        flexible: 'Can do 30 min for 2 days instead',
      },
      risk: {
        warning: 'Watching/reading passively without taking notes',
        consequence: 'You\'ll forget 90% within 48 hours and feel like you wasted time',
        severity: 'RISK',
      },
      commonMistakes: [
        'Watching videos at 2x speed without pausing - you feel productive but retain nothing',
        'Not writing notes BY HAND - typing is 40% less effective for memory',
        'Thinking "I get it" without testing yourself - the illusion of understanding',
      ],
      doneWhen: 'You can explain the 3 core concepts of ${diagnostic.goal.clarified} out loud for 2 minutes without looking at notes',
      selfTest: {
        challenge: 'Set a 2-minute timer. Explain ${diagnostic.goal.clarified} out loud as if teaching a friend. Record yourself.',
        passCriteria: 'You spoke for the full 2 minutes without major pauses or looking at notes',
      },
      abilities: [
        'Can define ${diagnostic.goal.clarified} in your own words',
        'Can list 3 key concepts without looking',
        'Can explain one real-world example',
      ],
      milestone: 'Foundation Complete',
      duration: 45,
      timeframe: 'Days 1-3',
      resources: [
        {
          type: 'video',
          title: `${diagnostic.goal.clarified} Beginner Tutorial`,
          searchQuery: `${diagnostic.goal.clarified} beginner tutorial 2024`,
          priority: 1,
        },
      ],
      microTasks: [
        {
          order: 1,
          title: 'Watch a beginner video',
          description: `Go to youtube.com, search "${diagnostic.goal.clarified} beginner tutorial 2024". Pick the first video under 15 min with good reviews. Watch it, pausing every 3 min to write one key concept.`,
          taskType: 'LEARN',
          duration: 15,
          verificationMethod: 'You have written at least 4 key concepts from the video',
          proofRequired: false,
        },
        {
          order: 2,
          title: 'Create structured notes',
          description: 'Open a notes app or grab paper. Write answers to: 1) What is this topic? 2) Three most important things to know. 3) One real example.',
          taskType: 'ACTION',
          duration: 15,
          verificationMethod: 'You have a notes document with all 3 sections filled out',
          proofRequired: false,
        },
        {
          order: 3,
          title: 'Active recall test',
          description: 'Close all notes. Set a 10-min timer. Write everything you remember. Then compare to notes and highlight gaps.',
          taskType: 'TEST',
          duration: 15,
          verificationMethod: 'You identified at least 2 things you forgot and added them to a "review" list',
          proofRequired: false,
        },
      ],
    },

    lockedSteps: Array.from({ length: stepCount - 1 }, (_, i) => ({
      order: i + 2,
      phase: i === 0 ? 'NEXT' as const : 'LATER' as const,
      title: `Step ${i + 2}: ${i === stepCount - 2 ? 'Final Mastery' : 'Build Skills'}`,
      whyAfterPrevious: 'Builds on knowledge from previous step',
      previewAbilities: ['Apply concepts', 'Solve problems independently'],
      milestone: i === stepCount - 2 ? 'Goal Complete' : undefined,
      estimatedDuration: 30,
      resources: [],
    })),

    criticalWarning: {
      warning: strategy.risks.critical.warning,
      consequence: strategy.risks.critical.consequence,
      severity: 'CRITICAL',
    },
  }
}
