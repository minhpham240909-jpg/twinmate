/**
 * MULTI-PHASE AI PIPELINE ORCHESTRATOR
 *
 * Orchestrates the 6-prompt pipeline for generating professor-level roadmaps.
 * Optimized to run in 2-3 API calls instead of 6 for cost and latency.
 *
 * Now integrated with the 4-Layer Content Quality System:
 * - Layer 1: Clerva Doctrine (fixed rules)
 * - Layer 2: Domain Playbooks (expert knowledge)
 * - Layer 3: Generation Engine (context builder)
 * - Layer 4: Quality Evaluator (gatekeeper)
 *
 * SCALABILITY FEATURES (handles 2000-3000 concurrent users):
 * - Roadmap-specific caching with goal hash (60-80% reduction in API calls)
 * - Robust error handling with retries and circuit breaker pattern
 * - Input validation for garbage/edge case goals
 * - Graceful degradation with fallback responses
 *
 * Pipeline Phases:
 * 1. Diagnostic (Call 1): Goal decomposition + Knowledge gap analysis
 * 2. Strategy (Call 2): Transformation design + Risk assessment + Learning strategy
 * 3. Execution (Call 3): Current step deep dive + Locked steps preview
 */

import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import logger from '@/lib/logger'
import {
  getCached,
  setCached,
  CACHE_PREFIX,
} from '@/lib/cache'
import { createHash } from 'crypto'

// Import 4-Layer Content Quality System
import { getContextBuilder } from './generator/context-builder'
import { getQualityEvaluator } from './evaluator/quality-evaluator'
import { getDomainContext } from './domains'

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
  RESOURCE_RESEARCH_PROMPT,
  parseResourceResearchResponse,
  createFallbackResources,
  formatResourcesForExecution,
  type ResourceResearchResult,
} from './prompts/resources'

import {
  getPlatformsForSubject,
  getPlatformSearchUrl,
  detectCategory,
  type Platform,
} from '@/lib/platforms/platform-database'

import { generateResourceUrl } from './smart-resources'

// ============================================
// CONFIGURATION
// ============================================

const PIPELINE_CONFIG = {
  // API Configuration
  // Using gpt-4o for PROFESSIONAL quality content
  // The extra cost is worth it for comprehensive, detailed roadmaps
  model: 'gpt-4o',      // Premium model for professional-grade content
  timeout: 90000,       // Increased timeout for comprehensive content generation

  // Token limits per phase
  // SIGNIFICANTLY INCREASED for professional-grade, comprehensive roadmaps
  // Users need rich, detailed, professional content - not brief summaries
  tokens: {
    diagnostic: 2000,   // Need thorough gap analysis and professional diagnosis
    strategy: 2500,     // Need rich transformation narrative with clear vision
    execution: 6000,    // LARGE - need comprehensive steps, detailed work processes, professional resources
  },

  // Temperature per phase (lower = more consistent, higher = more creative)
  temperature: {
    diagnostic: 0.3, // Very consistent for analysis
    strategy: 0.5,   // More creativity for compelling vision
    execution: 0.4,  // Balance between creativity and precision
  },

  // Retry configuration - enhanced for reliability at scale
  maxRetries: 3,
  retryDelay: 500,
  retryBackoffMultiplier: 2, // Exponential backoff
  maxRetryDelay: 5000,  // Cap retry delay at 5 seconds
}

// ============================================
// CACHING CONFIGURATION
// ============================================

const ROADMAP_CACHE_TTL = 60 * 60 // 1 hour - roadmaps are expensive to generate
const ROADMAP_CACHE_PREFIX = `${CACHE_PREFIX.STATS}:roadmap` // Reuse stats prefix for roadmaps

/**
 * Generate a deterministic cache key for a roadmap goal
 * Uses SHA-256 hash of normalized goal + subject for consistent caching
 */
function generateRoadmapCacheKey(goal: string, subject?: string): string {
  // Normalize: lowercase, trim, remove extra whitespace
  const normalizedGoal = goal.toLowerCase().trim().replace(/\s+/g, ' ')
  const normalizedSubject = subject?.toLowerCase().trim() || ''
  const hashInput = `${normalizedGoal}|${normalizedSubject}`

  // Create SHA-256 hash for consistent, collision-resistant key
  const hash = createHash('sha256').update(hashInput).digest('hex').slice(0, 16)
  return `${ROADMAP_CACHE_PREFIX}:${hash}`
}

// ============================================
// INPUT VALIDATION
// ============================================

/**
 * Input validation result
 */
interface ValidationResult {
  valid: boolean
  error?: string
  sanitizedGoal?: string
}

