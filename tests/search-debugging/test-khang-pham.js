/**
 * Test searching for "Khang Pham" specifically
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function testSearchKhangPham() {
  console.log('🧪 Testing Search for "Khang Pham"')
  console.log('='.repeat(80))

  try {
    // Get first user as current user
    const { data: allUsers } = await supabase
      .from('User')
      .select('id, name, email')
      .limit(1)

    if (!allUsers || allUsers.length === 0) {
      console.error('❌ No users in database')
      return
    }

    const currentUser = allUsers[0]
    console.log('👤 Searching as:', currentUser.name, `(${currentUser.id})`)
    console.log('🔍 Search query: "Khang Pham"\n')

    // Simulate searchUsers tool with "Khang Pham"
    const searchQuery = "Khang Pham"
    const searchTerms = searchQuery.trim().split(/\s+/)

    console.log('📋 Search terms:', searchTerms)
    console.log('   - "Khang"')
    console.log('   - "Pham"\n')

    // Build search query
    let userQuery = supabase
      .from('User')
      .select('id, name, email')
      .neq('id', currentUser.id)
      .limit(100)

    const conditions = []
    for (const term of searchTerms) {
      if (term.length > 0) {
        conditions.push(`name.ilike.%${term}%`)
        conditions.push(`email.ilike.%${term}%`)
      }
    }

    if (conditions.length > 0) {
      userQuery = userQuery.or(conditions.join(','))
    }

    console.log('🔄 SQL OR conditions:')
    console.log('   name contains "Khang" OR')
    console.log('   email contains "Khang" OR')
    console.log('   name contains "Pham" OR')
    console.log('   email contains "Pham"\n')

    const { data: foundUsers, error: userError } = await userQuery

    if (userError) {
      console.error('❌ Error:', userError.message)
      return
    }

    if (!foundUsers || foundUsers.length === 0) {
      console.log('⚠️  No users found matching "Khang Pham"')
      console.log('\nThis would cause AI to say "cannot find Khang Pham"')
      return
    }

    console.log(`✅ Found ${foundUsers.length} users:\n`)

    // Get profiles for these users
    const userIds = foundUsers.map(u => u.id)
    const { data: profiles } = await supabase
      .from('Profile')
      .select('userId, subjects, interests, bio, school')
      .in('userId', userIds)

    const profileMap = new Map(profiles?.map(p => [p.userId, p]) || [])

    foundUsers.forEach((user, index) => {
      const profile = profileMap.get(user.id)
      console.log(`${index + 1}. ${user.name} (${user.email})`)
      console.log(`   - Subjects: ${profile?.subjects?.slice(0, 3).join(', ') || 'None'}`)
      console.log(`   - Bio: ${profile?.bio || 'None'}`)
      console.log(`   - School: ${profile?.school || 'None'}`)
      console.log('')
    })

    // Check if "Gia Khang Phạm" is in results
    const hasGiaKhang = foundUsers.some(u =>
      u.name.toLowerCase().includes('khang') && u.name.toLowerCase().includes('pham')
    )

    if (hasGiaKhang) {
      console.log('✅ SUCCESS: Found users with "Khang" AND "Pham" in name')
      console.log('AI should be able to find this user!')
    } else {
      console.log('⚠️  Found users with "Khang" OR "Pham", but not both together')
    }

    console.log('\n' + '='.repeat(80))
    console.log('📊 RESULT FOR AI AGENT')
    console.log('='.repeat(80))
    console.log('Tool: searchUsers')
    console.log('Input: { query: "Khang Pham", searchBy: "all" }')
    console.log('Output:', JSON.stringify({
      users: foundUsers.slice(0, 2).map(u => {
        const profile = profileMap.get(u.id)
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          subjects: profile?.subjects || [],
          bio: profile?.bio || null,
        }
      }),
      totalFound: foundUsers.length,
      searchedBy: 'all'
    }, null, 2))

    console.log('\n✅ AI should see the results above and be able to tell you about the users')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
  }
}

testSearchKhangPham().catch(console.error)
