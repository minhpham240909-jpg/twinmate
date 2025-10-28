/**
 * AI Agent Chat API Route
 * Handles user messages and orchestrates AI responses with tool execution
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AgentOrchestrator } from '@/../packages/ai-agent/src/lib/orchestrator'
import { initializeToolRegistry } from '@/../packages/ai-agent/src/tools'
import { OpenAIEmbeddingProvider } from '@/../packages/ai-agent/src/rag/embeddings'
import { VectorRetriever } from '@/../packages/ai-agent/src/rag/retriever'
import { MemoryManager } from '@/../packages/ai-agent/src/lib/memory'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// LLM Provider (OpenAI/Anthropic)
class OpenAILLMProvider {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async complete(request: any): Promise<any> {
    const requestBody = {
      model: 'gpt-4-turbo',
      messages: request.messages,
      temperature: request.temperature || 0.7,
      tools: request.tools,
      stream: false, // Non-streaming for now (tool calls need full response)
    }

    console.log('OpenAI request:', {
      model: requestBody.model,
      messagesCount: requestBody.messages?.length,
      toolsCount: requestBody.tools?.length,
      firstMessage: requestBody.messages?.[0],
    })

    // Retry with exponential backoff for transient errors
    const maxRetries = 3
    let lastError: any

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.error?.message || errorData.message || response.statusText

          console.error(`OpenAI API error (attempt ${attempt}/${maxRetries}):`, errorData)

          // Don't retry on client errors (400-499) except rate limits (429)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(`OpenAI API error: ${errorMessage}`)
          }

          lastError = new Error(`OpenAI API error: ${errorMessage}`)

          // Retry on server errors (500+) or rate limits (429)
          if (attempt < maxRetries) {
            const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Max 10s backoff
            console.log(`Retrying in ${backoffMs}ms...`)
            await new Promise(resolve => setTimeout(resolve, backoffMs))
            continue
          }
          throw lastError
        }

        const data = await response.json()
        const message = data.choices[0].message

        return {
          content: message.content || '',
          finishReason: message.tool_calls ? 'tool_calls' : 'stop',
          toolCalls: message.tool_calls?.map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments, // Keep as JSON string for orchestrator
          })) || [],
        }
      } catch (error: any) {
        lastError = error
        if (attempt < maxRetries && this.isRetryableError(error)) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          console.log(`Network error, retrying in ${backoffMs}ms...`, error.message)
          await new Promise(resolve => setTimeout(resolve, backoffMs))
          continue
        }
        throw error
      }
    }

    throw lastError
  }

  private isRetryableError(error: any): boolean {
    // Retry on network errors, timeouts, etc.
    return (
      error.name === 'TypeError' ||
      error.message?.includes('fetch') ||
      error.message?.includes('network') ||
      error.message?.includes('timeout')
    )
  }

  async *stream(request: any): AsyncIterableIterator<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: request.messages,
        temperature: request.temperature || 0.7,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) throw new Error('No response body')

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim() !== '')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') return

          try {
            const json = JSON.parse(data)
            const content = json.choices[0]?.delta?.content
            if (content) {
              yield content
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

// Simple in-memory rate limiting (per-user)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const limit = rateLimitMap.get(userId)

  // Reset if expired
  if (limit && now > limit.resetAt) {
    rateLimitMap.delete(userId)
  }

  const current = rateLimitMap.get(userId)

  // Allow 20 requests per minute per user
  const maxRequests = 20
  const windowMs = 60000 // 1 minute

  if (!current) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (current.count >= maxRequests) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  current.count++
  return { allowed: true }
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check rate limit
    const rateLimit = checkRateLimit(user.id)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    // Parse request body
    const body = await request.json()
    const { message, context } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Enhance message with context if provided
    const enhancedMessage = context
      ? `[Context: ${context.description}]\n\n${message}`
      : message

    // Initialize AI agent components
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const openaiApiKey = process.env.OPENAI_API_KEY!

    const adminSupabase = createSupabaseClient(supabaseUrl, supabaseServiceKey)

    const embeddingProvider = new OpenAIEmbeddingProvider(openaiApiKey)
    const retriever = new VectorRetriever(supabaseUrl, supabaseServiceKey, embeddingProvider)
    const llmProvider = new OpenAILLMProvider(openaiApiKey)
    const memoryManager = new MemoryManager(adminSupabase)

    // Load conversation history from memory
    const conversationHistory = await memoryManager.loadConversation(user.id)

    // Initialize tool registry
    const registry = initializeToolRegistry({
      supabase: adminSupabase,
      llmProvider,
      retriever,
    })

    // Create orchestrator
    const orchestrator = new AgentOrchestrator({
      llmProvider,
      retriever,
      toolRegistry: registry,
      supabase: adminSupabase, // Pass Supabase client for profile/memory loading
    })

    // Process message with context
    const response = await orchestrator.handle(user.id, enhancedMessage)

    // Save updated conversation history (non-blocking, failures are logged but don't break response)
    try {
      const newConversation = [
        ...conversationHistory,
        {
          role: 'user' as const,
          content: message,
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: response.text || '',
          timestamp: new Date().toISOString(),
          cards: response.cards,
        },
      ]

      // Keep only last 20 messages (10 exchanges) to prevent memory bloat
      const trimmedConversation = newConversation.slice(-20)
      await memoryManager.saveConversation(user.id, trimmedConversation)
    } catch (memoryError) {
      console.error('Non-critical: Failed to save conversation to memory:', memoryError)
      // Continue - memory save is non-critical
    }

    // Return response
    return NextResponse.json({
      text: response.text,
      cards: response.cards || [],
      toolsUsed: response.toolsUsed || [],
      traceId: response.traceId,
      historyLoaded: conversationHistory.length > 0, // Let frontend know if history was available
    })
  } catch (error) {
    console.error('AI agent error:', error)

    // Log detailed error for debugging
    if (error instanceof Error) {
      console.error('Error stack:', error.stack)
      console.error('Error message:', error.message)
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined,
      },
      { status: 500 }
    )
  }
}

// Optional: GET endpoint to check agent status
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: '1.0.0',
    toolsAvailable: 11, // searchNotes, generateQuiz, addFlashcards, etc.
  })
}
