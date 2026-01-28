/**
 * ROADMAP GENERATOR
 *
 * Layer 3 of the Clerva content quality system.
 * The AI acts as a compiler, applying rules from Layer 1 & 2.
 *
 * This is the orchestrator that:
 * 1. Builds context from Doctrine + Domain
 * 2. Calls AI with rule injection
 * 3. Evaluates output quality
 * 4. Regenerates if quality fails
 */

import { ContextBuilder, getContextBuilder } from './context-builder'
import { QualityEvaluator, getQualityEvaluator } from '../evaluator'
import { getDomainContext } from '../domains'
import { QUALITY_THRESHOLDS, MAX_REGENERATION_ATTEMPTS, EvaluationResult } from '../standards/types'

// ============================================
// TYPES
// ============================================

export interface GenerationRequest {
  /** The user's learning goal */
  goal: string

  /** Optional user context */
  userContext?: {
    level?: 'beginner' | 'intermediate' | 'advanced'
    timeAvailable?: string
    specificOutcome?: string
  }

  /** Whether to skip clarification even if vague */
  skipClarification?: boolean
}

export interface GenerationResult {
  success: boolean

  /** The generated roadmap (if successful) */
  roadmap?: GeneratedRoadmap

  /** Quality evaluation result */
  evaluation?: EvaluationResult

  /** Whether clarification is needed */
  needsClarification: boolean

  /** Clarifying questions if needed */
  clarifyingQuestions: string[]

  /** Number of regeneration attempts */
  attempts: number

  /** Error message if failed */
  error?: string
}

export interface GeneratedRoadmap {
  title: string
  overview: string
  vision?: string
  targetUser?: string
  successMetrics?: string[]
  estimatedDays?: number
  dailyCommitment?: string
  criticalWarning?: { warning: string; consequence: string }
  steps: GeneratedStep[]
}

export interface GeneratedStep {
  order: number
  title: string
  description: string
  duration: number
  phase?: string
  whyFirst?: string
  method?: string
  avoid?: string
  doneWhen?: string
  commonMistakes?: { trap: string; consequence: string }[]
  selfTest?: { challenge: string; passCriteria: string; failCriteria?: string }
  abilities?: string[]
  resources?: { title: string; url: string; type: string }[]
  risk?: { warning: string; consequence: string; severity?: string }
}

// ============================================
// AI CALLER INTERFACE
// ============================================

export interface AICallerInterface {
  call(prompt: string, systemPrompt?: string): Promise<string>
}

// ============================================
// ROADMAP GENERATOR CLASS
// ============================================

export class RoadmapGenerator {
  private contextBuilder: ContextBuilder
  private evaluator: QualityEvaluator
  private aiCaller: AICallerInterface | null = null

  constructor(aiCaller?: AICallerInterface) {
    this.contextBuilder = getContextBuilder()
    this.evaluator = getQualityEvaluator()
    this.aiCaller = aiCaller || null
  }

  /**
   * Set the AI caller (dependency injection)
   */
  setAICaller(caller: AICallerInterface): void {
    this.aiCaller = caller
  }

  /**
   * Main generation entry point
   */
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    // 1. Check if clarification is needed
    const context = this.contextBuilder.buildContext(request.goal)

    if (context.needsClarification && !request.skipClarification) {
      return {
        success: false,
        needsClarification: true,
        clarifyingQuestions: context.clarifyingQuestions,
        attempts: 0,
      }
    }

    // 2. Generate with quality loop
    let attempts = 0
    let lastEvaluation: EvaluationResult | undefined
    let roadmap: GeneratedRoadmap | undefined

    while (attempts < MAX_REGENERATION_ATTEMPTS) {
      attempts++

      try {
        // Generate roadmap
        roadmap = await this.callAI(request, context, lastEvaluation)

        // Evaluate quality
        const evaluation = this.evaluator.evaluate(roadmap)
        lastEvaluation = evaluation

        if (evaluation.passed) {
          return {
            success: true,
            roadmap,
            evaluation,
            needsClarification: false,
            clarifyingQuestions: [],
            attempts,
          }
        }

        // Check if we should regenerate or give up
        if (evaluation.score < QUALITY_THRESHOLDS.REGENERATE_MIN) {
          // Too low to salvage, but try once more
          console.log(`[RoadmapGenerator] Score ${evaluation.score} too low, regenerating (attempt ${attempts})`)
        } else {
          // In regenerate range, try with feedback
          console.log(`[RoadmapGenerator] Score ${evaluation.score}, regenerating with feedback (attempt ${attempts})`)
        }

      } catch (error) {
        console.error(`[RoadmapGenerator] Generation error on attempt ${attempts}:`, error)
        if (attempts >= MAX_REGENERATION_ATTEMPTS) {
          return {
            success: false,
            needsClarification: false,
            clarifyingQuestions: [],
            attempts,
            error: error instanceof Error ? error.message : 'Unknown generation error',
          }
        }
      }
    }

