/**
 * Multi-step AI Pipelines
 * Chain multiple AI calls for complex tasks
 *
 * Features:
 * - Sequential step execution
 * - Parallel step execution
 * - Conditional branching
 * - Context passing between steps
 * - Error handling and retry
 * - Pipeline templates for common tasks
 */

import {
  sendChatMessage,
  generateQuizQuestion,
  generateFlashcards,
  moderateContent,
  checkContentSafety,
  AIMessage,
} from './openai'
import { searchForContext } from './rag'

// Types
export interface PipelineStep<TInput = unknown, TOutput = unknown> {
  name: string
  execute: (input: TInput, context: PipelineContext) => Promise<TOutput>
  condition?: (input: TInput, context: PipelineContext) => boolean
  retryCount?: number
  timeout?: number
}

export interface PipelineContext {
  userId: string
  sessionId?: string
  variables: Record<string, unknown>
  stepResults: Record<string, unknown>
  errors: Array<{ step: string; error: Error }>
  startTime: Date
  metadata: Record<string, unknown>
}

export interface PipelineResult<T = unknown> {
  success: boolean
  result: T | null
  stepResults: Record<string, unknown>
  errors: Array<{ step: string; error: Error }>
  totalDurationMs: number
  stepsExecuted: number
}

/**
 * Execute a pipeline of steps
 */
export async function executePipeline<TInput, TOutput>(
  steps: PipelineStep<any, any>[],
  initialInput: TInput,
  context: Omit<PipelineContext, 'stepResults' | 'errors' | 'startTime' | 'variables'>
): Promise<PipelineResult<TOutput>> {
  const pipelineContext: PipelineContext = {
    ...context,
    variables: {},
    stepResults: {},
    errors: [],
    startTime: new Date(),
  }

  let currentInput: unknown = initialInput
  let stepsExecuted = 0

  for (const step of steps) {
    // Check condition if exists
    if (step.condition && !step.condition(currentInput, pipelineContext)) {
      continue
    }

    let attempts = 0
    const maxAttempts = step.retryCount || 1
    let lastError: Error | null = null

    while (attempts < maxAttempts) {
      attempts++
      try {
        const stepResult = await executeWithTimeout(
          () => step.execute(currentInput, pipelineContext),
          step.timeout || 30000
        )

        pipelineContext.stepResults[step.name] = stepResult
        currentInput = stepResult
        stepsExecuted++
        break
      } catch (error) {
        lastError = error as Error
        if (attempts >= maxAttempts) {
          pipelineContext.errors.push({ step: step.name, error: lastError })
        }
      }
    }

    // If step failed after all retries, stop pipeline (unless it's optional)
    if (lastError && !step.condition) {
      break
    }
  }

  return {
    success: pipelineContext.errors.length === 0,
    result: currentInput as TOutput | null,
    stepResults: pipelineContext.stepResults,
    errors: pipelineContext.errors,
    totalDurationMs: Date.now() - pipelineContext.startTime.getTime(),
    stepsExecuted,
  }
}

/**
 * Execute with timeout
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Step timeout')), timeoutMs)
    ),
  ])
}

/**
 * Execute steps in parallel
 */
export async function executeParallel<TInput, TOutput>(
  steps: Array<{
    name: string
    execute: (input: TInput, context: PipelineContext) => Promise<TOutput>
  }>,
  input: TInput,
  context: PipelineContext
): Promise<Record<string, TOutput | Error>> {
  const results = await Promise.allSettled(
    steps.map(step => step.execute(input, context))
  )

  const output: Record<string, TOutput | Error> = {}
  results.forEach((result, index) => {
    const stepName = steps[index].name
    if (result.status === 'fulfilled') {
      output[stepName] = result.value
      context.stepResults[stepName] = result.value
    } else {
      output[stepName] = result.reason
      context.errors.push({ step: stepName, error: result.reason })
    }
  })

  return output
}

// ============================================
// PRE-BUILT PIPELINE TEMPLATES
// ============================================

/**
 * Smart Response Pipeline
 * 1. Moderate user input
 * 2. Check content safety
 * 3. Search for relevant context (RAG)
 * 4. Generate AI response
 */
