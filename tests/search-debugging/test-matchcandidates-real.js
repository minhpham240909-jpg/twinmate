/**
 * Test matchCandidates with real user profile
 * Simulate exactly what happens when user says "find me a partner"
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function testMatchCandidatesReal() {
  console.log('🧪 Testing matchCandidates - Real User Profile')
  console.log('='.repeat(80))
  console.log('Simulating: User says "find me a partner"\n')

  try {
    // Get the first user (Minh Pham)
    const { data: users } = await supabase
      .from('User')
      .select('id, name, email')
      .eq('email', 'minhpham240909@gmail.com')
      .single()

    if (!users) {
      console.error('❌ User not found')
      return
    }

    const currentUser = users
    console.log('👤 Current User:', currentUser.name, `(${currentUser.id})`)
    console.log('')

    // STEP 1: Get user's profile (what matchCandidates does first)
    console.log('='.repeat(80))
    console.log('STEP 1: Fetch current user profile')
    console.log('='.repeat(80))

    const { data: userProfile, error: userError } = await supabase
      .from('Profile')
      .select(`
        userId, subjects, studyStyle, skillLevel, goals, interests,
        bio, school, languages, aboutYourself, aboutYourselfItems
      `)
      .eq('userId', currentUser.id)
      .single()

    if (userError || !userProfile) {
      console.error('❌ User profile not found!')
      console.error('Error:', userError?.message)
      console.log('\n🔴 THIS IS THE PROBLEM - User has no profile!')
      console.log('AI will say "no matches" because user profile is required for matching')
      return
    }

    console.log('✅ User has profile:')
    console.log('  - Subjects:', userProfile.subjects || 'null')
    console.log('  - Interests:', userProfile.interests || 'null')
    console.log('  - Study Style:', userProfile.studyStyle || 'null')
    console.log('  - Skill Level:', userProfile.skillLevel || 'null')
    console.log('  - Goals:', userProfile.goals || 'null')
    console.log('  - Bio:', userProfile.bio || 'null')
    console.log('  - School:', userProfile.school || 'null')
    console.log('')

    // Check if profile is actually empty
    const hasSubjects = userProfile.subjects && userProfile.subjects.length > 0
    const hasInterests = userProfile.interests && userProfile.interests.length > 0
    const hasGoals = userProfile.goals && userProfile.goals.length > 0

    if (!hasSubjects && !hasInterests && !hasGoals) {
      console.log('⚠️  WARNING: Profile appears empty!')
      console.log('Even though profile exists, it has no subjects/interests/goals')
      console.log('This will result in very low compatibility scores')
      console.log('')
    }

    // STEP 2: Fetch potential candidates
    console.log('='.repeat(80))
    console.log('STEP 2: Fetch potential candidates')
    console.log('='.repeat(80))

    const { data: candidates, error: candidatesError } = await supabase
      .from('Profile')
      .select(`
        userId, subjects, studyStyle, skillLevel, goals, interests,
        bio, school, languages
      `)
      .neq('userId', currentUser.id)
      .limit(100)

    if (candidatesError) {
      console.error('❌ Failed to fetch candidates:', candidatesError.message)
      return
    }

    if (!candidates || candidates.length === 0) {
      console.log('⚠️  No other users with profiles in database')
      console.log('\n🔴 THIS IS THE PROBLEM - No other users exist!')
      console.log('AI will correctly say "no matches" because database is empty')
      return
    }

    console.log(`✅ Found ${candidates.length} potential candidates`)
    console.log('')

    // STEP 3: Calculate compatibility scores (simplified version of the tool)
    console.log('='.repeat(80))
    console.log('STEP 3: Calculate compatibility scores')
    console.log('='.repeat(80))

    const userSubjects = new Set(userProfile.subjects || [])
    const userInterests = new Set(userProfile.interests || [])

    const scoredMatches = candidates.map(candidate => {
      let score = 0
      let maxPossibleScore = 0

      // Subject overlap (40% weight)
      const candidateSubjects = new Set(candidate.subjects || [])
      if (userSubjects.size > 0 || candidateSubjects.size > 0) {
        const overlap = Array.from(userSubjects).filter(s => candidateSubjects.has(s)).length
        const subjectScore = Math.min(overlap / 3, 1)
        score += subjectScore * 0.4
        maxPossibleScore += 0.4
      }

      // Study style (20% weight)
      if (userProfile.studyStyle && candidate.studyStyle) {
        const styleScore = userProfile.studyStyle === candidate.studyStyle ? 0.8 : 0.7
        score += styleScore * 0.2
        maxPossibleScore += 0.2
      }

      // Skill level (15% weight)
      if (userProfile.skillLevel && candidate.skillLevel) {
        const skillScore = userProfile.skillLevel === candidate.skillLevel ? 1.0 : 0.6
        score += skillScore * 0.15
        maxPossibleScore += 0.15
      }

      // If profiles are mostly empty, give baseline
      if (maxPossibleScore === 0) {
        return { userId: candidate.userId, score: 0.1, maxPossibleScore: 0 }
      }

      const normalizedScore = maxPossibleScore > 0 ? score / maxPossibleScore : 0

      return {
        userId: candidate.userId,
        score: Math.min(normalizedScore, 1),
        maxPossibleScore,
        subjectOverlap: Array.from(userSubjects).filter(s => candidateSubjects.has(s)).length
      }
    })

    // Sort by score
    scoredMatches.sort((a, b) => b.score - a.score)

    console.log('Top 5 candidates by score:')
    for (let i = 0; i < Math.min(5, scoredMatches.length); i++) {
      const match = scoredMatches[i]
      const candidate = candidates.find(c => c.userId === match.userId)
      const { data: user } = await supabase
        .from('User')
        .select('name')
        .eq('id', match.userId)
        .single()

      console.log(`  ${i + 1}. ${user?.name || 'Unknown'}`)
      console.log(`     Score: ${(match.score * 100).toFixed(1)}% (maxPossible: ${match.maxPossibleScore})`)
      console.log(`     Shared subjects: ${match.subjectOverlap}`)
    }
    console.log('')

    // STEP 4: Filter by minScore (0.1 = 10%)
    const minScore = 0.1
    let filteredMatches = scoredMatches.filter(m => m.score >= minScore)

    console.log('='.repeat(80))
    console.log('STEP 4: Filter by minScore (0.1 = 10%)')
    console.log('='.repeat(80))
    console.log(`Candidates with score >= ${minScore}:`, filteredMatches.length)
    console.log('')

    // STEP 5: Fallback if no matches
    if (filteredMatches.length === 0 && scoredMatches.length > 0) {
      console.log('⚠️  No matches above minScore threshold')
      console.log('✅ FALLBACK: Returning top candidates anyway')
      filteredMatches = scoredMatches.slice(0, 10)
    }

    console.log('='.repeat(80))
    console.log('📊 FINAL RESULT')
    console.log('='.repeat(80))

    if (filteredMatches.length === 0) {
      console.log('❌ No matches returned!')
      console.log('\n🔴 THIS IS WHY AI says "no available matches"')
      console.log('\nPossible reasons:')
      console.log('1. No other users in database')
      console.log('2. All users have empty profiles')
      console.log('3. Bug in the scoring logic')
    } else {
      console.log(`✅ ${filteredMatches.length} matches will be returned to AI`)
      console.log('\nAI should say something like:')
      console.log(`"I found ${filteredMatches.length} potential study partners for you!"`)
      console.log('\nTool output that AI sees:')
      console.log(JSON.stringify({
        matches: filteredMatches.slice(0, 3).map(m => ({
          userId: m.userId,
          score: m.score,
          facets: {}
        })),
        total: filteredMatches.length
      }, null, 2))
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error)
  }
}

testMatchCandidatesReal().catch(console.error)
