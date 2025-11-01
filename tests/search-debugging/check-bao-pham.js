/**
 * Check bao pham's profile and test matchCandidates
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function checkBaoPham() {
  console.log('🔍 Checking bao pham Profile\n')

  try {
    const { data: user } = await supabase
      .from('User')
      .select('id, name, email')
      .eq('email', 'clervaclever@gmail.com')
      .single()

    if (!user) {
      console.error('❌ bao pham not found')
      return
    }

    console.log('👤 User:', user.name, `(${user.email})`)
    console.log('ID:', user.id)
    console.log('')

    // Get profile
    const { data: profile, error } = await supabase
      .from('Profile')
      .select('*')
      .eq('userId', user.id)
      .single()

    if (error || !profile) {
      console.error('❌ Profile not found!')
      return
    }

    console.log('📋 PROFILE DATA:')
    console.log('='.repeat(80))
    console.log('✓ subjects:', profile.subjects)
    console.log('✓ interests:', profile.interests)
    console.log('✓ goals:', profile.goals)
    console.log('✓ studyStyle:', profile.studyStyle)
    console.log('✓ skillLevel:', profile.skillLevel)
    console.log('✓ bio:', profile.bio || '(empty)')
    console.log('✓ school:', profile.school || '(empty)')
    console.log('✓ languages:', profile.languages || '(empty)')
    console.log('')

    // Check if profile is complete
    const hasSubjects = profile.subjects && profile.subjects.length > 0
    const hasInterests = profile.interests && profile.interests.length > 0
    const hasGoals = profile.goals && profile.goals.length > 0

    if (hasSubjects && hasInterests) {
      console.log('✅ Profile is COMPLETE!')
      console.log(`   - ${profile.subjects.length} subjects`)
      console.log(`   - ${profile.interests.length} interests`)
      console.log(`   - ${(profile.goals || []).length} goals`)
    } else {
      console.log('⚠️  Profile is incomplete')
    }
    console.log('')

    // Now test matchCandidates
    console.log('='.repeat(80))
    console.log('Testing matchCandidates for bao pham')
    console.log('='.repeat(80))
    console.log('')

    // Fetch candidates
    const { data: candidates, error: candidatesError } = await supabase
      .from('Profile')
      .select(`
        userId, subjects, studyStyle, skillLevel, goals, interests,
        bio, school, languages
      `)
      .neq('userId', user.id)
      .limit(100)

    if (candidatesError || !candidates || candidates.length === 0) {
      console.log('❌ No candidates found!')
      console.log('This is why AI says "no matches"')
      return
    }

    console.log(`✅ Found ${candidates.length} potential candidates\n`)

    // Calculate scores
    const userSubjects = new Set(profile.subjects || [])
    const userInterests = new Set(profile.interests || [])

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

      // Interest overlap (not in original but let's track it)
      const candidateInterests = new Set(candidate.interests || [])
      const interestOverlap = Array.from(userInterests).filter(i => candidateInterests.has(i)).length

      // Study style (20% weight)
      if (profile.studyStyle && candidate.studyStyle) {
        const styleScore = profile.studyStyle === candidate.studyStyle ? 0.8 : 0.7
        score += styleScore * 0.2
        maxPossibleScore += 0.2
      }

      // Skill level (15% weight)
      if (profile.skillLevel && candidate.skillLevel) {
        const skillScore = profile.skillLevel === candidate.skillLevel ? 1.0 : 0.6
        score += skillScore * 0.15
        maxPossibleScore += 0.15
      }

      // Baseline if empty
      if (maxPossibleScore === 0) {
        return {
          userId: candidate.userId,
          score: 0.1,
          maxPossibleScore: 0,
          subjectOverlap: 0,
          interestOverlap: 0
        }
      }

      const normalizedScore = maxPossibleScore > 0 ? score / maxPossibleScore : 0

      return {
        userId: candidate.userId,
        score: Math.min(normalizedScore, 1),
        maxPossibleScore,
        subjectOverlap: Array.from(userSubjects).filter(s => candidateSubjects.has(s)).length,
        interestOverlap
      }
    })

    scoredMatches.sort((a, b) => b.score - a.score)

    console.log('📊 Top candidates:')
    for (let i = 0; i < Math.min(5, scoredMatches.length); i++) {
      const match = scoredMatches[i]
      const candidate = candidates.find(c => c.userId === match.userId)
      const { data: candidateUser } = await supabase
        .from('User')
        .select('name')
        .eq('id', match.userId)
        .single()

      console.log(`\n${i + 1}. ${candidateUser?.name || 'Unknown'}`)
      console.log(`   Score: ${(match.score * 100).toFixed(1)}%`)
      console.log(`   Shared subjects: ${match.subjectOverlap}`)
      console.log(`   Shared interests: ${match.interestOverlap}`)
      console.log(`   Subjects: ${(candidate.subjects || []).slice(0, 3).join(', ')}`)
    }

    // Filter by minScore
    const minScore = 0.1
    let filteredMatches = scoredMatches.filter(m => m.score >= minScore)

    console.log('\n' + '='.repeat(80))
    console.log(`Matches with score >= ${minScore * 100}%: ${filteredMatches.length}`)

    if (filteredMatches.length === 0 && scoredMatches.length > 0) {
      console.log('\n⚠️  No matches above threshold, using fallback...')
      filteredMatches = scoredMatches.slice(0, 10)
      console.log(`✅ Returning top ${filteredMatches.length} candidates anyway`)
    }

    console.log('\n' + '='.repeat(80))
    console.log('📊 FINAL RESULT')
    console.log('='.repeat(80))

    if (filteredMatches.length === 0) {
      console.log('❌ NO MATCHES RETURNED!')
      console.log('\n🔴 This is why AI says "no available matches"')
      console.log('\nBUT based on our test, there ARE candidates!')
      console.log('This suggests:')
      console.log('  1. Deployment not complete (old code still running)')
      console.log('  2. AI misinterpreting the results')
      console.log('  3. Different issue in production vs local test')
    } else {
      console.log(`✅ ${filteredMatches.length} matches returned`)
      console.log('\nTool output AI sees:')
      console.log(JSON.stringify({
        matches: filteredMatches.slice(0, 3).map(m => ({
          userId: m.userId,
          score: m.score,
          facets: {}
        })),
        total: filteredMatches.length
      }, null, 2))
      console.log('\nAI should say:')
      console.log(`"I found ${filteredMatches.length} potential study partners for you!"`)
      console.log('\n🔴 If AI still says "no matches", then:')
      console.log('  - Vercel deployment is not complete yet (wait 2-3 minutes)')
      console.log('  - Or there\'s a bug in how AI interprets the response')
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

checkBaoPham().catch(console.error)