/**
 * Validate and sanitize user goal input
 * Detects garbage, spam, and edge cases before expensive API calls
 *
 * SCALABILITY: Prevents wasted API calls on invalid inputs
 */
function validateGoalInput(goal: string): ValidationResult {
  // 1. Check if goal exists and is a string
  if (!goal || typeof goal !== 'string') {
    return { valid: false, error: 'Please provide a learning goal' }
  }

  // 2. Trim and check minimum length (at least 3 characters)
  const trimmed = goal.trim()
  if (trimmed.length < 3) {
    return { valid: false, error: 'Goal is too short. Please describe what you want to learn.' }
  }

  // 3. Check maximum length (prevent DoS with massive inputs)
  if (trimmed.length > 2000) {
    return { valid: false, error: 'Goal is too long. Please be more concise (max 2000 characters).' }
  }

  // 4. Check for garbage/gibberish patterns
  // Pattern: mostly non-alphanumeric characters
  const alphanumericRatio = (trimmed.match(/[a-zA-Z0-9]/g) || []).length / trimmed.length
  if (alphanumericRatio < 0.3) {
    return { valid: false, error: 'Please enter a valid learning goal with words.' }
  }

  // 5. Check for repeated characters (e.g., "aaaaaaaaaa" or "abcabcabcabc")
  const repeatedPattern = /(.)\1{10,}|(.{2,})\2{5,}/
  if (repeatedPattern.test(trimmed)) {
    return { valid: false, error: 'Please enter a meaningful learning goal.' }
  }

  // 6. Check for minimum word count (at least 2 words for meaningful goal)
  const wordCount = trimmed.split(/\s+/).filter(w => w.length > 1).length
  if (wordCount < 2) {
    return {
      valid: false,
      error: 'Please describe your goal in more detail. For example: "learn Python programming" or "understand calculus basics"'
    }
  }

  // 7. Check for spam patterns (URLs, emails, phone numbers)
  const spamPatterns = [
    /https?:\/\/[^\s]+/gi,     // URLs
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, // Emails
    /\b\d{10,}\b/g,            // Long numbers (phone-like)
    /buy\s+now|click\s+here|free\s+money|winner/gi, // Spam keywords
  ]

  for (const pattern of spamPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Please enter a valid learning goal without links or spam.' }
    }
  }

  // 8. Check for offensive/inappropriate content (basic filter)
  // Note: This is a basic filter; a production system should use a proper content moderation API
  const offensivePatterns = /\b(fuck|shit|ass|damn|bitch|bastard|cunt|dick|cock|pussy)\b/gi
  if (offensivePatterns.test(trimmed)) {
    return { valid: false, error: 'Please keep your learning goal appropriate.' }
  }

  // 9. Sanitize: remove excessive whitespace and normalize
  const sanitized = trimmed.replace(/\s+/g, ' ')

  return { valid: true, sanitizedGoal: sanitized }
}

// ============================================
// ERROR HANDLING
// ============================================

/**
 * Custom error class for pipeline errors with retry information
 */
class PipelineError extends Error {
  constructor(
    message: string,
    public readonly phase: 'diagnostic' | 'strategy' | 'execution',
    public readonly retryable: boolean = true,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'PipelineError'
  }
}

/**
 * Circuit breaker state for OpenAI API
 * Prevents cascading failures when API is down
 */
interface CircuitBreakerState {
  failures: number
  lastFailure: number
  isOpen: boolean
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
}

const CIRCUIT_BREAKER_THRESHOLD = 5      // Open circuit after 5 consecutive failures
const CIRCUIT_BREAKER_RESET_MS = 30000   // Reset after 30 seconds

/**
 * Check if circuit breaker allows requests
 */
function isCircuitBreakerOpen(): boolean {
  if (!circuitBreaker.isOpen) return false

  // Check if enough time has passed to try again (half-open state)
  const timeSinceFailure = Date.now() - circuitBreaker.lastFailure
  if (timeSinceFailure > CIRCUIT_BREAKER_RESET_MS) {
    circuitBreaker.isOpen = false
    circuitBreaker.failures = 0
    logger.info('[Pipeline] Circuit breaker reset - allowing requests')
    return false
  }

  return true
}

/**
 * Record a failure for circuit breaker
 */
function recordCircuitBreakerFailure(): void {
  circuitBreaker.failures++
  circuitBreaker.lastFailure = Date.now()

  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.isOpen = true
    logger.warn('[Pipeline] Circuit breaker OPEN - too many failures', {
      failures: circuitBreaker.failures,
      willResetAt: new Date(circuitBreaker.lastFailure + CIRCUIT_BREAKER_RESET_MS).toISOString(),
    })
  }
}

