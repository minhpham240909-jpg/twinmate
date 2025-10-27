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
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// LLM Provider (OpenAI/Anthropic)
class OpenAILLMProvider {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async complete(request: any): Promise<any> {
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
        tools: request.tools,
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
        arguments: JSON.parse(tc.function.arguments),
      })) || [],
    }
  }
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

    // Parse request body
    const body = await request.json()
    const { message } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Initialize AI agent components
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const openaiApiKey = process.env.OPENAI_API_KEY!

    const adminSupabase = createSupabaseClient(supabaseUrl, supabaseServiceKey)

    const embeddingProvider = new OpenAIEmbeddingProvider(openaiApiKey)
    const retriever = new VectorRetriever(supabaseUrl, supabaseServiceKey, embeddingProvider)
    const llmProvider = new OpenAILLMProvider(openaiApiKey)

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
    })

    // Process message
    const response = await orchestrator.handle(user.id, message)

    // Return response
    return NextResponse.json({
      text: response.text,
      cards: response.cards || [],
      toolsUsed: response.toolsUsed || [],
      traceId: response.traceId,
    })
  } catch (error) {
    console.error('AI agent error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
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
