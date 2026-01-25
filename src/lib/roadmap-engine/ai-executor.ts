/**
 * CLERVA AI EXECUTOR
 *
 * Single point of entry for all AI calls.
 * Ensures:
 * - Strict input validation
 * - Strict output validation
 * - Consistent error handling
 * - Rate limiting
 * - Logging
 *
 * The AI is a worker, not a decision maker.
 */

import OpenAI from 'openai'
import { AIRole, validateAIOutput } from './index'
import { getPromptForRole } from './prompts'
import logger from '@/lib/logger'

// ============================================
// CONFIGURATION
// ============================================

const OPENAI_TIMEOUT_MS = 30000 // 30 seconds
const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_RETRIES = 1

// Token limits per role (keep responses tight)
const TOKEN_LIMITS: Record<AIRole, number> = {
  roadmap_builder: 1200,      // Increased for constraints/risks
  mission_generator: 600,     // Increased for session risks
  explainer: 500,
  practice_generator: 400,
  confusion_detector: 200,
  progress_checker: 200,
  constraint_detector: 600,   // New: constraint analysis
  risk_analyzer: 800,         // New: risk analysis
  tradeoff_analyzer: 800,     // New: tradeoff analysis
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: OPENAI_TIMEOUT_MS,
  maxRetries: MAX_RETRIES,
})

// ============================================
// TYPES
// ============================================

export interface AIExecutionResult<T = unknown> {
  success: boolean
  data: T | null
  error?: string
  validationErrors?: string[]
  executionTimeMs: number
  fromCache: boolean
}

// ============================================
// MAIN EXECUTOR
// ============================================

/**
 * Execute an AI call with strict validation
 *
 * This is the ONLY way AI should be called in Clerva.
 * It ensures:
 * 1. Proper prompt selection
 * 2. Token limits enforced
 * 3. Output validation
 * 4. Error handling
 */
export async function executeAI<T = unknown>(
  role: AIRole,
  context: Record<string, unknown>
): Promise<AIExecutionResult<T>> {
  const startTime = Date.now()

  try {
    // 1. Get the prompt for this role
    const prompt = getPromptForRole(role, context)
    if (!prompt) {
      return {
        success: false,
        data: null,
        error: `Unknown AI role: ${role}`,
        executionTimeMs: Date.now() - startTime,
        fromCache: false,
      }
    }

    // 2. Execute the AI call
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.7,
      max_tokens: TOKEN_LIMITS[role] || 500,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content || ''

    // 3. Parse the response
    let parsed: unknown
    try {
      parsed = JSON.parse(responseText)
    } catch {
      logger.error('[AI Executor] Failed to parse JSON', { role, response: responseText.slice(0, 200) })
      return {
        success: false,
        data: null,
        error: 'AI returned invalid JSON',
        executionTimeMs: Date.now() - startTime,
        fromCache: false,
      }
    }

    // 4. Validate the output
    const validation = validateAIOutput(parsed, role)
    if (!validation.valid) {
      logger.warn('[AI Executor] Validation failed', { role, errors: validation.errors })
      return {
        success: false,
        data: null,
        error: 'AI output failed validation',
        validationErrors: validation.errors,
        executionTimeMs: Date.now() - startTime,
        fromCache: false,
      }
    }

    // 5. Success
    return {
      success: true,
      data: parsed as T,
      executionTimeMs: Date.now() - startTime,
      fromCache: false,
    }

  } catch (error) {
    logger.error('[AI Executor] Execution error', error instanceof Error ? error : { error })
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'AI execution failed',
      executionTimeMs: Date.now() - startTime,
      fromCache: false,
    }
  }
}

// ============================================
// TYPED EXECUTORS FOR EACH ROLE
// ============================================

/**
 * Build a roadmap from user goal
 */
export async function buildRoadmap(params: {
  userGoal: string
  userLevel: string
  timeframe: string
  subject: string
}): Promise<AIExecutionResult<{
  goal: string
  totalDuration: string
  steps: Array<{
    order: number
    title: string
    timeframe: string
    description: string
    method: string
    avoid: string[]
    doneWhen: string
  }>
  overallPitfalls: string[]
  successLooksLike: string
}>> {
  return executeAI('roadmap_builder', params)
}

/**
 * Generate today's mission from current step
 */
export async function generateMission(params: {
  currentStep: {
    id: string
    title: string
    description: string
    timeframe: string
  }
  userLevel: string
  timeAvailable: number
  previousProgress?: string
}): Promise<AIExecutionResult<{
  title: string
  estimatedMinutes: number
  actions: Array<{
    order: number
    instruction: string
    type: 'read' | 'practice' | 'review' | 'create' | 'test'
  }>
  avoid: string[]
  doneWhen: string
}>> {
  return executeAI('mission_generator', params)
}

/**
 * Explain a concept
 */
export async function explainConcept(params: {
  concept: string
  userLevel: string
  currentStep: {
    id: string
    title: string
    description: string
    timeframe: string
  }
  allowFullSolutions: boolean
}): Promise<AIExecutionResult<{
  concept: string
  coreIdea: string
  breakdown: Array<{
    point: string
    why: string
  }>
  commonMistake: string
  checkYourself: string
}>> {
  return executeAI('explainer', params)
}

/**
 * Generate practice problems
 */
export async function generatePractice(params: {
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  count: number
  currentStep: {
    id: string
    title: string
    description: string
    timeframe: string
  }
  allowFullSolutions: boolean
}): Promise<AIExecutionResult<{
  problems: Array<{
    id: string
    problem: string
    difficulty: 'easy' | 'medium' | 'hard'
    hint: string
    solution?: string
  }>
  focusArea: string
}>> {
  return executeAI('practice_generator', params)
}

/**
 * Detect confusion
 */
export async function detectConfusion(params: {
  userInput: string
  currentStep: {
    id: string
    title: string
    description: string
    timeframe: string
  }
  previousAttempts?: string[]
}): Promise<AIExecutionResult<{
  isConfused: boolean
  confusionArea: string
  likelyCause: string
  suggestion: string
}>> {
  return executeAI('confusion_detector', params)
}

/**
 * Check if user is ready to progress
 */
export async function checkProgress(params: {
  currentStep: {
    id: string
    title: string
    description: string
    timeframe: string
    completionCriteria: {
      type: 'time_spent' | 'practice_done' | 'self_report' | 'quiz_passed'
      threshold: number
    }
  }
  completedActions: string[]
  timeSpent: number
  practiceResults?: { correct: number; total: number }
}): Promise<AIExecutionResult<{
  ready: boolean
  confidence: 'high' | 'medium' | 'low'
  reason: string
  suggestion: string
}>> {
  return executeAI('progress_checker', params)
}
