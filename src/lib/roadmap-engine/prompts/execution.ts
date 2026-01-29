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
  fakeProgressWarnings: string[] // ELITE: What looks like progress but isn't

  // ELITE: Standards & Bars
  standards: {
    passBar: string // Minimum acceptable level
    failConditions: string[] // What means you need to repeat
    repeatRule: string // When to go back and redo
    qualityCheck: string // How to verify you actually learned
  }

  // Completion
  doneWhen: string // Verifiable criterion
  selfTest: {
    challenge: string
    passCriteria: string
  }

  // ELITE: What Success Feels Like
  successSignals: {
    feelsLike: string // Emotional/sensory experience of success
    behaviorChange: string // How you'll act differently after mastery
    confidenceMarker: string // Specific situation where you'll feel confident
  }

  // Outcomes
  abilities: string[] // What you unlock - capability based
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

export const COMBINED_EXECUTION_PROMPT = `You are an elite private mentor creating a training program that transforms students. This isn't a generic lesson plan - it's exactly what a world-class coach would give their private client.

=== CONTEXT FROM DIAGNOSTIC ===
{diagnosticContext}

=== CONTEXT FROM STRATEGY ===
{strategyContext}

=== ROADMAP REQUIREMENTS ===
Total steps: {totalSteps} (determined by scope and complexity)
Estimated days: {estimatedDays}
Daily commitment: {dailyCommitment}

=== ELITE CONTENT REQUIREMENTS ===
Your content MUST include these elements that separate elite mentorship from generic courses:

1. CAPABILITY-BASED GOALS: "After this step, you can DO X under Y conditions"
   - NOT: "You'll understand variables"
   - YES: "You'll be able to declare, assign, and use variables in 3 different contexts without looking at documentation"

2. EXPLICIT STANDARDS & BARS: Clear pass/fail conditions
   - Pass bar: Minimum acceptable level
   - Fail conditions: What means you need to repeat
   - Repeat rule: When to go back and redo

3. FAKE PROGRESS WARNINGS: What LOOKS like learning but ISN'T
   - "Watching the video without pausing to code is fake progress"
   - "Feeling 'familiar' with code you haven't written yourself is a trap"

4. WHAT SUCCESS FEELS LIKE: Sensory/emotional/behavioral signals
   - NOT: "You'll know more"
   - YES: "When you see a variable declaration in any code, you'll feel a small flash of recognition - not confusion, not 'I think I know this', but certainty. You'll read code the way you read sentences."

=== CURRENT STEP (FULL DETAIL) ===

Create Step 1 with COMPLETE elite mentor-level detail:

1. WHY FIRST: Deep explanation of dependency (not "it's foundational")
   - What BREAKS if they skip this? What becomes 10x harder?

2. METHOD: Exact daily breakdown with ZERO AMBIGUITY
   - Every instruction must answer: WHAT, WHERE, HOW LONG, HOW TO VERIFY
   - Include specific platform names, URLs, or search terms
   - "Day 1 (15 min): Go to youtube.com, search 'X beginner tutorial'. Watch first 10 min, pause and write 3 key concepts."
   - "Day 2 (10 min): Open replit.com, create new project. Type (don't paste) 5 examples. Run to verify."

3. TIME BREAKDOWN: {daily, total, flexible}

4. RISK: One specific risk with consequence

5. COMMON MISTAKES: 3-5 specific mistakes with consequences

6. FAKE PROGRESS WARNINGS: 2-3 things that FEEL productive but AREN'T
   - "Watching tutorials at 2x speed without pausing feels efficient but you retain 20%"
   - "Re-reading your notes instead of testing yourself is comfort, not learning"

7. STANDARDS & BARS (CRITICAL - This is what elite mentors provide):
   - Pass bar: "You pass when you can X without Y"
   - Fail conditions: "You need to repeat if: A, B, or C"
   - Repeat rule: "If you can't pass the self-test in under X minutes, go back to Day 1"
   - Quality check: "Verify by doing X without looking at notes/examples"

8. DONE WHEN: Verifiable, PROVABLE criterion (not "understand X" but "can do Y without looking")

9. SELF-TEST: Challenge with MEASURABLE pass criteria

10. SUCCESS SIGNALS (ELITE - What success FEELS like):
    - Feels like: "You'll feel calm certainty, not anxious doubt"
    - Behavior change: "You'll start noticing X in everyday situations"
    - Confidence marker: "When someone asks about X, you'll feel a small smile - you KNOW this"

11. ABILITIES: Specific capabilities gained (2-4) as "Can DO X under Y conditions" not "Knows X"

12. MICRO-TASKS: 3-5 small IMMEDIATELY ACTIONABLE tasks
    - Each task must include WHERE (platform/site), WHAT (exact action), HOW TO VERIFY (concrete output)
    - GOOD: "Go to codecademy.com/learn/javascript. Complete lessons 1-3 (20 min). Screenshot completion badge."
    - BAD: "Learn JavaScript basics" (WHERE? HOW MUCH? HOW DO I KNOW I'M DONE?)

13. RESOURCES: 1-3 learning resources with SPECIFIC search queries for finding them

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
    "whyFirst": "Deep explanation of dependency - what BREAKS if skipped",
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
    "fakeProgressWarnings": [
      "Watching without coding feels productive but teaches nothing",
      "Re-reading notes instead of testing yourself is fake learning"
    ],
    "standards": {
      "passBar": "You pass when you can X without looking at notes, in under Y minutes",
      "failConditions": ["Can't complete without looking at examples", "Takes more than X minutes", "Makes basic errors"],
      "repeatRule": "If you fail 2+ conditions, go back to Day 1 of this step",
      "qualityCheck": "Close all references. Set a timer. Can you do X?"
    },
    "doneWhen": "Verifiable criterion - specific action you can prove",
    "selfTest": {
      "challenge": "Specific test",
      "passCriteria": "Exact pass criteria with measurable bar"
    },
    "successSignals": {
      "feelsLike": "What success FEELS like emotionally/sensorially",
      "behaviorChange": "How you'll act differently after mastering this",
      "confidenceMarker": "Specific situation where you'll feel confident"
    },
    "abilities": ["Can DO X under Y conditions", "Can DO Z without looking"],
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
        "description": "Task description with WHERE, WHAT, HOW TO VERIFY",
        "taskType": "LEARN",
        "duration": 10,
        "verificationMethod": "Concrete output that proves completion",
        "proofRequired": false
      }
    ]
  },
  "lockedSteps": [
    {
      "order": 2,
      "phase": "NEXT",
      "title": "Step 2 title",
      "whyAfterPrevious": "Why this MUST come after step 1 - the actual dependency",
      "previewAbilities": ["Capability 1", "Capability 2"],
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
- Write like a private mentor who genuinely cares about their transformation
- Be specific and personal - generic advice helps no one
- Include the hard truths - comfort doesn't create competence
- Every element should make them feel "this person SEES me and knows exactly what I need"
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
    "fakeProgressWarnings": ["string"],
    "standards": {
      "passBar": "string",
      "failConditions": ["string"],
      "repeatRule": "string",
      "qualityCheck": "string"
    },
    "doneWhen": "string",
    "selfTest": {
      "challenge": "string",
      "passCriteria": "string"
    },
    "successSignals": {
      "feelsLike": "string",
      "behaviorChange": "string",
      "confidenceMarker": "string"
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
  // Get diagnosis info with safe defaults
  const diagnosis = diagnostic.diagnosis || {
    whyStuck: 'Not diagnosed',
    falseBeliefs: [],
    overFocusing: [],
    neglecting: [],
    rootCause: 'Not diagnosed',
  }

  const diagnosticContext = `
