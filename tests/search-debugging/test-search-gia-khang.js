/**
 * Test the exact searchUsers query with "Gia Khang Pham"
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testSearch() {
  console.log('\n========================================')
  console.log('Testing searchUsers for "Gia Khang Pham"')
  console.log('========================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const adminSupabase = createClient(supabaseUrl, serviceKey)

  // Test 1: Search exactly like searchUsers tool does
  console.log('Test 1: Search User table for "Gia Khang Pham"')
  const searchTerms = 'Gia Khang Pham'.trim().split(/\s+/)
  console.log('Search terms:', searchTerms)

  const conditions = []
  for (const term of searchTerms) {
    if (term.length > 0) {
      conditions.push(`name.ilike.%${term}%`)
      conditions.push(`email.ilike.%${term}%`)
    }
  }

  console.log('Conditions:', conditions.join(','))

  const { data: users, error: userError } = await adminSupabase
    .from('User')
    .select('id, name, email, createdAt')
    .or(conditions.join(','))
    .limit(100)

  if (userError) {
    console.error('❌ Error:', userError)
  } else {
    console.log(`✅ Found ${users?.length || 0} users:`)
    users?.forEach(u => console.log(`  - ${u.name} (${u.email})`))
  }

  // Test 2: Try with "Computer Science" subject search
  console.log('\n\nTest 2: Search for users with "Computer Science" subject')

  const { data: profiles, error: profileError } = await adminSupabase
    .from('Profile')
    .select('userId, subjects')

  if (profileError) {
    console.error('❌ Error:', profileError)
  } else {
    console.log(`✅ Found ${profiles?.length || 0} profiles`)
    const csProfiles = profiles?.filter(p =>
      p.subjects && p.subjects.some(s => s.toLowerCase().includes('computer'))
    )
    console.log(`✅ Profiles with Computer Science: ${csProfiles?.length || 0}`)
    csProfiles?.forEach(p => console.log(`  - UserID: ${p.userId}, Subjects: ${p.subjects.join(', ')}`))
  }

  console.log('\n========================================\n')
}

testSearch().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
