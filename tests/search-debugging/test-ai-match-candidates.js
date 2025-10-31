/**
 * Test AI Agent matchCandidates Tool
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function testMatchCandidatesTool() {
  console.log('🧪 Testing AI Agent matchCandidates Tool\n')
  console.log('='.repeat(80))

  try {
    // Get a test user
    const { data: users } = await supabase
      .from('User')
      .select('id, name')
      .limit(1)

    if (!users || users.length === 0) {
      console.error('❌ No users found')
      return
    }

    const testUser = users[0]
    console.log('✅ Test user:', testUser.name, `(${testUser.id})`)

    // TEST 1: Check if user has a profile
    console.log('\n=== TEST 1: Check user profile ===')
    const { data: userProfile, error: userError } = await supabase
      .from('Profile')
      .select(`
        userId, subjects, studyStyle, skillLevel, goals, interests,
        bio, school, languages, aboutYourself, aboutYourselfItems,
        skillLevelCustomDescription, studyStyleCustomDescription,
        availabilityCustomDescription, subjectCustomDescription, interestsCustomDescription
      `)
      .eq('userId', testUser.id)
      .single()

    if (userError || !userProfile) {
      console.error('❌ User profile not found!')
      console.error('Error:', userError?.message)
      console.log('\n⚠️  This is a critical issue - user needs a profile for matching')
      return
    }

    console.log('✅ User has profile')
    console.log('  Subjects:', userProfile.subjects)
    console.log('  Study Style:', userProfile.studyStyle)
    console.log('  Skill Level:', userProfile.skillLevel)
    console.log('  Interests:', userProfile.interests)

    // TEST 2: Fetch potential candidates (exclude self)
    console.log('\n=== TEST 2: Fetch potential candidates ===')
    const { data: candidates, error: candidatesError } = await supabase
      .from('Profile')
      .select(`
        userId, subjects, studyStyle, skillLevel, goals, interests,
        bio, school, languages, aboutYourself, aboutYourselfItems,
        skillLevelCustomDescription, studyStyleCustomDescription,
        availabilityCustomDescription, subjectCustomDescription, interestsCustomDescription
      `)
      .neq('userId', testUser.id)
      .limit(100)

    if (candidatesError) {
      console.error('❌ Failed to fetch candidates:', candidatesError.message)
      return
    }

    if (!candidates || candidates.length === 0) {
      console.log('⚠️  No other users with profiles in database')
      console.log('This is why AI agent says "cannot find partner in database"')
      return
    }

    console.log('✅ Found', candidates.length, 'potential candidates')

    // TEST 3: Calculate compatibility scores (simplified)
    console.log('\n=== TEST 3: Calculate compatibility scores ===')

    const userSubjects = new Set(userProfile.subjects || [])
    const userInterests = new Set(userProfile.interests || [])

    let scoredMatches = candidates.map(candidate => {
      let score = 0

      // Subject overlap (40% weight)
      const candidateSubjects = new Set(candidate.subjects || [])
      const subjectOverlap = Array.from(userSubjects).filter(s => candidateSubjects.has(s)).length
      const subjectScore = Math.min(subjectOverlap / 3, 1)
      score += subjectScore * 0.4

      // Learning style compatibility (20% weight)
      if (userProfile.studyStyle && candidate.studyStyle) {
        const styleScore = userProfile.studyStyle === candidate.studyStyle ? 0.8 : 0.7
        score += styleScore * 0.2
      }

      // Skill level proximity (15% weight)
      if (userProfile.skillLevel && candidate.skillLevel) {
        const skillScore = userProfile.skillLevel === candidate.skillLevel ? 1.0 : 0.6
        score += skillScore * 0.15
      }

      return {
        userId: candidate.userId,
        score: Math.min(score, 1),
        subjectOverlap,
      }
    })

    // Filter by minimum score (0.4) and sort
    const filteredMatches = scoredMatches
      .filter(m => m.score >= 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    if (filteredMatches.length === 0) {
      console.log('⚠️  No candidates with score >= 0.4 (40% compatibility)')
      console.log('Top 3 scores:', scoredMatches.slice(0, 3).map(m => m.score.toFixed(2)))
      console.log('\nThis might be why AI agent says "cannot find partner"')
      console.log('Try lowering minScore threshold or adding more users with similar subjects')
    } else {
      console.log('✅ Found', filteredMatches.length, 'compatible matches')
      console.log('\nTop matches:')
      for (const match of filteredMatches.slice(0, 5)) {
        // Get candidate details
        const candidate = candidates.find(c => c.userId === match.userId)
        const { data: user } = await supabase
          .from('User')
          .select('name')
          .eq('id', match.userId)
          .single()

        console.log(`  - ${user?.name || 'Unknown'}: ${(match.score * 100).toFixed(1)}% (${match.subjectOverlap} shared subjects)`)
      }
    }

    // TEST 4: Check if MatchCandidate table exists
    console.log('\n=== TEST 4: Check MatchCandidate cache table ===')
    const { error: tableschemaError } = await supabase
      .from('MatchCandidate')
      .select('userId')
      .limit(1)

    if (tableError && tableError.code === '42P01') {
      console.log('⚠️  MatchCandidate table does not exist')
      console.log('Caching is disabled but tool should still work')
    } else if (tableError) {
      console.log('⚠️  Error checking MatchCandidate table:', tableError.message)
    } else {
      console.log('✅ MatchCandidate table exists')
    }

    console.log('\n' + '='.repeat(80))
    console.log('✅ Match candidates tool test completed')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('\n❌ Test failed:', error)
  }
}

testMatchCandidatesTool().catch(console.error)
