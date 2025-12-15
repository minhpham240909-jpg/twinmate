/**
 * AI Partner Intelligence System - Response Injector
 *
 * Injects decision-based instructions into the AI prompt.
 * This gives the AI freedom within the boundaries set by the decision controller.
 *
 * Performance optimized:
 * - String operations only (no API calls)
 * - Minimal memory allocation
 * - Template-based injection
 */

import type { AIDecision, PromptInjections, ResponseConfig } from './types'

/**
 * Inject decision into the system prompt
 * Appends response instructions that override default behavior for this message
 */
export function injectDecisionIntoPrompt(
  baseSystemPrompt: string,
  decision: AIDecision
): string {
  // If not a respond action, don't modify the prompt
  if (decision.action !== 'respond') {
    return baseSystemPrompt
  }

  const injections = decision.promptInjections
  const injectionBlock = buildInjectionBlock(injections)

  // Append injection block to the end of the system prompt
  return baseSystemPrompt + '\n\n' + injectionBlock
}

/**
 * Build the injection block from prompt injections
 */
function buildInjectionBlock(injections: PromptInjections): string {
  const lines: string[] = []

  lines.push('## RESPONSE INSTRUCTIONS (FOR THIS MESSAGE ONLY)')
  lines.push('')

  // Add style instruction if present
  if (injections.styleInstruction) {
    lines.push(`**Style:** ${injections.styleInstruction}`)
  }

  // Add tone instruction if present
  if (injections.toneInstruction) {
    lines.push(`**Tone:** ${injections.toneInstruction}`)
  }

  // Add length instruction if present
  if (injections.lengthInstruction) {
    lines.push(`**Length:** ${injections.lengthInstruction}`)
  }

  // Add special instructions if any
  if (injections.specialInstructions.length > 0) {
    lines.push('')
    lines.push('**Important:**')
    for (const instruction of injections.specialInstructions) {
      lines.push(`- ${instruction}`)
    }
  }

  return lines.join('\n')
}

/**
 * Build a lightweight injection for streaming responses
 * Use when you need minimal overhead
 */
export function buildLightweightInjection(config: ResponseConfig): string {
  const parts: string[] = []

  // Only add critical instructions
  if (!config.includeQuestion) {
    parts.push('Do not end with a question.')
  }

  if (config.length === 'short') {
    parts.push('Keep response brief (1-2 sentences).')
  }

  if (config.includeExample) {
    parts.push('Include an example.')
  }

  if (parts.length === 0) {
    return ''
  }

  return `\n\n[Response guidance: ${parts.join(' ')}]`
}

/**
 * Create injection for confused user scenario
 */
export function buildConfusionInjection(): string {
  return `
## STUDENT NEEDS HELP

The student is confused. Please:
1. Acknowledge their difficulty without judgment
2. Explain the concept using different words or approach
3. Use a simple, relatable example
4. Check if the new explanation helps

Be patient and supportive.`
}

/**
 * Create injection for disengaged user scenario
 */
export function buildReengagementInjection(): string {
  return `
## RE-ENGAGEMENT NEEDED

The student seems disengaged (short replies). Please:
1. Keep your response brief and focused
2. End with a gentle, open-ended question
3. Consider offering a different activity (quiz, visual, practice problem)

Don't be pushy - just offer options.`
}

/**
 * Create injection for wrap-up scenario
 */
export function buildWrapUpInjection(): string {
  return `
## SESSION WRAP-UP

This has been a longer session. Please:
1. Keep your response concise
2. Briefly summarize what was covered if appropriate
3. Offer to provide a summary, practice questions, or flashcards
4. Thank them for their time and encourage continued learning`
}

/**
 * Create injection for progress check
 */
export function buildProgressCheckInjection(): string {
  return `
## PROGRESS CHECK

It's been a while since we checked in. Please:
1. Briefly acknowledge what we've been working on
2. Ask if they want to continue with current topic, try something else, or take a break
3. Keep it casual and supportive`
}

/**
 * Merge multiple injections into one block
 */
export function mergeInjections(...injections: string[]): string {
  return injections.filter(i => i.trim()).join('\n\n')
}

/**
 * Create a complete prompt with all injections
 * Use for the final prompt sent to the AI
 */
export function createCompletePrompt(
  basePrompt: string,
  decision: AIDecision,
  additionalContext?: string
): string {
  let prompt = basePrompt

  // Inject decision
  prompt = injectDecisionIntoPrompt(prompt, decision)

  // Add additional context if provided
  if (additionalContext) {
    prompt += '\n\n' + additionalContext
  }

  return prompt
}

/**
 * Extract injection markers for debugging/logging
 */
export function extractInjectionMarkers(decision: AIDecision): Record<string, unknown> {
  return {
    action: decision.action,
    intent: decision.meta.intent,
    confidence: decision.meta.confidence,
    style: decision.responseConfig.style,
    tone: decision.responseConfig.tone,
    length: decision.responseConfig.length,
    includeQuestion: decision.responseConfig.includeQuestion,
    includeExample: decision.responseConfig.includeExample,
    specialInstructionsCount: decision.promptInjections.specialInstructions.length,
    usedFallback: decision.meta.usedAIFallback,
    processingTimeMs: decision.meta.processingTimeMs,
  }
}

/**
 * Validate injection doesn't exceed token limits
 */
export function validateInjectionSize(injection: string, maxTokens: number = 500): boolean {
  // Rough estimate: 1 token ≈ 4 characters
  const estimatedTokens = Math.ceil(injection.length / 4)
  return estimatedTokens <= maxTokens
}

/**
 * Truncate injection if too long
 */
export function truncateInjection(injection: string, maxTokens: number = 500): string {
  const maxChars = maxTokens * 4 // Rough estimate
  if (injection.length <= maxChars) {
    return injection
  }

  // Truncate and add indicator
  return injection.substring(0, maxChars - 20) + '\n\n[Instructions truncated]'
}
