/**
 * Smart Model Router
 *
 * Routes queries to the appropriate model based on complexity:
 * - gpt-5-mini: Fast, efficient, good for simple/moderate queries
 * - gpt-5: Advanced reasoning, better for complex queries
 *
 * Also manages dynamic response length based on query analysis
 */

import { QueryAnalysis, ModelTier, ResponseLength } from './query-analyzer'

// =============================================================================
// TYPES
// =============================================================================

export interface ModelConfig {
  model: string
  maxTokens: number
  temperature: number
  // System prompt additions for response length control
  lengthInstruction: string
}

export interface RoutingDecision {
  model: string
  maxTokens: number
  temperature: number
  lengthInstruction: string
  reason: string
  estimatedCost: 'low' | 'medium' | 'high'
  estimatedLatency: 'fast' | 'moderate' | 'slow'
}

// =============================================================================
// MODEL DEFINITIONS
// =============================================================================

const MODELS = {
  fast: {
    id: 'gpt-5-mini',
    costPer1kInput: 0.00015, // $0.15 per 1M input tokens
    costPer1kOutput: 0.0006, // $0.60 per 1M output tokens
    avgLatencyMs: 600,
  },
  advanced: {
    id: 'gpt-5',
    costPer1kInput: 0.0025, // $2.50 per 1M input tokens
    costPer1kOutput: 0.01, // $10.00 per 1M output tokens
    avgLatencyMs: 1200,
  },
} as const

// =============================================================================
// RESPONSE LENGTH INSTRUCTIONS
// =============================================================================

const LENGTH_INSTRUCTIONS: Record<ResponseLength, string> = {
  short: `
RESPONSE LENGTH: Keep your response BRIEF and CONCISE.
- Answer in 1-3 sentences maximum
- Get straight to the point
- No unnecessary elaboration
- If it's a definition, give just the definition
- If it's yes/no, answer directly then briefly explain if needed`,

  medium: `
RESPONSE LENGTH: Provide a BALANCED response.
- Use 1-2 short paragraphs
- Include a clear explanation
- Add one example if helpful
- Cover the main points without excessive detail
- Aim for clarity over comprehensiveness`,

  detailed: `
RESPONSE LENGTH: Provide a THOROUGH and COMPREHENSIVE response.
- Use multiple paragraphs as needed
- Break down complex concepts step-by-step
- Include examples, analogies, or diagrams descriptions
- Explain the "why" behind concepts
- Cover edge cases or common misconceptions
- Provide actionable takeaways or next steps`,
}

// =============================================================================
// ROUTING LOGIC
// =============================================================================

/**
 * Route a query to the appropriate model based on analysis
 */
export function routeQuery(analysis: QueryAnalysis): RoutingDecision {
  const modelTier = analysis.modelTier
  const modelConfig = MODELS[modelTier]
  const lengthInstruction = LENGTH_INSTRUCTIONS[analysis.responseLength]

  // Determine cost and latency estimates
  let estimatedCost: 'low' | 'medium' | 'high'
  let estimatedLatency: 'fast' | 'moderate' | 'slow'

  if (modelTier === 'fast') {
    estimatedCost = analysis.responseLength === 'short' ? 'low' : 'low'
    estimatedLatency = 'fast'
  } else {
    estimatedCost = analysis.responseLength === 'detailed' ? 'high' : 'medium'
    estimatedLatency = analysis.responseLength === 'detailed' ? 'slow' : 'moderate'
  }

  // Build reason
  const reasonParts: string[] = []
  reasonParts.push(`complexity=${analysis.complexity}`)
  if (analysis.requiresReasoning) reasonParts.push('needs reasoning')
  if (analysis.requiresCalculation) reasonParts.push('needs calculation')
  if (analysis.requiresCodeGeneration) reasonParts.push('needs code generation')
  if (analysis.isFactualQuestion) reasonParts.push('factual')

  return {
    model: modelConfig.id,
    maxTokens: analysis.maxTokens,
    temperature: analysis.temperature,
    lengthInstruction,
    reason: reasonParts.join(', '),
    estimatedCost,
    estimatedLatency,
  }
}

/**
 * Override routing decision based on specific conditions
 */
export function overrideRouting(
  decision: RoutingDecision,
  overrides: {
    forceModel?: 'gpt-5-mini' | 'gpt-5'
    forceMaxTokens?: number
    forceLength?: ResponseLength
    addToInstruction?: string
  }
): RoutingDecision {
  const result = { ...decision }

  if (overrides.forceModel) {
    result.model = overrides.forceModel
    result.reason += ` (forced to ${overrides.forceModel})`
  }

  if (overrides.forceMaxTokens) {
    result.maxTokens = overrides.forceMaxTokens
  }

  if (overrides.forceLength) {
    result.lengthInstruction = LENGTH_INSTRUCTIONS[overrides.forceLength]
  }

  if (overrides.addToInstruction) {
    result.lengthInstruction += `\n\n${overrides.addToInstruction}`
  }

  return result
}

/**
 * Get model config for a specific tier
 */
export function getModelForTier(tier: ModelTier): string {
  return MODELS[tier].id
}

/**
 * Get length instruction for a response length
 */
export function getLengthInstruction(length: ResponseLength): string {
  return LENGTH_INSTRUCTIONS[length]
}

/**
 * Estimate cost for a query based on routing decision
 * Returns cost in USD
 */
export function estimateCost(
  decision: RoutingDecision,
  estimatedInputTokens: number
): number {
  const model = decision.model === 'gpt-5' ? MODELS.advanced : MODELS.fast
  const inputCost = (estimatedInputTokens / 1000) * model.costPer1kInput
  const outputCost = (decision.maxTokens / 1000) * model.costPer1kOutput
  return inputCost + outputCost
}

// =============================================================================
// SMART ROUTING HELPERS
// =============================================================================

/**
 * Check if query should be upgraded to advanced model
 * based on additional context signals
 */
export function shouldUpgradeModel(
  analysis: QueryAnalysis,
  context: {
    userSkillLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT'
    previousQueriesWereComplex?: boolean
    sessionSubject?: string
    userRequestedDetail?: boolean
  }
): boolean {
  // Already using advanced model
  if (analysis.modelTier === 'advanced') return false

  // User explicitly asked for detail
  if (context.userRequestedDetail) return true

  // Expert users might benefit from advanced model
  if (context.userSkillLevel === 'EXPERT' && analysis.complexity === 'moderate') {
    return true
  }

  // Complex subjects should use advanced model even for moderate queries
  const complexSubjects = [
    'calculus', 'physics', 'chemistry', 'algorithms',
    'machine learning', 'quantum', 'organic chemistry',
  ]
  if (context.sessionSubject) {
    const lowerSubject = context.sessionSubject.toLowerCase()
    if (complexSubjects.some(s => lowerSubject.includes(s)) && analysis.complexity !== 'simple') {
      return true
    }
  }

  return false
}

/**
 * Check if query should be downgraded to fast model
 * to save costs
 */
export function shouldDowngradeModel(
  analysis: QueryAnalysis,
  context: {
    isCacheHit?: boolean
    isFollowUpQuestion?: boolean
    sessionMessageCount?: number
  }
): boolean {
  // Already using fast model
  if (analysis.modelTier === 'fast') return false

  // Cache hit means we don't need advanced processing
  if (context.isCacheHit) return true

  // Simple follow-up questions can use fast model
  if (context.isFollowUpQuestion && analysis.complexity === 'moderate') {
    return true
  }

  return false
}

// =============================================================================
// EXPORTS
// =============================================================================

export { MODELS, LENGTH_INSTRUCTIONS }
