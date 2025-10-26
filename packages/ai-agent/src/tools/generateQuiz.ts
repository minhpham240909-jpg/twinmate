/**
 * Generate Quiz Tool - Create quizzes from user content
 */

import { v4 as uuidv4 } from 'uuid'
import {
  Tool,
  GenerateQuizInputSchema,
  GenerateQuizOutputSchema,
  GenerateQuizInput,
  GenerateQuizOutput,
  QuizItem,
  AgentContext,
  LLMRequest,
} from '../types'
import { LLMProvider } from '../lib/orchestrator'
import { VectorRetriever } from '../rag/retriever'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function createGenerateQuizTool(
  llmProvider: LLMProvider,
  retriever: VectorRetriever,
  supabase: SupabaseClient
): Tool<GenerateQuizInput, GenerateQuizOutput> {
  return {
    name: 'generateQuiz',
    description: 'Generate a quiz from the student\'s materials on a specific topic. Creates multiple choice questions with exactly 4 choices, correct answer, and explanations.',
    category: 'learning',
    inputSchema: GenerateQuizInputSchema,
    outputSchema: GenerateQuizOutputSchema,
    estimatedLatencyMs: 5000,

    async call(input: GenerateQuizInput, ctx: AgentContext): Promise<GenerateQuizOutput> {
      const { topic, difficulty, n, sources } = input

      // 1. Retrieve relevant content if sources not specified
      let contentChunks: string[] = []
      if (sources && sources.length > 0) {
        // Fetch specific document chunks
        const { data: chunks, error } = await supabase
          .from('doc_chunk')
          .select('content')
          .in('doc_id', sources.map(s => s.docId))
          .order('ord')

        if (error) throw new Error(`Failed to fetch source chunks: ${error.message}`)
        contentChunks = chunks.map(c => c.content)
      } else {
        // Semantic search for relevant content
        const retrieved = await retriever.retrieve(topic, ctx.userId, {
          limit: 20, // Get more content for quiz generation
          threshold: 0.65,
        })
        contentChunks = retrieved.chunks.map(c => c.content)
      }

      if (contentChunks.length === 0) {
        throw new Error('No relevant content found for quiz generation. Please upload study materials first.')
      }

      // 2. Generate quiz with LLM
      const prompt = `You are an expert quiz creator. Generate ${n} multiple choice questions about "${topic}" at ${difficulty} difficulty level.

Source Material:
${contentChunks.slice(0, 10).join('\n\n---\n\n')}

Generate exactly ${n} questions. Each question MUST have:
- Clear, specific question text
- Exactly 4 answer choices (A, B, C, D)
- Exactly ONE correct answer
- Brief explanation of why the answer is correct

Difficulty guidelines:
- easy: Test basic recall and definitions
- medium: Test understanding and application
- hard: Test analysis, synthesis, and complex scenarios
- mixed: Vary difficulty across questions

Respond in this exact JSON format:
{
  "items": [
    {
      "q": "Question text here?",
      "choices": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "answer": "Choice A",
      "explanation": "Why this is correct...",
      "source": "Optional: which part of material"
    }
  ]
}

CRITICAL RULES:
- Exactly 4 choices per question
- Answer MUST be one of the 4 choices (exact match)
- Questions must be answerable from the source material
- Avoid trick questions or ambiguous wording
- Explanation should educate, not just confirm`

      const request: LLMRequest = {
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational quiz creator. Always respond with valid JSON matching the requested format.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8, // Higher temp for variety
        maxTokens: 3000,
      }

      const response = await llmProvider.complete(request)

      // 3. Parse and validate quiz items
      let items: QuizItem[] = []
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('No JSON found in LLM response')
        }

        const parsed = JSON.parse(jsonMatch[0])

        if (!parsed.items || !Array.isArray(parsed.items)) {
          throw new Error('Invalid quiz format: missing items array')
        }

        // Validate each item
        items = parsed.items.map((item: any, idx: number) => {
          if (!item.q || !item.choices || !item.answer || !item.explanation) {
            throw new Error(`Item ${idx + 1}: Missing required fields`)
          }

          if (item.choices.length !== 4) {
            throw new Error(`Item ${idx + 1}: Must have exactly 4 choices`)
          }

          if (!item.choices.includes(item.answer)) {
            throw new Error(`Item ${idx + 1}: Answer must be one of the choices`)
          }

          return {
            q: item.q,
            choices: [item.choices[0], item.choices[1], item.choices[2], item.choices[3]] as [string, string, string, string],
            answer: item.answer,
            explanation: item.explanation,
            source: item.source,
          }
        })

        // Ensure we have exactly n items
        items = items.slice(0, n)

      } catch (error) {
        throw new Error(`Failed to parse quiz: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      // 4. Save quiz to database
      const quizId = uuidv4()
      const { error: insertError } = await supabase
        .from('quiz')
        .insert({
          id: quizId,
          user_id: ctx.userId,
          title: `${topic} Quiz`,
          items: items,
          difficulty,
          topic,
          metadata: { generatedAt: new Date().toISOString() },
        })

      if (insertError) {
        throw new Error(`Failed to save quiz: ${insertError.message}`)
      }

      return {
        quizId,
        items,
      }
    },
  }
}
