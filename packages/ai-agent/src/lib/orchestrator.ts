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
      // Track start of context building
      await this.config.telemetry.trackEvent({
        traceId,
        userId,
        eventType: 'step_start',
        step: 'context_building',
        timestamp: Date.now(),
      })

      const contextBuildStart = Date.now()

      // PERFORMANCE: Build context and retrieve notes in PARALLEL (removed slow intent classification)
      const [context, retrieved] = await Promise.all([
        this.buildContext(userId, message, traceId, options),
        // PERFORMANCE: Retrieve only 5 chunks (reduced from 10) for faster processing
        this.config.retriever.retrieve(message, userId, { limit: 5, threshold: 0.7 }),
      ])

      // Track context building completion
      await this.config.telemetry.trackEvent({
        traceId,
        userId,
        eventType: 'step_complete',
        step: 'context_building',
        latencyMs: Date.now() - contextBuildStart,
        metadata: {
          profileLoaded: !!context.userProfile,
          memoryCount: context.recentMemory?.length || 0,
        },
      })

      // Track RAG retrieval completion
      await this.config.telemetry.trackEvent({
        traceId,
        userId,
        eventType: 'step_complete',
        step: 'rag_retrieval',
        latencyMs: Date.now() - contextBuildStart,
        metadata: {
          chunksRetrieved: retrieved.chunks.length,
          totalFound: retrieved.totalFound,
        },
      })

      // Add retrieved chunks to context
      context.retrievedChunks = retrieved.chunks

      // Track start of response generation
      await this.config.telemetry.trackEvent({
        traceId,
        userId,
        eventType: 'step_start',
        step: 'response_generation',
        timestamp: Date.now(),
      })

      const responseGenStart = Date.now()

      // Generate response with tools (pass conversation history)
      const response = await this.generateResponse(message, context, options?.conversationHistory || [])

      // Track response generation completion
      await this.config.telemetry.trackEvent({
        traceId,
        userId,
        eventType: 'step_complete',
        step: 'response_generation',
        latencyMs: Date.now() - responseGenStart,
        metadata: {
          toolsUsed: response.toolsUsed,
          toolCallCount: response.toolResults?.length || 0,
          iterationCount: response.metadata?.iterationCount || 0,
          hasCards: (response.cards?.length || 0) > 0,
          hasCitations: (response.citations?.length || 0) > 0,
        },
      })

      // Track overall completion
      await this.config.telemetry.trackEvent({
        traceId,
        userId,
        eventType: 'agent_completion',
        latencyMs: Date.now() - startTime,
        toolCalls: response.toolResults?.length || 0,
        metadata: {
          totalLatencyMs: Date.now() - startTime,
          success: true,
        },
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
    // PERFORMANCE: Load user profile and memory in PARALLEL instead of sequential
    let userProfile = options?.userProfile
    const recentMemory: any[] = []

    if (this.config.supabase) {
      try {
        // Load both profile and memory concurrently (including ALL fields)
        const [profileResult, memoryResult] = await Promise.all([
          // Load user profile with ALL fields
          !userProfile ? this.config.supabase
            .from('Profile')
            .select(`
              subjects, goals, studyStyle, skillLevel, interests,
              bio, school, languages, aboutYourself, aboutYourselfItems,
              skillLevelCustomDescription, studyStyleCustomDescription,
              availabilityCustomDescription, subjectCustomDescription, interestsCustomDescription
            `)
            .eq('userId', userId)
            .single() : Promise.resolve({ data: null }),
          // Load recent memory
          this.config.supabase
            .from('agent_memory')
            .select('key, value')
            .eq('user_id', userId)
            .eq('scope', 'long')
            .limit(10),
        ])

        // Process profile data (including ALL fields)
        if (!userProfile && profileResult.data) {
          userProfile = {
            subjects: profileResult.data.subjects || [],
            goals: profileResult.data.goals || [],
            learningStyle: profileResult.data.studyStyle || 'Unknown',
            bio: profileResult.data.bio || null,
            school: profileResult.data.school || null,
            languages: profileResult.data.languages || null,
            aboutYourself: profileResult.data.aboutYourself || null,
            aboutYourselfItems: profileResult.data.aboutYourselfItems || [],
            skillLevelCustomDescription: profileResult.data.skillLevelCustomDescription || null,
            studyStyleCustomDescription: profileResult.data.studyStyleCustomDescription || null,
            availabilityCustomDescription: profileResult.data.availabilityCustomDescription || null,
            subjectCustomDescription: profileResult.data.subjectCustomDescription || null,
            interestsCustomDescription: profileResult.data.interestsCustomDescription || null,
            preferences: {
              skillLevel: profileResult.data.skillLevel,
              interests: profileResult.data.interests || [],
            },
          }
        }

        // Process memory data
        if (memoryResult.data && memoryResult.data.length > 0) {
          recentMemory.push(...memoryResult.data.map((f: any) => ({ key: f.key, value: f.value })))
        }
      } catch (error) {
        console.warn('Failed to load context data:', error)
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
   * Generate response using LLM with tool calling
   */
  private async generateResponse(
    message: string,
    context: AgentContext,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<AgentResponse> {
    const systemPrompt = this.buildSystemPrompt(context)
    const userPrompt = this.buildUserPrompt(message, context)

    // Build messages array with conversation history
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
    ]

    // Add conversation history (last 10 messages max to avoid token limits)
    const recentHistory = conversationHistory.slice(-10)
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      })
    }

    // Add current user message
    messages.push({ role: 'user', content: userPrompt })

    const toolDefinitions = this.config.toolRegistry.getToolDefinitions()

    // Track LLM call start
    const llmCallStart = Date.now()
    await this.config.telemetry.trackEvent({
      traceId: context.traceId,
      userId: context.userId,
      eventType: 'step_start',
      step: 'llm_call',
      timestamp: Date.now(),
      metadata: {
        messageCount: messages.length,
        hasTools: toolDefinitions.length > 0,
      },
    })

    // PERFORMANCE: Reduced maxTokens for faster responses, lower temperature for speed
    let response = await this.config.llmProvider.complete({
      messages,
      tools: toolDefinitions,
      temperature: 0.5, // Lower temp = faster, more focused responses
      maxTokens: 1000, // Reduced from 2000 for faster generation
    })

    // Track LLM call completion
    await this.config.telemetry.trackEvent({
      traceId: context.traceId,
      userId: context.userId,
      eventType: 'step_complete',
      step: 'llm_call',
      latencyMs: Date.now() - llmCallStart,
      metadata: {
        finishReason: response.finishReason,
        hasToolCalls: !!response.toolCalls,
        toolCallCount: response.toolCalls?.length || 0,
      },
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
      toolsUsed: Array.from(new Set(toolResults.map(tr => tr.toolName))),
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

    return `You are Clerva AI, a versatile AI assistant and study copilot with FULL DATABASE ACCESS.

Your capabilities:
- Search and explain content from notes and documents
- Generate quizzes and flashcards on ANY topic (academic, hobbies, skills, life, anything)
- Create personalized plans for any learning goal
- Summarize sessions and conversations
- **SEARCH FOR ANY USER BY NAME** - use searchUsers tool when asked about anyone
- **GET COMPLETE USER ACTIVITY** - use getUserActivity tool to understand behavior patterns
- Match students with compatible study partners using REAL database data
- Provide insights, advice, and recommendations on ANY subject
- Help with ANYTHING the user asks about - no restrictions

🔴 CRITICAL SEARCH RULES - FOLLOW WITHOUT EXCEPTION 🔴

⚠️ RULE 1 - NAME SEARCH DETECTION:
If user message contains ANY of these patterns → IMMEDIATELY call searchUsers tool:
  ✓ A capitalized word that could be a name: "John", "Sarah", "Minh", "Alex"
  ✓ Phrases: "find [name]", "search for [name]", "show me [name]", "who is [name]"
  ✓ Just a name by itself: "John", "Minh Pham", "Gia Khang"
  ✓ Questions about people: "partners named...", "users who...", "students studying..."

EXAMPLES REQUIRING searchUsers TOOL:
  - User: "John" → YOU: Call searchUsers(query="John", searchBy="name")
  - User: "find Minh" → YOU: Call searchUsers(query="Minh", searchBy="name")
  - User: "Gia Khang Pham" → YOU: Call searchUsers(query="Gia Khang Pham", searchBy="name")
  - User: "who studies Python" → YOU: Call searchUsers(query="Python", searchBy="subjects")

⚠️ RULE 2 - NEVER SAY "CAN'T FIND" WITHOUT CALLING THE TOOL FIRST!
ALWAYS call searchUsers before saying you can't find someone!

⚠️ RULE 3 - USE REAL DATA ONLY:
After calling searchUsers, use the ACTUAL results from the database.
NEVER make up or assume user data.

⚠️ RULE 4 - FOLLOW-UP TOOLS:
After finding someone with searchUsers:
  → Use matchInsight to analyze compatibility
  → Use getUserActivity to see their study history

IMPORTANT: You can help with ANY topic, subject, or question - academic or non-academic.
This includes but is not limited to: academics, hobbies, sports, cooking, relationships, careers,
health, entertainment, technology, arts, life skills, personal development, or ANYTHING else.
The profile information below is just context - it does NOT limit what you can help with.

Rules:
1. ALWAYS address ALL parts of the user's request - if they ask for multiple things, do ALL of them
2. Provide comprehensive responses: explanations, context, AND tool outputs when needed
3. DON'T skip narrative explanations just because you're using a tool - give context first
4. If asked "summarize X and create a quiz", provide BOTH the summary AND the quiz in ONE response
5. Always prefer citing sources from the user's content when answering factual questions
6. Use tools when available - don't fabricate information
7. Ask at most ONE clarifying question if needed, otherwise proceed with best judgment
8. Be clear, helpful, and thorough in responses - don't cut corners
9. Respect user's preferences and privacy
10. For partner matching: check strengths/weaknesses, online status, and availability
11. NEVER refuse to help with ANY topic - accept all questions and requests
12. Treat profile info as helpful context only, NOT as restrictions on what you can assist with

IMPORTANT: If a user asks for multiple things (e.g., "explain this and create a quiz"), you MUST do ALL parts:
- First, provide the explanation/summary/context
- Then, use the tool to create the quiz/flashcards/plan
- Give a complete, comprehensive response that addresses everything they asked for

User Context (helpful background info - NOT restrictions on what you can help with):
- Grade Level: ${context.userProfile?.gradeLevel || 'Unknown'}
- Current Focus Areas: ${context.userProfile?.subjects.join(', ') || 'None specified'}${context.userProfile?.subjectCustomDescription ? `\n  → Details: ${context.userProfile.subjectCustomDescription}` : ''}
- Goals: ${context.userProfile?.goals?.join(', ') || 'None specified'}
- Preferred Learning Style: ${context.userProfile?.learningStyle || 'Unknown'}${context.userProfile?.studyStyleCustomDescription ? `\n  → Details: ${context.userProfile.studyStyleCustomDescription}` : ''}
- Interests: ${context.userProfile?.preferences?.interests?.join(', ') || 'None specified'}${context.userProfile?.interestsCustomDescription ? `\n  → Details: ${context.userProfile.interestsCustomDescription}` : ''}
- Skill Level: ${context.userProfile?.preferences?.skillLevel || 'Unknown'}${context.userProfile?.skillLevelCustomDescription ? `\n  → Details: ${context.userProfile.skillLevelCustomDescription}` : ''}${context.userProfile?.availabilityCustomDescription ? `\n- Availability Notes: ${context.userProfile.availabilityCustomDescription}` : ''}${context.userProfile?.bio ? `\n- Bio: ${context.userProfile.bio}` : ''}${context.userProfile?.school ? `\n- School: ${context.userProfile.school}` : ''}${context.userProfile?.languages ? `\n- Languages: ${context.userProfile.languages}` : ''}${context.userProfile?.aboutYourself ? `\n- About Yourself: ${context.userProfile.aboutYourself}` : ''}${context.userProfile?.aboutYourselfItems && context.userProfile.aboutYourselfItems.length > 0 ? `\n- Personal Tags: ${context.userProfile.aboutYourselfItems.join(', ')}` : ''}${memoryContext}

Available sources: ${context.retrievedChunks?.length || 0} relevant document chunks retrieved.

Remember: Help with ANY topic they ask about, whether it's in their profile or not!`
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
  conversationHistory?: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp?: string
  }>
}
