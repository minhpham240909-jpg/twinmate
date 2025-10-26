/**
 * Summarize Session Tool - Generate session summaries, tasks, and flashcards
 */

import {
  Tool,
  SummarizeSessionInputSchema,
  SummarizeSessionOutputSchema,
  SummarizeSessionInput,
  SummarizeSessionOutput,
  AgentContext,
  LLMRequest,
} from '../types'
import { LLMProvider } from '../lib/orchestrator'

export function createSummarizeSessionTool(llmProvider: LLMProvider): Tool<SummarizeSessionInput, SummarizeSessionOutput> {
  return {
    name: 'summarizeSession',
    description: 'Summarize a study session transcript or chat log, extract key points, generate follow-up tasks, and create flashcards from the content.',
    category: 'learning',
    inputSchema: SummarizeSessionInputSchema,
    outputSchema: SummarizeSessionOutputSchema,
    estimatedLatencyMs: 3000,

    async call(input: SummarizeSessionInput, ctx: AgentContext): Promise<SummarizeSessionOutput> {
      const { transcript, notes = [] } = input

      // Build prompt for session summarization
      const prompt = `You are a study session analyzer. Your task is to analyze the following study session and produce:

1. A concise summary (2-3 sentences) of what was covered
2. Key points and main takeaways (3-5 bullet points)
3. Suggested follow-up tasks with time estimates
4. Flashcards to reinforce learning

Study Session Transcript:
${transcript}

${notes.length > 0 ? `Additional Notes:\n${notes.join('\n')}` : ''}

Respond in this exact JSON format:
{
  "summary": "Brief summary of session",
  "keyPoints": ["point 1", "point 2", ...],
  "tasks": [
    {"title": "Task description", "etaMin": 30},
    ...
  ],
  "flashcards": [
    {"front": "Question or concept", "back": "Answer or explanation"},
    ...
  ]
}

Ensure:
- Summary is clear and concise
- Key points are actionable insights
- Tasks are specific and time-bound
- Flashcards test understanding, not just memory
- Generate 3-5 flashcards from the most important concepts`

      const request: LLMRequest = {
        messages: [
          {
            role: 'system',
            content: 'You are an expert study session analyzer. Always respond with valid JSON matching the requested format.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        maxTokens: 1500,
      }

      const response = await llmProvider.complete(request)

      // Parse JSON response
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('No JSON found in response')
        }

        const parsed = JSON.parse(jsonMatch[0])

        // Validate and return
        return {
          summary: parsed.summary || '',
          keyPoints: parsed.keyPoints || [],
          tasks: parsed.tasks || [],
          flashcards: parsed.flashcards || [],
        }
      } catch (error) {
        throw new Error(`Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },
  }
}