export async function smartResponsePipeline(params: {
  userId: string
  sessionId?: string
  userMessage: string
  systemPrompt: string
  conversationHistory: AIMessage[]
}): Promise<PipelineResult<{
  response: string
  moderation: { flagged: boolean }
  ragContext: unknown
  tokens: { prompt: number; completion: number; total: number }
}>> {
  const { userId, sessionId, userMessage, systemPrompt, conversationHistory } = params

  const steps: PipelineStep<any, any>[] = [
    // Step 1: Moderation
    {
      name: 'moderation',
      execute: async (input: any) => {
        const result = await moderateContent(input as string)
        return { input, moderation: result }
      },
    },
    // Step 2: Safety Check
    {
      name: 'safety_check',
      execute: async (data: any) => {
        if (data.moderation.flagged) {
          return {
            ...data,
            safety: { isSafe: false, isStudyRelated: false },
            blocked: true,
          }
        }
        const safety = await checkContentSafety(data.input)
        return { ...data, safety, blocked: !safety.isSafe }
      },
    },
    // Step 3: RAG Search (conditional - skip if blocked)
    {
      name: 'rag_search',
      condition: (data: any) => !data.blocked,
      execute: async (data: any, context) => {
        const ragContext = await searchForContext(context.userId, data.input, {
          maxResults: 5,
        })
        return { ...data, ragContext }
      },
    },
    // Step 4: Generate Response
    {
      name: 'generate_response',
      execute: async (data: any, _context) => {
        if (data.blocked) {
          return {
            response: data.safety?.redirectMessage || "Let's focus on studying!",
            moderation: data.moderation,
            ragContext: null,
            tokens: { prompt: 0, completion: 0, total: 0 },
          }
        }

        // Build messages with RAG context
        let enhancedSystemPrompt = systemPrompt
        if (data.ragContext?.contextText) {
          enhancedSystemPrompt += data.ragContext.contextText
        }

        const messages: AIMessage[] = [
          { role: 'system', content: enhancedSystemPrompt },
          ...conversationHistory.slice(-10), // Last 10 messages
          { role: 'user', content: userMessage },
        ]

        const result = await sendChatMessage(messages, {
          temperature: 0.7,
          maxTokens: 500,
        })

        return {
          response: result.content,
          moderation: data.moderation,
          ragContext: data.ragContext,
          tokens: {
            prompt: result.promptTokens,
            completion: result.completionTokens,
            total: result.totalTokens,
          },
        }
      },
    },
  ]

  return executePipeline(steps, userMessage, { userId, sessionId, metadata: {} })
}

/**
 * Comprehensive Study Session Pipeline
 * 1. Analyze topic
 * 2. Generate quiz questions
 * 3. Generate flashcards
 * 4. Create study plan
 */
export async function studySessionPipeline(params: {
  userId: string
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  quizCount?: number
  flashcardCount?: number
}): Promise<PipelineResult<{
  topicAnalysis: string
  quizQuestions: any[]
  flashcards: any[]
  studyPlan: string
}>> {
  const { userId, topic, difficulty, quizCount = 5, flashcardCount = 5 } = params

  const steps: PipelineStep<any, any>[] = [
    // Step 1: Analyze topic
    {
      name: 'topic_analysis',
      execute: async () => {
        const result = await sendChatMessage([
          {
            role: 'system',
            content: 'You are an educational expert. Analyze the topic and identify key concepts, prerequisites, and learning objectives. Be concise (2-3 paragraphs).',
          },
          {
            role: 'user',
            content: `Analyze this study topic for a ${difficulty} level learner: ${topic}`,
          },
        ])
        return { topicAnalysis: result.content }
      },
    },
    // Step 2: Generate quiz questions (parallel with flashcards)
    {
      name: 'quiz_generation',
      execute: async (data: any) => {
        const questions = []
        for (let i = 0; i < quizCount; i++) {
          const quiz = await generateQuizQuestion({
            subject: topic,
            difficulty,
            previousQuestions: questions.map(q => q.question),
          })
          questions.push(quiz)
        }
        return { ...data, quizQuestions: questions }
      },
    },
    // Step 3: Generate flashcards
    {
      name: 'flashcard_generation',
      execute: async (data: any) => {
        const flashcards = await generateFlashcards({
          subject: topic,
          topic: topic,
          count: flashcardCount,
        })
        return { ...data, flashcards }
      },
    },
    // Step 4: Create study plan
    {
      name: 'study_plan',
      execute: async (data: any) => {
        const result = await sendChatMessage([
          {
            role: 'system',
            content: 'You are a study coach. Create a brief study plan based on the topic analysis, quiz questions, and flashcards provided. Include specific steps and tips.',
          },
          {
            role: 'user',
            content: `Create a study plan for: ${topic}

Key points from analysis: ${data.topicAnalysis.slice(0, 500)}

I have ${data.quizQuestions.length} quiz questions and ${data.flashcards.length} flashcards ready.`,
          },
        ])
        return {
          topicAnalysis: data.topicAnalysis,
          quizQuestions: data.quizQuestions,
          flashcards: data.flashcards,
          studyPlan: result.content,
        }
      },
    },
  ]

  return executePipeline(steps, topic, { userId, metadata: {} })
}

/**
 * Content Enhancement Pipeline
 * Takes simple content and enhances it with examples, analogies, and visuals
 */
