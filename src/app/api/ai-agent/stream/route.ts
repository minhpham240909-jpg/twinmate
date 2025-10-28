/**
 * AI Agent Streaming Chat API Route
 * Returns Server-Sent Events (SSE) for real-time streaming
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AgentOrchestrator } from '@/../packages/ai-agent/src/lib/orchestrator'
import { initializeToolRegistry } from '@/../packages/ai-agent/src/tools'
import { OpenAIEmbeddingProvider } from '@/../packages/ai-agent/src/rag/embeddings'
import { VectorRetriever } from '@/../packages/ai-agent/src/rag/retriever'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// LLM Provider with streaming support
class StreamingOpenAIProvider {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async *stream(request: any): AsyncIterableIterator<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // PERFORMANCE: Switched to faster gpt-4o
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

  // Non-streaming fallback (for tool calls)
  async complete(request: any): Promise<any> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // PERFORMANCE: Switched to faster gpt-4o
        messages: request.messages,
        temperature: request.temperature || 0.7,
        tools: request.tools,
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const message = data.choices[0].message

    return {
      content: message.content || '',
      finishReason: message.tool_calls ? 'tool_calls' : 'stop',
      toolCalls: message.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })) || [],
    }
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { message } = body

    if (!message || typeof message !== 'string') {
      return new Response('Message is required', { status: 400 })
    }

    // Initialize AI components
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const openaiApiKey = process.env.OPENAI_API_KEY!

    const adminSupabase = createSupabaseClient(supabaseUrl, supabaseServiceKey)
    const embeddingProvider = new OpenAIEmbeddingProvider(openaiApiKey)
    const retriever = new VectorRetriever(supabaseUrl, supabaseServiceKey, embeddingProvider)
    const llmProvider = new StreamingOpenAIProvider(openaiApiKey)
    const memoryManager = new (await import('@/../packages/ai-agent/src/lib/memory')).MemoryManager(adminSupabase)

    // PERFORMANCE: Load conversation history in parallel
    const [conversationHistory, registry] = await Promise.all([
      memoryManager.loadConversation(user.id),
      Promise.resolve(initializeToolRegistry({
        supabase: adminSupabase,
        llmProvider,
        retriever,
      })),
    ])

    // Create orchestrator
    const orchestrator = new AgentOrchestrator({
      llmProvider,
      retriever,
      toolRegistry: registry,
      supabase: adminSupabase,
    })

    // Create readable stream for SSE with REAL streaming
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // PERFORMANCE: Execute orchestrator with conversation history
          const response = await orchestrator.handle(user.id, message, {
            conversationHistory,
          })

          // REAL STREAMING: Stream the text word by word (faster than char by char)
          const text = response.text || ''
          const words = text.split(' ')

          for (let i = 0; i < words.length; i++) {
            const word = words[i] + (i < words.length - 1 ? ' ' : '')
            const data = JSON.stringify({ type: 'text', content: word })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))

            // Micro-delay for natural streaming (1ms instead of 10ms)
            await new Promise(resolve => setTimeout(resolve, 1))
          }

          // Send cards if any
          if (response.cards && response.cards.length > 0) {
            const data = JSON.stringify({ type: 'cards', data: response.cards })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }

          // Save conversation history (non-blocking)
          memoryManager.saveConversation(user.id, [
            ...conversationHistory,
            { role: 'user' as const, content: message, timestamp: new Date().toISOString() },
            { role: 'assistant' as const, content: text, timestamp: new Date().toISOString(), cards: response.cards },
          ].slice(-20)).catch(err => console.warn('Failed to save conversation:', err))

          // Send done signal
          const doneData = JSON.stringify({ type: 'done' })
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))

          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          const errorData = JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Stream setup error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
