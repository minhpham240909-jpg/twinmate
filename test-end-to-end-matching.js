/**
 * END-TO-END AI AGENT MATCHING TEST
 * Tests if AI can find partners based on user descriptions
 * This simulates real user queries and checks if results are correct
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const openaiKey = process.env.OPENAI_API_KEY

if (!supabaseUrl || !supabaseKey || !openaiKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

// Import the orchestrator and tools
async function testEndToEnd() {
  console.log('=' .repeat(80))
  console.log('🧪 END-TO-END AI AGENT MATCHING TEST')
  console.log('=' .repeat(80))
  console.log('')
  console.log('This test simulates REAL user queries to see if AI finds partners')
  console.log('')

  try {
    // ========================================================================
    // STEP 1: Setup - Get test user and verify data
    // ========================================================================
    console.log('STEP 1: Setting up test environment')
    console.log('-'.repeat(80))

    const { data: users } = await supabase
      .from('User')
      .select('id, name, email')
      .limit(5)

    if (!users || users.length < 2) {
      console.error('❌ Need at least 2 users in database')
      process.exit(1)
    }

    const testUser = users[0]
    console.log(`✅ Test user: ${testUser.name}`)
    console.log(`   User ID: ${testUser.id}`)
    console.log('')

    // Get profile
    const { data: profile } = await supabase
      .from('Profile')
      .select('*')
      .eq('userId', testUser.id)
      .single()

    if (!profile) {
      console.error('❌ Test user has no profile')
      process.exit(1)
    }

    console.log('Profile:')
    console.log(`   Subjects: ${profile.subjects?.join(', ') || '(empty)'}`)
    console.log(`   Study Style: ${profile.studyStyle || '(not set)'}`)
    console.log(`   Skill Level: ${profile.skillLevel || '(not set)'}`)
    console.log('')

    // Get potential partners
    const { data: otherProfiles } = await supabase
      .from('Profile')
      .select('userId, subjects, studyStyle, skillLevel')
      .neq('userId', testUser.id)

    const { data: otherUsers } = await supabase
      .from('User')
      .select('id, name, email')
      .in('id', otherProfiles.map(p => p.userId))

    const userMap = new Map(otherUsers.map(u => [u.id, u]))

    console.log(`✅ Found ${otherProfiles.length} potential partners:`)
    otherProfiles.forEach((p, i) => {
      const user = userMap.get(p.userId)
      console.log(`   ${i + 1}. ${user?.name || 'Unknown'}`)
      console.log(`      Subjects: ${p.subjects?.join(', ') || '(none)'}`)
      console.log(`      Style: ${p.studyStyle || '(not set)'}`)
      console.log(`      Level: ${p.skillLevel || '(not set)'}`)
    })
    console.log('')

    // ========================================================================
    // STEP 2: Direct Tool Test
    // ========================================================================
    console.log('STEP 2: Testing matchCandidates tool directly')
    console.log('-'.repeat(80))

    // Dynamically import the tool
    const toolModule = await import('./packages/ai-agent/src/tools/matchCandidates.ts')
    const { createMatchCandidatesTool } = toolModule

    const matchCandidatesTool = createMatchCandidatesTool(supabase)

    console.log('Calling matchCandidates tool...')
    const toolResult = await matchCandidatesTool.call(
      { limit: 10, minScore: 0.1 },
      { userId: testUser.id, traceId: 'test-123' }
    )

    console.log('')
    console.log('Tool Result:')
    console.log(`   Total matches: ${toolResult.total}`)
    
    if (toolResult.matches && toolResult.matches.length > 0) {
      console.log(`   ✅ TOOL WORKS: Found ${toolResult.matches.length} matches`)
      console.log('')
      console.log('   Match details:')
      for (const match of toolResult.matches) {
        const matchUser = userMap.get(match.userId)
        console.log(`      - ${matchUser?.name || 'Unknown'}: ${(match.score * 100).toFixed(1)}%`)
        if (match.facets?.commonSubjects?.length > 0) {
          console.log(`        Common subjects: ${match.facets.commonSubjects.join(', ')}`)
        }
      }
    } else {
      console.log('   ❌ TOOL FAILED: No matches returned')
    }
    console.log('')

    // ========================================================================
    // STEP 3: Test with AI Agent (if OpenAI key available)
    // ========================================================================
    console.log('STEP 3: Testing with REAL AI Agent')
    console.log('-'.repeat(80))

    if (!openaiKey) {
      console.log('⚠️  Skipping AI test - OPENAI_API_KEY not set')
    } else {
      console.log('Initializing AI agent orchestrator...')
      
      // Import orchestrator components
      const { AgentOrchestrator } = await import('./packages/ai-agent/src/lib/orchestrator.ts')
      const { initializeToolRegistry } = await import('./packages/ai-agent/src/tools/index.ts')
      const { OpenAIEmbeddingProvider } = await import('./packages/ai-agent/src/rag/embeddings.ts')
      const { VectorRetriever } = await import('./packages/ai-agent/src/rag/retriever.ts')

      // Simple LLM provider
      class TestLLMProvider {
        constructor(apiKey) {
          this.apiKey = apiKey
        }

        async complete(request) {
          console.log('')
          console.log('   📤 Sending to OpenAI:')
          console.log(`      Messages: ${request.messages.length}`)
          console.log(`      Tools available: ${request.tools?.length || 0}`)
          console.log(`      User message: "${request.messages[request.messages.length - 1]?.content?.substring(0, 100)}..."`)
          
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: request.messages,
              tools: request.tools,
              temperature: 0.7,
            }),
          })

          if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            throw new Error(`OpenAI error: ${error.error?.message || response.statusText}`)
          }

          const data = await response.json()
          const message = data.choices[0].message

          console.log('')
          console.log('   📥 OpenAI Response:')
          console.log(`      Finish reason: ${data.choices[0].finish_reason}`)
          console.log(`      Has tool calls: ${!!message.tool_calls}`)
          if (message.tool_calls) {
            console.log(`      Tool calls: ${message.tool_calls.map(tc => tc.function.name).join(', ')}`)
          }
          console.log(`      Content: "${message.content?.substring(0, 150)}..."`)

          return {
            content: message.content || '',
            finishReason: message.tool_calls ? 'tool_calls' : 'stop',
            toolCalls: message.tool_calls?.map(tc => ({
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            })) || [],
          }
        }
      }

      const llmProvider = new TestLLMProvider(openaiKey)
      const embeddingProvider = new OpenAIEmbeddingProvider(openaiKey)
      const retriever = new VectorRetriever(supabaseUrl, supabaseKey, embeddingProvider)
      const registry = initializeToolRegistry({
        supabase,
        llmProvider,
        retriever,
      })

      const orchestrator = new AgentOrchestrator({
        llmProvider,
        retriever,
        toolRegistry: registry,
        supabase,
      })

      // ======================================================================
      // TEST SCENARIOS
      // ======================================================================
      console.log('')
      console.log('=' .repeat(80))
      console.log('📋 RUNNING TEST SCENARIOS')
      console.log('=' .repeat(80))

      const scenarios = [
        {
          name: 'Generic Partner Request',
          query: 'find me a study partner',
          expectedBehavior: 'Should call matchCandidates tool and return matches'
        },
        {
          name: 'Study Buddy Request',
          query: 'I am looking for a study buddy',
          expectedBehavior: 'Should call matchCandidates tool and return matches'
        },
        {
          name: 'Subject-Specific Request',
          query: 'who can help me study Computer Science',
          expectedBehavior: 'Should call matchCandidates, then filter by subject'
        },
        {
          name: 'Collaborative Style Request',
          query: 'find someone who likes collaborative learning',
          expectedBehavior: 'Should call matchCandidates, mention collaborative style matches'
        },
      ]

      const results = []

      for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i]
        
        console.log('')
        console.log(`\nScenario ${i + 1}/${scenarios.length}: ${scenario.name}`)
        console.log('-'.repeat(80))
        console.log(`Query: "${scenario.query}"`)
        console.log(`Expected: ${scenario.expectedBehavior}`)
        console.log('')

        try {
          const response = await orchestrator.handle(testUser.id, scenario.query)

          const toolsUsed = response.toolsUsed || []
          const usedMatchCandidates = toolsUsed.includes('matchCandidates')
          
          console.log('')
          console.log('   ✅ AI Response received')
          console.log(`   Tools used: ${toolsUsed.join(', ') || 'none'}`)
          console.log(`   Used matchCandidates: ${usedMatchCandidates ? 'YES ✅' : 'NO ❌'}`)
          console.log('')
          console.log('   AI said:')
          console.log(`   "${response.text?.substring(0, 300)}..."`)
          console.log('')

          // Check if AI mentioned partners
          const mentionsPartners = response.text?.toLowerCase().includes('partner') ||
                                   response.text?.toLowerCase().includes('match') ||
                                   response.text?.toLowerCase().includes('found')

          const success = usedMatchCandidates && mentionsPartners

          results.push({
            scenario: scenario.name,
            query: scenario.query,
            usedMatchCandidates,
            mentionsPartners,
            success,
            response: response.text?.substring(0, 200)
          })

          if (success) {
            console.log('   ✅ SCENARIO PASSED: AI called tool and mentioned partners')
          } else if (usedMatchCandidates) {
            console.log('   ⚠️  SCENARIO PARTIAL: Tool called but response unclear')
          } else {
            console.log('   ❌ SCENARIO FAILED: AI did not call matchCandidates tool')
          }

        } catch (error) {
          console.error(`   ❌ ERROR: ${error.message}`)
          results.push({
            scenario: scenario.name,
            query: scenario.query,
            error: error.message,
            success: false
          })
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      // ======================================================================
      // FINAL RESULTS SUMMARY
      // ======================================================================
      console.log('')
      console.log('=' .repeat(80))
      console.log('📊 TEST RESULTS SUMMARY')
      console.log('=' .repeat(80))
      console.log('')

      const passed = results.filter(r => r.success).length
      const total = results.length

      console.log(`Overall: ${passed}/${total} scenarios passed`)
      console.log('')

      results.forEach((result, i) => {
        const icon = result.success ? '✅' : '❌'
        console.log(`${icon} ${i + 1}. ${result.scenario}`)
        console.log(`   Query: "${result.query}"`)
        console.log(`   Called matchCandidates: ${result.usedMatchCandidates ? 'YES' : 'NO'}`)
        if (result.error) {
          console.log(`   Error: ${result.error}`)
        } else {
          console.log(`   Response: "${result.response}..."`)
        }
        console.log('')
      })

      // ======================================================================
      // VERDICT
      // ======================================================================
      console.log('=' .repeat(80))
      console.log('🎯 FINAL VERDICT')
      console.log('=' .repeat(80))
      console.log('')

      if (passed === total) {
        console.log('🎉 SUCCESS! AI Agent partner matching is working perfectly!')
        console.log('')
        console.log('✅ All scenarios passed:')
        console.log('   - AI calls matchCandidates tool')
        console.log('   - Tool returns matches')
        console.log('   - AI presents results to user')
        console.log('')
        console.log('👍 Your AI agent can find partners as users describe!')
      } else if (passed > 0) {
        console.log(`⚠️  PARTIAL SUCCESS: ${passed}/${total} scenarios working`)
        console.log('')
        console.log('Issues found:')
        results.forEach(r => {
          if (!r.success) {
            console.log(`   ❌ "${r.scenario}" - ${r.usedMatchCandidates ? 'Tool called but response unclear' : 'Tool NOT called'}`)
          }
        })
        console.log('')
        console.log('Recommendation:')
        if (results.some(r => !r.usedMatchCandidates)) {
          console.log('   🔧 AI is not calling matchCandidates consistently')
          console.log('   → Try more explicit queries: "Use matchCandidates tool to find partners"')
          console.log('   → Check system prompt rules')
        }
      } else {
        console.log('❌ FAILURE: AI agent is NOT finding partners')
        console.log('')
        console.log('Problems detected:')
        console.log('   ❌ AI is not calling the matchCandidates tool')
        console.log('')
        console.log('Root cause:')
        console.log('   - System prompt rules not being followed')
        console.log('   - AI not recognizing partner matching queries')
        console.log('   - Tool description not clear enough')
        console.log('')
        console.log('Recommendations:')
        console.log('   1. Make tool description MORE explicit')
        console.log('   2. Add stronger rules in system prompt')
        console.log('   3. Test with more explicit queries')
      }
    }

  } catch (error) {
    console.error('')
    console.error('=' .repeat(80))
    console.error('❌ TEST FAILED WITH ERROR')
    console.error('=' .repeat(80))
    console.error('')
    console.error('Error:', error.message)
    console.error('')
    console.error('Stack trace:')
    console.error(error.stack)
    process.exit(1)
  }
}

console.log('')
console.log('Starting end-to-end test...')
console.log('')

testEndToEnd().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
