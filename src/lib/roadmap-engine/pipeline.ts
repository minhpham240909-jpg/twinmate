/**
 * MULTI-PHASE AI PIPELINE ORCHESTRATOR
 *
 * Orchestrates the 6-prompt pipeline for generating professor-level roadmaps.
 * Optimized to run in 2-3 API calls instead of 6 for cost and latency.
 *
 * Pipeline Phases:
 * 1. Diagnostic (Call 1): Goal decomposition + Knowledge gap analysis
 * 2. Strategy (Call 2): Transformation design + Risk assessment + Learning strategy
 * 3. Execution (Call 3): Current step deep dive + Locked steps preview
 */

import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import logger from '@/lib/logger'

// Import prompt modules
import {
  COMBINED_DIAGNOSTIC_PROMPT,
  DIAGNOSTIC_RESPONSE_FORMAT,
  parseDiagnosticResponse,
  createFallbackDiagnostic,
  type DiagnosticResult,
} from './prompts/diagnostic'

import {
  COMBINED_STRATEGY_PROMPT,
  STRATEGY_RESPONSE_FORMAT,
  formatDiagnosticForStrategy,
  parseStrategyResponse,
  createFallbackStrategy,
  type StrategyResult,
} from './prompts/strategy'

import {
  COMBINED_EXECUTION_PROMPT,
  EXECUTION_RESPONSE_FORMAT,
  formatExecutionContext,
  calculateStepCount,
  parseExecutionResponse,
  createFallbackExecution,
  type ExecutionResult,
  type MicroTask,
} from './prompts/execution'

import {
  getPlatformsForSubject,
  getPlatformSearchUrl,
  detectCategory,
  type Platform,
} from '@/lib/platforms/platform-database'

// ============================================
// CONFIGURATION
// ============================================

const PIPELINE_CONFIG = {
  // API Configuration
  // Using gpt-4o-mini for balance of speed, quality, and cost
  // For premium users, can upgrade to gpt-4o for even better quality
  model: 'gpt-4o-mini', // Fast, smart, cost-effective
  timeout: 45000,

  // Token limits per phase
  // INCREASED for better quality - the execution phase especially needs more tokens
  // for detailed, actionable micro-tasks
  tokens: {
    diagnostic: 1000,   // Increased from 800 - need thorough gap analysis
    strategy: 1200,     // Increased from 1000 - need rich transformation narrative
    execution: 2500,    // SIGNIFICANTLY increased from 1500 - this is where actionability lives
  },

  // Temperature per phase (lower = more consistent, higher = more creative)
  // Execution phase lowered to ensure consistent, specific actionable output
  temperature: {
    diagnostic: 0.3, // Very consistent for analysis
    strategy: 0.5,   // Some creativity for vision
    execution: 0.3,  // LOWERED from 0.4 - we want SPECIFIC, consistent steps
  },

  // Retry configuration
  maxRetries: 2,
  retryDelay: 500,
}

// ============================================
// TYPES
// ============================================

export interface PipelineInput {
  goal: string
  subject?: string
  userContext?: string
  memoryContext?: string
}

export interface PipelineOutput {
  // Roadmap metadata
  title: string
  overview: string
  vision: string
  targetUser: string

  // Progress tracking
  totalSteps: number
  estimatedDays: number
  dailyCommitment: string
  totalMinutes: number

  // Success criteria
  successLooksLike: string
  successMetrics: string[]
  outOfScope: string[]

  // Steps (GPS-style)
  currentStep: {
    id: string
    order: number
    phase: 'NOW'
    title: string
    description: string
    whyFirst: string
    method: string
    timeBreakdown: {
      daily: string
      total: string
      flexible: string
    }
    risk: {
      warning: string
      consequence: string
      severity: string
    }
    commonMistakes: string[]
    doneWhen: string
    selfTest: {
      challenge: string
      passCriteria: string
    }
    abilities: string[]
    milestone?: string
    duration: number
    timeframe: string
    resources: {
      type: string
      title: string
      description?: string
      searchQuery?: string
      platformId?: string
      platformName?: string
      directUrl?: string
      priority?: number
    }[]
    microTasks: MicroTask[]
    isLocked: false
  }

