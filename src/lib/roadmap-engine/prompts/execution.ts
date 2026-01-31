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

// ============================================
// LESSON SLIDES (Understanding section - 40% of step)
// Explains the WHY before users do the actions
// ============================================

export interface LessonSlide {
  order: number
  title: string                    // Catchy, clear title for this slide

  // Core content - the explanation
  concept: string                  // Main concept being explained (1 sentence)
  explanation: string              // Clear explanation (2-4 sentences)

  // WHY it matters - critical for understanding
  whyItMatters: string             // Why this matters for their goal
  whatHappensWithout: string       // What fails if they skip this understanding

  // Real-world connection
  realWorldExample: string         // Concrete, specific, relatable example
  analogyOrMetaphor?: string       // Simple analogy to help it click

  // Visual/Memory aid
  visualHint?: string              // Emoji or simple visual cue
  keyTakeaway: string              // One sentence to remember (quotable)
}

export interface StepLesson {
  // Lesson metadata
  title: string                    // "Understanding [Topic]" or "Why [Concept] Matters"
  subtitle?: string                // Hook that makes them want to learn
  duration: number                 // Total lesson time in minutes (5-15 min)

  // The slides (2-4 per step)
  slides: LessonSlide[]

  // Resources that support the lesson
  resources?: StepResource[]       // Videos, articles that explain concepts

  // Quiz/check before moving to actions
  understandingCheck?: {
    question: string               // "Before moving on, can you explain..."
    correctAnswer: string          // What a good answer looks like
    hint?: string                  // Help if they're stuck
  }

  // Bridge to the doing section
  bridgeToActions: string          // "Now that you understand X, let's put it into practice by..."
}

export interface StepResource {
  type: 'video' | 'article' | 'exercise' | 'tool' | 'book'
  title: string
  description?: string
  searchQuery: string
  priority: number
}

export interface TodaysFocus {
  action: string // Single clear action
  where: string // Specific URL or platform
  duration: string // "~X min"
  output: string // What they'll have when done
}

export interface CommonTrap {
  temptation: string // What they'll be tempted to do
  whyItFeelsRight: string // Why this feels productive
  whyItFails: string // What actually happens
  betterApproach: string // What to do instead
}

export interface SuccessSignals {
  feelsLike: string // Warm description of what success feels like
  youllKnow: string // "You'll know you're ready when..."
}

export interface CurrentStep {
  order: number
  phase: 'NOW'
  title: string
  description: string

  // ============================================
  // LESSON SECTION (Understanding - 40%)
  // User must complete lesson before actions unlock
  // ============================================
  lesson?: StepLesson

  // ============================================
  // ACTION SECTION (Doing - 60%)
  // Specific, detailed tasks to do
  // ============================================

  // NEW: Today's Focus (most prominent action)
  todaysFocus: TodaysFocus

  // NEW: Personalized why
  whyThisMattersForYou: string

  // NEW: Exit conditions (checkboxes)
  exitConditions: string[]

  // NEW: Common trap (warm mentor voice)
  commonTrap: CommonTrap

  // Method - detailed day-by-day actions
  method: string // Day-by-day breakdown with WHERE, WHAT, HOW LONG
  timeBreakdown: {
    daily: string
    total: string
    flexible: string
  }

  // Success signals (warm)
  successSignals: SuccessSignals

  // Outcomes
  abilities: string[] // What you unlock - capability based
  milestone?: string // Achievement marker

  // Time
  duration: number // Total minutes for step
  timeframe: string // "Days 1-3"

  // Resources (platforms, tools, videos, articles)
  resources: StepResource[]

  // Encouragement
  encouragement?: string

  // ============================================
  // RISK & QUALITY (Transparency)
  // ============================================
  risk?: {
    warning: string
    consequence: string
    severity: 'RISK' | 'WARNING'
  }
  commonMistakes?: string[]
  fakeProgressWarnings?: string[]
  standards?: {
    passBar: string
    failConditions: string[]
    repeatRule: string
    qualityCheck: string
  }

  // Legacy fields (for backwards compatibility)
  whyFirst?: string
  doneWhen?: string
  selfTest?: {
    challenge: string
    passCriteria: string
  }
  microTasks?: MicroTask[]
}

export interface LockedStep {
  order: number
  phase: 'NEXT' | 'LATER'
  title: string
  whyAfterPrevious: string
  previewAbilities: string[]
  teaser?: string // One sentence that makes them look forward to this
  milestone?: string
  estimatedDuration?: number
  resources: StepResource[]
}

export interface RoadmapVision {
  // The big picture - where they're going
  destination: string          // "By the end, you'll be able to..."
  transformation: string       // Who they become (identity shift)
  timeframe: string           // "In X weeks/days"

  // The journey overview
  phases: {
    name: string              // "Foundation", "Building", "Mastery"
    description: string       // What this phase accomplishes
    stepsIncluded: number[]   // Which step numbers [1, 2, 3]
  }[]

  // What's NOT in this roadmap (clarity)
  outOfScope: string[]        // "This roadmap doesn't cover..."

  // Success preview
  successPreview: string      // "Imagine being able to..."
}

export interface ExecutionResult {
  // Roadmap metadata
  title: string
  totalSteps: number
  estimatedDays: number
  dailyCommitment: string
  totalMinutes: number

  // NEW: Clear vision section at the top
  vision?: RoadmapVision

  // NEW: Personalized intro
  personalizedIntro?: string

  // Steps
  currentStep: CurrentStep
  lockedSteps: LockedStep[]

