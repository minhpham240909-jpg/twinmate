/**
 * STRATEGY PHASE PROMPTS
 *
 * Phase 2 of the multi-phase AI pipeline.
 * Creates the strategic framework for the learning journey:
 * - Vision: What transformation awaits
 * - Journey narrative: The story of their growth
 * - Milestones: Clear checkpoints
 * - Risk assessment: What could go wrong and how to prevent it
 */

import type { DiagnosticResult } from './diagnostic'

// ============================================
// TYPES
// ============================================

export interface StrategyResult {
  // Transformation Design
  transformation: {
    vision: string // WHY this journey matters - emotional + practical
    beforeState: string // Where they are now
    afterState: string // Where they'll be after
    narrative: string // The story of their transformation
    identity: string // Who they'll become ("You'll be someone who...")
    identityShift: { // ELITE: Clear identity transformation
      oldIdentity: string // "You are no longer X..."
      newIdentity: string // "You are now Y..."
      behaviorChange: string // How they'll act differently
    }
  }

  // Success Definition
  success: {
    looksLike: string // Vivid description of success
    feelsLike: string // ELITE: Sensory/emotional signals of success
    metrics: string[] // Measurable outcomes (3-5)
    abilities: string[] // What they'll be able to DO (3-5)
    outOfScope: string[] // What NOT to focus on yet
  }

  // ELITE: Strong Prioritization
  prioritization: {
    focusNow: string // "This matters NOW. Ignore everything else."
    ignoreFor: string[] // What to explicitly NOT do yet
    justification: string // WHY this sequence, why alternatives fail
    sequenceRationale: string // Why step 1 before step 2, etc.
  }

  // Milestones
  milestones: {
    order: number
    title: string
    description: string
    marker: string // What proves you've reached this milestone
    unlocks: string // What this milestone unlocks
  }[]

  // Risk Assessment
  risks: {
    critical: {
      warning: string
      consequence: string
      prevention: string
      severity: 'CRITICAL'
    }
    common: {
      mistake: string
      consequence: string
      prevention: string
    }[]
    fakeProgress: string[] // ELITE: What LOOKS like progress but isn't
    recoveryPath: string // What to do if they fall off track
  }

  // Learning Strategy
  strategy: {
    approach: string // Overall approach description
    dailyCommitment: string // "15-20 min/day"
    estimatedDays: number
    pacing: 'intensive' | 'moderate' | 'relaxed'
    focusAreas: string[] // Priority areas to emphasize
  }

  // ELITE: What Comes Next (builds anticipation)
  whatComesNext: {
    afterMastery: string // What becomes possible after this roadmap
    nextLevel: string // Natural next step after completing this
    buildsToward: string // The bigger picture this contributes to
  }
}

// ============================================
// PROMPT 3: TRANSFORMATION DESIGN
// ============================================

export const TRANSFORMATION_DESIGN_PROMPT = `You are a master learning architect who creates TRANSFORMATIONAL learning experiences. Given a diagnostic report about a learner's goal, design the transformation they'll undergo.

=== YOUR TASK ===
Create a compelling vision of the learner's transformation:
1. Vision: WHY this journey matters (both emotionally and practically)
2. Before/After: Clear picture of their transformation
3. Narrative: The story of their growth
4. Identity shift: Who they'll become

=== TRANSFORMATION FRAMEWORK ===

VISION (Why this matters):
- Connect to their deeper motivation (career, confidence, capability)
- Show what becomes POSSIBLE after mastery
- Make it personal and compelling

BEFORE/AFTER:
- Before: Honest but respectful assessment of current state
- After: Specific, achievable, desirable end state
- Focus on CAPABILITIES, not just knowledge

NARRATIVE:
- Frame the journey as a story with them as the hero
- Include challenges they'll overcome
- Build anticipation for the transformation

IDENTITY:
- "You'll be someone who can..."
- "You'll think like a..."
- "You'll have the confidence to..."

SUCCESS DEFINITION:
- What does success LOOK LIKE? (vivid description)
- Measurable metrics (specific, provable outcomes)
- Abilities gained (what they'll DO, not just know)
- Out of scope (what NOT to worry about yet)

=== OUTPUT FORMAT ===
{
  "vision": "Compelling 2-3 sentence vision of why this journey matters",
  "beforeState": "Where they are now (honest, specific)",
  "afterState": "Where they'll be after (specific, achievable)",
  "narrative": "The story of their transformation",
  "identity": "Who they'll become - starts with 'You'll be someone who...'",
  "looksLike": "Vivid description of what success looks like",
  "metrics": ["Measurable outcome 1", "Measurable outcome 2", "Measurable outcome 3"],
  "abilities": ["Can do X", "Can do Y", "Can do Z"],
  "outOfScope": ["Don't worry about X yet", "Save Y for later"]
}

Be inspiring but realistic. Make them WANT to start.`