GOAL: ${diagnostic.goal.clarified}
TYPE: ${diagnostic.goal.type}
LEVEL: ${diagnostic.user.inferredLevel}
CRITICAL GAPS: ${diagnostic.gaps.critical.join(', ')}
PRIORITY ORDER: ${diagnostic.gaps.priorityOrder.join(' → ')}

=== WHY THEY'RE STUCK (Use this to make content personal) ===
ROOT CAUSE: ${diagnosis.rootCause}
FALSE BELIEFS: ${diagnosis.falseBeliefs.join('; ') || 'None identified'}
OVER-FOCUSING ON: ${diagnosis.overFocusing.join('; ') || 'None identified'}
NEGLECTING: ${diagnosis.neglecting.join('; ') || 'None identified'}
`.trim()

  // Get new strategy fields with safe defaults
  const identityShift = strategy.transformation.identityShift || {
    oldIdentity: 'Someone learning passively',
    newIdentity: 'Someone who practices actively',
    behaviorChange: 'Active practice over passive consumption',
  }
  const prioritization = strategy.prioritization || {
    focusNow: 'Master the fundamentals',
    ignoreFor: [],
    justification: 'Fundamentals unlock everything',
    sequenceRationale: 'Each step builds on the previous',
  }
  const fakeProgress = strategy.risks.fakeProgress || []
  const feelsLike = strategy.success.feelsLike || 'Confident and capable'

  const strategyContext = `
