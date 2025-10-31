/**
 * Test searchUsers tool directly (not through API)
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// Import the tool (we'll use dynamic import)
async function testSearchTool() {
  console.log('\n========================================')
  console.log('Testing searchUsers Tool Directly')
  console.log('========================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing environment variables')
    return
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // First, get a real user ID to use as context
  const { data: users } = await supabase
    .from('User')
    .select('id, name')
    .limit(1)

  if (!users || users.length === 0) {
    console.error('❌ No users found in database')
    return
  }

  const testUserId = users[0].id
  console.log('Using test user ID:', testUserId, '(', users[0].name, ')')

  // Import and create the tool
  const { createSearchUsersTool } = require('./packages/ai-agent/src/tools/searchUsers.ts')
  const searchUsersTool = createSearchUsersTool(supabase)

  // Test 1: Search for "Gia Khang Pham"
  console.log('\n\nTest 1: Search for "Gia Khang Pham"')
  console.log('=========================================')

  try {
    const result1 = await searchUsersTool.call(
      { query: 'Gia Khang Pham', searchBy: 'name', limit: 10 },
      {
        userId: testUserId,
        traceId: `test-${Date.now()}`,
        timestamp: new Date()
      }
    )

    console.log('✅ Tool returned successfully')
    console.log('Total found:', result1.totalFound)
    console.log('Users returned:', result1.users.length)

    if (result1.users.length > 0) {
      console.log('\nUser details:')
      result1.users.forEach(u => {
        console.log(`  - ${u.name} (${u.email})`)
        console.log(`    Subjects: ${u.subjects?.join(', ') || 'none'}`)
        console.log(`    School: ${u.school || 'not set'}`)
        console.log(`    Languages: ${u.languages || 'not set'}`)
        console.log(`    About: ${u.aboutYourself || 'not set'}`)
      })
    } else {
      console.log('❌ NO USERS RETURNED')
    }
  } catch (error) {
    console.error('❌ Tool call failed:', error.message)
    console.error('Stack:', error.stack)
  }

  // Test 2: Search for "Computer Science"
  console.log('\n\nTest 2: Search for "Computer Science" subject')
  console.log('=========================================')

  try {
    const result2 = await searchUsersTool.call(
      { query: 'Computer Science', searchBy: 'subjects', limit: 10 },
      {
        userId: testUserId,
        traceId: `test-${Date.now()}`,
        timestamp: new Date()
      }
    )

    console.log('✅ Tool returned successfully')
    console.log('Total found:', result2.totalFound)
    console.log('Users returned:', result2.users.length)

    if (result2.users.length > 0) {
      console.log('\nUser details:')
      result2.users.forEach(u => {
        console.log(`  - ${u.name}`)
        console.log(`    Subjects: ${u.subjects?.join(', ') || 'none'}`)
      })
    } else {
      console.log('❌ NO USERS RETURNED')
    }
  } catch (error) {
    console.error('❌ Tool call failed:', error.message)
    console.error('Stack:', error.stack)
  }

  console.log('\n========================================\n')
}

testSearchTool().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
