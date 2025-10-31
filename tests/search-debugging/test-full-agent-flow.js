/**
 * Test the FULL AI agent flow to see what OpenAI receives
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testFullFlow() {
  console.log('\n========================================')
  console.log('Testing FULL AI Agent Flow')
  console.log('========================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (!supabaseUrl || !serviceKey || !openaiKey) {
    console.error('❌ Missing environment variables')
    return
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Get a real user ID
  const { data: users } = await supabase
    .from('User')
    .select('id, name')
    .limit(1)

  if (!users || users.length === 0) {
    console.error('❌ No users found')
    return
  }

  const testUserId = users[0].id
  console.log('Using test user:', users[0].name, '(', testUserId, ')')

  // Import and initialize AI agent components
  const { OpenAIEmbeddingProvider } = require('./packages/ai-agent/src/rag/embeddings.ts')
  const { VectorRetriever } = require('./packages/ai-agent/src/rag/retriever.ts')
  const { initializeToolRegistry } = require('./packages/ai-agent/src/tools/index.ts')
  const { AgentOrchestrator } = require('./packages/ai-agent/src/lib/orchestrator.ts')

  // Initialize components
  console.log('\n\n1. Initializing AI agent components...')
  const embeddingProvider = new OpenAIEmbeddingProvider(openaiKey)
  const retriever = new VectorRetriever(supabaseUrl, serviceKey, embeddingProvider)

  // Create minimal LLM provider that logs everything
  class DebugLLMProvider {
    constructor(apiKey) {
      this.apiKey = apiKey
    }

    async complete(request) {
      console.log('\n\n2. LLM REQUEST DETAILS:')
      console.log('   Model: gpt-4o')
      console.log('   Messages:', request.messages?.length || 0)
      console.log('   Tools provided:', request.tools?.length || 0)

      if (request.tools && request.tools.length > 0) {
        console.log('\n   Tool Names:')
        request.tools.forEach(t => {
          console.log(`     - ${t.function.name}`)
        })

        console.log('\n   searchUsers tool details:')
        const searchUsersTool = request.tools.find(t => t.function.name === 'searchUsers')
        if (searchUsersTool) {
          console.log('   ✅ searchUsers IS in the tool list!')
          console.log('   Description preview:', searchUsersTool.function.description.substring(0, 100) + '...')
          console.log('   Parameters:', JSON.stringify(searchUsersTool.function.parameters, null, 2))
        } else {
          console.log('   ❌ searchUsers IS NOT in the tool list!')
        }
      } else {
        console.log('   ❌ NO TOOLS PROVIDED TO OPENAI!')
      }

      console.log('\n   System Prompt (first 500 chars):')
      const systemMsg = request.messages.find(m => m.role === 'system')
      if (systemMsg) {
        console.log(systemMsg.content.substring(0, 500) + '...')
      }

      console.log('\n   User Message:')
      const userMsg = request.messages.find(m => m.role === 'user')
      if (userMsg) {
        console.log(userMsg.content)
      }

      // Make actual OpenAI call
      console.log('\n\n3. Calling OpenAI API...')
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: request.messages,
          temperature: 0.7,
          tools: request.tools,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('❌ OpenAI API error:', error)
        throw new Error(`OpenAI error: ${error.error?.message || 'Unknown'}`)
      }

      const data = await response.json()
      const message = data.choices[0].message

      console.log('\n\n4. OpenAI RESPONSE:')
      console.log('   Finish reason:', data.choices[0].finish_reason)
      console.log('   Tool calls:', message.tool_calls?.length || 0)

      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log('   ✅ OpenAI called tools:')
        message.tool_calls.forEach(tc => {
          console.log(`     - ${tc.function.name}`)
          console.log(`       Args: ${tc.function.arguments}`)
        })
      } else {
        console.log('   ❌ OpenAI did NOT call any tools')
        console.log('   Response content:', message.content)
      }

      return {
        content: message.content || '',
        finishReason: message.tool_calls ? 'tool_calls' : 'stop',
        toolCalls: message.tool_calls?.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        })) || [],
      }
    }
  }

  const llmProvider = new DebugLLMProvider(openaiKey)

  console.log('   Initializing tool registry...')
  const registry = initializeToolRegistry({
    supabase,
    llmProvider,
    retriever,
  })

  console.log('   ✅ Tools registered:', registry.list().length)
  registry.list().forEach(t => {
    console.log(`     - ${t.name}`)
  })

  // Create orchestrator
  const orchestrator = new AgentOrchestrator({
    llmProvider,
    retriever,
    toolRegistry: registry,
    supabase,
  })

  // Test query
  const testMessage = 'Gia Khang Pham'
  console.log('\n\n5. Sending message to AI agent:', testMessage)
  console.log('=========================================')

  try {
    const response = await orchestrator.handle(testUserId, testMessage, {})

    console.log('\n\n6. FINAL RESPONSE:')
    console.log('   Text:', response.text)
    console.log('   Tools used:', response.toolsUsed || [])
    console.log('   Tool results:', response.toolResults?.length || 0)
  } catch (error) {
    console.error('\n\n❌ Error during agent handling:', error.message)
    console.error('Stack:', error.stack)
  }

  console.log('\n========================================\n')
}

testFullFlow().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