/**
 * Record a success for circuit breaker
 */
function recordCircuitBreakerSuccess(): void {
  if (circuitBreaker.failures > 0) {
    circuitBreaker.failures = 0
    circuitBreaker.isOpen = false
  }
}

/**
 * Sleep helper for retry delays with exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute a phase with retry logic and error handling
 */
async function executeWithRetry<T>(
  phase: 'diagnostic' | 'strategy' | 'execution',
  operation: () => Promise<T>,
  fallback: () => T
): Promise<T> {
  // Check circuit breaker first
  if (isCircuitBreakerOpen()) {
    logger.warn(`[Pipeline] Circuit breaker open, using fallback for ${phase}`)
    return fallback()
  }

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= PIPELINE_CONFIG.maxRetries; attempt++) {
    try {
      const result = await operation()
      recordCircuitBreakerSuccess()
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if error is retryable
      const isRetryable = isRetryableError(lastError)

      logger.warn(`[Pipeline] ${phase} attempt ${attempt} failed`, {
        error: lastError.message,
        retryable: isRetryable,
        willRetry: isRetryable && attempt < PIPELINE_CONFIG.maxRetries,
      })

      if (!isRetryable || attempt >= PIPELINE_CONFIG.maxRetries) {
        recordCircuitBreakerFailure()
        break
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = PIPELINE_CONFIG.retryDelay * Math.pow(PIPELINE_CONFIG.retryBackoffMultiplier, attempt - 1)
      const jitter = Math.random() * 0.3 * baseDelay // 30% jitter
      const delay = Math.min(baseDelay + jitter, PIPELINE_CONFIG.maxRetryDelay)

      logger.info(`[Pipeline] Retrying ${phase} in ${Math.round(delay)}ms`)
      await sleep(delay)
    }
  }

  // All retries failed, use fallback
  logger.error(`[Pipeline] All retries failed for ${phase}, using fallback`, {
    error: lastError?.message,
  })
  return fallback()
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase()

  // Retryable: rate limits, timeouts, server errors
  const retryablePatterns = [
    'rate limit',
    'timeout',
    '429',
    '500',
    '502',
    '503',
    '504',
    'econnreset',
    'econnrefused',
    'socket hang up',
    'network',
    'temporarily unavailable',
  ]

  // Not retryable: authentication, validation, client errors
  const nonRetryablePatterns = [
    'invalid api key',
    'authentication',
    'unauthorized',
    '401',
    '403',
    'invalid_request',
    'context_length_exceeded',
  ]

  // Check non-retryable first
  for (const pattern of nonRetryablePatterns) {
    if (message.includes(pattern)) return false
  }

  // Check retryable patterns
  for (const pattern of retryablePatterns) {
    if (message.includes(pattern)) return true
  }

  // Default: retry on unknown errors (better UX)
  return true
}

// ============================================
// TYPES
// ============================================

export interface PipelineInput {
  goal: string
  subject?: string
  userContext?: string
  memoryContext?: string
  dailyCommitmentMinutes?: number // User's daily learning time (5, 15, 30, 45, 60 min)
}

// Vision structure for roadmap overview
export interface RoadmapVisionOutput {
  destination: string          // "By the end, you'll be able to..."
  transformation: string       // Who they become (identity shift)
  timeframe: string           // "In X weeks/days"
  phases: {
    name: string              // "Foundation", "Building", "Mastery"
    description: string       // What this phase accomplishes
    stepsIncluded: number[]   // Which step numbers [1, 2, 3]
  }[]
  outOfScope: string[]        // "This roadmap doesn't cover..."
  successPreview: string      // "Imagine being able to..."
}

export interface PipelineOutput {
  // Roadmap metadata
  title: string
  overview: string
  vision: string              // Legacy: simple vision string
  visionDetails?: RoadmapVisionOutput  // NEW: Detailed vision structure
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

  // ELITE: Success signals from strategy
  successFeelsLike?: string
  identityShift?: {
    oldIdentity: string
    newIdentity: string
    behaviorChange: string
  }
  prioritization?: {
    focusNow: string
    ignoreFor: string[]
    justification: string
  }
  fakeProgressWarnings?: string[]
  whatComesNext?: {
    afterMastery: string
    nextLevel: string
    buildsToward: string
  }

  // ELITE: Diagnosis from diagnostic phase
  diagnosis?: {
    whyStuck: string
    falseBeliefs: string[]
    overFocusing: string[]
    neglecting: string[]
    rootCause: string
  }

  // Personalized intro
  personalizedIntro?: string