// ============================================
// PROMPT 4: RISK ASSESSMENT
// ============================================

export const RISK_ASSESSMENT_PROMPT = `You are a learning coach who has seen thousands of students succeed AND fail. Given a learner's goal and diagnostic, identify EXACTLY what could go wrong and how to prevent it.

=== YOUR TASK ===
Create a comprehensive risk assessment:
1. The ONE critical behavior that ruins everything
2. Common mistakes people make (with consequences)
3. Recovery path if they fall off track
4. Prevention strategies

=== RISK FRAMEWORK ===

CRITICAL RISK (The #1 failure mode):
- What is the ONE thing that causes most people to fail at this?
- Be specific - "giving up" is too vague
- Include the exact CONSEQUENCE of this behavior
- Severity: CRITICAL

COMMON MISTAKES:
- List 3-5 specific mistakes people make
- Each mistake must have:
  - What they do wrong
  - The exact consequence
  - How to prevent it
- Be concrete, not generic ("skipping practice" → "moving to loops before mastering variables")

RECOVERY PATH:
- What should they do if they fall off track?
- How to get back on without starting over
- When to ask for help

=== OUTPUT FORMAT ===
{
  "critical": {
    "warning": "The ONE behavior that ruins everything",
    "consequence": "Exactly what happens if they do this",
    "prevention": "How to avoid this",
    "severity": "CRITICAL"
  },
  "common": [
    {
      "mistake": "Specific mistake 1",
      "consequence": "What goes wrong",
      "prevention": "How to avoid"
    },
    {
      "mistake": "Specific mistake 2",
      "consequence": "What goes wrong",
      "prevention": "How to avoid"
    }
  ],
  "recoveryPath": "What to do if you fall off track"
}

Be honest about risks. Sugarcoating helps no one.`

// ============================================
// PROMPT 5: LEARNING STRATEGY
// ============================================

export const LEARNING_STRATEGY_PROMPT = `You are a curriculum architect designing the optimal learning strategy. Given a diagnostic and transformation design, determine the best approach.

=== YOUR TASK ===
Design the learning strategy:
1. Overall approach (how to tackle this)
2. Time commitment (realistic daily/weekly)
3. Pacing (intensive, moderate, relaxed)
4. Focus areas (what to prioritize)
5. Milestones (checkpoints along the way)

=== STRATEGY FRAMEWORK ===

APPROACH:
- Based on goal type, what's the optimal learning method?
- Test prep → practice problems and timed exercises
- Skill build → hands-on projects with immediate feedback
- Subject learn → conceptual understanding then application
- Project → reverse engineering from end goal

PACING:
- intensive: 45-60 min/day, fast progress, higher burnout risk
- moderate: 20-30 min/day, steady progress, sustainable
- relaxed: 10-15 min/day, slow but very sustainable

MILESTONES:
- Create 3-4 clear checkpoints
- Each milestone should:
  - Have a clear "done when" criteria
  - Unlock new capabilities
  - Provide sense of achievement

=== OUTPUT FORMAT ===
{
  "approach": "Overall approach description",
  "dailyCommitment": "XX-XX min/day",
  "estimatedDays": 14,
  "pacing": "intensive | moderate | relaxed",
  "focusAreas": ["Priority area 1", "Priority area 2"],
  "milestones": [
    {
      "order": 1,
      "title": "Milestone title",
      "description": "What you achieve",
      "marker": "How you know you're there",
      "unlocks": "What this enables"
    }
  ]
}

Be realistic about timelines. Overpromising leads to disappointment.`

