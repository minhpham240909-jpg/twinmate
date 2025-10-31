/**
 * Test Both Search Systems
 * 1. Manual Partner Search API (/api/partners/search)
 * 2. AI Agent searchUsers Tool
 */

const { createClient } = require('@supabase/supabase-js')

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function testManualPartnerSearch() {
  console.log('\n' + '='.repeat(80))
  console.log('TEST 1: Manual Partner Search (/api/partners/search)')
  console.log('='.repeat(80))

  try {
    // Get a test user
    const { data: users, error: userError } = await supabase
      .from('User')
      .select('id, name, email')
      .limit(1)

    if (userError || !users || users.length === 0) {
      console.error('❌ No users found in database')
      return
    }

    const testUser = users[0]
    console.log('✅ Test user:', testUser.name, `(${testUser.id})`)

    // Simulate the exact query from route.ts
    console.log('\n🔍 Simulating /api/partners/search query...')

    // Step 1: Get existing matches
    const { data: existingMatches, error: matchError } = await supabase
      .from('Match')
      .select('senderId, receiverId, status')
      .or(`senderId.eq.${testUser.id},receiverId.eq.${testUser.id}`)

    console.log('📊 Existing matches:', existingMatches?.length || 0)

    const acceptedPartnerIds = new Set()
    const pendingOrOtherUserIds = new Set()

    existingMatches?.forEach(match => {
      const otherUserId = match.senderId === testUser.id ? match.receiverId : match.senderId
      if (match.status === 'ACCEPTED') {
        acceptedPartnerIds.add(otherUserId)
      } else {
        pendingOrOtherUserIds.add(otherUserId)
      }
    })

    // Step 2: Build the partner search query (with subjects filter)
    let query = supabase
      .from('Profile')
      .select(`
        userId,
        subjects,
        interests,
        goals,
        studyStyle,
        skillLevel,
        availableDays,
        availableHours,
        bio,
        school,
        languages,
        aboutYourself,
        aboutYourselfItems,
        subjectCustomDescription,
        skillLevelCustomDescription,
        studyStyleCustomDescription,
        interestsCustomDescription,
        availabilityCustomDescription,
        updatedAt,
        user:User!inner(
          id,
          name,
          email,
          avatarUrl,
          role,
          createdAt
        )
      `)
      .neq('userId', testUser.id)

    // Exclude pending/rejected connections
    if (pendingOrOtherUserIds.size > 0) {
      query = query.not('userId', 'in', `(${Array.from(pendingOrOtherUserIds).join(',')})`)
    }

    // Test with subjects filter (which most users would use)
    query = query.overlaps('subjects', ['Python'])

    // Pagination
    query = query.range(0, 19).order('updatedAt', { ascending: false })

    console.log('🔄 Executing profile search query...')
    const { data: profiles, error: profileError } = await query

    if (profileError) {
      console.error('❌ PROFILE SEARCH ERROR:', profileError)
      console.error('Error details:', {
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code
      })
      return
    }

    console.log('✅ Found', profiles?.length || 0, 'profiles')

    // Step 3: Get user's profile for scoring
    const { data: myProfile, error: myProfileError } = await supabase
      .from('Profile')
      .select('subjects, interests, studyStyle, skillLevel')
      .eq('userId', testUser.id)
      .single()

    if (myProfileError) {
      console.error('❌ MY PROFILE ERROR:', myProfileError)
      return
    }

    console.log('✅ Got user profile for scoring')

    // Step 4: Calculate match scores (simplified)
    const profilesWithScores = (profiles || []).map(profile => {
      let matchScore = 0
      const mySubjects = new Set(myProfile?.subjects || [])
      const myInterests = new Set(myProfile?.interests || [])

      if (profile.subjects && profile.subjects.length > 0) {
        const subjectOverlap = profile.subjects.filter(s => mySubjects.has(s)).length
        if (subjectOverlap > 0) {
          matchScore += subjectOverlap * 20
        }
      }

      if (profile.interests && profile.interests.length > 0) {
        const interestOverlap = profile.interests.filter(i => myInterests.has(i)).length
        if (interestOverlap > 0) {
          matchScore += interestOverlap * 15
        }
      }

      matchScore = Math.min(matchScore, 100)
      const isAlreadyPartner = acceptedPartnerIds.has(profile.userId)

      return {
        userId: profile.userId,
        name: profile.user?.name || 'Unknown',
        matchScore,
        isAlreadyPartner,
      }
    })

    console.log('✅ Calculated match scores for', profilesWithScores.length, 'profiles')
    console.log('\n📋 Sample results:')
    profilesWithScores.slice(0, 3).forEach(p => {
      console.log(`  - ${p.name}: ${p.matchScore} points`)
    })

    console.log('\n✅ Manual Partner Search Test PASSED')

  } catch (error) {
    console.error('❌ MANUAL PARTNER SEARCH TEST FAILED:', error)
  }
}

