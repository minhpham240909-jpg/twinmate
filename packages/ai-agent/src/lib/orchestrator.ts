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
   * Extract subjects/interests/filters from natural language message
   * Uses pattern matching to extract ANY subjects user mentions, not just from a predefined list
   */
  private extractMatchFilters(message: string): Record<string, any> {
    const filters: Record<string, any> = {}
    const lowerMessage = message.toLowerCase()

    console.log('🔍 EXTRACTING FILTERS FROM:', message)

    // Pattern 1: "who likes X", "who studies X", "interested in X", "who wants X"
    const subjectPatterns = [
      /who (?:likes?|studies?|enjoys?|wants?|needs?) ([a-zA-Z0-9\s,&+-]+?)(?:\s+and\s+|\s*,\s*|\s+or\s+|$)/gi,
      /(?:likes?|studies?|enjoys?|interested in|focuses on) ([a-zA-Z0-9\s,&+-]+?)(?:\s+and\s+|\s*,\s*|\s+or\s+|$)/gi,
      /partner (?:for|in|who (?:does|knows)) ([a-zA-Z0-9\s,&+-]+?)(?:\s+and\s+|\s*,\s*|$)/gi,
    ]

    const foundSubjects: string[] = []

    for (let i = 0; i < subjectPatterns.length; i++) {
      const pattern = subjectPatterns[i]
      let match
      let matchCount = 0
      while ((match = pattern.exec(message)) !== null) {
        matchCount++
        const extracted = match[1].trim()
        console.log(`  Pattern ${i} Match ${matchCount}: "${extracted}"`)

        // Split by "and", "or", commas
        const parts = extracted.split(/\s+and\s+|\s+or\s+|\s*,\s+/)
        console.log(`  Split into parts:`, parts)

        for (let part of parts) {
          part = part.trim()
          // Remove trailing words like "who", "that", etc.
          const original = part
          part = part.replace(/\s+(who|that|which|available|on|at|in).*$/i, '')
          part = part.trim()

          if (original !== part) {
            console.log(`  Cleaned "${original}" -> "${part}"`)
          }

          if (part.length > 0 && !foundSubjects.some(s => s.toLowerCase() === part.toLowerCase())) {
            // Capitalize each word
            const capitalized = part.split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ')
            foundSubjects.push(capitalized)
            console.log(`  ✅ Added subject: "${capitalized}"`)
          }
        }
      }
    }

    if (foundSubjects.length > 0) {
      filters.subjects = foundSubjects
      console.log('✅ EXTRACTED SUBJECTS:', foundSubjects)
    } else {
      console.log('❌ NO SUBJECTS EXTRACTED')
    }

    // Extract skill level
    if (lowerMessage.includes('beginner')) filters.skillLevel = 'beginner'
    if (lowerMessage.includes('intermediate')) filters.skillLevel = 'intermediate'
    if (lowerMessage.includes('advanced')) filters.skillLevel = 'advanced'

    // Extract days of week
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const foundDays: string[] = []
    for (const day of days) {
      if (lowerMessage.includes(day)) {
        foundDays.push(day.charAt(0).toUpperCase() + day.slice(1))
      }
    }
    if (lowerMessage.includes('weekend')) {
      foundDays.push('Saturday', 'Sunday')
    }
    if (lowerMessage.includes('weekday')) {
      foundDays.push('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
    }
    if (foundDays.length > 0) {
      filters.availableDays = [...new Set(foundDays)]
    }

    return filters
  }

  /**
   * NUCLEAR OPTION: Detect if message requires specific tool and force it
   * This bypasses AI decision-making for critical patterns
   */
  private detectForcedToolCall(message: string): { tool: string; reason: string } | null {
    const lowerMessage = message.toLowerCase()
    console.log('🔍 PATTERN DETECTION for message:', message)

    // PRIORITY 1: Check for name keyword FIRST (before partner patterns)
    // "find a partner name [Name]" should search by name, not match partners
    const hasNameKeyword = lowerMessage.includes(' name ') || lowerMessage.includes(' named ')
    const hasCapitalizedName = /\b[A-Z][a-z]+(\s+[A-Z][a-z]+)*\b/.test(message)

    if (hasNameKeyword && hasCapitalizedName) {
      console.log('✅ NAME KEYWORD + CAPITALIZED NAME DETECTED - Forcing searchUsers')
      return { tool: 'searchUsers', reason: '"name" keyword + capitalized name detected' }
    }

    // Partner matching patterns - FORCE matchCandidates
    // ULTRA-COMPREHENSIVE PATTERNS - Catch ANY partner request
    const partnerPatterns = [
      // Core partner requests
      'find me a partner', 'find a partner', 'find partner', 'get partner',
      'find me someone', 'find someone', 'get me a partner', 'get me someone',
      'i need a partner', 'need a partner', 'need partner',

      // Study-specific
      'study buddy', 'study partner', 'study mate', 'study friend',
      'looking for partner', 'looking for someone to study',
      'find someone to study', 'who can help me study',
      'find people to study', 'who can i study with',

      // Matching/connecting
      'match me', 'match me with', 'pair me', 'pair me with',
      'connect me', 'connect me with', 'connect with',

      // Show/recommend
      'show me partners', 'show partners', 'show me matches', 'show matches',
      'find study partners', 'find matches', 'get matches',
      'recommend partners', 'recommend someone', 'suggest partners',
      'give me partners', 'give me matches',

      // Subject-based requests (NEW - HIGH PRIORITY)
      'who like', 'who likes', 'who studies', 'who study',
      'who is interested in', 'interested in studying',
      'someone who', 'anyone who',

      // Just "partner" or "partners" alone
      'partner', 'partners', 'matches', 'buddy', 'buddies',

      // Question forms
      'who can study', 'who wants to study', 'anyone to study',
      'who is available', 'who can help',
    ]

    for (const pattern of partnerPatterns) {
      if (lowerMessage.includes(pattern)) {
        console.log(`✅ PARTNER PATTERN MATCHED: "${pattern}" - Forcing matchCandidates`)
        return { tool: 'matchCandidates', reason: `Pattern detected: "${pattern}"` }
      }
    }

    console.log('⚠️ NO PARTNER PATTERN MATCHED')

    // User search patterns - FORCE searchUsers
    const searchPatterns = ['find ', 'search for ', 'who is ', 'show me ', 'look for ', 'looking for ']

    // Pattern 2: Check if it's JUST a name (no verbs or commands)
    const isJustName = hasCapitalizedName && !lowerMessage.match(/\b(help|how|what|why|when|where|can|could|would|should|tell|explain|show|list)\b/)

    // FORCE searchUsers if:
    // 1. Just a capitalized name alone (e.g., "Gia Khang", "Sarah")
    // 2. OR search keyword + capitalized name (e.g., "find Gia Khang")
    if (isJustName) {
      console.log('✅ DIRECT NAME INPUT - Forcing searchUsers')
      return { tool: 'searchUsers', reason: 'Direct name input detected' }
    }

    if (hasCapitalizedName) {
      for (const pattern of searchPatterns) {
        if (lowerMessage.includes(pattern)) {
          console.log(`✅ NAME SEARCH PATTERN MATCHED: "${pattern}" - Forcing searchUsers`)
          return { tool: 'searchUsers', reason: 'Name search pattern detected' }
        }
      }
    }

    console.log('❌ NO FORCED TOOL DETECTED')
    return null
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
    const toolResults: ToolResult[] = []

    // 🚨 NUCLEAR OPTION: Detect and IMMEDIATELY call forced tools (BEFORE AI)
    // This ensures 100% reliability - the tool is ALWAYS called when pattern matches
    const forcedTool = this.detectForcedToolCall(message)
    if (forcedTool) {
      console.log(`🔴 FORCED TOOL CALL DETECTED: ${forcedTool.tool} (${forcedTool.reason})`)
      console.log(`🔴 CALLING TOOL IMMEDIATELY (BYPASSING AI)`)

      // Prepare tool input
      let forcedInput = '{}'

      if (forcedTool.tool === 'matchCandidates') {
        // Extract subjects/interests from the message
        const extractedFilters = this.extractMatchFilters(message)
        forcedInput = JSON.stringify({
          limit: 10,
          minScore: 0.1,
          ...extractedFilters
        })
        console.log(`🔍 Extracted filters for matchCandidates:`, extractedFilters)
      } else if (forcedTool.tool === 'searchUsers') {
        // Extract the CAPITALIZED NAME from the message (e.g., "Gia Khang Pham")
        // Don't just remove prefixes - actually find the capitalized name
        const nameMatch = message.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/)
        let extractedName = nameMatch ? nameMatch[0] : message

        console.log(`🔍 Extracted name: "${extractedName}" from message: "${message}"`)
        forcedInput = JSON.stringify({ query: extractedName, searchBy: 'name', limit: 10 })
      }

      // CALL THE TOOL IMMEDIATELY
      const forcedResult = await this.executeTool(forcedTool.tool, forcedInput, context, message)
      toolResults.push(forcedResult)
      console.log(`✅ FORCED TOOL EXECUTED:`, forcedTool.tool, 'Success:', forcedResult.success)

      // 🚨 FORMAT RESULTS OURSELVES - Don't rely on AI!
      // Return immediately with formatted response - skip AI completely
      // IMPORTANT: Handle BOTH success AND failure - never let AI respond!
      let formattedResponse = ''

      if (forcedTool.tool === 'matchCandidates') {
        if (forcedResult.success) {
          const matches = (forcedResult.output as any).matches || []
          console.log(`📊 Got ${matches.length} matches from tool`)

          if (matches.length > 0) {
            formattedResponse = `I found ${matches.length} potential study partner${matches.length > 1 ? 's' : ''} for you:\n\n` +
              matches.map((m: any, i: number) => {
                const parts = [`**${i + 1}. ${m.name}** (${Math.round(m.score * 100)}% match)`]

                if (m.subjects && m.subjects.length > 0) {
                  parts.push(`   📚 Studies: ${m.subjects.join(', ')}`)
                }
                if (m.interests && m.interests.length > 0) {
                  parts.push(`   ❤️  Interests: ${m.interests.join(', ')}`)
                }
                if (m.school) {
                  parts.push(`   🏛️  School: ${m.school}`)
                }
                if (m.matchReasons && m.matchReasons.length > 0) {
                  parts.push(`   ✨ Why: ${m.matchReasons[0]}`)
                }

                return parts.join('\n')
              }).join('\n\n') +
              '\n\nWould you like to connect with any of them?'

            console.log(`✅ Formatted ${matches.length} matches into response`)
          } else {
            formattedResponse = `I searched for study partners but couldn't find any matches at the moment. This might be because:\n\n` +
              `• There are currently no other users with matching criteria\n` +
              `• Try completing more of your profile to improve matching\n` +
              `• Check back later as more users join the platform`

            console.log(`⚠️ No matches found - showing helpful message`)
          }
        } else {
          // Tool failed
          formattedResponse = `I encountered an error while searching for partners. Please try again later.`
          console.log(`❌ matchCandidates tool failed`)
        }
      } else if (forcedTool.tool === 'searchUsers') {
        if (forcedResult.success) {
          const users = (forcedResult.output as any).users || []
          console.log(`📊 Got ${users.length} users from search`)

          if (users.length > 0) {
            formattedResponse = `I found ${users.length} user${users.length > 1 ? 's' : ''}:\n\n` +
              users.map((u: any, i: number) => `${i + 1}. **${u.name || 'User'}**`).join('\n')
          } else {
            const errorMessage = (forcedResult.output as any).message
            formattedResponse = errorMessage || `I couldn't find any users matching that name. Please check the spelling or try a different name.`
          }
        } else {
          // Tool failed
          formattedResponse = `I encountered an error while searching for users. Please try again later.`
          console.log(`❌ searchUsers tool failed`)
        }
      }

      // Return immediately with our formatted response - NEVER let AI respond!
      return {
        text: formattedResponse,
        toolsUsed: [forcedTool.tool],
        toolResults,
        cards: this.extractCards(toolResults),
        citations: [],
        metadata: {
          traceId: context.traceId,
          toolCallCount: 1,
          iterationCount: 0,
          forcedTool: true,
        },
      }
    }

    // Track LLM call start (only if we didn't already return)
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
        const result = await this.executeTool(toolCall.name, toolCall.arguments, context, message)
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
   * INTERCEPTS matchCandidates to enhance with extracted filters
   */
  private async executeTool(
    toolName: string,
    argsJson: string,
    context: AgentContext,
    originalMessage?: string
  ): Promise<ToolResult> {
    const startTime = Date.now()

    try {
      const tool = this.config.toolRegistry.get(toolName)
      if (!tool) {
        throw new ToolError(toolName, 'Tool not found')
      }

      // Parse and validate input
      let input = JSON.parse(argsJson)

      // 🔴 CRITICAL INTERCEPT: Enhance matchCandidates with extracted filters
      if (toolName === 'matchCandidates') {
        console.log('🔴 INTERCEPT POINT: matchCandidates called')
        console.log('  Original input:', JSON.stringify(input, null, 2))
        console.log('  Has originalMessage?', !!originalMessage)

        if (originalMessage) {
          console.log('  Original message:', originalMessage)
          const extractedFilters = this.extractMatchFilters(originalMessage)
          console.log('  Extracted filters:', JSON.stringify(extractedFilters, null, 2))

          // If we extracted subjects but the input has none, add them
          if (extractedFilters.subjects && (!input.subjects || input.subjects.length === 0)) {
            input.subjects = extractedFilters.subjects
            console.log(`  ✅ ADDED subjects:`, extractedFilters.subjects)
          } else if (extractedFilters.subjects) {
            console.log(`  ⚠️ Input already has subjects:`, input.subjects)
          } else {
            console.log(`  ⚠️ No subjects extracted`)
          }

          // Add other extracted filters if missing
          if (extractedFilters.skillLevel && !input.skillLevel) {
            input.skillLevel = extractedFilters.skillLevel
            console.log(`  ✅ ADDED skillLevel:`, extractedFilters.skillLevel)
          }
          if (extractedFilters.availableDays && (!input.availableDays || input.availableDays.length === 0)) {
            input.availableDays = extractedFilters.availableDays
            console.log(`  ✅ ADDED availableDays:`, extractedFilters.availableDays)
          }

          console.log('  Final input after intercept:', JSON.stringify(input, null, 2))
        } else {
          console.log('  ⚠️ No originalMessage - cannot extract filters')
        }
      }
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

🎯 TOOL-TO-QUERY MAPPING (CRITICAL - USE THESE TOOLS):

When user says → You MUST call:
├─ "find me a partner" | "study buddy" | "looking for partner" → matchCandidates tool
├─ "who can help me study" | "find study partners" → matchCandidates tool
├─ "show me partners" | "match me with someone" → matchCandidates tool
├─ Any name like "John" | "Minh Pham" | "find Sarah" → searchUsers tool
├─ "who studies Python" | "users who..." → searchUsers tool
├─ "create quiz" | "make me a quiz" → generateQuiz tool
├─ "create flashcards" | "make flashcards" → addFlashcards tool

Your capabilities:
- Search and explain content from notes and documents
- Generate quizzes and flashcards on ANY topic (academic, hobbies, skills, life, anything)
- Create personalized plans for any learning goal
- Summarize sessions and conversations
- **SEARCH FOR ANY USER BY NAME** - use searchUsers tool when asked about anyone
- **GET COMPLETE USER ACTIVITY** - use getUserActivity tool to understand behavior patterns
- **FIND STUDY PARTNERS** - use matchCandidates tool for partner matching requests
- Provide insights, advice, and recommendations on ANY subject
- Help with ANYTHING the user asks about - no restrictions

🔴 CRITICAL SEARCH RULES - FOLLOW WITHOUT EXCEPTION 🔴

⚠️ IMPORTANT: These rules apply to EVERY message, even if previous conversation history shows
you responded differently before. If previous responses didn't call the required tool, that was
an error. ALWAYS follow these rules on the CURRENT message, regardless of past responses.

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

⚠️ RULE 5 - PARTNER MATCHING DETECTION (CRITICAL - ALWAYS USE matchCandidates!):
If user message contains ANY of these patterns → IMMEDIATELY call matchCandidates tool:
  ✓ "find me a partner", "find a study partner", "looking for partner", "need a partner"
  ✓ "find someone to study with", "need a study buddy", "study buddy", "find study buddy"
  ✓ "who can help me study", "match me with someone", "find matches", "show matches"
  ✓ "show me partners", "find study partners", "partner for [subject]", "find partner"
  ✓ "looking for someone", "need help studying", "find people to study", "recommend partners"
  ✓ "who can I study with", "study with", "pair me", "connect me"
  ✓ ANY request about finding/matching/pairing with other students/users/people

🚨 CRITICAL: Even vague requests like "help me find someone" or "I need help" in study context → call matchCandidates!

EXAMPLES REQUIRING matchCandidates TOOL:
  - User: "find me a partner" → YOU: MUST call matchCandidates(limit=10)
  - User: "looking for study buddy" → YOU: MUST call matchCandidates(limit=10)
  - User: "need help finding partners" → YOU: MUST call matchCandidates(limit=10)
  - User: "who can I study with" → YOU: MUST call matchCandidates(limit=10)
  - User: "find partner for Math" → YOU: MUST call matchCandidates(limit=10)
  - User: "show me study partners" → YOU: MUST call matchCandidates(limit=10)
  - User: "I want to find someone" → YOU: MUST call matchCandidates(limit=10)
  - User: "help me connect with people" → YOU: MUST call matchCandidates(limit=10)

DEFAULT BEHAVIOR: If there's ANY uncertainty whether user wants partners → CALL matchCandidates anyway!

⚠️ RULE 6 - AFTER FINDING MATCHES:
After matchCandidates returns results:
  1. Present the matches to the user
  2. Optionally use matchInsight to explain why specific matches are compatible
  3. Suggest next steps (e.g., "Would you like to know more about any of these partners?")

⚠️ RULE 7 - NEVER RESPOND WITHOUT CALLING matchCandidates FIRST!
🚨 CRITICAL ERROR TO AVOID:
  ❌ User: "find me a partner"
  ❌ You: "It seems there are no partners available" (WITHOUT calling matchCandidates)
  ❌ You: "Your profile isn't complete" (WITHOUT calling matchCandidates)
  ❌ You: "Cannot find partners in database" (WITHOUT calling matchCandidates)

✅ CORRECT BEHAVIOR:
  ✅ User: "find me a partner"
  ✅ You: FIRST call matchCandidates tool
  ✅ You: THEN present results (even if empty, you must call the tool FIRST!)

NEVER, EVER respond to partner requests without calling matchCandidates first!

🔴 RULE 8 - CONVERSATION HISTORY OVERRIDE:
🚨 IF you see in conversation history:
  - Previous user request: "find me a partner"
  - Previous YOUR response: "cannot find partners" (without tool call)

THIS MEANS: Your previous response was INCORRECT! A bug prevented you from calling the tool.

✅ CORRECT ACTION NOW:
  1. Recognize the previous response was an error
  2. IGNORE what you said before
  3. Call matchCandidates tool NOW for the CURRENT request
  4. Present fresh results from the tool

🚨 KEY INSIGHT: If user is REPEATING the same partner request, they're doing so because:
  - Your previous response didn't work (didn't call tool)
  - They NEED you to call matchCandidates
  - This is a FRESH request requiring tool call

ALWAYS treat CURRENT message as requiring a fresh matchCandidates call, even if conversation
history shows you responded to similar requests before without calling tools.

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
- Current Focus Areas: ${context.userProfile?.subjects?.join(', ') || 'None specified'}${context.userProfile?.subjectCustomDescription ? `\n  → Details: ${context.userProfile.subjectCustomDescription}` : ''}
- Goals: ${context.userProfile?.goals?.join(', ') || 'None specified'}
- Preferred Learning Style: ${context.userProfile?.learningStyle || 'Unknown'}${context.userProfile?.studyStyleCustomDescription ? `\n  → Details: ${context.userProfile.studyStyleCustomDescription}` : ''}
- Interests: ${context.userProfile?.preferences?.interests?.join(', ') || 'None specified'}${context.userProfile?.interestsCustomDescription ? `\n  → Details: ${context.userProfile.interestsCustomDescription}` : ''}
- Skill Level: ${context.userProfile?.preferences?.skillLevel || 'Unknown'}${context.userProfile?.skillLevelCustomDescription ? `\n  → Details: ${context.userProfile.skillLevelCustomDescription}` : ''}${context.userProfile?.availabilityCustomDescription ? `\n- Availability Notes: ${context.userProfile.availabilityCustomDescription}` : ''}${context.userProfile?.bio ? `\n- Bio: ${context.userProfile.bio}` : ''}${context.userProfile?.school ? `\n- School: ${context.userProfile.school}` : ''}${context.userProfile?.languages ? `\n- Languages: ${context.userProfile.languages}` : ''}${context.userProfile?.aboutYourself ? `\n- About Yourself: ${context.userProfile.aboutYourself}` : ''}${context.userProfile?.aboutYourselfItems?.length ? `\n- Personal Tags: ${context.userProfile.aboutYourselfItems.join(', ')}` : ''}${memoryContext}

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