// ============================================
// COMBINED STRATEGY PROMPT (for efficiency)
// ============================================

export const COMBINED_STRATEGY_PROMPT = `You are an elite private mentor designing a TRANSFORMATIONAL training program. This isn't a generic lesson plan - it's a personalized diagnosis and training regimen like what world-class coaches provide to top performers.

=== CONTEXT FROM DIAGNOSTIC ===
{diagnosticContext}

=== YOUR MISSION ===
Create a strategy that feels like a private mentor's training plan, not a public course. Include:
1. Clear identity shift ("You are no longer X, you are now Y")
2. Strong prioritization ("This matters NOW. Ignore everything else.")
3. Explicit fake progress warnings ("This LOOKS like learning but ISN'T")
4. What success FEELS like (not just looks like)
5. Why this sequence, why alternatives fail

=== PHASE 1: TRANSFORMATION DESIGN ===

Create a compelling vision with IDENTITY SHIFT:
1. Vision: WHY this journey matters (emotional + practical)
2. Before/After: Clear transformation picture
3. Narrative: Story of their growth
4. Identity: Who they'll become
5. IDENTITY SHIFT (CRITICAL):
   - Old identity: "You are no longer someone who..."
   - New identity: "You are now someone who..."
   - Behavior change: How you'll act differently

IDENTITY SHIFT EXAMPLES:
- NOT: "You'll learn JavaScript"
- YES: "You are no longer a tutorial consumer who watches videos passively. You are now a builder who codes for 80% of your learning time. When you don't know something, you experiment first, search second."

=== PHASE 2: SUCCESS DEFINITION ===

Define success with SENSORY DETAIL:
1. Looks like: What observable evidence of success
2. FEELS LIKE (ELITE): The emotional/sensory experience of success
   - "You'll feel calm confidence, not frantic cramming"
   - "When someone asks about X, you'll feel a small smile form - you KNOW this"
   - "The anxiety of 'am I doing it right?' will be replaced by quiet certainty"
3. Metrics: Measurable outcomes
4. Abilities: What you'll be able to DO
5. Out of scope: What NOT to worry about yet

=== PHASE 3: STRONG PRIORITIZATION ===

This is what separates elite mentorship from generic advice:
1. FOCUS NOW: "This matters NOW. Ignore everything else until this is solid."
2. IGNORE FOR NOW: Explicitly list what NOT to do yet (even if it seems important)
3. JUSTIFICATION: WHY this sequence matters, WHY alternatives fail
4. SEQUENCE RATIONALE: Why step 1 before step 2 (the actual dependency)

PRIORITIZATION EXAMPLES:
- NOT: "Learn the basics first"
- YES: "You will ONLY focus on variables and functions for the first week. Do NOT touch arrays, objects, or DOM manipulation yet. I know you want to build things - but every hour you spend on advanced topics now creates 3 hours of confusion later. The foundation isn't sexy, but it's the difference between someone who 'knows some code' and someone who can actually build."

=== PHASE 4: RISK ASSESSMENT WITH FAKE PROGRESS ===

Identify what could go wrong AND what LOOKS like progress but isn't:
1. Critical risk: The ONE behavior that ruins everything
2. Common mistakes: 3-5 specific mistakes with consequences
3. FAKE PROGRESS (ELITE): What feels productive but isn't actually learning
   - "Watching tutorials at 2x speed feels efficient but you retain 20%"
   - "Highlighting notes feels like learning but is nearly useless for retention"
   - "Reading documentation without coding is mental masturbation"
4. Recovery path: How to get back on track

=== PHASE 5: WHAT COMES NEXT ===

Build anticipation without overload:
1. After mastery: What becomes possible after completing this roadmap
2. Next level: Natural next step
3. Builds toward: The bigger picture this contributes to

=== PHASE 6: LEARNING STRATEGY ===

Design the optimal approach:
1. Overall approach based on goal type
2. Time commitment (realistic)
3. Pacing (intensive/moderate/relaxed)
4. Focus areas to prioritize
5. Milestones (3-4 checkpoints)

PACING GUIDE:
- intensive: 45-60 min/day (fast but risky)
- moderate: 20-30 min/day (steady, sustainable)
- relaxed: 10-15 min/day (slow but very sustainable)

=== OUTPUT FORMAT ===
{
  "transformation": {
    "vision": "2-3 sentence compelling vision",
    "beforeState": "Where they are now - be specific and honest",
    "afterState": "Where they'll be - specific and achievable",
    "narrative": "Story of their transformation",
    "identity": "You'll be someone who...",
    "identityShift": {
      "oldIdentity": "You are no longer someone who...",
      "newIdentity": "You are now someone who...",
      "behaviorChange": "Specific behavior that will be different"
    }
  },
  "success": {
    "looksLike": "Observable evidence of success",
    "feelsLike": "The emotional/sensory experience - what it FEELS like to succeed",
    "metrics": ["Measurable outcome 1", "Measurable outcome 2", "Measurable outcome 3"],
    "abilities": ["Can DO X under Y conditions", "Can DO Z without looking"],
    "outOfScope": ["Don't worry about X yet", "Save Y for later"]
  },
  "prioritization": {
    "focusNow": "This is the ONLY thing that matters right now. Everything else is noise.",
    "ignoreFor": ["Don't do X yet", "Resist the urge to Y", "Save Z for after mastery"],
    "justification": "Why this sequence matters and why shortcuts fail",
    "sequenceRationale": "Why step 1 must come before step 2 - the actual dependency"
  },
  "milestones": [
    {
      "order": 1,
      "title": "Milestone title",
      "description": "Achievement description",
      "marker": "Specific proof you've reached it",
      "unlocks": "What this enables next"
    }
  ],
  "risks": {
    "critical": {
      "warning": "The ONE critical mistake that ruins everything",
      "consequence": "Exactly what happens - be vivid",
      "prevention": "How to avoid this",
      "severity": "CRITICAL"
    },
    "common": [
      {
        "mistake": "Common mistake 1",
        "consequence": "What goes wrong",
        "prevention": "How to avoid"
      }
    ],
    "fakeProgress": [
      "Activity that FEELS productive but ISN'T learning",
      "Another fake progress trap",
      "Third example of wasted effort that feels good"
    ],
    "recoveryPath": "What to do if you fall off track"
  },
  "strategy": {
    "approach": "Overall approach description",
    "dailyCommitment": "XX-XX min/day",
    "estimatedDays": 14,
    "pacing": "moderate",
    "focusAreas": ["Priority 1", "Priority 2"]
  },
  "whatComesNext": {
    "afterMastery": "What becomes possible after completing this",
    "nextLevel": "Natural next step after this roadmap",
    "buildsToward": "The bigger picture this contributes to"
  }
}

=== IMPORTANT ===
- Write like a private mentor who ACTUALLY cares about their success
- Be specific and personal, not generic and safe
- Tell hard truths - comfort doesn't create transformation
- Make them feel like they have a coach who sees exactly what they need
- Output valid JSON only`