  lockedSteps: {
    id: string
    order: number
    phase: 'NEXT' | 'LATER'
    title: string
    whyAfterPrevious: string
    previewAbilities: string[]
    milestone?: string
    estimatedDuration?: number
    resources: {
      type: string
      title: string
      searchQuery?: string
      platformId?: string
      platformName?: string
      directUrl?: string
    }[]
    isLocked: true
  }[]

  // Warnings
  criticalWarning: {
    warning: string
    consequence: string
    severity: 'CRITICAL'
  }
  pitfalls: string[]

  // Milestones
  milestones: {
    order: number
    title: string
    description: string
    marker: string
    unlocks: string
  }[]

  // Platforms
  recommendedPlatforms: {
    id: string
    name: string
    description: string
    url: string
    icon: string
    color: string
    searchUrl?: string
  }[]

  // Debug info (optional)
  _debug?: {
    diagnostic: DiagnosticResult
    strategy: StrategyResult
    execution: ExecutionResult
    timings: {
      diagnostic: number
      strategy: number
      execution: number
      total: number
    }
  }
}

// ============================================
// OPENAI CLIENT
// ============================================

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: PIPELINE_CONFIG.timeout,
      maxRetries: PIPELINE_CONFIG.maxRetries,
    })
  }
  return openaiClient
}

// ============================================
// PIPELINE EXECUTION
// ============================================

/**
 * Run the complete multi-phase pipeline
 */
export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const startTime = Date.now()
  const timings = { diagnostic: 0, strategy: 0, execution: 0, total: 0 }

  try {
    // ============================================
    // PHASE 1: DIAGNOSTIC
    // ============================================
    logger.info('[Pipeline] Starting diagnostic phase')
    const diagnosticStart = Date.now()

    const diagnostic = await runDiagnosticPhase(input)
    timings.diagnostic = Date.now() - diagnosticStart
    logger.info('[Pipeline] Diagnostic complete', { duration: timings.diagnostic })

    // ============================================
    // PHASE 2: STRATEGY
    // ============================================
    logger.info('[Pipeline] Starting strategy phase')
    const strategyStart = Date.now()

    const strategy = await runStrategyPhase(diagnostic)
    timings.strategy = Date.now() - strategyStart
    logger.info('[Pipeline] Strategy complete', { duration: timings.strategy })

    // ============================================
    // PHASE 3: EXECUTION
    // ============================================
    logger.info('[Pipeline] Starting execution phase')
    const executionStart = Date.now()

    const execution = await runExecutionPhase(diagnostic, strategy)
    timings.execution = Date.now() - executionStart
    logger.info('[Pipeline] Execution complete', { duration: timings.execution })

    // ============================================
    // ASSEMBLE OUTPUT
    // ============================================
    timings.total = Date.now() - startTime
    logger.info('[Pipeline] Complete', { totalDuration: timings.total })

    return assembleOutput(input, diagnostic, strategy, execution, timings)
  } catch (error) {
    logger.error('[Pipeline] Failed', error instanceof Error ? error : { error })
    timings.total = Date.now() - startTime

    // Return fallback roadmap
    return createFallbackOutput(input, timings)
  }
}

// ============================================
// PHASE RUNNERS
// ============================================

/**
 * Phase 1: Diagnostic - Understand the goal and gaps
 */
