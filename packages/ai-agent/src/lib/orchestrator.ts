/**
 * Agent Orchestrator - Main entry point for AI agent
 * Handles tool routing, memory, prompt strategies, and safety
 */

import { v4 as uuidv4 } from 'uuid'
import {
  AgentContext,
  AgentResponse,
  AgentError,
  ToolError,
  ValidationError,
  LLMRequest,
  LLMResponse,
  LLMMessage,
  ToolResult,
  ResponseCard,
} from '../types'
import { ToolRegistry } from './tool-registry'

export interface OrchestratorConfig {
  llmProvider: LLMProvider
  retriever: Retriever
  toolRegistry: ToolRegistry
  supabase: any // Supabase client for DB access
  telemetry?: TelemetryClient
  maxToolCalls?: number
  timeout?: number
}

export interface LLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>
  stream?(request: LLMRequest): AsyncIterableIterator<string>
}

export interface Retriever {
  retrieve(query: string, userId: string, options?: RetrievalOptions): Promise<RetrievalResult>
}

export interface RetrievalOptions {
  limit?: number
  threshold?: number
  filters?: Record<string, any>
}

export interface RetrievalResult {
  chunks: Array<{
    docId: string
    ord: number
    content: string
    source?: string
    similarity: number
  }>
  totalFound: number
}

export interface TelemetryClient {
  trackEvent(event: any): Promise<void>
}

export class AgentOrchestrator {
  private config: Required<OrchestratorConfig>

  constructor(config: OrchestratorConfig) {
    this.config = {
      ...config,
      maxToolCalls: config.maxToolCalls || 5,
      timeout: config.timeout || 30000,
      telemetry: config.telemetry || { trackEvent: async () => {} },
    }
  }

  /**
   * Main agent handler - processes user message and returns response
   */
  async handle(userId: string, message: string, options?: HandleOptions): Promise<AgentResponse> {
    const traceId = uuidv4()
    const startTime = Date.now()

    try {
      // Build context
      const context = await this.buildContext(userId, message, traceId, options)

      // Classify intent and decide if RAG is needed
      const intent = await this.classifyIntent(message, context)

      // Retrieve relevant context if needed
      if (intent.needsRAG) {
        const retrieved = await this.config.retriever.retrieve(
          message,
          userId,
          { limit: 10, threshold: 0.7 }
        )
        context.retrievedChunks = retrieved.chunks
      }

      // Generate response with tools
      const response = await this.generateResponse(message, context)

      // Track telemetry
      await this.config.telemetry.trackEvent({
        traceId,
        userId,
        eventType: 'agent_completion',
        latencyMs: Date.now() - startTime,
        toolCalls: response.toolResults?.length || 0,
      })

      return response
    } catch (error) {
      // Track error
      await this.config.telemetry.trackEvent({
        traceId,
        userId,
        eventType: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - startTime,
      })

      throw error
    }
  }

  /**
   * Build context for agent execution
   */
  private async buildContext(
    userId: string,
    message: string,
    traceId: string,
    options?: HandleOptions
  ): Promise<AgentContext> {
    // Load user profile from database
    let userProfile = options?.userProfile
    if (!userProfile && this.config.supabase) {
      try {
        const { data: profile } = await this.config.supabase
          .from('Profile')
          .select('subjects, goals, studyStyle, skillLevel, interests')
          .eq('userId', userId)
          .single()

        if (profile) {
          userProfile = {
            subjects: profile.subjects || [],
            goals: profile.goals || [],
            learningStyle: profile.studyStyle || 'Unknown',
            preferences: {
              skillLevel: profile.skillLevel,
              interests: profile.interests || [],
            },
          }
        }
      } catch (error) {
        console.warn('Failed to load user profile:', error)
      }
    }

    // Load recent memory/facts from agent_memory table
    const recentMemory: any[] = []
    if (this.config.supabase) {
      try {
        const { data: facts } = await this.config.supabase
          .from('agent_memory')
          .select('key, value')
          .eq('user_id', userId)
          .eq('scope', 'long')
          .limit(10)

        if (facts && facts.length > 0) {
          recentMemory.push(...facts.map((f: any) => ({ key: f.key, value: f.value })))
        }
      } catch (error) {
        console.warn('Failed to load memory:', error)
      }
    }

    return {
      userId,
      traceId,
      timestamp: new Date(),
      conversationId: options?.conversationId,
      userProfile,
      recentMemory,
      retrievedChunks: [],
    }
  }