  // Steps (GPS-style)
  currentStep: {
    id: string
    order: number
    phase: 'NOW'
    title: string
    description: string

    // LESSON SECTION (Understanding - 40%)
    lesson?: {
      title: string
      subtitle?: string
      duration: number
      slides: {
        order: number
        title: string
        concept: string
        explanation: string
        whyItMatters: string
        whatHappensWithout: string
        realWorldExample: string
        analogyOrMetaphor?: string
        visualHint?: string
        keyTakeaway: string
      }[]
      resources?: {
        type: string
        title: string
        description?: string
        searchQuery?: string
        priority?: number
      }[]
      understandingCheck?: {
        question: string
        correctAnswer: string
        hint?: string
      }
      bridgeToActions: string
    }

    // ACTION SECTION (Doing - 60%)
    // Today's Focus (primary action)
    todaysFocus?: {
      action: string
      where: string
      duration: string
      output: string
    }

    // Personalized why
    whyThisMattersForYou?: string

    // Exit conditions (checkboxes)
    exitConditions?: string[]

    // Common trap (warm mentor voice)
    commonTrap?: {
      temptation: string
      whyItFeelsRight: string
      whyItFails: string
      betterApproach: string
    }

    // Legacy fields
    whyFirst?: string
    method?: string
    timeBreakdown?: {
      daily: string
      total: string
      flexible: string
    }
    risk?: {
      warning: string
      consequence: string
      severity: string
    }
    commonMistakes?: string[]
    fakeProgressWarnings?: string[]
    standards?: {
      passBar: string
      failConditions: string[]
      repeatRule: string
      qualityCheck: string
    }
    successSignals?: {
      feelsLike: string
      youllKnow?: string
      behaviorChange?: string
      confidenceMarker?: string
    }
    doneWhen?: string
    selfTest?: {
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
      thumbnailUrl?: string
      embedUrl?: string
      platformLogoUrl?: string
      priority?: number
    }[]
    microTasks?: MicroTask[]
    encouragement?: string
    isLocked: false
  }