// ============================================
// RESPONSE FORMAT SCHEMA
// ============================================

export const STRATEGY_RESPONSE_FORMAT = `{
  "transformation": {
    "vision": "string",
    "beforeState": "string",
    "afterState": "string",
    "narrative": "string",
    "identity": "string",
    "identityShift": {
      "oldIdentity": "string",
      "newIdentity": "string",
      "behaviorChange": "string"
    }
  },
  "success": {
    "looksLike": "string",
    "feelsLike": "string",
    "metrics": ["string"],
    "abilities": ["string"],
    "outOfScope": ["string"]
  },
  "prioritization": {
    "focusNow": "string",
    "ignoreFor": ["string"],
    "justification": "string",
    "sequenceRationale": "string"
  },
  "milestones": [
    {
      "order": "number",
      "title": "string",
      "description": "string",
      "marker": "string",
      "unlocks": "string"
    }
  ],
  "risks": {
    "critical": {
      "warning": "string",
      "consequence": "string",
      "prevention": "string",
      "severity": "CRITICAL"
    },
    "common": [
      {
        "mistake": "string",
        "consequence": "string",
        "prevention": "string"
      }
    ],
    "fakeProgress": ["string"],
    "recoveryPath": "string"
  },
  "strategy": {
    "approach": "string",
    "dailyCommitment": "string",
    "estimatedDays": "number",
    "pacing": "intensive | moderate | relaxed",
    "focusAreas": ["string"]
  },
  "whatComesNext": {
    "afterMastery": "string",
    "nextLevel": "string",
    "buildsToward": "string"
  }
}`

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format diagnostic result for strategy prompt
 */
