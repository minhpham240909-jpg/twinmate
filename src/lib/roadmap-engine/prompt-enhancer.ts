/**
 * CLERVA PROMPT ENHANCER
 *
 * Enhances user goal input to generate better AI roadmaps.
 *
 * STRATEGY: Smart Hybrid
 * 1. Template Enhancement: Add structured context fields (fast)
 * 2. AI Polish: Refine and expand with AI (smart)
 *
 * USER EXPERIENCE:
 * - One-click magic wand button
 * - Shows enhanced prompt (editable)
 * - Fast but intelligent
 */

import OpenAI from 'openai'
import logger from '@/lib/logger'

// ============================================
// TYPES
// ============================================

export interface EnhancementContext {
  skillLevel?: 'beginner' | 'intermediate' | 'advanced' | 'unknown'
  timeframe?: string // "1 week", "1 month", "ASAP"
  hoursPerWeek?: number
  learningStyle?: 'visual' | 'hands-on' | 'reading' | 'mixed'
  specificTarget?: string // "Pass exam", "Build project", "Get job"
  constraints?: string[]
}

export interface EnhancedPrompt {
  original: string
  enhanced: string
  context: EnhancementContext
  confidence: 'high' | 'medium' | 'low'
  suggestions?: string[] // Optional tips for the user
}

export interface EnhancementOptions {
  mode?: 'quick' | 'thorough'
  useAI?: boolean // Whether to use AI polish (default: true)
}

// ============================================
// CONFIGURATION
// ============================================

const OPENAI_TIMEOUT_MS = 15000 // Fast timeout for good UX
const MAX_INPUT_LENGTH = 500
const MAX_ENHANCED_LENGTH = 1000

// Singleton OpenAI client for reuse
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: 1,
    })
  }
  return openaiClient
}

// ============================================
// TEMPLATE PATTERNS - Fast Detection
// ============================================