export async function contentEnhancementPipeline(params: {
  userId: string
  content: string
  targetAudience: 'beginner' | 'intermediate' | 'advanced'
}): Promise<PipelineResult<{
  enhancedContent: string
  examples: string[]
  analogies: string[]
  practiceProblems: string[]
}>> {
  const { userId, content, targetAudience } = params

  const steps: PipelineStep<any, any>[] = [
    // Step 1: Enhance content
    {
      name: 'enhance_content',
      execute: async () => {
        const result = await sendChatMessage([
          {
            role: 'system',
            content: `You are an expert educator. Enhance the following content for a ${targetAudience} level student. Make it clearer, add structure, and ensure comprehension.`,
          },
          { role: 'user', content },
        ])
        return { enhancedContent: result.content }
      },
    },
    // Step 2: Generate examples
    {
      name: 'examples',
      execute: async (data: any) => {
        const result = await sendChatMessage([
          {
            role: 'system',
            content: 'Generate 3 real-world examples that illustrate this concept. Format as a JSON array of strings.',
          },
          { role: 'user', content: data.enhancedContent.slice(0, 1000) },
        ], { temperature: 0.8 })

        let examples: string[] = []
        try {
          const match = result.content.match(/\[[\s\S]*\]/)
          if (match) examples = JSON.parse(match[0])
        } catch {
          examples = [result.content]
        }

        return { ...data, examples }
      },
    },
    // Step 3: Generate analogies
    {
      name: 'analogies',
      execute: async (data: any) => {
        const result = await sendChatMessage([
          {
            role: 'system',
            content: 'Create 2 simple analogies that help explain this concept. Format as a JSON array of strings.',
          },
          { role: 'user', content: data.enhancedContent.slice(0, 1000) },
        ], { temperature: 0.9 })

        let analogies: string[] = []
        try {
          const match = result.content.match(/\[[\s\S]*\]/)
          if (match) analogies = JSON.parse(match[0])
        } catch {
          analogies = [result.content]
        }

        return { ...data, analogies }
      },
    },
    // Step 4: Generate practice problems
    {
      name: 'practice_problems',
      execute: async (data: any) => {
        const result = await sendChatMessage([
          {
            role: 'system',
            content: `Generate 3 practice problems for a ${targetAudience} student. Format as a JSON array of strings with the problem statement only (no solutions).`,
          },
          { role: 'user', content: data.enhancedContent.slice(0, 1000) },
        ], { temperature: 0.7 })

        let practiceProblems: string[] = []
        try {
          const match = result.content.match(/\[[\s\S]*\]/)
          if (match) practiceProblems = JSON.parse(match[0])
        } catch {
          practiceProblems = [result.content]
        }

        return {
          enhancedContent: data.enhancedContent,
          examples: data.examples,
          analogies: data.analogies,
          practiceProblems,
        }
      },
    },
  ]

  return executePipeline(steps, content, { userId, metadata: {} })
}

/**
 * Learning Gap Analysis Pipeline
 * Analyzes user's quiz performance and identifies learning gaps
 */
export async function learningGapPipeline(params: {
  userId: string
  quizResults: Array<{
    question: string
    userAnswer: string
    correctAnswer: string
    isCorrect: boolean
  }>
  subject: string
}): Promise<PipelineResult<{
  analysis: string
  gaps: string[]
  recommendations: string[]
  focusAreas: string[]
}>> {
  const { userId, quizResults, subject } = params

  const steps: PipelineStep<any, any>[] = [
    // Step 1: Analyze performance
    {
      name: 'performance_analysis',
      execute: async () => {
        const wrongAnswers = quizResults.filter(q => !q.isCorrect)
        const correctRate = ((quizResults.length - wrongAnswers.length) / quizResults.length) * 100

        const result = await sendChatMessage([
          {
            role: 'system',
            content: 'You are an educational analyst. Analyze the quiz results and identify patterns in the mistakes. Be specific about what concepts the student struggles with.',
          },
          {
            role: 'user',
            content: `Subject: ${subject}
Score: ${correctRate.toFixed(0)}% (${quizResults.length - wrongAnswers.length}/${quizResults.length})

Incorrect answers:
${wrongAnswers.map(q => `Q: ${q.question}\nStudent answered: ${q.userAnswer}\nCorrect: ${q.correctAnswer}`).join('\n\n')}`,
          },
        ])

        return { analysis: result.content, wrongAnswers, correctRate }
      },
    },
    // Step 2: Identify learning gaps
    {
      name: 'identify_gaps',
      execute: async (data: any) => {
        const result = await sendChatMessage([
          {
            role: 'system',
            content: 'Based on the analysis, identify specific learning gaps. Format as a JSON array of strings.',
          },
          { role: 'user', content: data.analysis },
        ])

        let gaps: string[] = []
        try {
          const match = result.content.match(/\[[\s\S]*\]/)
          if (match) gaps = JSON.parse(match[0])
        } catch {
          gaps = [result.content]
        }

        return { ...data, gaps }
      },
    },
    // Step 3: Generate recommendations
    {
      name: 'recommendations',
      execute: async (data: any) => {
        const result = await sendChatMessage([
          {
            role: 'system',
            content: 'Create actionable study recommendations for each learning gap. Format as a JSON array of strings.',
          },
          { role: 'user', content: `Gaps: ${data.gaps.join(', ')}\nSubject: ${subject}` },
        ])

        let recommendations: string[] = []
        try {
          const match = result.content.match(/\[[\s\S]*\]/)
          if (match) recommendations = JSON.parse(match[0])
        } catch {
          recommendations = [result.content]
        }

        return {
          analysis: data.analysis,
          gaps: data.gaps,
          recommendations,
          focusAreas: data.gaps.slice(0, 3), // Top 3 focus areas
        }
      },
    },
  ]

  return executePipeline(steps, quizResults, { userId, metadata: {} })
}
