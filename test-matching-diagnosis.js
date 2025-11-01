/**
 * Diagnostic Test: Why AI Can't Find Partners
 * This simulates the EXACT flow when AI agent tries to match partners
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function diagnoseMatchingIssue() {
  console.log('🔍 AI AGENT MATCHING DIAGNOSIS')
  console.log('=' .repeat(80))
  console.log('')

  try {
    // STEP 1: Get a real user (the one you're logged in as)
    console.log('STEP 1: Check who is using the system')
    console.log('-'.repeat(80))
    
    const { data: allUsers } = await supabase
      .from('User')
      .select('id, name, email')
      .limit(5)
    
    if (!allUsers || allUsers.length === 0) {
      console.error('❌ CRITICAL: No users in database!')
      console.error('This is why AI says "no partners found"')
      return
    }

    console.log(`✅ Found ${allUsers.length} users in database:`)
    allUsers.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.name} (${u.email})`)
    })
    console.log('')

    // Use the first user as test subject
    const currentUser = allUsers[0]
    console.log(`🎯 Testing as: ${currentUser.name}`)
    console.log('')

    // STEP 2: Check if user has a profile
    console.log('STEP 2: Check user profile')
    console.log('-'.repeat(80))
    
    const { data: userProfile, error: profileError } = await supabase
      .from('Profile')
      .select('*')
      .eq('userId', currentUser.id)
      .single()

    if (profileError || !userProfile) {
      console.error('❌ ISSUE FOUND: User has NO profile!')
      console.error('Error:', profileError?.message)
      console.error('')
      console.error('🔴 ROOT CAUSE: matchCandidates requires user to have a Profile')
      console.error('The tool throws error: "User profile not found"')
      console.error('')
      console.error('FIX: Create a profile for this user in the database')
      return
    }

    console.log('✅ User has profile')
    console.log('   Subjects:', userProfile.subjects || '(empty)')
    console.log('   Interests:', userProfile.interests || '(empty)')
    console.log('   Study Style:', userProfile.studyStyle || '(not set)')
    console.log('   Skill Level:', userProfile.skillLevel || '(not set)')
    console.log('')

    // Check if profile is empty
    const hasData = (
      (userProfile.subjects && userProfile.subjects.length > 0) ||
      (userProfile.interests && userProfile.interests.length > 0) ||
      userProfile.studyStyle ||
      userProfile.skillLevel
    )

    if (!hasData) {
      console.log('⚠️  WARNING: Profile exists but is empty!')
      console.log('This will result in very low match scores')
      console.log('')
    }

    // STEP 3: Check for other users (candidates)
    console.log('STEP 3: Check for other users (potential partners)')
    console.log('-'.repeat(80))
    
    const { data: otherProfiles, error: candidatesError } = await supabase
      .from('Profile')
      .select('userId, subjects, studyStyle, skillLevel, interests')
      .neq('userId', currentUser.id)

    if (candidatesError) {
      console.error('❌ Database error:', candidatesError.message)
      return
    }

    if (!otherProfiles || otherProfiles.length === 0) {
      console.error('❌ ISSUE FOUND: No other users with profiles!')
      console.error('')
      console.error('🔴 ROOT CAUSE: Database only has 1 user with profile')
      console.error('matchCandidates returns: { matches: [], total: 0 }')
      console.error('AI correctly says: "no available matches"')
      console.error('')
      console.error('FIX: Add more users with profiles to the database')
      return
    }

    console.log(`✅ Found ${otherProfiles.length} potential partners`)
    console.log('')

    // Get user names for candidates
    const candidateIds = otherProfiles.map(p => p.userId)
    const { data: candidateUsers } = await supabase
      .from('User')
      .select('id, name')
      .in('id', candidateIds)

    const userNameMap = new Map(candidateUsers?.map(u => [u.id, u.name]) || [])

    otherProfiles.forEach((p, i) => {
      const name = userNameMap.get(p.userId) || 'Unknown'
      console.log(`   ${i + 1}. ${name}`)
      console.log(`      Subjects: ${p.subjects?.join(', ') || '(empty)'}`)
      console.log(`      Study Style: ${p.studyStyle || '(not set)'}`)
      console.log(`      Skill Level: ${p.skillLevel || '(not set)'}`)
    })
    console.log('')

    // STEP 4: Simulate matchCandidates scoring logic
    console.log('STEP 4: Simulate matching algorithm')
    console.log('-'.repeat(80))

    const userSubjects = new Set(userProfile.subjects || [])
    const scoredMatches = []

    for (const candidate of otherProfiles) {
      let score = 0
      let maxPossible = 0

      // Subject overlap (40%)
      const candidateSubjects = new Set(candidate.subjects || [])
      if (userSubjects.size > 0 || candidateSubjects.size > 0) {
        const overlap = Array.from(userSubjects).filter(s => candidateSubjects.has(s)).length
        const subjectScore = Math.min(overlap / 3, 1)
        score += subjectScore * 0.4
        maxPossible += 0.4
      }

      // Study style (20%)
      if (userProfile.studyStyle && candidate.studyStyle) {
        const styleScore = userProfile.studyStyle === candidate.studyStyle ? 0.8 : 0.7
        score += styleScore * 0.2
        maxPossible += 0.2
      }

      // Skill level (15%)
      if (userProfile.skillLevel && candidate.skillLevel) {
        const skillScore = userProfile.skillLevel === candidate.skillLevel ? 1.0 : 0.6
        score += skillScore * 0.15
        maxPossible += 0.15
      }

      // Baseline for empty profiles
      if (maxPossible === 0) {
        score = 0.1
      } else {
        score = score / maxPossible
      }

      scoredMatches.push({
        userId: candidate.userId,
        name: userNameMap.get(candidate.userId) || 'Unknown',
        score: Math.min(score, 1)
      })
    }

    scoredMatches.sort((a, b) => b.score - a.score)

    console.log('Match scores:')
    scoredMatches.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.name}: ${(m.score * 100).toFixed(1)}%`)
    })
    console.log('')

    // STEP 5: Apply filtering (minScore = 0.1 = 10%)
    const minScore = 0.1
    let filteredMatches = scoredMatches.filter(m => m.score >= minScore)

    console.log('STEP 5: Filter by minScore threshold')
    console.log('-'.repeat(80))
    console.log(`minScore: ${minScore} (10%)`)
    console.log(`Matches above threshold: ${filteredMatches.length}`)
    console.log('')

    // STEP 6: Fallback logic
    if (filteredMatches.length === 0 && scoredMatches.length > 0) {
      console.log('✅ FALLBACK activated: Returning top candidates anyway')
      filteredMatches = scoredMatches.slice(0, 10)
    }

    // FINAL DIAGNOSIS
    console.log('=' .repeat(80))
    console.log('📊 FINAL DIAGNOSIS')
    console.log('=' .repeat(80))
    console.log('')

    if (filteredMatches.length === 0) {
      console.error('❌ PROBLEM: No matches returned!')
      console.error('')
      console.error('Possible causes:')
      console.error('1. No other users in database → Add more users')
      console.error('2. No profiles for other users → Create profiles')
      console.error('3. Bug in scoring logic → Check code')
      console.error('')
      console.error('🔴 THIS IS WHY AI says: "cannot find a partner in database"')
    } else {
      console.log(`✅ SUCCESS: ${filteredMatches.length} matches would be returned`)
      console.log('')
      console.log('Tool output sent to AI:')
      console.log(JSON.stringify({
        matches: filteredMatches.slice(0, 3).map(m => ({
          userId: m.userId,
          score: m.score
        })),
        total: filteredMatches.length
      }, null, 2))
      console.log('')
      console.log('🟢 AI should say: "I found [N] potential study partners!"')
      console.log('')
      console.log('⚠️  IF AI STILL SAYS "no partners", the issue is:')
      console.log('   - AI is not calling the matchCandidates tool')
      console.log('   - OR tool is throwing an error before returning results')
      console.log('   - Check server logs for tool execution errors')
    }

  } catch (error) {
    console.error('')
    console.error('❌ TEST FAILED:', error.message)
    console.error('')
    console.error('Stack:', error.stack)
  }
}

diagnoseMatchingIssue().catch(console.error)