  // Critical warning (carried from strategy)
  criticalWarning: {
    warning: string
    consequence: string
    prevention?: string
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

export const COMBINED_EXECUTION_PROMPT = `You are a SENIOR EXPERT and professional mentor creating a COMPREHENSIVE learning roadmap. This is NOT a baby-steps tutorial - this is a PROFESSIONAL training program like what you'd find at top universities, coding bootcamps, or professional development programs.

=== CONTEXT FROM DIAGNOSTIC ===
{diagnosticContext}

=== CONTEXT FROM STRATEGY ===
{strategyContext}

=== USER PROFILE ===
{userProfile}

=== ROADMAP REQUIREMENTS ===
Total steps: {totalSteps} (this is a comprehensive journey, not a brief overview)
Estimated days: {estimatedDays}
Daily commitment: {dailyCommitment}

IMPORTANT: Create ALL {totalSteps} steps. Each step should be meaningful and actionable.
The roadmap must feel complete and comprehensive - not rushed or abbreviated.

=== CRITICAL: PROFESSIONAL QUALITY STANDARD ===

This roadmap is for SERIOUS learners - college students, professionals, high schoolers preparing for careers.
NOT for children. NOT a "baby steps" tutorial. Content must be:

1. SUBSTANTIAL: Each step should have real depth, not just "Day 1: watch video, Day 2: practice"
2. PROFESSIONAL: Use industry-standard terminology, real tools, actual platforms used by professionals
3. REALISTIC TIME: Time estimates must reflect ACTUAL work required:
   - Learning a programming concept: 1-3 hours (not 15 minutes)
   - Building a small project: 2-5 hours
   - Mastering a framework: 10-20 hours
   - Research and reading: 30-60 minutes per session
4. COMPREHENSIVE: Cover the topic thoroughly, not superficially
5. VISION-DRIVEN: Every step should show HOW it connects to the end goal

=== TIME ESTIMATE RULES (CRITICAL) ===

DO NOT use arbitrary times like "15 min, 35 min, 20 min per day"
INSTEAD, estimate based on ACTUAL WORK PROCESS:

For LEARNING tasks:
- Reading documentation: 30-60 min per major topic
- Watching tutorials: Match the video length + 50% for notes/practice
- Studying concepts: 1-2 hours per concept to really understand

For DOING tasks:
- Setting up environment: 30-90 min (includes troubleshooting)
- First project: 2-4 hours (more for complex topics)
- Practice exercises: 45-90 min per session
- Building something real: 3-8 hours depending on scope

For MASTERY tasks:
- Multiple practice sessions over days/weeks, not one 15-min session
- Real projects that take sustained effort
- Spaced repetition for retention

EXAMPLE - BAD (arbitrary, childish):
"Day 1: Watch video (15 min) ✓
 Day 2: Practice basics (20 min) ✓
 Day 3: Build something (35 min) ✓"

EXAMPLE - GOOD (realistic, professional):
"Phase 1: Core Concepts (4-6 hours total)
 - Study the fundamentals through official documentation (2 hours)
 - Complete the interactive tutorial at [platform] (1.5 hours)
 - Practice with 10 guided exercises (1-2 hours)

 Phase 2: First Real Project (3-5 hours)
 - Plan your project structure (30 min)
 - Build the core functionality (2-3 hours)
 - Debug and refine (1-2 hours)"

=== YOUR VOICE & TONE ===
Write like a senior professional mentor - knowledgeable, supportive, but NOT condescending.
- Treat them as a capable adult learner
- Reference professional context (industry, career, real applications)
- Be honest about difficulty - don't oversimplify
- Give them credit for taking on a serious learning goal

=== VISION SECTION (CRITICAL - This goes at the TOP) ===

Create a CLEAR, COMPELLING VISION:
1. DESTINATION: Specific professional outcome - what they can DO in the real world
2. TRANSFORMATION: From [current state] to [professional identity]
3. TIMEFRAME: Realistic - based on actual learning science, not arbitrary days
4. PHASES: Group into meaningful learning stages:
   - Phase 1: Foundation (understanding core concepts)
   - Phase 2: Application (hands-on practice)
   - Phase 3: Mastery (real-world projects, professional skills)
5. OUT OF SCOPE: What this roadmap doesn't cover (so they're not disappointed)
6. SUCCESS PREVIEW: "You'll be able to [professional capability]..."

=== STEP STRUCTURE (Each step MUST follow this format) ===

WHAT: Professional, action-oriented title
- Use professional language: "Master", "Build", "Implement", "Configure", "Design"
- NOT childish: "Learn about", "Get to know", "Start with"
- Title should reflect real professional skill

WHY: Clear vision for THIS specific step
- How this step connects to the overall goal
- What becomes possible AFTER completing this step
- Professional context: "This is how developers/professionals do it"

HOW: Comprehensive method with REAL work process
- Structure by PHASES or SESSIONS, not arbitrary "Day 1, Day 2"
- Include ACTUAL TOOLS professionals use (VSCode, GitHub, Figma, industry platforms)
- Include REALISTIC time based on actual work:
  * "Study session (45-60 min): Read official docs sections 1-3"
  * "Practice session (90 min): Complete 5 exercises, debug your solutions"
  * "Project work (2-3 hours): Build and test your first component"

EXAMPLE - GOOD METHOD FORMAT:
"=== Session 1: Understanding the Fundamentals (60-90 min) ===
1. Read the official documentation sections on [topic] (30 min)
2. Watch the recommended deep-dive tutorial (20 min)
3. Take notes on key concepts using YOUR OWN WORDS

=== Session 2: Hands-on Practice (90-120 min) ===
1. Set up your development environment using [tool] (15 min)
2. Complete exercises 1-5 on [platform] (45 min)
3. Debug any errors - this is where real learning happens (30+ min)

=== Session 3: Apply to Real Scenario (2+ hours) ===
1. Choose a mini-project that interests you
2. Plan your approach (15 min)
3. Build it step by step, referring to docs as needed
4. Test and refine until it works"

DONE: Professional-level verification
- NOT: "Understand X"
- YES: "Can implement X from scratch without reference"
- YES: "Can explain X to a colleague and answer questions"
- YES: "Can debug common issues with X independently"

=== CONTENT STRUCTURE PER STEP ===

CRITICAL: Each step has TWO main sections:
1. LESSON (Understanding - 40% of time) - Explains WHY, builds mental model
2. ACTIONS (Doing - 60% of time) - Substantial tasks with professional tools

User flow: Lesson slides → Understanding check → Actions unlock → Do tasks → Exit check

=== LESSON SECTION (Understanding - 40%) ===

The lesson explains WHY and HOW at a PROFESSIONAL level:
- Not dumbed-down explanations
- Real technical/professional context
- How professionals actually think about this
- Industry best practices and standards

Create 2-4 SLIDES per step:

SLIDE STRUCTURE:
1. CONCEPT: Professional-level explanation (not oversimplified)
2. EXPLANATION: Technical but accessible - assume intelligent adult learner
3. WHY IT MATTERS: Professional/career context
   - "In real projects, this matters because..."
   - "Professionals use this to solve..."
   - "This is fundamental to [career goal] because..."
4. WHAT HAPPENS WITHOUT: Real consequences in professional context
   - "Without this, your code will..."
   - "Teams that skip this often face..."
5. REAL-WORLD EXAMPLE: Industry examples, not toy examples
   - Reference real companies, products, or projects when relevant
   - "This is how Netflix handles...", "Developers at Google..."
6. KEY TAKEAWAY: Professional principle to remember

LESSON QUALITY RULES:
- Use PROPER TERMINOLOGY with clear explanations
- Reference INDUSTRY STANDARDS and best practices
- Include REAL TOOLS professionals use (not just toy examples)
- Each slide builds toward professional competence
- End with: "Now you understand WHY professionals do X. Let's learn to do it yourself..."

UNDERSTANDING CHECK:
- "Can you explain [concept] as if you were in a job interview?"
- "What would you say if a colleague asked about [topic]?"
- Include what a PROFESSIONAL answer looks like

=== ACTION SECTION (Doing - 60%) ===

After the lesson, SUBSTANTIAL hands-on work:

1. PRIMARY OBJECTIVE (What this step accomplishes)
   - Clear deliverable or skill to acquire
   - Professional context: "After this, you'll be able to..."
   - Realistic scope - not trivial, not overwhelming

2. TODAY'S FOCUS (First action to take)
   - Specific platform/tool to use (professional tools, not toy sites)
   - Realistic time estimate based on actual work
   - Clear output: code file, document, completed exercise
   - Examples of GOOD resources:
     * Official documentation (docs.python.org, developer.mozilla.org)
     * Professional platforms (GitHub, Coursera, LinkedIn Learning, freeCodeCamp)
     * Industry-standard tools (VSCode, Figma, Notion, real IDEs)

3. COMPLETE WORK PROCESS (Not arbitrary days)
   - Structure by LEARNING PHASES or WORK SESSIONS
   - Each session has realistic duration (45 min to 2+ hours)
   - Include what SUCCESS looks like for each session
   - Example:
     "Session 1 - Foundation (1-1.5 hours):
      → Read sections 1-3 of official docs
      → Complete the quick-start tutorial
      → Checkpoint: You can set up a basic project

      Session 2 - Practice (1.5-2 hours):
      → Complete exercises 1-10 on [platform]
      → Debug your solutions (expect to spend time here)
      → Checkpoint: You can solve basic problems independently

      Session 3 - Application (2-3 hours):
      → Build a mini-project using what you learned
      → Reference docs as needed (this is normal!)
      → Checkpoint: Working project you can demo"

4. EXIT CONDITIONS (Professional verification)
   - 3-5 criteria that prove professional competence
   - NOT: "Feel comfortable with X"
   - YES: "Can implement X from scratch in under 30 minutes"
   - YES: "Can explain X in a technical interview"
   - YES: "Can debug common X errors independently"

5. COMMON MISTAKES (Professional perspective)
   - What junior developers/learners commonly do wrong
   - Professional consequence of this mistake
   - What experienced practitioners do instead
   - Mentor voice: "I've seen many people..."

6. RESOURCES (Professional-grade)
   - 2-4 resources professionals actually use
   - Official documentation FIRST (not random tutorials)
   - Industry platforms (Coursera, Udemy pro courses, official tutorials)
   - Open source projects to learn from
   - Include search queries for finding specific content

=== QUALITY REQUIREMENTS (CRITICAL - Read This Carefully) ===

PROFESSIONAL QUALITY STANDARD:
This roadmap will be used by college students, professionals, and serious learners.
Content must meet PROFESSIONAL education standards:

1. DEPTH: Cover topics thoroughly, not superficially
   - BAD: "Learn about variables" (what does this even mean?)
   - GOOD: "Master JavaScript variable declaration, scoping rules, and hoisting behavior"

2. ACCURACY: Use correct technical terminology
   - BAD: "Make the thing work"
   - GOOD: "Configure the development environment and verify the build process"

3. COMPLETENESS: Include the full picture
   - Why this matters professionally
   - How it connects to real-world work
   - What mistakes to avoid
   - How to verify mastery

4. REALISTIC EXPECTATIONS: Time estimates based on actual work
   - NOT: "Day 1: 15 min, Day 2: 20 min" (arbitrary and unrealistic)
   - YES: "Study session: 1-2 hours, Practice: 90 min, Project: 3-4 hours"

=== CONTEXT-AWARE ADAPTATION ===

Adapt to the user's level WITHOUT dumbing down:

BEGINNER:
- More explanation of WHY, not less content
- More examples, but REAL examples (not childish ones)
- More checkpoints to verify understanding
- Still professional language, just more explanation

INTERMEDIATE:
- Skip basic explanations, get to practical application
- Focus on common pitfalls and professional practices
- Include more advanced techniques and optimizations

ADVANCED:
- Focus on edge cases, performance, architecture
- Reference advanced resources and research
- Challenge them with complex scenarios

LIMITED TIME:
- Prioritize essentials, but don't cut depth
- Suggest focused deep dives over surface-level breadth
- "If you only have 1 hour, focus on X because..."

=== PERSONALIZATION WITHOUT BEING CONDESCENDING ===

Good personalization:
- "Given your goal of [X], this step is crucial because..."
- "Since you're working with [time constraint], I've prioritized..."
- "Building on your background in [Y], we can skip..."

Bad personalization (too childish):
- "Great job! You're doing amazing!"
- "Don't worry, this is easy!"
- "You've got this! Just believe in yourself!"

Treat them as capable adults who want real information, not cheerleading.

=== ACTIONABILITY STANDARD ===

Every instruction must pass this test:
- Can they start in the next 60 seconds?
- Do they know exactly where to go?
- Do they know exactly what to do?
- Do they know what "done" looks like?

=== PERSONALIZATION MARKERS ===

Content should feel like it was written FOR THEM:
- Reference their time constraints by name
- Reference their specific goal
- Reference their level explicitly
- "Because you're a beginner..." or "Since you have limited time..."
- Make them feel SEEN, not like they got a generic template

=== WARMTH WITHOUT FLUFF ===

Content should feel human but efficient:
- Acknowledge that learning is hard (briefly)
- Normalize struggle (don't dwell)
- Celebrate small wins (naturally)
- Be honest but kind about challenges
- Sound like a mentor, not a textbook

=== EXIT CONDITIONS STANDARD ===

Must be specific and provable:
- NOT: "Understand variables"
- YES: "Can declare 5 different variables from memory in under 2 minutes"
- NOT: "Feel comfortable with loops"
- YES: "Can write a for loop that prints 1-10 without looking at examples"

=== CURRENT STEP (FULL PROFESSIONAL DETAIL) ===

Create Step 1 with PROFESSIONAL depth - this is a comprehensive learning step, not a quick task:

1. PRIMARY OBJECTIVE (What this step accomplishes)
   - Clear professional outcome
   - How this connects to their career/learning goal
   - "After this step, you'll be able to [professional capability]"

2. TODAY'S FOCUS (First action to take)
   - Specific professional resource or platform
   - Realistic time: 45-90 min for study, 1-3 hours for practice
   - Clear output: notes, code, completed exercises
   - Example: "Read chapters 1-2 of the official documentation (45 min), then complete the quick-start tutorial (30 min)"

3. COMPREHENSIVE METHOD (Structured work process, NOT arbitrary days)
   Format by SESSIONS or PHASES:

   "=== Session 1: Foundation (1-1.5 hours) ===
   1. Read the official getting-started guide (30 min)
   2. Set up your development environment (20-40 min, includes troubleshooting)
   3. Verify setup by running the example project
   Checkpoint: Environment is working, you can run basic examples

   === Session 2: Core Concepts (1.5-2 hours) ===
   1. Study core concepts through official docs + recommended video
   2. Take notes on key principles - write in your own words
   3. Complete 5-10 guided practice exercises
   Checkpoint: Can explain core concepts without reference

   === Session 3: Apply & Build (2-3 hours) ===
   1. Choose a small project that interests you
   2. Plan your approach (15 min)
   3. Build it step by step, referring to docs as needed
   4. Debug issues - this is where real learning happens
   Checkpoint: Working mini-project you can demo"

4. EXIT CONDITIONS (Professional verification)
   - 3-5 criteria that prove professional competence
   - "Can implement [X] from scratch without reference material"
   - "Can explain [Y] as if in a technical interview"
   - "Can debug common [Z] issues independently"
   - "Can make informed decisions about when to use [approach]"

5. COMMON PROFESSIONAL MISTAKE
   - What junior developers/learners commonly do wrong
   - Why this mistake costs time in the long run
   - What experienced practitioners do instead
   - Professional context: "In real teams, this leads to..."

6. RESOURCES (Professional-grade, prioritized)
   - Official documentation FIRST (most reliable)
   - Recommended course or video series (specific, not generic)
   - Practice platform with real exercises
   - Open source projects to study

7. SUCCESS SIGNALS (Professional confidence)
   - "You'll know you've mastered this when..."
   - Reference professional scenarios: job interview, code review, team discussion
   - Internal confidence vs just familiarity

8. ABILITIES UNLOCKED (Professional capabilities)
   - 3-4 things they can NOW DO professionally
   - "Can build [type of project] independently"
   - "Can contribute to [type of team/project]"
   - "Can make informed architectural decisions about [topic]"

THE PROFESSIONAL STANDARD:
- Content should be suitable for college curriculum or professional training
- Time estimates match actual work (not arbitrary "15 min/day")
- Treat them as intelligent adults pursuing real skills
- Every element moves them toward professional competence

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
  "title": "Professional, descriptive title (e.g., 'Complete Guide to [Topic]')",
  "totalSteps": {totalSteps},
  "estimatedDays": {estimatedDays},
  "dailyCommitment": "{dailyCommitment}",
  "totalMinutes": 600,

  "vision": {
    "destination": "By the end, you'll be able to [specific professional capability] with confidence",
    "transformation": "You'll go from [current state] to someone who can [professional identity]",
    "timeframe": "Approximately X weeks with dedicated study sessions",
    "phases": [
      {"name": "Foundation", "description": "Master core concepts and set up your environment", "stepsIncluded": [1, 2, 3]},
      {"name": "Application", "description": "Build skills through hands-on practice", "stepsIncluded": [4, 5, 6]},
      {"name": "Mastery", "description": "Real projects and professional-level work", "stepsIncluded": [7, 8]}
    ],
    "outOfScope": ["Advanced topic 1 (covered in follow-up)", "Specialized area 2"],
    "successPreview": "You'll be able to [professional scenario] with confidence and competence..."
  },

  "personalizedIntro": "Professional, personalized intro acknowledging their specific goal and context.",
  "currentStep": {
    "order": 1,
    "phase": "NOW",
    "title": "Master the Core Fundamentals",
    "description": "Build a solid foundation with the essential concepts professionals use daily.",

    "lesson": {
      "title": "Understanding [Topic]: The Foundation Professionals Build On",
      "subtitle": "Why this matters for your career and long-term success",
      "duration": 30,
      "slides": [
        {
          "order": 1,
          "title": "What [Topic] Really Is (Professional Context)",
          "concept": "Clear technical definition with professional context",
          "explanation": "Technical but accessible explanation. How professionals think about this. Why it exists and what problems it solves.",
          "whyItMatters": "Professional context: 'In real development teams, this is crucial because...'",
          "whatHappensWithout": "Real consequences: code quality issues, team problems, career impact",
          "realWorldExample": "Industry example: 'Companies like Netflix/Google handle this by...'",
          "visualHint": "diagram or concept visualization",
          "keyTakeaway": "Professional principle to remember"
        },
        {
          "order": 2,
          "title": "Core Principles That Guide Professional Practice",
          "concept": "Key principle stated clearly",
          "explanation": "Why this principle matters, how it applies in practice",
          "whyItMatters": "Career relevance: job interviews, code reviews, team work",
          "whatHappensWithout": "What goes wrong when this is ignored",
          "realWorldExample": "Real project example",
          "keyTakeaway": "Key professional insight"
        }
      ],
      "resources": [
        {"type": "article", "title": "Official Documentation - Getting Started", "description": "The authoritative source", "searchQuery": "[topic] official documentation getting started", "priority": 1}
      ],
      "understandingCheck": {
        "question": "How would you explain [concept] in a job interview?",
        "correctAnswer": "A strong answer includes: [technical accuracy], [practical application], [why it matters]",
        "hint": "Think about what an interviewer is really asking: can you apply this?"
      },
      "bridgeToActions": "Now that you understand WHY professionals value this, let's develop your hands-on skills..."
    },

    "todaysFocus": {
      "action": "Read the official getting-started guide and complete the interactive tutorial",
      "where": "Official documentation site (e.g., docs.python.org, developer.mozilla.org)",
      "duration": "60-90 min",
      "output": "Working development environment + notes on key concepts"
    },

    "whyThisMattersForYou": "Given your goal of [specific goal], mastering these fundamentals now prevents frustration later. This is exactly what hiring managers look for.",

    "exitConditions": [
      "Can set up a project from scratch without referring to documentation",
      "Can explain the core concepts in a technical interview",
      "Can identify and fix basic errors independently",
      "Can make informed decisions about when to use different approaches"
    ],

    "commonTrap": {
      "temptation": "Skipping the official docs to watch random YouTube tutorials",
      "whyItFeelsRight": "Videos feel easier and faster than reading documentation",
      "whyItFails": "Random tutorials often teach outdated practices or skip crucial context. Official docs are what professionals actually use.",
      "betterApproach": "Start with official docs for accuracy, supplement with videos for visual explanation of specific concepts"
    },

    "method": "=== Session 1: Foundation (60-90 min) ===\\n1. Read official getting-started guide (30 min)\\n2. Complete the interactive tutorial (30 min)\\n3. Set up your development environment\\nCheckpoint: Environment works, can run examples\\n\\n=== Session 2: Core Practice (90-120 min) ===\\n1. Complete guided exercises 1-10 (60 min)\\n2. Debug any issues (30 min)\\n3. Review and take notes on key concepts\\nCheckpoint: Can solve basic problems without help\\n\\n=== Session 3: Application (2-3 hours) ===\\n1. Choose a mini-project\\n2. Plan your approach (15 min)\\n3. Build and test (remaining time)\\nCheckpoint: Working project you can demo",
    "timeBreakdown": {
      "daily": "1-2 hours per session",
      "total": "5-7 hours across 3 sessions",
      "flexible": "Can spread over 1-2 weeks based on schedule"
    },

    "successSignals": {
      "feelsLike": "Confident clarity when discussing the topic - you know you understand it, not just recognize it",
      "youllKnow": "You can build something from scratch without constantly checking documentation"
    },

    "abilities": ["Can build basic projects from scratch", "Can explain concepts in technical discussions", "Can debug common issues independently", "Can make informed architectural decisions"],
    "milestone": "Foundation Complete - Ready for Advanced Topics",
    "duration": 360,
    "timeframe": "3-5 sessions over 1-2 weeks",

    "resources": [
      {"type": "article", "title": "Official Documentation", "description": "The authoritative source - professionals use this daily", "searchQuery": "[topic] official documentation", "priority": 1},
      {"type": "video", "title": "Comprehensive Video Course", "description": "Visual explanation of core concepts", "searchQuery": "[topic] complete course [current year]", "priority": 2},
      {"type": "exercise", "title": "Interactive Practice Platform", "description": "Hands-on coding exercises", "searchQuery": "[topic] practice exercises online", "priority": 3}
    ],

    "encouragement": "This is substantial work - that's intentional. You're building real professional skills, not just checking boxes."
  },
  "lockedSteps": [
    {
      "order": 2,
      "phase": "NEXT",
      "title": "Build Your First Real Project",
      "whyAfterPrevious": "With the fundamentals solid, you're ready to apply them to something real",
      "previewAbilities": ["Design and implement a complete project", "Debug complex issues", "Make professional-quality code"],
      "teaser": "This is where theory becomes practical skill you can show employers",
      "milestone": "First Project Complete",
      "estimatedDuration": 300,
      "resources": [{"type": "exercise", "title": "Project-Based Tutorial", "searchQuery": "[topic] build project tutorial", "priority": 1}]
    }
  ],
  "criticalWarning": {
    "warning": "Important thing to avoid - stated with care, not fear",
    "consequence": "What happens if ignored",
    "prevention": "How to avoid this",
    "severity": "CRITICAL"
  }
}

=== VOICE CHECK ===
Before outputting, verify your content:
1. Does it feel like a supportive friend/mentor wrote it? (not a robot)
2. Does it reference their specific situation? (not generic)
3. Is every instruction actionable in 60 seconds? (not vague)
4. Would they feel encouraged, not overwhelmed? (not scary)
5. Are exit conditions specific and provable? (not "understand")

=== IMPORTANT ===
- Write like a mentor who genuinely cares - warm but honest
- Make them feel SEEN - reference their profile, time, goals
- Keep it achievable - don't overwhelm with too much detail
- Every element should make them think "this was made for ME"
- Balance encouragement with honesty - no fake cheerleading
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

  // IMPROVED: More steps for deeper, more comprehensive roadmaps
  // Users need enough content to actually learn, not just a brief overview

  // Base count by scope - INCREASED for better depth
  let count = 6  // Minimum 6 steps for meaningful learning
  if (scope === 'moderate') count = 8
  if (scope === 'broad') count = 10

  // Adjust by urgency
  // immediate = focused but still comprehensive (min 5 steps)
  // long_term = full detailed journey (up to 12 steps)
  if (urgency === 'immediate') count = Math.max(5, count - 1)
  if (urgency === 'long_term') count = Math.min(12, count + 2)

  return count
}

/**
 * Format user profile for personalization
 */
export function formatUserProfile(
  diagnostic: DiagnosticResult,
  dailyCommitment?: string
): string {
  const user = diagnostic.user
  const goal = diagnostic.goal

  return `
=== WHO YOU'RE WRITING FOR ===
Level: ${user.inferredLevel}
Goal: ${goal.clarified}
Goal type: ${goal.type}
Urgency: ${goal.urgency}
Time available: ${dailyCommitment || '15-20 min/day'}
Context: ${user.context}
Constraints: ${user.constraints.join(', ') || 'None specified'}
Prior knowledge: ${user.priorKnowledge.join(', ') || 'Starting fresh'}

=== PERSONALIZATION REQUIREMENTS (CRITICAL) ===
You MUST reference the user's specific situation. Generic content is unacceptable.

REQUIRED PERSONALIZATION PHRASES (use at least 2-3):
- "Since you have ${dailyCommitment || '15-20 min/day'}..."
- "Because you're a ${user.inferredLevel}..."
- "Given that you want to ${goal.clarified}..."
- "With your ${goal.urgency === 'immediate' ? 'tight timeline' : 'flexible schedule'}..."
${user.constraints.length > 0 ? `- "Working around ${user.constraints[0]}..."` : ''}
${user.priorKnowledge.length > 0 ? `- "Building on your knowledge of ${user.priorKnowledge[0]}..."` : ''}

LEVEL-SPECIFIC TONE:
${user.inferredLevel === 'beginner' ? '- Be extra encouraging, explain jargon, celebrate small wins' : ''}
${user.inferredLevel === 'intermediate' ? '- Skip basics, focus on practical application, challenge them a bit' : ''}
${user.inferredLevel === 'advanced' ? '- Be direct, assume competence, focus on nuance and edge cases' : ''}

TIME-SPECIFIC PACING:
${dailyCommitment?.includes('5') || dailyCommitment?.includes('10') ? '- Ultra-short sessions: one concept per day, no overwhelm' : ''}
${dailyCommitment?.includes('15') || dailyCommitment?.includes('20') ? '- Short sessions: focused learning, clear stopping points' : ''}
${dailyCommitment?.includes('30') || dailyCommitment?.includes('45') || dailyCommitment?.includes('60') ? '- Longer sessions: deeper dives possible, include practice time' : ''}
`.trim()
}

/**
 * Format context for execution prompts
 */
export function formatExecutionContext(
  diagnostic: DiagnosticResult,
  strategy: StrategyResult,
  dailyCommitment?: string
): { diagnosticContext: string; strategyContext: string; userProfile: string } {
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

  const userProfile = formatUserProfile(diagnostic, dailyCommitment)

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

  return { diagnosticContext, strategyContext, userProfile }
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
    if (!cs.title) {
      console.error('[Execution] Missing required currentStep title')
      return null
    }

    // Ensure arrays exist
    cs.abilities = cs.abilities || []
    cs.resources = cs.resources || []
    cs.exitConditions = cs.exitConditions || []

    // NEW: Ensure todaysFocus exists with defaults
    cs.todaysFocus = cs.todaysFocus || {
      action: cs.description || 'Start learning the fundamentals',
      where: 'YouTube or your preferred learning platform',
      duration: '~15 min',
      output: 'Notes on key concepts',
    }

    // NEW: Ensure whyThisMattersForYou exists
    cs.whyThisMattersForYou = cs.whyThisMattersForYou || cs.whyFirst || 'This step builds the foundation for everything that follows.'

    // NEW: Ensure exitConditions exist (convert from legacy if needed)
    if (cs.exitConditions.length === 0) {
      if (cs.doneWhen) {
        cs.exitConditions = [cs.doneWhen]
      } else if (cs.selfTest?.passCriteria) {
        cs.exitConditions = [cs.selfTest.passCriteria]
      } else {
        cs.exitConditions = ['Can explain the core concept in your own words']
      }
    }

    // NEW: Ensure commonTrap exists (convert from legacy if needed)
    cs.commonTrap = cs.commonTrap || {
      temptation: cs.commonMistakes?.[0] || 'Moving too fast without practicing',
      whyItFeelsRight: 'It feels like you\'re making progress',
      whyItFails: 'You\'ll forget most of it without active practice',
      betterApproach: 'Pause and practice after each new concept',
    }

    // NEW: Ensure successSignals in new format
    cs.successSignals = cs.successSignals || {}
    cs.successSignals.feelsLike = cs.successSignals.feelsLike || 'Calm confidence when the topic comes up'
    cs.successSignals.youllKnow = cs.successSignals.youllKnow || cs.successSignals.confidenceMarker || 'You can explain it without hesitation'

    // NEW: Validate lesson structure if present
    if (cs.lesson) {
      cs.lesson.slides = cs.lesson.slides || []
      cs.lesson.resources = cs.lesson.resources || []
      cs.lesson.duration = cs.lesson.duration || 10

      // Ensure each slide has required fields
      cs.lesson.slides = cs.lesson.slides.map((slide: LessonSlide, index: number) => ({
        order: slide.order || index + 1,
        title: slide.title || `Concept ${index + 1}`,
        concept: slide.concept || '',
        explanation: slide.explanation || '',
        whyItMatters: slide.whyItMatters || '',
        whatHappensWithout: slide.whatHappensWithout || '',
        realWorldExample: slide.realWorldExample || '',
        visualHint: slide.visualHint,
        keyTakeaway: slide.keyTakeaway || '',
      }))
    }

    // Legacy field defaults for backwards compatibility
    cs.commonMistakes = cs.commonMistakes || []
    cs.microTasks = cs.microTasks || []
    cs.fakeProgressWarnings = cs.fakeProgressWarnings || []

    // Validate locked steps
    parsed.lockedSteps = parsed.lockedSteps.map((ls: LockedStep) => ({
      ...ls,
      previewAbilities: ls.previewAbilities || [],
      resources: ls.resources || [],
      teaser: ls.teaser || '',
    }))

    return parsed as ExecutionResult
  } catch (error) {
    console.error('[Execution] Failed to parse response:', error)
    return null
  }
}

/**
 * Create fallback execution if AI fails
 * Uses personalized content based on user profile
 */
export function createFallbackExecution(
  diagnostic: DiagnosticResult,
  strategy: StrategyResult
): ExecutionResult {
  const stepCount = calculateStepCount(diagnostic)
  const goal = diagnostic.goal.clarified
  const level = diagnostic.user.inferredLevel
  const dailyTime = strategy.strategy.dailyCommitment
  const urgency = diagnostic.goal.urgency

  // Personalization helpers
  const isBeginnerLevel = level === 'beginner' || level === 'absolute_beginner'
  const hasLimitedTime = dailyTime.includes('5') || dailyTime.includes('10') || dailyTime.includes('15')
  const needsExtraEncouragement = urgency === 'immediate' || isBeginnerLevel

  // Build personalized intro
  const introPrefix = isBeginnerLevel
    ? `Hey! I know starting something new can feel overwhelming, but I've got you.`
    : `Let's get you moving on ${goal}.`

  const introTimeAck = hasLimitedTime
    ? `Since you have ${dailyTime}, I've designed each step to fit your schedule perfectly.`
    : `With ${dailyTime} to work with, you can make solid progress.`

  return {
    title: `Your Path to ${goal}`,
    totalSteps: stepCount,
    estimatedDays: strategy.strategy.estimatedDays,
    dailyCommitment: dailyTime,
    totalMinutes: strategy.strategy.estimatedDays * 20,

    personalizedIntro: `${introPrefix} ${introTimeAck} Let's start with the fundamentals - they're more important than you might think.`,

    currentStep: {
      order: 1,
      phase: 'NOW',
      title: 'Build Your Foundation',
      description: `Let's start with the core fundamentals of ${goal}`,

      // LESSON SECTION (Understanding - 40%)
      lesson: {
        title: `Understanding ${goal}: Why It Matters`,
        subtitle: `Before diving in, let's understand what ${goal} really is and why it's worth learning`,
        duration: hasLimitedTime ? 5 : 10,
        slides: [
          {
            order: 1,
            title: `What is ${goal}?`,
            concept: `${goal} is a skill that allows you to achieve specific outcomes in your field.`,
            explanation: `Think of ${goal} as a tool in your toolbox. Just like a hammer is designed for nails, ${goal} is designed for specific problems. Once you understand what problems it solves, you'll know exactly when and how to use it.`,
            whyItMatters: `For your goal of mastering ${goal}, understanding the "what" prevents you from misusing it or using it for the wrong problems.`,
            whatHappensWithout: `Without this understanding, people often try to apply ${goal} everywhere, wasting time on problems it wasn't designed to solve.`,
            realWorldExample: `Imagine someone learning to cook - they need to understand what a knife is FOR (cutting, not stirring) before they can use it effectively.`,
            visualHint: '🎯',
            keyTakeaway: `${goal} is a specific tool for specific problems - understanding its purpose is step one.`,
          },
          {
            order: 2,
            title: 'Why Learn This Now?',
            concept: 'The foundational concepts you learn first determine how fast you progress later.',
            explanation: `Learning ${goal} is like building a house. The foundation isn't glamorous, but everything else depends on it. People who rush past fundamentals always come back to fix gaps later - often taking 3x longer than if they'd learned it right the first time.`,
            whyItMatters: `Because you're ${isBeginnerLevel ? 'just starting' : 'building on existing knowledge'}, getting these basics right now will accelerate everything that comes after.`,
            whatHappensWithout: 'Skipping fundamentals leads to confusion later. You\'ll hit walls and won\'t know why things aren\'t working.',
            realWorldExample: 'It\'s like learning to drive - you could skip learning what the pedals do, but you\'ll crash pretty quickly.',
            visualHint: '🏗️',
            keyTakeaway: 'Fundamentals aren\'t boring - they\'re the reason experts make hard things look easy.',
          },
        ],
        resources: [
          {
            type: 'video',
            title: `${goal} Explained Simply`,
            description: 'A clear overview that builds the mental model',
            searchQuery: `${goal} explained for beginners what is`,
            priority: 1,
          },
        ],
        understandingCheck: {
          question: `Can you explain what ${goal} is in one sentence, without using jargon?`,
          correctAnswer: `A good answer describes what ${goal} DOES and what problems it SOLVES, not a textbook definition.`,
          hint: 'Think about how you would explain it to a friend who has never heard of it.',
        },
        bridgeToActions: `Now that you understand what ${goal} is and why fundamentals matter, let's put it into practice...`,
      },

      // ACTION SECTION (Doing - 60%)
      todaysFocus: {
        action: `Watch a beginner-friendly video about ${goal} and write down 3 key takeaways`,
        where: 'YouTube',
        duration: hasLimitedTime ? `~${dailyTime.replace('/day', '')}` : '~15 min',
        output: '3 bullet points of key concepts in your own words',
      },

      whyThisMattersForYou: isBeginnerLevel
        ? `Because you're ${level === 'beginner' ? 'just starting out' : 'new to this'}, getting the fundamentals right now saves you hours of confusion later. I know it's tempting to jump ahead - but trust me, this foundation makes everything else click.`
        : `Since you have some background knowledge, this step is about filling any gaps and making sure your foundation is solid. Even experienced learners benefit from revisiting the basics with fresh eyes.`,

      exitConditions: [
        `Can explain what ${goal} is in simple terms (without notes)`,
        'Can list 3 key concepts from memory',
        'Can give one real-world example of how it\'s used',
      ],

      commonTrap: {
        temptation: isBeginnerLevel
          ? 'Watching videos at 2x speed or jumping between different tutorials'
          : 'Skipping the basics because you think you already know them',
        whyItFeelsRight: isBeginnerLevel
          ? 'Feels like you\'re covering more ground faster'
          : 'You want to get to the "real" content',
        whyItFails: isBeginnerLevel
          ? 'You\'ll forget 90% of it and have to relearn anyway'
          : 'Small gaps in fundamentals cause big problems later',
        betterApproach: isBeginnerLevel
          ? 'Watch at normal speed, pause to take notes, and actually practice what you learn'
          : 'Go through basics quickly but actively - take notes on anything that surprises you',
      },

      method: hasLimitedTime
        ? `Session 1 (${dailyTime.replace('/day', '')}): Find a beginner tutorial for "${goal}" on YouTube. Watch the first 10-15 minutes. Write down one key concept.

Session 2 (${dailyTime.replace('/day', '')}): Without looking at your notes, write what you remember. Check your notes - what did you miss?

Session 3 (${dailyTime.replace('/day', '')}): Try explaining ${goal} out loud. If you get stuck, that's your gap. Review that part.`
        : `Session 1: Search for "${goal} beginner tutorial" on YouTube. Watch a well-rated video (under 20 min). Pause every few minutes to jot down key points.

Session 2: Close your notes. Write everything you remember. Compare with original notes - what did you miss? That's what to focus on.

Session 3: Explain ${goal} out loud as if teaching a friend. Stumbles = gaps to review.`,

      timeBreakdown: {
        daily: dailyTime.replace('/day', ''),
        total: `About ${parseInt(dailyTime) * 3} min over 3 sessions`,
        flexible: 'Complete when ready - no rush, no time pressure',
      },

      successSignals: {
        feelsLike: 'You\'ll feel a quiet confidence when the topic comes up. Not "I think I know this" but genuine clarity.',
        youllKnow: 'You can explain the basics without hesitating or checking notes.',
      },

      abilities: [
        `Explain ${goal} in your own words`,
        'Identify the core concepts and give examples',
        'Know what to learn next (and what to ignore for now)',
      ],

      milestone: 'Foundation Complete',
      duration: parseInt(dailyTime) * 3 || 45,
      timeframe: '3 sessions',

      resources: [
        {
          type: 'video',
          title: `${goal} for ${isBeginnerLevel ? 'Beginners' : 'Intermediate Learners'}`,
          description: `Start here - a focused ${isBeginnerLevel ? 'intro' : 'overview'} to build your foundation`,
          searchQuery: `${goal} ${isBeginnerLevel ? 'beginner tutorial' : 'crash course'} 2024`,
          priority: 1,
        },
        {
          type: 'article',
          title: `Understanding ${goal} - Quick Guide`,
          description: 'For when you prefer reading or want to review concepts',
          searchQuery: `${goal} guide explained simply`,
          priority: 2,
        },
      ],

      encouragement: needsExtraEncouragement
        ? `You've got this! Everyone starts somewhere, and taking this first step puts you ahead of most people who just think about learning. Take your time - there's no rush.`
        : `You're already ahead by taking a structured approach. Most people skip the fundamentals and struggle later. Not you.`,

      // Legacy fields for compatibility
      whyFirst: 'Fundamentals make everything else click. Skip this and you\'ll hit walls of confusion later.',
      commonMistakes: ['Watching without taking notes', 'Moving on before really understanding'],
      microTasks: [],
    },

    lockedSteps: Array.from({ length: stepCount - 1 }, (_, i) => {
      const isLastStep = i === stepCount - 2
      const stepNumber = i + 2

      return {
        order: stepNumber,
        phase: i === 0 ? 'NEXT' as const : 'LATER' as const,
        title: isLastStep
          ? `Put It All Together`
          : stepNumber === 2
            ? 'Apply What You Learned'
            : `Deepen Your Skills`,
        whyAfterPrevious: i === 0
          ? 'Once you have the foundation, you\'re ready to start applying it'
          : 'Each step builds naturally on the previous one',
        previewAbilities: isLastStep
          ? [`Use ${goal} confidently in real situations`, 'Solve problems independently']
          : ['Apply concepts to practical scenarios', 'Start building real skills'],
        teaser: isLastStep
          ? 'This is where everything clicks and you see the full picture!'
          : 'You\'ll start seeing real results and building confidence',
        milestone: isLastStep ? 'Goal Complete' : undefined,
        estimatedDuration: parseInt(dailyTime) * 3 || 30,
        resources: [],
      }
    }),

    criticalWarning: {
      warning: strategy.risks.critical.warning,
      consequence: strategy.risks.critical.consequence,
      prevention: strategy.risks.critical.prevention,
      severity: 'CRITICAL',
    },
  }
}