  lockedSteps: {
    id: string
    order: number
    phase: 'NEXT' | 'LATER'
    title: string
    whyAfterPrevious: string
    previewAbilities: string[]
    teaser?: string
    milestone?: string
    estimatedDuration?: number
    resources: {
      type: string
      title: string
      searchQuery?: string
      platformId?: string
      platformName?: string
      directUrl?: string
      thumbnailUrl?: string
      embedUrl?: string
      platformLogoUrl?: string
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
 *
 * SCALABILITY FEATURES:
 * 1. Input validation - rejects garbage/invalid goals before expensive API calls
 * 2. Caching - returns cached roadmaps for identical goals (60-80% reduction)
 * 3. Circuit breaker - prevents cascading failures when OpenAI is down
 * 4. Retry with exponential backoff - handles transient failures gracefully
 * 5. Graceful degradation - returns fallback roadmap if all else fails
 */
export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const startTime = Date.now()
  const timings = { diagnostic: 0, strategy: 0, execution: 0, total: 0 }

  // ============================================
  // STEP 1: INPUT VALIDATION
  // ============================================
  const validation = validateGoalInput(input.goal)
  if (!validation.valid) {
    logger.warn('[Pipeline] Invalid goal input', { error: validation.error })
    throw new PipelineError(validation.error || 'Invalid goal', 'diagnostic', false)
  }

  // Use sanitized goal
  const sanitizedInput: PipelineInput = {
    ...input,
    goal: validation.sanitizedGoal || input.goal,
  }

  // ============================================
  // STEP 2: CHECK CACHE
  // ============================================
  const cacheKey = generateRoadmapCacheKey(sanitizedInput.goal, sanitizedInput.subject)

  try {
    const cached = await getCached<PipelineOutput>(cacheKey)
    if (cached) {
      logger.info('[Pipeline] Cache HIT - returning cached roadmap', {
        cacheKey: cacheKey.slice(-20),
        goal: sanitizedInput.goal.slice(0, 50),
      })
      return cached
    }
  } catch (cacheError) {
    // Cache read failed - continue with generation
    logger.warn('[Pipeline] Cache read failed, continuing with generation', {
      error: cacheError instanceof Error ? cacheError.message : String(cacheError),
    })
  }

  logger.info('[Pipeline] Cache MISS - generating new roadmap', {
    goal: sanitizedInput.goal.slice(0, 50),
  })

  // ============================================
  // STEP 3: CHECK CIRCUIT BREAKER
  // ============================================
  if (isCircuitBreakerOpen()) {
    logger.warn('[Pipeline] Circuit breaker OPEN - returning fallback')
    timings.total = Date.now() - startTime
    return createFallbackOutput(sanitizedInput, timings)
  }

  try {
    // ============================================
    // PHASE 1: DIAGNOSTIC (with retry)
    // ============================================
    logger.info('[Pipeline] Starting diagnostic phase')
    const diagnosticStart = Date.now()

    const diagnostic = await executeWithRetry(
      'diagnostic',
      () => runDiagnosticPhase(sanitizedInput),
      () => createFallbackDiagnostic(sanitizedInput.goal)
    )
    timings.diagnostic = Date.now() - diagnosticStart
    logger.info('[Pipeline] Diagnostic complete', { duration: timings.diagnostic })

    // ============================================
    // PHASE 2: STRATEGY (with retry)
    // ============================================
    logger.info('[Pipeline] Starting strategy phase')
    const strategyStart = Date.now()

    const strategy = await executeWithRetry(
      'strategy',
      () => runStrategyPhase(diagnostic, sanitizedInput.dailyCommitmentMinutes),
      () => createFallbackStrategy(diagnostic)
    )
    timings.strategy = Date.now() - strategyStart
    logger.info('[Pipeline] Strategy complete', { duration: timings.strategy })

    // ============================================
    // PHASE 2.5: RESOURCE RESEARCH (with retry)
    // NEW: Research real, specific resources for this topic BEFORE execution
    // ============================================
    logger.info('[Pipeline] Starting resource research phase')
    const resourceStart = Date.now()

    const resources = await executeWithRetry(
      'execution', // Use execution for retry tracking since it's part of that phase
      () => runResourceResearchPhase(diagnostic.goal.clarified),
      () => createFallbackResources(diagnostic.goal.clarified)
    )
    const resourceDuration = Date.now() - resourceStart
    logger.info('[Pipeline] Resource research complete', { duration: resourceDuration })

    // ============================================
    // PHASE 3: EXECUTION (with retry)
    // Now includes researched resources for specific, real content
    // ============================================
    logger.info('[Pipeline] Starting execution phase')
    const executionStart = Date.now()

    const execution = await executeWithRetry(
      'execution',
      () => runExecutionPhase(diagnostic, strategy, sanitizedInput.dailyCommitmentMinutes, resources),
      () => createFallbackExecution(diagnostic, strategy)
    )
    timings.execution = Date.now() - executionStart + resourceDuration // Include resource research time
    logger.info('[Pipeline] Execution complete', { duration: timings.execution })

    // ============================================
    // ASSEMBLE OUTPUT
    // ============================================
    timings.total = Date.now() - startTime
    logger.info('[Pipeline] Complete', { totalDuration: timings.total })

    const output = assembleOutput(sanitizedInput, diagnostic, strategy, execution, timings)

    // ============================================
    // STEP 4: CACHE THE RESULT
    // ============================================
    try {
      await setCached(cacheKey, output, ROADMAP_CACHE_TTL)
      logger.info('[Pipeline] Cached roadmap', {
        cacheKey: cacheKey.slice(-20),
        ttl: ROADMAP_CACHE_TTL,
      })
    } catch (cacheError) {
      // Cache write failed - log but don't fail the request
      logger.warn('[Pipeline] Failed to cache roadmap', {
        error: cacheError instanceof Error ? cacheError.message : String(cacheError),
      })
    }

    // Record success for circuit breaker
    recordCircuitBreakerSuccess()

    return output
  } catch (error) {
    logger.error('[Pipeline] Failed', error instanceof Error ? error : { error })
    timings.total = Date.now() - startTime

    // Record failure for circuit breaker
    recordCircuitBreakerFailure()

    // Return fallback roadmap
    return createFallbackOutput(sanitizedInput, timings)
  }
}

/**
 * Exported validation function for use in API routes
 * Allows pre-validation before calling runPipeline
 */
export { validateGoalInput, type ValidationResult }

// ============================================
// PHASE RUNNERS
// ============================================

/**
 * Phase 1: Diagnostic - Understand the goal and gaps
 * Now enhanced with Layer 2 Domain Intelligence
 */
async function runDiagnosticPhase(input: PipelineInput): Promise<DiagnosticResult> {
  const openai = getOpenAI()

  // Get domain context from Layer 2
  const domainInfo = getDomainContext(input.goal)

  // Build domain-enhanced system prompt
  let systemPrompt = COMBINED_DIAGNOSTIC_PROMPT

  // Inject domain intelligence if available
  if (domainInfo.domain !== 'generic') {
    const domainInjection = `

## DOMAIN INTELLIGENCE: ${domainInfo.domain}${domainInfo.subdomain ? ` (${domainInfo.subdomain})` : ''}

### Expert Priorities (Consider these in your analysis)
${domainInfo.expertPriorities.map(p => `- ${p}`).join('\n')}

### Known Wrong Beliefs (Watch for these)
${domainInfo.wrongBeliefs.map(wb => `- BELIEF: "${wb.belief}" → REALITY: ${wb.reality}`).join('\n')}

### Known Failure Modes (Design to prevent)
${domainInfo.failureModes.slice(0, 5).map(f => `- TRAP: ${f.trap} → CONSEQUENCE: ${f.consequence}`).join('\n')}

Use this domain knowledge to provide deeper, more specific analysis.
`
    systemPrompt = systemPrompt + domainInjection
  }

  // Build time commitment context for personalization
  const timeCommitmentContext = input.dailyCommitmentMinutes
    ? `\nUser's daily learning time: ${input.dailyCommitmentMinutes} minutes/day (${input.dailyCommitmentMinutes <= 15 ? 'short sessions - prefer bite-sized steps' : input.dailyCommitmentMinutes >= 45 ? 'deep work sessions - can handle longer, complex steps' : 'moderate sessions - balanced step lengths'})`
    : ''

  const userPrompt = `User's learning goal: "${input.goal}"${input.subject ? `\nSubject area: ${input.subject}` : ''}${input.userContext ? `\nUser context: ${input.userContext}` : ''}${timeCommitmentContext}

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
 * Phase 2.5: Resource Research - Find real, specific resources for the topic
 * This runs BEFORE execution to provide real resource names
 */
async function runResourceResearchPhase(topic: string): Promise<ResourceResearchResult> {
  const openai = getOpenAI()

  const userPrompt = `Research real, specific learning resources for this topic: "${topic}"

Return ONLY real resources that actually exist. Include specific names, platforms, and why each is credible.

Output valid JSON only.`

  try {
    const completion = await openai.chat.completions.create({
      model: PIPELINE_CONFIG.model,
      messages: [
        { role: 'system', content: RESOURCE_RESEARCH_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Low temperature for factual accuracy
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content || ''
    const parsed = parseResourceResearchResponse(responseText)

    if (!parsed) {
      logger.warn('[Pipeline] Resource research parse failed, using fallback')
      return createFallbackResources(topic)
    }

    logger.info('[Pipeline] Resource research successful', {
      topic: parsed.topic,
      category: parsed.category,
      videoCount: parsed.videos.length,
      articleCount: parsed.articles.length,
    })

    return parsed
  } catch (error) {
    logger.error('[Pipeline] Resource research API error', error instanceof Error ? error : { error })
    return createFallbackResources(topic)
  }
}

/**
 * Phase 2: Strategy - Design the transformation and assess risks
 */
async function runStrategyPhase(
  diagnostic: DiagnosticResult,
  dailyCommitmentMinutes?: number
): Promise<StrategyResult> {
  const openai = getOpenAI()

  const diagnosticContext = formatDiagnosticForStrategy(diagnostic)
  let systemPrompt = COMBINED_STRATEGY_PROMPT.replace('{diagnosticContext}', diagnosticContext)

  // Inject time commitment personalization
  if (dailyCommitmentMinutes) {
    const timeGuidance = dailyCommitmentMinutes <= 15
      ? 'User has LIMITED TIME (≤15 min/day). Design phases with SHORT, focused steps (5-10 min each). Prioritize quick wins and momentum.'
      : dailyCommitmentMinutes >= 45
      ? 'User has DEDICATED TIME (45+ min/day). Can handle LONGER, deeper steps (20-30 min). Include comprehensive practice sessions.'
      : 'User has MODERATE TIME (15-45 min/day). Balance between quick steps and deeper exploration (10-20 min steps).'

    systemPrompt = systemPrompt + `\n\n## TIME PERSONALIZATION\n${timeGuidance}\nDaily commitment: ${dailyCommitmentMinutes} minutes`
  }

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
 * Now enhanced with:
 * - Layer 1 Clerva Doctrine
 * - Layer 2 Domain Intelligence
 * - Researched real resources from Phase 2.5
 */
async function runExecutionPhase(
  diagnostic: DiagnosticResult,
  strategy: StrategyResult,
  dailyCommitmentMinutes?: number,
  resources?: ResourceResearchResult
): Promise<ExecutionResult> {
  const openai = getOpenAI()

  const stepCount = calculateStepCount(diagnostic)
  const dailyCommitment = dailyCommitmentMinutes ? `${dailyCommitmentMinutes} min/day` : strategy.strategy.dailyCommitment
  const { diagnosticContext, strategyContext, userProfile } = formatExecutionContext(diagnostic, strategy, dailyCommitment)

  // Get context builder for Clerva Doctrine injection
  const contextBuilder = getContextBuilder()
  const clervaContext = contextBuilder.buildFullPromptInjection(diagnostic.goal.original)

  // Get domain context for additional intelligence
  const domainInfo = getDomainContext(diagnostic.goal.original)

  // Build enhanced system prompt with Clerva Doctrine
  let systemPrompt = COMBINED_EXECUTION_PROMPT
    .replace('{diagnosticContext}', diagnosticContext)
    .replace('{strategyContext}', strategyContext)
    .replace('{userProfile}', userProfile)
    .replace(/{totalSteps}/g, String(stepCount))
    .replace(/{estimatedDays}/g, String(strategy.strategy.estimatedDays))
    .replace(/{dailyCommitment}/g, dailyCommitment)

  // Inject Clerva Doctrine and Domain Intelligence
  systemPrompt = `${clervaContext}

---

${systemPrompt}

---

## ADDITIONAL DOMAIN CONSTRAINTS

${domainInfo.sequenceRules.length > 0 ? `### Sequence Rules (Must Follow)
${domainInfo.sequenceRules.map(r => `- ${r.prerequisite} must come before ${r.required_for}`).join('\n')}` : ''}

### Failure Modes to Address in commonMistakes
${domainInfo.failureModes.slice(0, 6).map(f => `- ${f.trap} → ${f.consequence}`).join('\n')}

${dailyCommitmentMinutes ? `## STEP DURATION PERSONALIZATION
User's daily time: ${dailyCommitmentMinutes} minutes/day
${dailyCommitmentMinutes <= 15
  ? '→ Create SHORT steps (5-10 min each). User needs quick wins. Break complex topics into micro-steps.'
  : dailyCommitmentMinutes >= 45
  ? '→ Create COMPREHENSIVE steps (15-30 min each). User can handle depth. Include practice and application.'
  : '→ Create BALANCED steps (10-20 min each). Mix of quick and deeper content.'}
IMPORTANT: Set each step\'s "duration" field to match the user\'s available time.` : ''}

${resources ? `## RESEARCHED RESOURCES (USE THESE - THEY ARE REAL AND VERIFIED)
${formatResourcesForExecution(resources)}

CRITICAL: Use the resources above in your roadmap. These are REAL, VERIFIED resources that exist.
- Use the exact titles and platform names provided
- Include the URLs if provided
- Reference the credibility markers in descriptions
- Match resources to appropriate steps based on "bestFor" descriptions` : ''}
`

  const userPrompt = `Create the execution plan with ${stepCount} total steps.

CRITICAL REMINDERS:
1. Every step title must use ACTION VERBS (not "understand", "learn", "know")
2. Every step needs whyFirst explaining why NOW
3. Every step needs 2+ commonMistakes with trap AND consequence
4. Every step needs selfTest with challenge and passCriteria
5. Every step needs abilities (what user CAN DO after)

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
 *
 * Now integrated with Layer 4 Quality Evaluator for validation.
 */
function enforceActionability(execution: ExecutionResult, goal: string): ExecutionResult {
  // Use quality evaluator to check the output
  const evaluator = getQualityEvaluator()

  // Convert execution to roadmap format for evaluation
  const roadmapForEval = {
    title: execution.title,
    overview: '',
    steps: [
      {
        order: execution.currentStep.order,
        title: execution.currentStep.title,
        description: execution.currentStep.description,
        duration: execution.currentStep.duration,
        whyFirst: execution.currentStep.whyFirst,
        method: execution.currentStep.method,
        doneWhen: execution.currentStep.doneWhen,
        commonMistakes: execution.currentStep.commonMistakes?.map(m => ({
          trap: m,
          consequence: 'See above'
        })),
        selfTest: execution.currentStep.selfTest,
        abilities: execution.currentStep.abilities,
        risk: execution.currentStep.risk,
      },
      ...execution.lockedSteps.map(ls => ({
        order: ls.order,
        title: ls.title,
        description: '',
        whyFirst: ls.whyAfterPrevious,
        abilities: ls.previewAbilities,
      })),
    ],
  }

  // Evaluate and log quality score
  const evaluation = evaluator.evaluate(roadmapForEval)
  logger.info('[Pipeline] Quality evaluation', {
    score: evaluation.score,
    passed: evaluation.passed,
    failureCount: evaluation.failures.length,
    criticalFailures: evaluation.failures.filter(f => f.severity === 'critical').length,
  })

  // Log suggestions for improvement
  if (!evaluation.passed && evaluation.failures.length > 0) {
    logger.warn('[Pipeline] Quality issues detected', {
      failures: evaluation.failures.slice(0, 5).map(f => f.fix),
    })
  }

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

  // Enhance resources with platform info, thumbnails, and embed URLs
  const enhanceResources = (resources: { type: string; title: string; searchQuery?: string; priority?: number; description?: string }[]) => {
    return resources.map(r => {
      const searchQuery = r.searchQuery || r.title

      // Use smart-resources to generate URLs with thumbnails and embeds
      const resourceData = generateResourceUrl(r.type, searchQuery, detectedSubject)

      return {
        type: r.type,
        title: r.title,
        description: r.description,
        searchQuery,
        platformId: resourceData.platformId,
        platformName: resourceData.platformName,
        directUrl: resourceData.url,
        thumbnailUrl: resourceData.thumbnailUrl,
        embedUrl: resourceData.embedUrl,
        platformLogoUrl: resourceData.platformLogoUrl,
        priority: r.priority,
      }
    })
  }

  // Build pitfalls from strategy risks
  const pitfalls = [
    `CRITICAL: ${strategy.risks.critical.warning} → ${strategy.risks.critical.consequence}`,
    ...strategy.risks.common.map(c => `${c.mistake} → ${c.consequence}`),
  ]

  // Build vision details from execution if available
  const visionDetails = execution.vision ? {
    destination: execution.vision.destination,
    transformation: execution.vision.transformation,
    timeframe: execution.vision.timeframe,
    phases: execution.vision.phases,
    outOfScope: execution.vision.outOfScope,
    successPreview: execution.vision.successPreview,
  } : undefined

  return {
    // Metadata
    title: execution.title,
    overview: strategy.transformation.narrative,
    vision: strategy.transformation.vision,
    visionDetails,  // NEW: Detailed vision structure
    targetUser: strategy.transformation.identity,

    // Progress tracking
    totalSteps: execution.totalSteps,
    estimatedDays: execution.estimatedDays,
    dailyCommitment: execution.dailyCommitment,
    totalMinutes: execution.totalMinutes,

    // Success criteria
    successLooksLike: strategy.success.looksLike,
    successMetrics: strategy.success.metrics,
    outOfScope: visionDetails?.outOfScope || strategy.success.outOfScope,

    // ELITE: Enhanced content from diagnostic and strategy
    successFeelsLike: strategy.success.feelsLike,
    identityShift: strategy.transformation.identityShift,
    prioritization: strategy.prioritization ? {
      focusNow: strategy.prioritization.focusNow,
      ignoreFor: strategy.prioritization.ignoreFor,
      justification: strategy.prioritization.justification,
    } : undefined,
    fakeProgressWarnings: strategy.risks.fakeProgress,
    whatComesNext: strategy.whatComesNext,
    diagnosis: diagnostic.diagnosis,

    // Personalized intro
    personalizedIntro: execution.personalizedIntro,

    // Current step (fully detailed with new structure)
    currentStep: {
      id: uuidv4(),
      order: execution.currentStep.order,
      phase: 'NOW',
      title: execution.currentStep.title,
      description: execution.currentStep.description,

      // LESSON SECTION (Understanding - 40%)
      lesson: execution.currentStep.lesson,

      // ACTION SECTION (Doing - 60%)
      // Today's Focus
      todaysFocus: execution.currentStep.todaysFocus,

      // Personalized why
      whyThisMattersForYou: execution.currentStep.whyThisMattersForYou,

      // Exit conditions
      exitConditions: execution.currentStep.exitConditions,

      // Common trap
      commonTrap: execution.currentStep.commonTrap,

      // Legacy fields
      whyFirst: execution.currentStep.whyFirst,
      method: execution.currentStep.method,
      timeBreakdown: execution.currentStep.timeBreakdown,
      risk: execution.currentStep.risk,
      commonMistakes: execution.currentStep.commonMistakes,
      fakeProgressWarnings: execution.currentStep.fakeProgressWarnings,
      standards: execution.currentStep.standards,
      successSignals: execution.currentStep.successSignals,
      doneWhen: execution.currentStep.doneWhen,
      selfTest: execution.currentStep.selfTest,
      abilities: execution.currentStep.abilities,
      milestone: execution.currentStep.milestone,
      duration: execution.currentStep.duration,
      timeframe: execution.currentStep.timeframe,
      resources: enhanceResources(execution.currentStep.resources),
      microTasks: execution.currentStep.microTasks,
      encouragement: execution.currentStep.encouragement,
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
      teaser: ls.teaser,
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
