/**
 * Live AI Agent Test - Find Partner Matching
 * This tests the ACTUAL AI agent endpoint to see what happens
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function testAIAgentMatching() {
  console.log('🤖 LIVE AI AGENT MATCHING TEST')
  console.log('='.repeat(80))
  console.log('')

  try {
    // STEP 1: Get a test user to simulate
    console.log('STEP 1: Get test user')
    console.log('-'.repeat(80))
    
    const { data: users } = await supabase
      .from('User')
      .select('id, name, email')
    
    if (!users || users.length === 0) {
      console.error('❌ No users in database')
      return
    }

    console.log('Available users:')
    users.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.name} (${u.email})`)
    })
    
    const testUser = users[0]
    console.log('')
    console.log(`🎯 Testing as: ${testUser.name}`)
    console.log('')

    // STEP 2: Create a session token for this user
    console.log('STEP 2: Authenticate as test user')
    console.log('-'.repeat(80))
    
    // Sign in as the test user (you'll need to know their password or use service role)
    // For testing, we'll call the AI tool directly instead
    console.log('⚠️  Note: Cannot create full auth session in test script')
    console.log('Instead, we will test the matchCandidates tool directly')
    console.log('')

    // STEP 3: Test matchCandidates tool directly
    console.log('STEP 3: Test matchCandidates tool (direct call)')
    console.log('-'.repeat(80))
    
    // Import the tool
    const { createMatchCandidatesTool } = require('./packages/ai-agent/src/tools/matchCandidates.ts')
    
    const matchCandidatesTool = createMatchCandidatesTool(supabase)
    
    console.log('Tool name:', matchCandidatesTool.name)
    console.log('Tool description:', matchCandidatesTool.description.substring(0, 100) + '...')
    console.log('')
    console.log('Calling tool with:')
    console.log('  - userId:', testUser.id)
    console.log('  - limit: 10')
    console.log('  - minScore: 0.1')
    console.log('')

    const result = await matchCandidatesTool.call(
      { limit: 10, minScore: 0.1 },
      { userId: testUser.id, conversationId: 'test-123' }
    )

    console.log('✅ Tool executed successfully!')
    console.log('')
    console.log('RESULT:')
    console.log(JSON.stringify(result, null, 2))
    console.log('')
    
    if (result.matches && result.matches.length > 0) {
      console.log('✅ MATCHES FOUND:', result.matches.length)
      console.log('')
      console.log('Top matches:')
      for (const match of result.matches.slice(0, 3)) {
        const { data: user } = await supabase
          .from('User')
          .select('name')
          .eq('id', match.userId)
          .single()
        
        console.log(`   - ${user?.name || 'Unknown'}: ${(match.score * 100).toFixed(1)}%`)
      }
      console.log('')
      console.log('🟢 CONCLUSION: Tool is working correctly!')
      console.log('')
      console.log('⚠️  If AI still says "no partners found", the issue is:')
      console.log('')
      console.log('POSSIBLE CAUSES:')
      console.log('1. AI is NOT calling the matchCandidates tool')
      console.log('   → Check: Look for [matchCandidates] in server logs')
      console.log('   → Fix: Tool description might not match user queries')
      console.log('')
      console.log('2. AI is calling tool but getting an error')
      console.log('   → Check: Server logs for errors during tool execution')
      console.log('   → Fix: Debug the error in production environment')
      console.log('')
      console.log('3. AI receives results but misinterprets them')
      console.log('   → Check: AI prompt/system message')
      console.log('   → Fix: Update AI instructions to properly use tool results')
      console.log('')
    } else {
      console.log('❌ NO MATCHES RETURNED')
      console.log('')
      console.log('This IS the problem!')
      console.log('The tool executed but returned no matches.')
      console.log('')
      console.log('Debugging info:')
      console.log('  - Total:', result.total || 0)
      console.log('  - Matches array length:', result.matches?.length || 0)
    }

  } catch (error) {
    console.error('')
    console.error('❌ ERROR DURING TEST:', error.message)
    console.error('')
    console.error('This might be the issue! The tool is throwing an error.')
    console.error('')
    console.error('Full error:')
    console.error(error)
    console.error('')
    console.error('Stack trace:')
    console.error(error.stack)
  }
}

testAIAgentMatching().catch(console.error)
