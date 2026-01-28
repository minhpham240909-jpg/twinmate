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
  }

  // Success Definition
  success: {
    looksLike: string // Vivid description of success
    metrics: string[] // Measurable outcomes (3-5)
    abilities: string[] // What they'll be able to DO (3-5)
    outOfScope: string[] // What NOT to focus on yet
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

export const COMBINED_STRATEGY_PROMPT = `You are a master learning architect and coach. Given a diagnostic report about a learner, create a complete strategic framework for their learning journey.

=== CONTEXT FROM DIAGNOSTIC ===
{diagnosticContext}

=== PHASE 1: TRANSFORMATION DESIGN ===

Create a compelling vision:
1. Vision: WHY this journey matters (emotional + practical)
2. Before/After: Clear transformation picture
3. Narrative: Story of their growth
4. Identity: Who they'll become
5. Success definition: What it looks like, metrics, abilities, out of scope

VISION RULES:
- Connect to deeper motivation
- Show what becomes POSSIBLE
- Make it personal and specific

=== PHASE 2: RISK ASSESSMENT ===

Identify what could go wrong:
1. Critical risk: The ONE behavior that ruins everything
2. Common mistakes: 3-5 specific mistakes with consequences
3. Recovery path: How to get back on track

RISK RULES:
- Be specific, not generic
- Include exact consequences
- Provide prevention strategies

=== PHASE 3: LEARNING STRATEGY ===

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
    "beforeState": "Where they are now",
    "afterState": "Where they'll be",
    "narrative": "Story of their transformation",
    "identity": "You'll be someone who..."
  },
  "success": {
    "looksLike": "Vivid success description",
    "metrics": ["Measurable outcome 1", "Measurable outcome 2", "Measurable outcome 3"],
    "abilities": ["Can do X", "Can do Y", "Can do Z"],
    "outOfScope": ["Don't worry about X yet"]
  },
  "milestones": [
    {
      "order": 1,
      "title": "Milestone title",
      "description": "Achievement description",
      "marker": "How you know you reached it",
      "unlocks": "What this enables"
    }
  ],
  "risks": {
    "critical": {
      "warning": "The ONE critical mistake",
      "consequence": "What happens",
      "prevention": "How to avoid",
      "severity": "CRITICAL"
    },
    "common": [
      {
        "mistake": "Common mistake 1",
        "consequence": "Result",
        "prevention": "How to avoid"
      }
    ],
    "recoveryPath": "What to do if you fall off"
  },
  "strategy": {
    "approach": "Overall approach description",
    "dailyCommitment": "XX-XX min/day",
    "estimatedDays": 14,
    "pacing": "moderate",
    "focusAreas": ["Priority 1", "Priority 2"]
  }
}

=== IMPORTANT ===
- Be inspiring but realistic
- Make them WANT to start
- Don't sugarcoat risks
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
    "identity": "string"
  },
  "success": {
    "looksLike": "string",
    "metrics": ["string"],
    "abilities": ["string"],
    "outOfScope": ["string"]
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
    "recoveryPath": "string"
  },
  "strategy": {
    "approach": "string",
    "dailyCommitment": "string",
    "estimatedDays": "number",
    "pacing": "intensive | moderate | relaxed",
    "focusAreas": ["string"]
  }
}`

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format diagnostic result for strategy prompt
 */
export function formatDiagnosticForStrategy(diagnostic: DiagnosticResult): string {
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
    },
    success: {
      looksLike: 'You can explain core concepts clearly and apply them independently.',
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
      recoveryPath: 'If you fall behind, review the previous step before continuing.',
    },
    strategy: {
      approach: 'Build strong foundations through structured learning and practice',
      dailyCommitment: '15-20 min/day',
      estimatedDays: 14,
      pacing: 'moderate',
      focusAreas: diagnostic.gaps.critical.slice(0, 3),
    },
  }
}