async function runDiagnosticPhase(input: PipelineInput): Promise<DiagnosticResult> {
  const openai = getOpenAI()

  const systemPrompt = COMBINED_DIAGNOSTIC_PROMPT
  const userPrompt = `User's learning goal: "${input.goal}"${input.subject ? `\nSubject area: ${input.subject}` : ''}${input.userContext ? `\nUser context: ${input.userContext}` : ''}

Analyze this goal and provide the diagnostic report in JSON format.

Expected JSON structure:
${DIAGNOSTIC_RESPONSE_FORMAT}`

  try {
    const completion = await openai.chat.completions.create({
      model: PIPELINE_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: PIPELINE_CONFIG.temperature.diagnostic,
      max_tokens: PIPELINE_CONFIG.tokens.diagnostic,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content || ''
    const parsed = parseDiagnosticResponse(responseText)

    if (!parsed) {
      logger.warn('[Pipeline] Diagnostic parse failed, using fallback')
      return createFallbackDiagnostic(input.goal)
    }

    // Ensure original goal is preserved
    parsed.goal.original = input.goal

    return parsed
  } catch (error) {
    logger.error('[Pipeline] Diagnostic API error', error instanceof Error ? error : { error })
    return createFallbackDiagnostic(input.goal)
  }
}

/**
 * Phase 2: Strategy - Design the transformation and assess risks
 */
async function runStrategyPhase(diagnostic: DiagnosticResult): Promise<StrategyResult> {
  const openai = getOpenAI()

  const diagnosticContext = formatDiagnosticForStrategy(diagnostic)
  const systemPrompt = COMBINED_STRATEGY_PROMPT.replace('{diagnosticContext}', diagnosticContext)

  const userPrompt = `Based on the diagnostic above, create the strategic framework.

Expected JSON structure:
${STRATEGY_RESPONSE_FORMAT}`

  try {
    const completion = await openai.chat.completions.create({
      model: PIPELINE_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: PIPELINE_CONFIG.temperature.strategy,
      max_tokens: PIPELINE_CONFIG.tokens.strategy,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content || ''
    const parsed = parseStrategyResponse(responseText)

    if (!parsed) {
      logger.warn('[Pipeline] Strategy parse failed, using fallback')
      return createFallbackStrategy(diagnostic)
    }

    return parsed
  } catch (error) {
    logger.error('[Pipeline] Strategy API error', error instanceof Error ? error : { error })
    return createFallbackStrategy(diagnostic)
  }
}

/**
 * Phase 3: Execution - Create detailed steps
 */
async function runExecutionPhase(
  diagnostic: DiagnosticResult,
  strategy: StrategyResult
): Promise<ExecutionResult> {
  const openai = getOpenAI()

  const stepCount = calculateStepCount(diagnostic)
  const { diagnosticContext, strategyContext } = formatExecutionContext(diagnostic, strategy)

  const systemPrompt = COMBINED_EXECUTION_PROMPT
    .replace('{diagnosticContext}', diagnosticContext)
    .replace('{strategyContext}', strategyContext)
    .replace(/{totalSteps}/g, String(stepCount))
    .replace(/{estimatedDays}/g, String(strategy.strategy.estimatedDays))
    .replace(/{dailyCommitment}/g, strategy.strategy.dailyCommitment)

  const userPrompt = `Create the execution plan with ${stepCount} total steps.

Expected JSON structure:
${EXECUTION_RESPONSE_FORMAT}`

  try {
    const completion = await openai.chat.completions.create({
      model: PIPELINE_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: PIPELINE_CONFIG.temperature.execution,
      max_tokens: PIPELINE_CONFIG.tokens.execution,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content || ''
    const parsed = parseExecutionResponse(responseText)

    if (!parsed) {
      logger.warn('[Pipeline] Execution parse failed, using fallback')
      return createFallbackExecution(diagnostic, strategy)
    }

    // Ensure critical warning from strategy is preserved
    parsed.criticalWarning = {
      warning: strategy.risks.critical.warning,
      consequence: strategy.risks.critical.consequence,
      severity: 'CRITICAL',
    }

    // Quality enforcement: Validate and enhance actionability
    const enhanced = enforceActionability(parsed, diagnostic.goal.clarified)

    return enhanced
  } catch (error) {
    logger.error('[Pipeline] Execution API error', error instanceof Error ? error : { error })
    return createFallbackExecution(diagnostic, strategy)
  }
}

/**
 * Enforce actionability quality standards on the execution output
 *
 * This catches cases where AI output is too vague and enhances it
 * with concrete, actionable details.
 */
function enforceActionability(execution: ExecutionResult, goal: string): ExecutionResult {
  const VAGUE_PATTERNS = [
    /^learn\s/i,
    /^study\s/i,
    /^practice\s/i,
    /^understand\s/i,
    /^review\s/i,
    /^explore\s/i,
    /^familiarize/i,
  ]

  const hasVagueStart = (text: string): boolean => {
    return VAGUE_PATTERNS.some(pattern => pattern.test(text.trim()))
  }

  // Enhance current step's method if too vague
  if (execution.currentStep?.method) {
    const lines = execution.currentStep.method.split('\n')
    const enhancedLines = lines.map(line => {
      if (hasVagueStart(line)) {
        // Add specificity: where, what, how to verify
        const dayMatch = line.match(/^(Day\s+\d+[^:]*:?\s*)/i)
        const prefix = dayMatch ? dayMatch[1] : ''
        const content = dayMatch ? line.slice(prefix.length) : line

        // Make it specific by adding platform and verification
        if (/learn|study/i.test(content)) {
          return `${prefix}Go to youtube.com, search "${goal} beginner tutorial". Watch the first video under 15 min. Write down 3 key concepts.`
        }
        if (/practice/i.test(content)) {
          return `${prefix}Open replit.com or your code editor. Create a new file. Write 5 examples of ${goal} concepts. Run to verify no errors.`
        }
        if (/review/i.test(content)) {
          return `${prefix}Close all notes. Set a 10-min timer. Write everything you remember about ${goal}. Then check notes and highlight gaps.`
        }
      }
      return line
    })
    execution.currentStep.method = enhancedLines.join('\n')
  }

  // Enhance micro-tasks if too vague
  if (execution.currentStep?.microTasks) {
    execution.currentStep.microTasks = execution.currentStep.microTasks.map(task => {
      if (hasVagueStart(task.description)) {
        // Enhance with WHERE, WHAT, HOW TO VERIFY
        if (/learn|study|watch/i.test(task.description)) {
          task.description = `Go to youtube.com, search "${goal} tutorial ${new Date().getFullYear()}". Watch the first result under 15 min. Pause every 3 min to write one key concept.`
          task.verificationMethod = `You have written at least 3 key concepts from the video`
        } else if (/practice|exercise/i.test(task.description)) {
          task.description = `Open replit.com or your preferred code editor. Create a new project. Write 5 examples practicing ${goal} concepts. Run to verify no errors.`
          task.verificationMethod = `Code runs without errors and you can explain what each line does`
        } else if (/review|test/i.test(task.description)) {
          task.description = `Close all notes. Set a 10-min timer. Write everything you remember about ${goal}. Then compare to notes.`
          task.verificationMethod = `You identified at least 2 gaps in your knowledge to review`
        }
      }
      return task
    })
  }

  // Enhance doneWhen if too vague
  if (execution.currentStep?.doneWhen && hasVagueStart(execution.currentStep.doneWhen)) {
    execution.currentStep.doneWhen = `You can explain the 3 core concepts of ${goal} out loud for 2 minutes without looking at notes. Record yourself to verify.`
  }

  return execution
}

// ============================================
// OUTPUT ASSEMBLY
// ============================================

/**
 * Assemble final output from all phases
 */
function assembleOutput(
  input: PipelineInput,
  diagnostic: DiagnosticResult,
  strategy: StrategyResult,
  execution: ExecutionResult,
  timings: { diagnostic: number; strategy: number; execution: number; total: number }
): PipelineOutput {
  // Get recommended platforms
  const detectedSubject = input.subject || detectCategory(input.goal) || input.goal
  const platforms = getPlatformsForSubject(detectedSubject, 3)
  const recommendedPlatforms = platforms.map((p: Platform) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    url: p.url,
    icon: p.icon,
    color: p.color,
    searchUrl: p.searchUrl ? getPlatformSearchUrl(p, input.goal.slice(0, 50)) : undefined,
  }))

  // Enhance resources with platform info
  const enhanceResources = (resources: { type: string; title: string; searchQuery?: string; priority?: number }[]) => {
    return resources.map(r => {
      // Find best platform for resource type based on features
      const platform = platforms.find(p => {
        if (r.type === 'video' && p.features.some(f => f.toLowerCase().includes('video'))) return true
        if (r.type === 'exercise' && p.features.some(f => f.toLowerCase().includes('practice') || f.toLowerCase().includes('interactive'))) return true
        if (r.type === 'article' && p.features.some(f => f.toLowerCase().includes('article') || f.toLowerCase().includes('documentation'))) return true
        return false
      }) || platforms[0]

      return {
        type: r.type,
        title: r.title,
        searchQuery: r.searchQuery,
        platformId: platform?.id,
        platformName: platform?.name,
        directUrl: platform?.searchUrl ? getPlatformSearchUrl(platform, r.searchQuery || r.title) : undefined,
        priority: r.priority,
      }
    })
  }

  // Build pitfalls from strategy risks
  const pitfalls = [
    `CRITICAL: ${strategy.risks.critical.warning} → ${strategy.risks.critical.consequence}`,
    ...strategy.risks.common.map(c => `${c.mistake} → ${c.consequence}`),
  ]

  return {
    // Metadata
    title: execution.title,
    overview: strategy.transformation.narrative,
    vision: strategy.transformation.vision,
    targetUser: strategy.transformation.identity,

    // Progress tracking
    totalSteps: execution.totalSteps,
    estimatedDays: execution.estimatedDays,
    dailyCommitment: execution.dailyCommitment,
    totalMinutes: execution.totalMinutes,

    // Success criteria
    successLooksLike: strategy.success.looksLike,
    successMetrics: strategy.success.metrics,
    outOfScope: strategy.success.outOfScope,

    // Current step (fully detailed)
    currentStep: {
      id: uuidv4(),
      order: execution.currentStep.order,
      phase: 'NOW',
      title: execution.currentStep.title,
      description: execution.currentStep.description,
      whyFirst: execution.currentStep.whyFirst,
      method: execution.currentStep.method,
      timeBreakdown: execution.currentStep.timeBreakdown,
      risk: execution.currentStep.risk,
      commonMistakes: execution.currentStep.commonMistakes,
      doneWhen: execution.currentStep.doneWhen,
      selfTest: execution.currentStep.selfTest,
      abilities: execution.currentStep.abilities,
      milestone: execution.currentStep.milestone,
      duration: execution.currentStep.duration,
      timeframe: execution.currentStep.timeframe,
      resources: enhanceResources(execution.currentStep.resources),
      microTasks: execution.currentStep.microTasks,
      isLocked: false as const,
    },

    // Locked steps (previews only)
    lockedSteps: execution.lockedSteps.map(ls => ({
      id: uuidv4(),
      order: ls.order,
      phase: ls.phase,
      title: ls.title,
      whyAfterPrevious: ls.whyAfterPrevious,
      previewAbilities: ls.previewAbilities,
      milestone: ls.milestone,
      estimatedDuration: ls.estimatedDuration,
      resources: enhanceResources(ls.resources),
      isLocked: true as const,
    })),

    // Warnings
    criticalWarning: execution.criticalWarning,
    pitfalls,

    // Milestones
    milestones: strategy.milestones,

    // Platforms
    recommendedPlatforms,

    // Debug info
    _debug: {
      diagnostic,
      strategy,
      execution,
      timings,
    },
  }
}

/**
 * Create fallback output when pipeline fails
 */
function createFallbackOutput(
  input: PipelineInput,
  timings: { diagnostic: number; strategy: number; execution: number; total: number }
): PipelineOutput {
  const diagnostic = createFallbackDiagnostic(input.goal)
  const strategy = createFallbackStrategy(diagnostic)
  const execution = createFallbackExecution(diagnostic, strategy)

  return assembleOutput(input, diagnostic, strategy, execution, timings)
}

// ============================================
// EXPORTS
// ============================================

export {
  DiagnosticResult,
  StrategyResult,
  ExecutionResult,
  MicroTask,
}