const GOAL_PATTERNS = {
  // Time indicators
  timeframe: [
    { pattern: /in (\d+) (days?|weeks?|months?)/i, extract: 1 },
    { pattern: /(this|next) (week|month)/i, extract: 'relative' },
    { pattern: /(quickly|fast|asap|soon)/i, extract: 'urgent' },
    { pattern: /by (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, extract: 'deadline' },
    { pattern: /before (.*?)(exam|test|deadline|interview)/i, extract: 'deadline' },
  ],

  // Skill level indicators
  level: [
    { pattern: /(beginner|newbie|new to|starting|first time)/i, level: 'beginner' },
    { pattern: /(intermediate|some experience|know basics)/i, level: 'intermediate' },
    { pattern: /(advanced|expert|master|deep dive)/i, level: 'advanced' },
  ],

  // Goal type indicators
  goalType: [
    { pattern: /(pass|ace|prepare for).*(exam|test|quiz)/i, type: 'test_prep' },
    { pattern: /(learn|understand|study)/i, type: 'learn_subject' },
    { pattern: /(build|create|make|develop)/i, type: 'skill_build' },
    { pattern: /(improve|get better|enhance)/i, type: 'skill_improve' },
    { pattern: /(get (a )?job|career|interview)/i, type: 'career' },
  ],

  // Subject detection
  subjects: [
    { pattern: /\b(math|algebra|calculus|geometry|statistics)\b/i, subject: 'mathematics' },
    { pattern: /\b(python|javascript|java|coding|programming)\b/i, subject: 'programming' },
    { pattern: /\b(english|spanish|french|german|language)\b/i, subject: 'language' },
    { pattern: /\b(physics|chemistry|biology|science)\b/i, subject: 'science' },
    { pattern: /\b(react|vue|angular|frontend|backend|web)\b/i, subject: 'web development' },
    { pattern: /\b(machine learning|ai|data science)\b/i, subject: 'AI/ML' },
  ],
}

// ============================================
// ENHANCEMENT TEMPLATES
// ============================================

const ENHANCEMENT_TEMPLATES: Record<string, (ctx: EnhancementContext, original: string) => string> = {
  // For learning a subject
  learn_subject: (ctx, original) => {
    const parts = [original]

    if (ctx.skillLevel && ctx.skillLevel !== 'unknown') {
      parts.push(`Current level: ${ctx.skillLevel}`)
    }

    if (ctx.timeframe) {
      parts.push(`Timeframe: ${ctx.timeframe}`)
    }

    if (ctx.hoursPerWeek) {
      parts.push(`Available time: ${ctx.hoursPerWeek} hours per week`)
    }

    if (ctx.specificTarget) {
      parts.push(`End goal: ${ctx.specificTarget}`)
    }

    return parts.join('. ') + '.'
  },

  // For test preparation
  test_prep: (ctx, original) => {
    const parts = [original]

    if (ctx.timeframe) {
      parts.push(`Exam in: ${ctx.timeframe}`)
    }

    if (ctx.skillLevel && ctx.skillLevel !== 'unknown') {
      parts.push(`Current preparation level: ${ctx.skillLevel}`)
    }

    if (ctx.hoursPerWeek) {
      parts.push(`Study time available: ${ctx.hoursPerWeek} hours per week`)
    }

    parts.push('Focus: Exam readiness and practical problem-solving')

    return parts.join('. ') + '.'
  },

  // For skill building
  skill_build: (ctx, original) => {
    const parts = [original]

    if (ctx.skillLevel && ctx.skillLevel !== 'unknown') {
      parts.push(`Experience level: ${ctx.skillLevel}`)
    }

    if (ctx.timeframe) {
      parts.push(`Target timeline: ${ctx.timeframe}`)
    }

    if (ctx.specificTarget) {
      parts.push(`Practical goal: ${ctx.specificTarget}`)
    }

    if (ctx.learningStyle) {
      parts.push(`Preferred learning: ${ctx.learningStyle} approach`)
    }

    return parts.join('. ') + '.'
  },

  // For career goals
  career: (ctx, original) => {
    const parts = [original]

    if (ctx.skillLevel && ctx.skillLevel !== 'unknown') {
      parts.push(`Current skill level: ${ctx.skillLevel}`)
    }

    if (ctx.timeframe) {
      parts.push(`Timeline: ${ctx.timeframe}`)
    }

    if (ctx.hoursPerWeek) {
      parts.push(`Commitment: ${ctx.hoursPerWeek} hours per week`)
    }

    parts.push('Focus: Practical skills and portfolio/proof of competence')

    return parts.join('. ') + '.'
  },

  // Default / general
  default: (ctx, original) => {
    const parts = [original]

    if (ctx.skillLevel && ctx.skillLevel !== 'unknown') {
      parts.push(`Level: ${ctx.skillLevel}`)
    }

    if (ctx.timeframe) {
      parts.push(`Timeframe: ${ctx.timeframe}`)
    }

    if (ctx.hoursPerWeek) {
      parts.push(`Available: ${ctx.hoursPerWeek} hours per week`)
    }

    if (ctx.specificTarget) {
      parts.push(`Goal: ${ctx.specificTarget}`)
    }

    return parts.join('. ') + '.'
  },
}

// ============================================
// MAIN ENHANCEMENT FUNCTION
// ============================================

/**
 * Enhance a user's goal input for better AI roadmap generation.
 *
 * @param userGoal - The original goal text from user
 * @param options - Enhancement options (mode, useAI)
 * @returns Enhanced prompt with context
 */
export async function enhancePrompt(
  userGoal: string,
  options: EnhancementOptions = {}
): Promise<EnhancedPrompt> {
  const { mode = 'quick', useAI = true } = options
  const startTime = Date.now()

  // Validate input
  const trimmedGoal = userGoal.trim().slice(0, MAX_INPUT_LENGTH)
  if (trimmedGoal.length < 5) {
    return {
      original: userGoal,
      enhanced: userGoal,
      context: {},
      confidence: 'low',
      suggestions: ['Try to be more specific about what you want to learn'],
    }
  }

  // Step 1: Extract context using templates (fast)
  const context = extractContext(trimmedGoal)
  const goalType = detectGoalType(trimmedGoal)

  // Step 2: Apply template enhancement
  const templateEnhanced = applyTemplate(trimmedGoal, context, goalType)

  // Step 3: AI polish (if enabled and mode allows)
  let finalEnhanced = templateEnhanced
  let confidence: 'high' | 'medium' | 'low' = 'medium'

  if (useAI && mode === 'quick') {
    try {
      const aiResult = await aiPolish(trimmedGoal, templateEnhanced, context)
      finalEnhanced = aiResult.enhanced
      confidence = aiResult.confidence
    } catch (error) {
      // Fall back to template-only enhancement
      logger.warn('[Prompt Enhancer] AI polish failed, using template only', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  logger.info('[Prompt Enhancer] Enhancement complete', {
    mode,
    useAI,
    goalType,
    confidence,
    originalLength: userGoal.length,
    enhancedLength: finalEnhanced.length,
    durationMs: Date.now() - startTime,
  })

  return {
    original: userGoal,
    enhanced: finalEnhanced.slice(0, MAX_ENHANCED_LENGTH),
    context,
    confidence,
    suggestions: generateSuggestions(context, goalType),
  }
}

// ============================================
// CONTEXT EXTRACTION
// ============================================

/**
 * Extract context from the user's goal using pattern matching
 */
function extractContext(goal: string): EnhancementContext {
  const context: EnhancementContext = {}

  // Detect skill level
  for (const { pattern, level } of GOAL_PATTERNS.level) {
    if (pattern.test(goal)) {
      context.skillLevel = level as EnhancementContext['skillLevel']
      break
    }
  }
  if (!context.skillLevel) {
    context.skillLevel = 'unknown'
  }

  // Detect timeframe
  for (const { pattern, extract } of GOAL_PATTERNS.timeframe) {
    const match = goal.match(pattern)
    if (match) {
      if (extract === 'relative') {
        context.timeframe = match[0]
      } else if (extract === 'urgent') {
        context.timeframe = 'as soon as possible'
      } else if (extract === 'deadline') {
        context.timeframe = match[0]
      } else {
        context.timeframe = match[0]
      }
      break
    }
  }

  // Detect constraints
  const constraints: string[] = []
  if (goal.toLowerCase().includes('no coding')) constraints.push('no prior coding experience')
  if (goal.toLowerCase().includes('free')) constraints.push('prefer free resources')
  if (goal.toLowerCase().includes('work') || goal.toLowerCase().includes('job')) {
    constraints.push('career-focused')
  }
  if (constraints.length > 0) {
    context.constraints = constraints
  }

  return context
}

/**
 * Detect the type of goal
 */
function detectGoalType(goal: string): string {
  for (const { pattern, type } of GOAL_PATTERNS.goalType) {
    if (pattern.test(goal)) {
      return type
    }
  }
  return 'default'
}

/**
 * Detect the subject/topic
 */
function detectSubject(goal: string): string | undefined {
  for (const { pattern, subject } of GOAL_PATTERNS.subjects) {
    if (pattern.test(goal)) {
      return subject
    }
  }
  return undefined
}

// ============================================
// TEMPLATE APPLICATION
// ============================================

/**
 * Apply the appropriate template to enhance the goal
 */
function applyTemplate(
  goal: string,
  context: EnhancementContext,
  goalType: string
): string {
  const template = ENHANCEMENT_TEMPLATES[goalType] || ENHANCEMENT_TEMPLATES.default
  return template(context, goal)
}

// ============================================
// AI POLISH
// ============================================

/**
 * Use AI to polish and improve the enhanced prompt
 */
async function aiPolish(
  original: string,
  templateEnhanced: string,
  context: EnhancementContext
): Promise<{ enhanced: string; confidence: 'high' | 'medium' | 'low' }> {
  const openai = getOpenAIClient()

  const systemPrompt = `You are a prompt optimizer for a learning roadmap app. Your job is to take a user's learning goal and make it clearer and more actionable.

RULES:
1. Keep it concise (1-3 sentences max)
2. Make it specific and measurable
3. Add context if missing (level, timeframe, end goal)
4. Fix spelling and grammar
5. Don't add fluff or motivation
6. Keep the user's intent intact
7. Output ONLY the enhanced goal, nothing else

EXAMPLES:
Input: "i want to learn python fast"
Output: "Learn Python fundamentals in 2 weeks. Focus: Core syntax, data structures, and writing simple scripts. Starting from beginner level."

Input: "improve my math for sat"
Output: "Prepare for SAT Math section. Current level: intermediate. Focus: Problem-solving speed and common SAT question patterns. Timeline: exam preparation mode."

Input: "become a web developer"
Output: "Become job-ready as a frontend web developer. Starting from beginner level. Focus: HTML, CSS, JavaScript, and building portfolio projects. Goal: Land first developer role."`

  const userPrompt = `Original goal: "${original}"

Template-enhanced: "${templateEnhanced}"

Detected context:
- Level: ${context.skillLevel || 'not specified'}
- Timeframe: ${context.timeframe || 'not specified'}
- Constraints: ${context.constraints?.join(', ') || 'none'}

Make this goal clearer and more actionable. Return ONLY the enhanced goal text.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
    })

    const enhanced = completion.choices[0]?.message?.content?.trim() || templateEnhanced

    // Determine confidence based on response quality
    let confidence: 'high' | 'medium' | 'low' = 'medium'
    if (enhanced.length > original.length * 1.2 && enhanced.length < 500) {
      confidence = 'high'
    } else if (enhanced === original || enhanced === templateEnhanced) {
      confidence = 'low'
    }

    return { enhanced, confidence }
  } catch (error) {
    throw error
  }
}

// ============================================
// SUGGESTIONS GENERATION
// ============================================

/**
 * Generate helpful suggestions based on what's missing
 */
function generateSuggestions(
  context: EnhancementContext,
  goalType: string
): string[] {
  const suggestions: string[] = []

  if (context.skillLevel === 'unknown') {
    suggestions.push('Consider mentioning your current skill level (beginner, intermediate, advanced)')
  }

  if (!context.timeframe) {
    suggestions.push('Adding a timeframe helps create a more focused roadmap')
  }

  if (goalType === 'test_prep' && !context.timeframe) {
    suggestions.push('When is your exam? Adding a deadline helps prioritize what to study')
  }

  if (goalType === 'career' && !context.hoursPerWeek) {
    suggestions.push('How many hours per week can you dedicate? This affects the roadmap pace')
  }

  return suggestions.slice(0, 2) // Max 2 suggestions
}

// ============================================
// QUICK ENHANCEMENT (No AI, template only)
// ============================================

/**
 * Quick enhancement without AI - template only
 * Use when speed is critical or AI is unavailable
 */
export function enhancePromptQuick(userGoal: string): EnhancedPrompt {
  const trimmedGoal = userGoal.trim().slice(0, MAX_INPUT_LENGTH)

  if (trimmedGoal.length < 5) {
    return {
      original: userGoal,
      enhanced: userGoal,
      context: {},
      confidence: 'low',
    }
  }

  const context = extractContext(trimmedGoal)
  const goalType = detectGoalType(trimmedGoal)
  const enhanced = applyTemplate(trimmedGoal, context, goalType)

  return {
    original: userGoal,
    enhanced,
    context,
    confidence: 'medium',
    suggestions: generateSuggestions(context, goalType),
  }
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate if a goal is good enough for roadmap generation
 */
export function validateGoal(goal: string): {
  valid: boolean
  issues: string[]
  score: number // 0-100
} {
  const issues: string[] = []
  let score = 50 // Start at 50

  // Length check
  if (goal.length < 10) {
    issues.push('Goal is too short. Be more specific.')
    score -= 30
  } else if (goal.length > 20) {
    score += 10
  }

  // Contains subject/topic
  const subject = detectSubject(goal)
  if (subject) {
    score += 15
  } else {
    issues.push('Consider specifying what subject or skill you want to learn')
    score -= 10
  }

  // Contains timeframe
  const context = extractContext(goal)
  if (context.timeframe) {
    score += 15
  }

  // Contains level
  if (context.skillLevel && context.skillLevel !== 'unknown') {
    score += 10
  }

  // Goal type detected
  const goalType = detectGoalType(goal)
  if (goalType !== 'default') {
    score += 10
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score))

  return {
    valid: score >= 40 && goal.length >= 10,
    issues,
    score,
  }
}

// ============================================
// EXPORT HELPERS
// ============================================

export { detectGoalType, detectSubject, extractContext }