    // Exhausted attempts
    return {
      success: roadmap !== undefined && (lastEvaluation?.score || 0) >= QUALITY_THRESHOLDS.REGENERATE_MIN,
      roadmap,
      evaluation: lastEvaluation,
      needsClarification: false,
      clarifyingQuestions: [],
      attempts,
      error: lastEvaluation
        ? `Quality score ${lastEvaluation.score} below threshold after ${attempts} attempts`
        : 'Failed to generate roadmap',
    }
  }

  /**
   * Get the prompt injection for external use
   */
  getPromptInjection(goal: string): string {
    return this.contextBuilder.buildFullPromptInjection(goal)
  }

  /**
   * Get domain context for external use
   */
  getDomainInfo(goal: string) {
    return getDomainContext(goal)
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async callAI(
    request: GenerationRequest,
    context: ReturnType<ContextBuilder['buildContext']>,
    previousEvaluation?: EvaluationResult
  ): Promise<GeneratedRoadmap> {
    if (!this.aiCaller) {
      throw new Error('AI caller not configured. Use setAICaller() first.')
    }

    // Build system prompt with context injection
    const systemPrompt = this.buildSystemPrompt(request, context, previousEvaluation)

    // Build user prompt
    const userPrompt = this.buildUserPrompt(request)

    // Call AI
    const response = await this.aiCaller.call(userPrompt, systemPrompt)

    // Parse response
    return this.parseResponse(response)
  }

  private buildSystemPrompt(
    request: GenerationRequest,
    context: ReturnType<ContextBuilder['buildContext']>,
    previousEvaluation?: EvaluationResult
  ): string {
    let prompt = this.contextBuilder.buildFullPromptInjection(request.goal)

    // Add regeneration feedback if this is a retry
    if (previousEvaluation && !previousEvaluation.passed) {
      const feedback = this.evaluator.generateRegenerationFeedback(previousEvaluation)
      prompt += `

---

## REGENERATION FEEDBACK (Previous attempt failed)

${feedback}

CRITICAL: Fix ALL issues listed above. Do not repeat the same mistakes.
`
    }

    return prompt
  }

  private buildUserPrompt(request: GenerationRequest): string {
    let prompt = `Generate a Clerva roadmap for: "${request.goal}"`

    if (request.userContext) {
      if (request.userContext.level) {
        prompt += `\n- Current level: ${request.userContext.level}`
      }
      if (request.userContext.timeAvailable) {
        prompt += `\n- Time available: ${request.userContext.timeAvailable}`
      }
      if (request.userContext.specificOutcome) {
        prompt += `\n- Specific outcome wanted: ${request.userContext.specificOutcome}`
      }
    }

    prompt += `

Generate a complete roadmap following ALL Clerva standards above.
Output as valid JSON matching the GeneratedRoadmap schema.`

    return prompt
  }

  private parseResponse(response: string): GeneratedRoadmap {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No valid JSON found in AI response')
    }

    try {
      const parsed = JSON.parse(jsonMatch[0])

      // Validate basic structure
      if (!parsed.title || !parsed.steps || !Array.isArray(parsed.steps)) {
        throw new Error('Invalid roadmap structure: missing title or steps')
      }

      // Ensure steps have order numbers
      parsed.steps = parsed.steps.map((step: GeneratedStep, index: number) => ({
        ...step,
        order: step.order ?? index + 1,
      }))

      return parsed as GeneratedRoadmap
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let generatorInstance: RoadmapGenerator | null = null

export function getRoadmapGenerator(): RoadmapGenerator {
  if (!generatorInstance) {
    generatorInstance = new RoadmapGenerator()
  }
  return generatorInstance
}

export default RoadmapGenerator