export function formatDiagnosticForStrategy(diagnostic: DiagnosticResult): string {
  const diagnosis = diagnostic.diagnosis || {
    whyStuck: 'Not diagnosed',
    falseBeliefs: [],
    overFocusing: [],
    neglecting: [],
    rootCause: 'Not diagnosed',
  }

  return `
USER'S GOAL:
- Original: "${diagnostic.goal.original}"
- Clarified: "${diagnostic.goal.clarified}"
- Type: ${diagnostic.goal.type}
- Urgency: ${diagnostic.goal.urgency}
- Scope: ${diagnostic.goal.scope}

USER PROFILE:
- Level: ${diagnostic.user.inferredLevel}
- Prior knowledge: ${diagnostic.user.priorKnowledge.join(', ') || 'None specified'}
- Context: ${diagnostic.user.context}
- Constraints: ${diagnostic.user.constraints.join(', ') || 'None specified'}

KNOWLEDGE GAPS:
- Critical (must learn): ${diagnostic.gaps.critical.join(', ')}
- Important: ${diagnostic.gaps.important.join(', ')}
- Optional: ${diagnostic.gaps.optional.join(', ')}
- Priority order: ${diagnostic.gaps.priorityOrder.join(' → ')}

PREREQUISITES:
- Required: ${diagnostic.prerequisites.required.join(', ') || 'None'}
- Recommended: ${diagnostic.prerequisites.recommended.join(', ') || 'None'}
- Missing: ${diagnostic.prerequisites.missing.join(', ') || 'None'}

=== DIAGNOSIS (Why they're stuck) ===
- WHY STUCK: ${diagnosis.whyStuck}
- FALSE BELIEFS: ${diagnosis.falseBeliefs.join('; ') || 'None identified'}
- OVER-FOCUSING ON: ${diagnosis.overFocusing.join('; ') || 'None identified'}
- NEGLECTING: ${diagnosis.neglecting.join('; ') || 'None identified'}
- ROOT CAUSE: ${diagnosis.rootCause}
`.trim()
}

/**
 * Parse and validate strategy response from AI
 */
export function parseStrategyResponse(response: string): StrategyResult | null {
  try {
    const parsed = JSON.parse(response)

    // Validate required fields
    if (!parsed.transformation || !parsed.success || !parsed.risks || !parsed.strategy) {
      console.error('[Strategy] Missing required fields')
      return null
    }

    // Validate transformation
    if (!parsed.transformation.vision) {
      console.error('[Strategy] Missing transformation.vision')
      return null
    }

    // Validate risks
    if (!parsed.risks.critical) {
      console.error('[Strategy] Missing risks.critical')
      return null
    }

    // Ensure arrays exist
    parsed.success.metrics = parsed.success.metrics || []
    parsed.success.abilities = parsed.success.abilities || []
    parsed.success.outOfScope = parsed.success.outOfScope || []
    parsed.milestones = parsed.milestones || []
    parsed.risks.common = parsed.risks.common || []
    parsed.strategy.focusAreas = parsed.strategy.focusAreas || []

    // Ensure new elite fields exist with defaults
    parsed.transformation.identityShift = parsed.transformation.identityShift || {
      oldIdentity: 'Someone who learns passively',
      newIdentity: 'Someone who practices actively and learns from failure',
      behaviorChange: 'You will test yourself immediately after learning',
    }

    parsed.success.feelsLike = parsed.success.feelsLike || 'Calm confidence when facing challenges in this area'

    parsed.prioritization = parsed.prioritization || {
      focusNow: 'Master the fundamentals before anything else',
      ignoreFor: ['Advanced topics', 'Edge cases'],
      justification: 'Fundamentals unlock everything else',
      sequenceRationale: 'Each step builds on the previous',
    }

    parsed.risks.fakeProgress = parsed.risks.fakeProgress || [
      'Watching tutorials without practicing',
      'Re-reading notes instead of testing yourself',
    ]

    parsed.whatComesNext = parsed.whatComesNext || {
      afterMastery: 'Ready for more advanced challenges',
      nextLevel: 'Intermediate techniques and real-world application',
      buildsToward: 'Complete mastery of the subject',
    }

    return parsed as StrategyResult
  } catch (error) {
    console.error('[Strategy] Failed to parse response:', error)
    return null
  }
}