async function testAIAgentSearchUsers() {
  console.log('\n' + '='.repeat(80))
  console.log('TEST 2: AI Agent searchUsers Tool')
  console.log('='.repeat(80))

  try {
    // Get a test user to search for
    const { data: users, error: userError } = await supabase
      .from('User')
      .select('id, name, email')
      .limit(5)

    if (userError || !users || users.length === 0) {
      console.error('❌ No users found in database')
      return
    }

    console.log(`✅ Found ${users.length} users in database:`)
    users.forEach(u => console.log(`  - ${u.name} (${u.email})`))

    // Pick a user to search for
    const targetUser = users[1] || users[0]
    const searchQuery = targetUser.name
    const currentUserId = users[0].id

    console.log('\n🔍 Searching for:', searchQuery)
    console.log('🔍 As user:', users[0].name)

    // Simulate searchUsers tool logic
    const searchTerms = searchQuery.trim().split(/\s+/)
    console.log('🔍 Search terms:', searchTerms)

    // Build search query for User table (same as searchUsers tool)
    let userQuery = supabase
      .from('User')
      .select('id, name, email, createdAt')
      .neq('id', currentUserId)
      .limit(100)

    // Build OR conditions for each search term against name and email
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

    console.log('🔄 Executing user search query...')
    const { data: foundUsers, error: searchError } = await userQuery

    if (searchError) {
      console.error('❌ USER SEARCH ERROR:', searchError)
      console.error('Error details:', {
        message: searchError.message,
        details: searchError.details,
        hint: searchError.hint,
        code: searchError.code
      })
      return
    }

    console.log('✅ Found', foundUsers?.length || 0, 'users')

    if (!foundUsers || foundUsers.length === 0) {
      console.log('❌ AI AGENT SEARCH: Could not find user in database')
      console.log('This is the bug the user reported!')
      return
    }

    console.log('📋 Found users:')
    foundUsers.forEach(u => console.log(`  - ${u.name} (${u.email})`))

    // Get profiles for these users
    const userIds = foundUsers.map(u => u.id)
    const { data: profiles, error: profileError } = await supabase
      .from('Profile')
      .select(`
        userId, subjects, interests, goals, studyStyle, skillLevel, onlineStatus,
        bio, school, languages, aboutYourself, aboutYourselfItems,
        skillLevelCustomDescription, studyStyleCustomDescription,
        availabilityCustomDescription, subjectCustomDescription, interestsCustomDescription
      `)
      .in('userId', userIds)

    if (profileError) {
      console.error('❌ PROFILE FETCH ERROR:', profileError)
      return
    }

    console.log('✅ Got profiles for', profiles?.length || 0, 'users')

    console.log('\n✅ AI Agent searchUsers Test PASSED')

  } catch (error) {
    console.error('❌ AI AGENT SEARCH TEST FAILED:', error)
  }
}

async function main() {
  console.log('🧪 Testing Both Search Systems')
  console.log('Testing against:', supabaseUrl)

  await testManualPartnerSearch()
  await testAIAgentSearchUsers()

  console.log('\n' + '='.repeat(80))
  console.log('✅ All tests completed')
  console.log('='.repeat(80))
}

main().catch(console.error)
