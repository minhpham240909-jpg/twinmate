/**
 * COMPREHENSIVE AI AGENT MATCHING DIAGNOSIS
 * Tests every component to identify ALL issues preventing partner matching
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const openaiKey = process.env.OPENAI_API_KEY

// Track all issues found
const issues = []
const warnings = []
const successes = []

function logIssue(category, message, details = null) {
  issues.push({ category, message, details })
  console.error(`\n❌ ISSUE [${category}]: ${message}`)
  if (details) {
    console.error('   Details:', details)
  }
}

function logWarning(category, message, details = null) {
  warnings.push({ category, message, details })
  console.warn(`\n⚠️  WARNING [${category}]: ${message}`)
  if (details) {
    console.warn('   Details:', details)
  }
}

function logSuccess(category, message, details = null) {
  successes.push({ category, message, details })
  console.log(`\n✅ SUCCESS [${category}]: ${message}`)
  if (details) {
    console.log('   Details:', details)
  }
}

async function runCompleteDiagnosis() {
  console.log('=' .repeat(80))
  console.log('🔍 COMPREHENSIVE AI AGENT MATCHING DIAGNOSIS')
  console.log('=' .repeat(80))
  console.log('')

  // ==========================================================================
  // STEP 1: Environment Variables Check
  // ==========================================================================
  console.log('STEP 1: Checking Environment Variables')
  console.log('-'.repeat(80))

  if (!supabaseUrl) {
    logIssue('ENV', 'NEXT_PUBLIC_SUPABASE_URL is missing')
  } else {
    logSuccess('ENV', 'NEXT_PUBLIC_SUPABASE_URL is set', supabaseUrl)
  }

  if (!supabaseKey) {
    logIssue('ENV', 'SUPABASE_SERVICE_ROLE_KEY is missing')
  } else {
    logSuccess('ENV', 'SUPABASE_SERVICE_ROLE_KEY is set', supabaseKey.substring(0, 20) + '...')
  }

  if (!openaiKey) {
    logIssue('ENV', 'OPENAI_API_KEY is missing')
  } else {
    logSuccess('ENV', 'OPENAI_API_KEY is set', openaiKey.substring(0, 20) + '...')
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('\n🛑 Cannot continue without Supabase credentials')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  })

  // ==========================================================================
  // STEP 2: Database Connection Check
  // ==========================================================================
  console.log('\n\nSTEP 2: Testing Database Connection')
  console.log('-'.repeat(80))

  try {
    const { data, error } = await supabase.from('User').select('count', { count: 'exact', head: true })
    
    if (error) {
      logIssue('DATABASE', 'Cannot connect to Supabase', error.message)
    } else {
      logSuccess('DATABASE', 'Connected to Supabase successfully')
    }
  } catch (error) {
    logIssue('DATABASE', 'Database connection failed', error.message)
  }

  // ==========================================================================
  // STEP 3: User Data Check
  // ==========================================================================
  console.log('\n\nSTEP 3: Checking User Data')
  console.log('-'.repeat(80))

  let testUser = null
  let allUsers = []

  try {
    const { data: users, error: userError } = await supabase
      .from('User')
      .select('id, name, email, createdAt')
      .limit(10)

    if (userError) {
      logIssue('DATA', 'Failed to fetch users', userError.message)
    } else if (!users || users.length === 0) {
      logIssue('DATA', 'NO USERS IN DATABASE - Cannot test matching without users')
    } else {
      allUsers = users
      testUser = users[0]
      logSuccess('DATA', `Found ${users.length} users in database`)
      console.log('\n   Users:')
      users.forEach((u, i) => {
        console.log(`      ${i + 1}. ${u.name} (${u.email})`)
      })
      console.log(`\n   Testing as: ${testUser.name} (${testUser.id})`)
    }
  } catch (error) {
    logIssue('DATA', 'Error fetching users', error.message)
  }

  if (!testUser) {
    console.error('\n🛑 Cannot continue without test user')
    process.exit(1)
  }

  // ==========================================================================
  // STEP 4: Profile Data Check
  // ==========================================================================
  console.log('\n\nSTEP 4: Checking Profile Data')
  console.log('-'.repeat(80))

  try {
    const { data: profiles, error: profileError } = await supabase
      .from('Profile')
      .select('userId, subjects, interests, studyStyle, skillLevel, goals')
      .in('userId', allUsers.map(u => u.id))

    if (profileError) {
      logIssue('PROFILE', 'Failed to fetch profiles', profileError.message)
    } else if (!profiles || profiles.length === 0) {
      logIssue('PROFILE', 'NO PROFILES IN DATABASE - Users need profiles for matching')
    } else {
      logSuccess('PROFILE', `Found ${profiles.length} profiles out of ${allUsers.length} users`)

      // Check test user profile
      const testUserProfile = profiles.find(p => p.userId === testUser.id)
      
      if (!testUserProfile) {
        logIssue('PROFILE', `Test user "${testUser.name}" has NO PROFILE`, 
          'matchCandidates will fail with "User profile not found" error')
      } else {
        logSuccess('PROFILE', `Test user has profile`)
        console.log('   Profile data:')
        console.log('      Subjects:', testUserProfile.subjects || '(empty)')
        console.log('      Interests:', testUserProfile.interests || '(empty)')
        console.log('      Study Style:', testUserProfile.studyStyle || '(not set)')
        console.log('      Skill Level:', testUserProfile.skillLevel || '(not set)')

        // Check if profile is complete
        const hasSubjects = testUserProfile.subjects && testUserProfile.subjects.length > 0
        const hasInterests = testUserProfile.interests && testUserProfile.interests.length > 0
        const hasStyle = !!testUserProfile.studyStyle
        const hasSkill = !!testUserProfile.skillLevel

        if (!hasSubjects && !hasInterests && !hasStyle && !hasSkill) {
          logWarning('PROFILE', 'Test user profile is COMPLETELY EMPTY',
            'This will result in low match scores')
        } else if (!hasSubjects) {
          logWarning('PROFILE', 'Test user has no subjects',
            'Matches will have lower compatibility scores')
        }
      }

      // Check other profiles
      const otherProfiles = profiles.filter(p => p.userId !== testUser.id)
      if (otherProfiles.length === 0) {
        logIssue('PROFILE', 'No other users with profiles',
          'matchCandidates will return empty array - no potential partners')
      } else {
        logSuccess('PROFILE', `Found ${otherProfiles.length} potential partner profiles`)
        console.log('\n   Potential partners:')
        otherProfiles.forEach((p, i) => {
          const user = allUsers.find(u => u.userId === p.userId)
          const userName = user ? user.name : 'Unknown'
          console.log(`      ${i + 1}. ${userName}`)
          console.log(`         Subjects: ${p.subjects?.join(', ') || '(empty)'}`)
          console.log(`         Study Style: ${p.studyStyle || '(not set)'}`)
        })
      }
    }
  } catch (error) {
    logIssue('PROFILE', 'Error fetching profiles', error.message)
  }

  // ==========================================================================
  // STEP 5: Tool Registration Check
  // ==========================================================================
  console.log('\n\nSTEP 5: Checking Tool Registration')
  console.log('-'.repeat(80))

  try {
    // Try to load the tool registry
    const toolRegistryPath = './packages/ai-agent/src/tools/index.ts'
    const matchCandidatesPath = './packages/ai-agent/src/tools/matchCandidates.ts'
    
    console.log('Checking if tool files exist...')
    const fs = require('fs')
    
    if (!fs.existsSync(toolRegistryPath)) {
      logIssue('TOOLS', 'Tool registry file not found', toolRegistryPath)
    } else {
      logSuccess('TOOLS', 'Tool registry file exists')
    }

    if (!fs.existsSync(matchCandidatesPath)) {
      logIssue('TOOLS', 'matchCandidates tool file not found', matchCandidatesPath)
    } else {
      logSuccess('TOOLS', 'matchCandidates tool file exists')
      
      // Read and check the tool description
      const toolContent = fs.readFileSync(matchCandidatesPath, 'utf8')
      
      if (toolContent.includes('description:')) {
        const descMatch = toolContent.match(/description:\s*['"`]([^'"`]+)['"`]/)
        if (descMatch) {
          const desc = descMatch[1]
          console.log('\n   Tool description:', desc.substring(0, 100) + '...')
          
          if (desc.length < 50) {
            logWarning('TOOLS', 'Tool description is very short',
              'AI might not understand when to use this tool')
          }
        }
      }
    }
  } catch (error) {
    logWarning('TOOLS', 'Could not verify tool files', error.message)
  }

  // ==========================================================================
  // STEP 6: Simulate matchCandidates Tool Execution
  // ==========================================================================
  console.log('\n\nSTEP 6: Testing matchCandidates Tool Logic')
  console.log('-'.repeat(80))

  try {
    // Fetch test user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('Profile')
      .select('userId, subjects, studyStyle, skillLevel, interests')
      .eq('userId', testUser.id)
      .single()

    if (profileError || !userProfile) {
      logIssue('TOOL_EXEC', 'Cannot get user profile for matching',
        profileError?.message || 'Profile not found')
    } else {
      // Fetch candidates
      const { data: candidates, error: candidatesError } = await supabase
        .from('Profile')
        .select('userId, subjects, studyStyle, skillLevel, interests')
        .neq('userId', testUser.id)
        .limit(100)

      if (candidatesError) {
        logIssue('TOOL_EXEC', 'Failed to fetch candidates', candidatesError.message)
      } else if (!candidates || candidates.length === 0) {
        logIssue('TOOL_EXEC', 'matchCandidates returns empty',
          'No other profiles exist in database')
      } else {
        logSuccess('TOOL_EXEC', `matchCandidates would return ${candidates.length} candidates`)

        // Simulate scoring
        const userSubjects = new Set(userProfile.subjects || [])
        const scoredMatches = []

        for (const candidate of candidates) {
          let score = 0
          let maxPossible = 0

          // Subject overlap
          const candidateSubjects = new Set(candidate.subjects || [])
          if (userSubjects.size > 0 || candidateSubjects.size > 0) {
            const overlap = Array.from(userSubjects).filter(s => candidateSubjects.has(s)).length
            const subjectScore = Math.min(overlap / 3, 1)
            score += subjectScore * 0.4
            maxPossible += 0.4
          }

          // Study style
          if (userProfile.studyStyle && candidate.studyStyle) {
            const styleScore = userProfile.studyStyle === candidate.studyStyle ? 0.8 : 0.7
            score += styleScore * 0.2
            maxPossible += 0.2
          }

          // Skill level
          if (userProfile.skillLevel && candidate.skillLevel) {
            const skillScore = userProfile.skillLevel === candidate.skillLevel ? 1.0 : 0.6
            score += skillScore * 0.15
            maxPossible += 0.15
          }

          const normalizedScore = maxPossible > 0 ? score / maxPossible : 0.1

          scoredMatches.push({
            userId: candidate.userId,
            score: normalizedScore
          })
        }

        scoredMatches.sort((a, b) => b.score - a.score)

        // Check threshold
        const minScore = 0.1
        const filteredMatches = scoredMatches.filter(m => m.score >= minScore)

        console.log('\n   Top 5 match scores:')
        scoredMatches.slice(0, 5).forEach((m, i) => {
          const user = allUsers.find(u => u.id === m.userId)
          console.log(`      ${i + 1}. ${user?.name || 'Unknown'}: ${(m.score * 100).toFixed(1)}%`)
        })

        if (filteredMatches.length === 0) {
          logWarning('TOOL_EXEC', 'All matches below minScore threshold',
            `Fallback should return top ${Math.min(10, scoredMatches.length)} anyway`)
        } else {
          logSuccess('TOOL_EXEC', `${filteredMatches.length} matches above threshold (10%)`)
        }
      }
    }
  } catch (error) {
    logIssue('TOOL_EXEC', 'Tool simulation failed', error.message)
  }

  // ==========================================================================
  // STEP 7: System Prompt Check
  // ==========================================================================
  console.log('\n\nSTEP 7: Checking System Prompt Configuration')
  console.log('-'.repeat(80))

  try {
    const orchestratorPath = './packages/ai-agent/src/lib/orchestrator.ts'
    const fs = require('fs')

    if (!fs.existsSync(orchestratorPath)) {
      logIssue('PROMPT', 'Orchestrator file not found', orchestratorPath)
    } else {
      const orchestratorContent = fs.readFileSync(orchestratorPath, 'utf8')

      // Check for matchCandidates rules
      if (orchestratorContent.includes('RULE 5 - PARTNER MATCHING')) {
        logSuccess('PROMPT', 'System prompt has RULE 5 for partner matching')
      } else if (orchestratorContent.includes('matchCandidates')) {
        logWarning('PROMPT', 'matchCandidates mentioned but no explicit RULE 5',
          'AI might not know when to call the tool')
      } else {
        logIssue('PROMPT', 'NO matchCandidates instructions in system prompt',
          'AI will never call this tool')
      }

      // Check for example queries
      const hasExamples = orchestratorContent.includes('"find me a partner"') ||
                          orchestratorContent.includes('"find a study partner"')
      
      if (hasExamples) {
        logSuccess('PROMPT', 'System prompt includes partner matching examples')
      } else {
        logWarning('PROMPT', 'No partner matching examples in prompt',
          'AI might not recognize user queries')
      }

      // Check for fallback rules
      if (orchestratorContent.includes('IGNORE INCORRECT PREVIOUS RESPONSES')) {
        logSuccess('PROMPT', 'System prompt has fallback rules (RULE 8)')
      }
    }
  } catch (error) {
    logWarning('PROMPT', 'Could not verify system prompt', error.message)
  }

  // ==========================================================================
  // STEP 8: API Endpoint Check
  // ==========================================================================
  console.log('\n\nSTEP 8: Checking API Endpoint')
  console.log('-'.repeat(80))

  try {
    const apiRoutePath = './src/app/api/ai-agent/chat/route.ts'
    const fs = require('fs')

    if (!fs.existsSync(apiRoutePath)) {
      logIssue('API', 'AI agent API route not found', apiRoutePath)
    } else {
      logSuccess('API', 'AI agent API route exists')
      
      const routeContent = fs.readFileSync(apiRoutePath, 'utf8')
      
      // Check if it initializes tools
      if (routeContent.includes('initializeToolRegistry')) {
        logSuccess('API', 'API initializes tool registry')
      } else {
        logIssue('API', 'API does not initialize tool registry',
          'Tools will not be available to AI')
      }

      // Check error handling
      if (routeContent.includes('catch') && routeContent.includes('console.error')) {
        logSuccess('API', 'API has error handling and logging')
      }
    }
  } catch (error) {
    logWarning('API', 'Could not verify API endpoint', error.message)
  }

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n\n' + '='.repeat(80))
  console.log('📊 DIAGNOSIS SUMMARY')
  console.log('='.repeat(80))

  console.log(`\n✅ Successes: ${successes.length}`)
  successes.forEach((s, i) => {
    console.log(`   ${i + 1}. [${s.category}] ${s.message}`)
  })

  console.log(`\n⚠️  Warnings: ${warnings.length}`)
  if (warnings.length === 0) {
    console.log('   (none)')
  } else {
    warnings.forEach((w, i) => {
      console.log(`   ${i + 1}. [${w.category}] ${w.message}`)
      if (w.details) {
        console.log(`      → ${w.details}`)
      }
    })
  }

  console.log(`\n❌ Issues: ${issues.length}`)
  if (issues.length === 0) {
    console.log('   (none)')
  } else {
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. [${issue.category}] ${issue.message}`)
      if (issue.details) {
        console.log(`      → ${issue.details}`)
      }
    })
  }

  // ==========================================================================
  // RECOMMENDATIONS
  // ==========================================================================
  console.log('\n\n' + '='.repeat(80))
  console.log('💡 RECOMMENDATIONS')
  console.log('='.repeat(80))

  if (issues.length === 0 && warnings.length <= 2) {
    console.log('\n🎉 Your AI agent matching system appears to be working!')
    console.log('\nTo debug why AI says "cannot find partners", check:')
    console.log('1. Server logs when you ask for partners (look for [matchCandidates])')
    console.log('2. Exact query you\'re using (try: "find me a study partner")')
    console.log('3. If you see tool calls but wrong results, check OpenAI API logs')
  } else {
    console.log('\n🔴 Critical Issues to Fix:\n')
    
    const criticalIssues = issues.filter(i => 
      i.category === 'DATA' || 
      i.category === 'PROFILE' || 
      i.category === 'TOOL_EXEC' ||
      i.category === 'PROMPT'
    )

    if (criticalIssues.length > 0) {
      criticalIssues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue.message}`)
        if (issue.details) {
          console.log(`   Fix: ${issue.details}`)
        }
      })
    }

    console.log('\n⚠️  Warnings to Address:\n')
    warnings.forEach((w, i) => {
      console.log(`${i + 1}. ${w.message}`)
      if (w.details) {
        console.log(`   Impact: ${w.details}`)
      }
    })
  }

  console.log('\n\n' + '='.repeat(80))
  console.log('✅ Diagnosis Complete!')
  console.log('='.repeat(80))
}

// Run diagnosis
runCompleteDiagnosis().catch(error => {
  console.error('\n\n🛑 FATAL ERROR:', error.message)
  console.error('Stack:', error.stack)
  process.exit(1)
})
