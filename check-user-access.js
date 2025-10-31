/**
 * Test if AI agent can actually access User and Profile tables
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testUserAccess() {
  console.log('\n========================================')
  console.log('Testing User Table Access for AI Agent')
  console.log('========================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing environment variables')
    console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
    console.error('SUPABASE_SERVICE_ROLE_KEY:', !!serviceKey)
    process.exit(1)
  }

  // Create admin client (same as AI agent uses)
  const adminSupabase = createClient(supabaseUrl, serviceKey)

  console.log('✓ Created Supabase client with service_role key\n')

  // Test 1: Count users
  console.log('Test 1: Count all users')
  const { count: userCount, error: countError } = await adminSupabase
    .from('User')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('❌ Failed to count users:', countError.message)
  } else {
    console.log(`✓ Found ${userCount} users in database\n`)
  }

  // Test 2: Fetch sample users (like searchUsers tool does)
  console.log('Test 2: Fetch sample users by name search')
  const { data: users, error: searchError } = await adminSupabase
    .from('User')
    .select('id, name, email')
    .limit(5)

  if (searchError) {
    console.error('❌ Failed to fetch users:', searchError.message)
    console.error('Error details:', searchError)
  } else {
    console.log(`✓ Successfully fetched ${users?.length || 0} users:`)
    users?.forEach(u => console.log(`  - ${u.name} (${u.email})`))
  }

  // Test 3: Search by name (exactly like searchUsers tool)
  console.log('\nTest 3: Search users by name pattern (like AI agent does)')
  const testName = 'a' // Search for names containing 'a'
  const { data: searchResults, error: patternError } = await adminSupabase
    .from('User')
    .select('id, name, email')
    .or(`name.ilike.%${testName}%,email.ilike.%${testName}%`)
    .limit(10)

  if (patternError) {
    console.error(`❌ Failed to search for "${testName}":`, patternError.message)
    console.error('Error details:', patternError)
  } else {
    console.log(`✓ Found ${searchResults?.length || 0} users matching "${testName}":`)
    searchResults?.forEach(u => console.log(`  - ${u.name} (${u.email})`))
  }

  // Test 4: Fetch profiles
  console.log('\nTest 4: Fetch profiles (with custom descriptions)')
  const { data: profiles, error: profileError } = await adminSupabase
    .from('Profile')
    .select(`
      userId, subjects, interests, goals, studyStyle, skillLevel,
      bio, skillLevelCustomDescription, studyStyleCustomDescription,
      availabilityCustomDescription, subjectCustomDescription, interestsCustomDescription
    `)
    .limit(3)

  if (profileError) {
    console.error('❌ Failed to fetch profiles:', profileError.message)
    console.error('Error details:', profileError)
  } else {
    console.log(`✓ Successfully fetched ${profiles?.length || 0} profiles`)
    profiles?.forEach(p => {
      console.log(`\n  Profile ${p.userId}:`)
      console.log(`    - Subjects: ${p.subjects?.join(', ') || 'none'}`)
      console.log(`    - Bio: ${p.bio ? p.bio.substring(0, 50) + '...' : 'none'}`)
      console.log(`    - Subject custom desc: ${p.subjectCustomDescription ? 'YES' : 'no'}`)
    })
  }

  console.log('\n========================================')
  console.log('Test Complete!')
  console.log('========================================\n')
}

testUserAccess().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