/**
 * Create fallback strategy if AI fails
 */
export function createFallbackStrategy(diagnostic: DiagnosticResult): StrategyResult {
  return {
    transformation: {
      vision: `Master ${diagnostic.goal.clarified} and gain the confidence to apply it in real situations.`,
      beforeState: 'Currently building foundation in this area',
      afterState: 'Confident and capable practitioner',
      narrative: 'You\'ll progress from fundamentals to practical application through focused practice.',
      identity: 'You\'ll be someone who can confidently tackle challenges in this area.',
      identityShift: {
        oldIdentity: 'Someone who consumes content and hopes to "get it"',
        newIdentity: 'Someone who practices deliberately and learns from failure',
        behaviorChange: 'You\'ll test yourself immediately after learning, not just re-read notes',
      },
    },
    success: {
      looksLike: 'You can explain core concepts clearly and apply them independently.',
      feelsLike: 'You feel calm confidence when facing challenges in this area. No anxiety, no imposter syndrome - just quiet competence.',
      metrics: [
        'Complete all learning steps',
        'Pass self-assessment with confidence',
        'Apply knowledge to real problems',
      ],
      abilities: [
        'Understand core fundamentals',
        'Apply concepts to new situations',
        'Identify and solve common problems',
      ],
      outOfScope: ['Advanced optimization', 'Edge cases'],
    },
    prioritization: {
      focusNow: 'Master the fundamentals. Everything else is a distraction until this is solid.',
      ignoreFor: ['Advanced techniques', 'Edge cases', 'Optimization', 'Multiple approaches'],
      justification: 'Fundamentals unlock everything else. Without them, advanced topics are noise.',
      sequenceRationale: 'Each step builds on the previous. Skipping creates knowledge gaps that compound.',
    },
    milestones: [
      {
        order: 1,
        title: 'Foundation Complete',
        description: 'Core concepts understood',
        marker: 'Can explain basics clearly',
        unlocks: 'Practical application',
      },
      {
        order: 2,
        title: 'Practical Application',
        description: 'Can apply knowledge',
        marker: 'Successfully solved practice problems',
        unlocks: 'Independent learning',
      },
    ],
    risks: {
      critical: {
        warning: 'Skipping fundamentals to rush ahead',
        consequence: 'Weak foundation leads to confusion and giving up',
        prevention: 'Complete each step fully before moving on',
        severity: 'CRITICAL',
      },
      common: [
        {
          mistake: 'Passive learning without practice',
          consequence: 'Knowledge doesn\'t stick',
          prevention: 'Do the exercises, don\'t just read',
        },
      ],
      fakeProgress: [
        'Watching tutorials without pausing to practice',
        'Re-reading notes instead of testing yourself',
        'Feeling "familiar" with content but unable to apply it',
      ],
      recoveryPath: 'If you fall behind, review the previous step before continuing.',
    },
    strategy: {
      approach: 'Build strong foundations through structured learning and practice',
      dailyCommitment: '15-20 min/day',
      estimatedDays: 14,
      pacing: 'moderate',
      focusAreas: diagnostic.gaps.critical.slice(0, 3),
    },
    whatComesNext: {
      afterMastery: 'You\'ll be ready to tackle more complex challenges and learn advanced topics with confidence.',
      nextLevel: 'Intermediate techniques and real-world application',
      buildsToward: 'Complete mastery and the ability to teach others',
    },
  }
}
