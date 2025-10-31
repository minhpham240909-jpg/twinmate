/**
 * Test AI Agent searchUsers Tool Directly
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

// Copy the exact searchUsers tool logic
async function searchUsersToolSimulation(query, searchBy = 'all', currentUserId, limit = 10) {
  try {
    console.log('[searchUsers] Searching for:', query, 'searchBy:', searchBy)

    // STEP 1: Search for users by name/email in User table
    let userIds = []
    let userMap = new Map()

    // Build search query for User table
    let userQuery = supabase
      .from('User')
      .select('id, name, email, createdAt')
      .neq('id', currentUserId) // Don't include current user
      .limit(100)

    // For name/all search: Search by name and email
    // Split multi-word queries to match partial names (e.g., "Gia Khang Pham")
    if (searchBy === 'all' || searchBy === 'name') {
      const searchTerms = query.trim().split(/\s+/) // Split by whitespace

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

      console.log('[searchUsers] Searching User table with terms:', searchTerms)
      console.log('[searchUsers] OR conditions:', conditions.join(','))
    }

    const { data: users, error: userError } = await userQuery

    console.log('[searchUsers] User table search result:', {
      query: query,
      found: users?.length || 0,
      error: userError?.message
    })

    if (userError) {
      console.error('[searchUsers] User search error:', userError)
      console.error('[searchUsers] Error details:', {
        message: userError.message,
        hint: userError.hint,
        details: userError.details,
        code: userError.code
      })
      throw new Error(`Failed to search users: ${userError.message}`)
    }

    if (!users || users.length === 0) {
      console.log('[searchUsers] No users found matching:', query)
      console.log('[searchUsers] DEBUG - Query details:', {
        query,
        searchBy,
        searchTerms: query.trim().split(/\s+/),
        currentUserId: currentUserId,
        supabaseConnected: !!supabase
      })
      return {
        users: [],
        totalFound: 0,
        searchedBy: searchBy,
      }
    }

    // Store user data
    for (const user of users) {
      userIds.push(user.id)
      userMap.set(user.id, { name: user.name, email: user.email })
    }

    console.log('[searchUsers] Found user IDs:', userIds)
    console.log('[searchUsers] User names:', users.map(u => u.name).join(', '))

    // STEP 2: Get Profile data for these users (including ALL fields)
    const { data: profiles, error: profileError } = await supabase
      .from('Profile')
      .select(`
        userId, subjects, interests, goals, studyStyle, skillLevel, onlineStatus,
        bio, school, languages, aboutYourself, aboutYourselfItems,
        skillLevelCustomDescription, studyStyleCustomDescription,
        availabilityCustomDescription, subjectCustomDescription, interestsCustomDescription
      `)
      .in('userId', userIds)

    console.log('[searchUsers] Profile query result:', {
      found: profiles?.length || 0,
      error: profileError?.message
    })

    if (profileError) {
      console.error('[searchUsers] Profile fetch error:', profileError)
      // Continue even if profiles fail - return users without profile data
    }

    // Map profiles by userId for easy lookup
    const profileMap = new Map(
      profiles?.map(p => [p.userId, p]) || []
    )

    // Build result
    let resultUsers = userIds.map(userId => {
      const userInfo = userMap.get(userId)
      const profile = profileMap.get(userId)

      console.log('[searchUsers] Mapping user:', userInfo.name, 'has profile:', !!profile)

      return {
        userId: userId,
        name: userInfo.name || userInfo.email,
        email: userInfo.email,
        subjects: profile?.subjects || [],
        interests: profile?.interests || [],
        goals: profile?.goals || [],
        learningStyle: profile?.studyStyle || undefined,
        skillLevel: profile?.skillLevel || undefined,
        bio: profile?.bio || undefined,
        school: profile?.school || undefined,
        languages: profile?.languages || undefined,
        aboutYourself: profile?.aboutYourself || undefined,
        aboutYourselfItems: profile?.aboutYourselfItems || [],
      }
    })

    // Limit final results
    const limitedResults = resultUsers.slice(0, limit)

    console.log('[searchUsers] Returning', limitedResults.length, 'users out of', resultUsers.length, 'found')
    console.log('[searchUsers] User names:', limitedResults.map(u => u.name).join(', '))

    return {
      users: limitedResults,
      totalFound: resultUsers.length,
      searchedBy: searchBy,
    }
  } catch (error) {
    console.error('Search users error:', error)
    throw error
  }
}

async function testAIAgentSearchUsers() {
  console.log('🧪 Testing AI Agent searchUsers Tool\n')
  console.log('='.repeat(80))

  try {
    // Get test users
    const { data: allUsers } = await supabase
      .from('User')
      .select('id, name, email')
      .limit(5)

    if (!allUsers || allUsers.length === 0) {
      console.error('❌ No users in database')
      return
    }

    console.log(`✅ Found ${allUsers.length} users in database:`)
    allUsers.forEach((u, i) => console.log(`  ${i+1}. ${u.name} (${u.email})`))

    // Test 1: Search for a specific user
    const targetUser = allUsers[1] || allUsers[0]
    const currentUser = allUsers[0]

    console.log('\n' + '='.repeat(80))
    console.log('TEST 1: Search for specific user')
    console.log('='.repeat(80))
    console.log('Searching for:', targetUser.name)
    console.log('As user:', currentUser.name)

    const result1 = await searchUsersToolSimulation(targetUser.name, 'all', currentUser.id, 10)

    if (result1.users.length > 0) {
      console.log('\n✅ TEST 1 PASSED')
      console.log('Found', result1.users.length, 'users:')
      result1.users.forEach(u => {
        console.log(`  - ${u.name} (${u.email})`)
        console.log(`    Subjects: ${u.subjects.join(', ') || 'None'}`)
        console.log(`    Bio: ${u.bio || 'None'}`)
      })
    } else {
      console.log('\n❌ TEST 1 FAILED')
      console.log('No users found!')
      console.log('This is the bug the user reported!')
    }

    // Test 2: Search with Vietnamese name
    console.log('\n' + '='.repeat(80))
    console.log('TEST 2: Search with Vietnamese characters')
    console.log('='.repeat(80))

    const result2 = await searchUsersToolSimulation('Gia Khang Phạm', 'all', currentUser.id, 10)

    if (result2.users.length > 0) {
      console.log('\n✅ TEST 2 PASSED')
      console.log('Found', result2.users.length, 'users with Vietnamese name')
    } else {
      console.log('\n⚠️  TEST 2: No users found (might be expected if no Vietnamese names exist)')
    }

    // Test 3: Search with partial name
    console.log('\n' + '='.repeat(80))
    console.log('TEST 3: Search with partial name')
    console.log('='.repeat(80))

    const firstName = targetUser.name.split(' ')[0]
    console.log('Searching for:', firstName)

    const result3 = await searchUsersToolSimulation(firstName, 'all', currentUser.id, 10)

    if (result3.users.length > 0) {
      console.log('\n✅ TEST 3 PASSED')
      console.log('Found', result3.users.length, 'users')
    } else {
      console.log('\n❌ TEST 3 FAILED')
      console.log('Partial name search failed!')
    }

    // Test 4: Search for non-existent user
    console.log('\n' + '='.repeat(80))
    console.log('TEST 4: Search for non-existent user (should return empty)')
    console.log('='.repeat(80))

    const result4 = await searchUsersToolSimulation('XYZ_NonExistent_User_12345', 'all', currentUser.id, 10)

    if (result4.users.length === 0) {
      console.log('\n✅ TEST 4 PASSED')
      console.log('Correctly returned no users')
    } else {
      console.log('\n❌ TEST 4 FAILED')
      console.log('Should not have found any users!')
    }

    console.log('\n' + '='.repeat(80))
    console.log('✅ All tests completed')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('\n❌ Test failed with error:', error)
  }
}

testAIAgentSearchUsers().catch(console.error)