VISION: ${strategy.transformation.vision}
SUCCESS LOOKS LIKE: ${strategy.success.looksLike}
SUCCESS FEELS LIKE: ${feelsLike}
ABILITIES TO GAIN: ${strategy.success.abilities.join(', ')}

=== IDENTITY SHIFT (Weave this into the content) ===
OLD IDENTITY: ${identityShift.oldIdentity}
NEW IDENTITY: ${identityShift.newIdentity}
BEHAVIOR CHANGE: ${identityShift.behaviorChange}

=== STRONG PRIORITIZATION ===
FOCUS NOW: ${prioritization.focusNow}
IGNORE FOR NOW: ${prioritization.ignoreFor.join(', ') || 'Nothing specific'}
JUSTIFICATION: ${prioritization.justification}
SEQUENCE RATIONALE: ${prioritization.sequenceRationale}

=== WARNINGS ===
CRITICAL WARNING: ${strategy.risks.critical.warning}
FAKE PROGRESS TRAPS: ${fakeProgress.join('; ') || 'None identified'}

=== APPROACH ===
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

    // Ensure new elite fields exist with defaults
    cs.fakeProgressWarnings = cs.fakeProgressWarnings || [
      'Watching without actively practicing',
      'Re-reading notes instead of testing yourself',
    ]

    cs.standards = cs.standards || {
      passBar: 'Complete all tasks and pass the self-test',
      failConditions: ['Cannot complete without looking at notes'],
      repeatRule: 'If you fail, review and try again',
      qualityCheck: 'Can you do this without any help?',
    }

    cs.successSignals = cs.successSignals || {
      feelsLike: 'Calm confidence when facing this topic',
      behaviorChange: 'You\'ll approach similar challenges differently',
      confidenceMarker: 'You can explain this to others without hesitation',
    }

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
      whyFirst: 'Every skill builds on fundamentals. Without this foundation, advanced topics won\'t make sense. Skipping this is why most people give up - they hit a wall of confusion that didn\'t need to exist.',
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
      fakeProgressWarnings: [
        'Watching tutorials without pausing to take notes feels productive but you\'ll retain almost nothing',
        'Re-reading your notes instead of testing yourself from memory - comfort disguised as learning',
        'Feeling "familiar" with the content but unable to explain it without looking - this is the illusion of competence',
      ],
      standards: {
        passBar: 'You can explain the 3 core concepts out loud for 2 minutes without any notes or prompts',
        failConditions: [
          'You pause for more than 5 seconds trying to remember',
          'You need to look at notes more than once',
          'You can\'t give a concrete example for each concept',
        ],
        repeatRule: 'If you fail 2 or more conditions, go back to Day 2 and redo the note-taking exercise with more focus',
        qualityCheck: 'Record yourself explaining the concepts. Play it back. Would someone with zero knowledge understand?',
      },
      doneWhen: 'You can explain the 3 core concepts of ${diagnostic.goal.clarified} out loud for 2 minutes without looking at notes',
      selfTest: {
        challenge: 'Set a 2-minute timer. Explain ${diagnostic.goal.clarified} out loud as if teaching a friend. Record yourself.',
        passCriteria: 'You spoke for the full 2 minutes without major pauses or looking at notes, and covered all 3 core concepts',
      },
      successSignals: {
        feelsLike: 'You\'ll feel a quiet confidence when the topic comes up - not "I think I know this" but genuine certainty. The anxiety of "am I doing this right?" will be replaced by calm clarity.',
        behaviorChange: 'You\'ll start noticing ${diagnostic.goal.clarified} concepts in everyday situations. Your brain will automatically make connections you couldn\'t see before.',
        confidenceMarker: 'When someone asks "what is ${diagnostic.goal.clarified}?" you\'ll feel a small smile form - you KNOW this, deeply, not just surface-level familiarity.',
      },
      abilities: [
        'Can define ${diagnostic.goal.clarified} in your own words without hesitation',
        'Can list 3 key concepts from memory under time pressure',
        'Can explain one real-world example to a complete beginner',
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
