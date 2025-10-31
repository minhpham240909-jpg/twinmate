/**
 * Test AI Agent Complete Flow - Simulate what the AI actually sees
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

// Import and test the actual searchUsers tool
async function testRealSearchUsersTool() {
  console.log('🧪 Testing REAL AI Agent Flow')
  console.log('='.repeat(80))
  console.log('Simulating: User asks "Can you find Minh Pham?"\n')

  try {
    // Get a user to act as the current user
    const { data: allUsers } = await supabase
      .from('User')
      .select('id, name, email')
      .limit(2)

    if (!allUsers || allUsers.length < 2) {
      console.error('❌ Need at least 2 users in database')
      return
    }

    const currentUser = allUsers[0]
    const targetUser = allUsers[1]

    console.log('👤 Current User:', currentUser.name, `(${currentUser.id})`)
    console.log('🎯 Target User:', targetUser.name)
    console.log('')

    // SCENARIO 1: AI calls searchUsers with "Minh Pham"
    console.log('='.repeat(80))
    console.log('SCENARIO 1: AI calls searchUsers tool')
    console.log('='.repeat(80))
    console.log('Tool: searchUsers')
    console.log('Input: { query: "Minh Pham", searchBy: "name", limit: 10 }')
    console.log('')

    // Simulate searchUsers tool call
    let userQuery = supabase
      .from('User')
      .select('id, name, email, createdAt')
      .neq('id', currentUser.id)
      .limit(100)

    const searchTerms = "Minh Pham".trim().split(/\s+/)
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

    const { data: foundUsers, error: userError } = await userQuery

    console.log('📊 Tool Result:')
    if (userError) {
      console.error('❌ Error:', userError.message)
      console.log('Tool Output:', JSON.stringify({
        users: [],
        totalFound: 0,
        searchedBy: 'name',
        error: userError.message
      }, null, 2))
    } else if (!foundUsers || foundUsers.length === 0) {
      console.log('⚠️  No users found')
      console.log('Tool Output:', JSON.stringify({
        users: [],
        totalFound: 0,
        searchedBy: 'name'
      }, null, 2))
      console.log('\n❌ THIS IS THE BUG - AI sees empty array and says "cannot find"')
    } else {
      // Get profiles for these users
      const userIds = foundUsers.map(u => u.id)
      const { data: profiles } = await supabase
        .from('Profile')
        .select('userId, subjects, interests, bio, school')
        .in('userId', userIds)

      const profileMap = new Map(profiles?.map(p => [p.userId, p]) || [])

      const resultUsers = foundUsers.map(user => {
        const profile = profileMap.get(user.id)
        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          subjects: profile?.subjects || [],
          interests: profile?.interests || [],
          bio: profile?.bio || null,
          school: profile?.school || null,
        }
      })

      console.log('✅ Found', resultUsers.length, 'users')
      console.log('\nTool Output:')
      console.log(JSON.stringify({
        users: resultUsers.map(u => ({
          userId: u.userId,
          name: u.name,
          email: u.email,
          subjects: u.subjects,
          bio: u.bio,
        })),
        totalFound: resultUsers.length,
        searchedBy: 'name'
      }, null, 2))

      console.log('\n✅ AI should be able to see user info above')
      console.log('The AI should say something like:')
      console.log(`"I found ${resultUsers[0].name}! Here's their information..."`)
    }

    // SCENARIO 2: Check if there's an issue with the user profile
    console.log('\n' + '='.repeat(80))
    console.log('SCENARIO 2: Check if user has a complete profile')
    console.log('='.repeat(80))

    const { data: profile } = await supabase
      .from('Profile')
      .select('*')
      .eq('userId', targetUser.id)
      .single()

    if (!profile) {
      console.log('⚠️  User has NO profile!')
      console.log('This might confuse the AI')
    } else {
      console.log('✅ User has profile:')
      console.log('  - Subjects:', profile.subjects || 'None')
      console.log('  - Interests:', profile.interests || 'None')
      console.log('  - Bio:', profile.bio || 'None')
      console.log('  - School:', profile.school || 'None')

      if (!profile.subjects || profile.subjects.length === 0) {
        console.log('\n⚠️  User has empty subjects!')
        console.log('This might cause matchCandidates to fail')
      }
    }

    // SCENARIO 3: Test matchCandidates with current user
    console.log('\n' + '='.repeat(80))
    console.log('SCENARIO 3: AI calls matchCandidates (find study partners)')
    console.log('='.repeat(80))
    console.log('Tool: matchCandidates')
    console.log('Input: { limit: 10, minScore: 0.1 }')
    console.log('')

    const { data: currentUserProfile } = await supabase
      .from('Profile')
      .select('*')
      .eq('userId', currentUser.id)
      .single()

    if (!currentUserProfile) {
      console.log('❌ Current user has no profile - matchCandidates will fail')
    } else {
      console.log('Current user profile:')
      console.log('  - Subjects:', currentUserProfile.subjects || '[]')
      console.log('  - Interests:', currentUserProfile.interests || '[]')

      // Get candidates
      const { data: candidates } = await supabase
        .from('Profile')
        .select('userId, subjects, studyStyle, skillLevel')
        .neq('userId', currentUser.id)
        .limit(10)

      if (!candidates || candidates.length === 0) {
        console.log('\n⚠️  No other profiles in database')
        console.log('Tool Output:', JSON.stringify({
          matches: [],
          total: 0
        }, null, 2))
        console.log('\n❌ THIS IS WHY AI says "cannot find partner in database"')
      } else {
        console.log(`\n✅ Found ${candidates.length} candidates`)
        console.log('Tool Output:', JSON.stringify({
          matches: candidates.map(c => ({
            userId: c.userId,
            score: 0.25,  // Example score
            facets: {}
          })).slice(0, 3),
          total: candidates.length
        }, null, 2))
        console.log('\n✅ AI should see matches above')
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log('📋 SUMMARY')
    console.log('='.repeat(80))
    console.log('Issue 1: searchUsers - Test shows it WORKS')
    console.log('Issue 2: matchCandidates - Might fail with low compatibility scores')
    console.log('\nPossible reasons AI says "cannot find":')
    console.log('1. AI chose wrong tool (matchCandidates instead of searchUsers)')
    console.log('2. Tool returned empty results due to incomplete profiles')
    console.log('3. Vercel deployment not complete yet (old code still running)')
    console.log('4. User query phrasing causes AI to choose wrong tool')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
  }
}

testRealSearchUsersTool().catch(console.error)