  /**
   * Classify user intent and determine if RAG is needed
   */
  private async classifyIntent(
    message: string,
    context: AgentContext
  ): Promise<{ needsRAG: boolean; suggestedTools: string[] }> {
    // Simple heuristic-based classification
    // In production, use LLM to classify intent

    const lowerMessage = message.toLowerCase()

    // RAG triggers
    const ragKeywords = ['explain', 'what is', 'tell me about', 'summarize', 'from my notes']
    const needsRAG = ragKeywords.some(kw => lowerMessage.includes(kw))

    // Tool suggestions
    const suggestedTools: string[] = []
    if (lowerMessage.includes('quiz')) suggestedTools.push('generateQuiz')
    if (lowerMessage.includes('flashcard')) suggestedTools.push('addFlashcards')
    if (lowerMessage.includes('plan') || lowerMessage.includes('schedule')) {
      suggestedTools.push('createStudyPlan')
    }
    if (lowerMessage.includes('partner') || lowerMessage.includes('match')) {
      suggestedTools.push('matchCandidates', 'matchInsight')
    }
    if (lowerMessage.includes('summarize')) suggestedTools.push('summarizeSession')

    return { needsRAG, suggestedTools }
  }

  /**
   * Generate response using LLM with tool calling
   */
  private async generateResponse(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    const systemPrompt = this.buildSystemPrompt(context)
    const userPrompt = this.buildUserPrompt(message, context)

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    const toolDefinitions = this.config.toolRegistry.getToolDefinitions()

    // Call LLM with tools
    let response = await this.config.llmProvider.complete({
      messages,
      tools: toolDefinitions,
      temperature: 0.7,
      maxTokens: 2000,
    })

    const toolResults: ToolResult[] = []
    let iterationCount = 0

    // Tool calling loop
    while (
      response.finishReason === 'tool_calls' &&
      response.toolCalls &&
      iterationCount < this.config.maxToolCalls
    ) {
      iterationCount++

      // CRITICAL FIX: Add assistant's message with tool_calls BEFORE adding tool results
      // OpenAI API requires: [user] -> [assistant with tool_calls] -> [tool results] -> [assistant]
      messages.push({
        role: 'assistant' as const,
        content: response.content || null,
        tool_calls: response.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })),
      })

      // Execute all tool calls and add their results
      for (const toolCall of response.toolCalls) {
        const result = await this.executeTool(toolCall.name, toolCall.arguments, context)
        toolResults.push(result)

        // Add tool result to conversation
        messages.push({
          role: 'tool' as const,
          content: JSON.stringify(result.output),
          tool_call_id: toolCall.id, // OpenAI uses tool_call_id (not toolCallId)
        })
      }

      // Continue conversation with updated messages
      response = await this.config.llmProvider.complete({
        messages,
        tools: toolDefinitions,
        temperature: 0.7,
        maxTokens: 2000,
      })
    }

    // Extract cards from tool results
    const cards = this.extractCards(toolResults)

    // Extract citations from retrieved chunks
    const citations = context.retrievedChunks?.map(chunk => ({
      text: chunk.content.substring(0, 100) + '...',
      docId: chunk.docId,
      ord: chunk.ord,
      source: chunk.source,
    }))

    return {
      text: response.content,
      toolsUsed: [...new Set(toolResults.map(tr => tr.toolName))],
      toolResults,
      cards,
      citations,
      traceId: context.traceId,
      metadata: {
        toolCallCount: toolResults.length,
        iterationCount,
      },
    }
  }

  /**
   * Execute a tool call
   */
  private async executeTool(
    toolName: string,
    argsJson: string,
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now()

    try {
      const tool = this.config.toolRegistry.get(toolName)
      if (!tool) {
        throw new ToolError(toolName, 'Tool not found')
      }

      // Parse and validate input
      const input = JSON.parse(argsJson)
      const validatedInput = tool.inputSchema.parse(input)

      // Call tool
      const output = await tool.call(validatedInput, context)

      // Validate output
      const validatedOutput = tool.outputSchema.parse(output)

      const latencyMs = Date.now() - startTime

      // Track telemetry
      await this.config.telemetry.trackEvent({
        traceId: context.traceId,
        userId: context.userId,
        eventType: 'tool_call',
        toolName,
        latencyMs,
      })

      return {
        toolName,
        input: validatedInput,
        output: validatedOutput,
        latencyMs,
        success: true,
      }
    } catch (error) {
      const latencyMs = Date.now() - startTime

      // Track error
      await this.config.telemetry.trackEvent({
        traceId: context.traceId,
        userId: context.userId,
        eventType: 'error',
        toolName,
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs,
      })

      return {
        toolName,
        input: argsJson,
        output: null,
        latencyMs,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Build system prompt with agent identity and rules
   */
  private buildSystemPrompt(context: AgentContext): string {
    // Build memory context if available
    let memoryContext = ''
    if (context.recentMemory && context.recentMemory.length > 0) {
      const memoryItems = context.recentMemory
        .map((mem: any) => `- ${mem.key}: ${typeof mem.value === 'object' ? JSON.stringify(mem.value) : mem.value}`)
        .join('\n')
      memoryContext = `\n\nWhat I remember about you:\n${memoryItems}`
    }

    return `You are Clerva AI, a smart study copilot for students.

Your capabilities:
- Search and explain content from student's notes and documents
- Generate quizzes and flashcards from their materials
- Create personalized study plans
- Summarize study sessions
- Match students with compatible study partners
- Provide learning insights and recommendations

Rules:
1. Always prefer citing sources from the student's content when answering factual questions
2. Use tools when available - don't fabricate information
3. Ask at most ONE clarifying question if needed, otherwise proceed with best judgment
4. Be clear, motivating (not cheesy), and concise
5. Respect student's preferences and privacy
6. For partner matching: check strengths/weaknesses, online status, and availability

Student Context:
- Grade Level: ${context.userProfile?.gradeLevel || 'Unknown'}
- Subjects: ${context.userProfile?.subjects.join(', ') || 'None specified'}
- Learning Style: ${context.userProfile?.learningStyle || 'Unknown'}
- Interests: ${context.userProfile?.preferences?.interests?.join(', ') || 'None specified'}
- Skill Level: ${context.userProfile?.preferences?.skillLevel || 'Unknown'}${memoryContext}

Available sources: ${context.retrievedChunks?.length || 0} relevant document chunks retrieved.`
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(message: string, context: AgentContext): string {
    let prompt = message

    // Add retrieved context if available
    if (context.retrievedChunks && context.retrievedChunks.length > 0) {
      const sources = context.retrievedChunks
        .map((chunk, idx) => `[${idx + 1}] ${chunk.content}`)
        .join('\n\n')

      prompt = `${message}\n\nRelevant sources from student's notes:\n${sources}`
    }

    return prompt
  }

  /**
   * Extract response cards from tool results
   */
  private extractCards(toolResults: ToolResult[]): ResponseCard[] {
    const cards: ResponseCard[] = []

    for (const result of toolResults) {
      if (!result.success) continue

      // Quiz card
      if (result.toolName === 'generateQuiz') {
        cards.push({
          type: 'quiz',
          title: 'Generated Quiz',
          content: result.output,
          actions: [
            { label: 'Start Quiz', action: 'start', href: `/quiz/${result.output.quizId}` },
            { label: 'Save', action: 'save' },
          ],
        })
      }

      // Flashcards card
      if (result.toolName === 'addFlashcards') {
        cards.push({
          type: 'flashcards',
          title: 'Flashcards Created',
          content: { saved: result.output.saved },
          actions: [
            { label: 'Review Now', action: 'start', href: '/flashcards' },
          ],
        })
      }

      // Study plan card
      if (result.toolName === 'createStudyPlan') {
        cards.push({
          type: 'plan',
          title: 'Study Plan Created',
          content: result.output,
          actions: [
            { label: 'View Plan', action: 'start', href: `/study-plans/${result.output.planId}` },
          ],
        })
      }

      // Match insight card
      if (result.toolName === 'matchInsight') {
        const insight = result.output
        cards.push({
          type: 'match',
          title: 'Partner Match Insight',
          content: insight,
          actions: insight.canStudyNow
            ? [{ label: 'Start Now', action: 'start', payload: { candidateId: result.input.candidateId } }]
            : [{ label: 'Schedule', action: 'schedule', payload: { times: insight.nextBestTimes } }],
        })
      }

      // Session summary card
      if (result.toolName === 'summarizeSession') {
        cards.push({
          type: 'summary',
          title: 'Session Summary',
          content: result.output,
          actions: [
            { label: 'Save Flashcards', action: 'save', payload: { flashcards: result.output.flashcards } },
            { label: 'Add Tasks to Plan', action: 'save', payload: { tasks: result.output.tasks } },
          ],
        })
      }
    }

    return cards
  }
}

export interface HandleOptions {
  conversationId?: string
  userProfile?: any
}
