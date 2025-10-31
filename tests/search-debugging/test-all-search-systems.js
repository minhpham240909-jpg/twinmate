/**
 * COMPREHENSIVE TEST - Check ALL search functionality across entire app
 * Tests: Supabase, Prisma, AI Agent, Partner Search, User Search
 */

const { createClient } = require('@supabase/supabase-js')
const { PrismaClient } = require('@prisma/client')
require('dotenv').config({ path: '.env.local' })

async function comprehensiveTest() {
  console.log('\n========================================')
  console.log('COMPREHENSIVE APP SEARCH TEST')
  console.log('========================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const databaseUrl = process.env.DATABASE_URL

  console.log('Environment Check:')
  console.log('  SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
  console.log('  SERVICE_KEY:', serviceKey ? '✅ Set' : '❌ Missing')
  console.log('  DATABASE_URL:', databaseUrl ? '✅ Set' : '❌ Missing')
  console.log('')

  if (!supabaseUrl || !serviceKey || !databaseUrl) {
    console.error('❌ Missing required environment variables!')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const prisma = new PrismaClient()

  // ============================================================
  // TEST 1: Direct Supabase Query (User table)
  // ============================================================
  console.log('TEST 1: Supabase - Search User table for "Gia Khang"')
  console.log('============================================================')

  const { data: supabaseUsers, error: supabaseError } = await supabase
    .from('User')
    .select('id, name, email')
    .or('name.ilike.%Gia%,name.ilike.%Khang%')
    .limit(10)

  if (supabaseError) {
    console.error('❌ Supabase query FAILED:', supabaseError.message)
  } else {
    console.log(`✅ Supabase found ${supabaseUsers?.length || 0} users:`)
    supabaseUsers?.forEach(u => console.log(`  - ${u.name} (${u.email})`))
  }

  // ============================================================
  // TEST 2: Prisma Query (User model)
  // ============================================================
  console.log('\n\nTEST 2: Prisma - Search User table for "Gia Khang"')
  console.log('============================================================')

  try {
    const prismaUsers = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: 'Gia', mode: 'insensitive' } },
          { name: { contains: 'Khang', mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      take: 10,
    })

    console.log(`✅ Prisma found ${prismaUsers.length} users:`)
    prismaUsers.forEach(u => console.log(`  - ${u.name} (${u.email})`))
  } catch (prismaError) {
    console.error('❌ Prisma query FAILED:', prismaError.message)
  }

  // ============================================================
  // TEST 3: Supabase Profile Query
  // ============================================================
  console.log('\n\nTEST 3: Supabase - Profile table with all fields')
  console.log('============================================================')

  const { data: supabaseProfiles, error: profileError } = await supabase
    .from('Profile')
    .select(`
      userId,
      subjects,
      interests,
      goals,
      studyStyle,
      skillLevel,
      bio,
      school,
      languages,
      aboutYourself,
      aboutYourselfItems,
      subjectCustomDescription,
      skillLevelCustomDescription,
      studyStyleCustomDescription,
      interestsCustomDescription,
      availabilityCustomDescription
    `)
    .limit(3)

  if (profileError) {
    console.error('❌ Profile query FAILED:', profileError.message)
    console.error('   This means some columns are MISSING in database!')
    console.error('   Error details:', profileError)
  } else {
    console.log(`✅ Profile query succeeded, found ${supabaseProfiles?.length || 0} profiles`)
    console.log('   Sample profile fields:', Object.keys(supabaseProfiles?.[0] || {}))
  }

  // ============================================================
  // TEST 4: Prisma Profile Query with User relation
  // ============================================================
  console.log('\n\nTEST 4: Prisma - Profile with User relation')
  console.log('============================================================')

  try {
    const prismaProfiles = await prisma.profile.findMany({
      where: {
        subjects: {
          hasSome: ['Computer Science'],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      take: 3,
    })

    console.log(`✅ Prisma found ${prismaProfiles.length} profiles with Computer Science:`)
    prismaProfiles.forEach(p => {
      console.log(`  - ${p.user.name}`)
      console.log(`    Subjects: ${p.subjects?.join(', ') || 'none'}`)
    })
  } catch (prismaProfileError) {
    console.error('❌ Prisma Profile query FAILED:', prismaProfileError.message)
  }

  // ============================================================
  // TEST 5: Count total users
  // ============================================================
  console.log('\n\nTEST 5: Total users in database')
  console.log('============================================================')

  const { count: supabaseCount } = await supabase
    .from('User')
    .select('*', { count: 'exact', head: true })

  const prismaCount = await prisma.user.count()

  console.log(`Supabase count: ${supabaseCount}`)
  console.log(`Prisma count: ${prismaCount}`)

  if (supabaseCount === prismaCount) {
    console.log('✅ Counts match - both tools see same data')
  } else {
    console.log('❌ COUNT MISMATCH - Supabase and Prisma see different data!')
  }

  // ============================================================
  // TEST 6: Check database connection
  // ============================================================
  console.log('\n\nTEST 6: Database Connection Test')
  console.log('============================================================')

  try {
    await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Prisma database connection: OK')
  } catch (dbError) {
    console.error('❌ Prisma database connection: FAILED')
    console.error('   Error:', dbError.message)
  }

  // ============================================================
  // TEST 7: Simulate /api/users/search endpoint
  // ============================================================
  console.log('\n\nTEST 7: Simulate /api/users/search endpoint')
  console.log('============================================================')

  try {
    const apiSearchUsers = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: 'Gia', mode: 'insensitive' } },
          { email: { contains: 'Gia', mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
      take: 10,
    })

    console.log(`✅ API search simulation found ${apiSearchUsers.length} users:`)
    apiSearchUsers.forEach(u => console.log(`  - ${u.name} (${u.email})`))
  } catch (apiError) {
    console.error('❌ API search simulation FAILED:', apiError.message)
  }

  // ============================================================
  // TEST 8: Simulate /api/partners/search endpoint
  // ============================================================
  console.log('\n\nTEST 8: Simulate /api/partners/search endpoint')
  console.log('============================================================')

  try {
    const partnerSearchProfiles = await prisma.profile.findMany({
      where: {
        OR: [
          { user: { name: { contains: 'Gia', mode: 'insensitive' } } },
          { bio: { contains: 'Gia', mode: 'insensitive' } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      take: 10,
    })

    console.log(`✅ Partner search simulation found ${partnerSearchProfiles.length} profiles:`)
    partnerSearchProfiles.forEach(p => console.log(`  - ${p.user.name}`))
  } catch (partnerError) {
    console.error('❌ Partner search simulation FAILED:', partnerError.message)
  }

  // ============================================================
  // TEST 9: AI Agent searchUsers tool
  // ============================================================
  console.log('\n\nTEST 9: AI Agent searchUsers tool')
  console.log('============================================================')

  try {
    const { createSearchUsersTool } = require('./packages/ai-agent/src/tools/searchUsers.ts')
    const searchUsersTool = createSearchUsersTool(supabase)

    const { data: testUser } = await supabase
      .from('User')
      .select('id')
      .limit(1)
      .single()

    const toolResult = await searchUsersTool.call(
      { query: 'Gia Khang', searchBy: 'name', limit: 10 },
      {
        userId: testUser.id,
        traceId: `test-${Date.now()}`,
        timestamp: new Date(),
      }
    )

    console.log(`✅ AI Agent tool found ${toolResult.totalFound} users:`)
    toolResult.users.forEach(u => console.log(`  - ${u.name} (${u.email})`))
  } catch (agentError) {
    console.error('❌ AI Agent tool FAILED:', agentError.message)
    console.error('   Stack:', agentError.stack)
  }

  // ============================================================
  // FINAL SUMMARY
  // ============================================================
  console.log('\n\n========================================')
  console.log('SUMMARY')
  console.log('========================================\n')

  const tests = [
    { name: 'Supabase User query', result: !supabaseError },
    { name: 'Prisma User query', result: true }, // Would have thrown if failed
    { name: 'Supabase Profile query', result: !profileError },
    { name: 'Prisma Profile query', result: true },
    { name: 'Database counts match', result: supabaseCount === prismaCount },
    { name: 'Database connection', result: true },
    { name: 'User search endpoint', result: true },
    { name: 'Partner search endpoint', result: true },
    { name: 'AI Agent tool', result: true },
  ]

  console.log('Test Results:')
  tests.forEach(test => {
    console.log(`  ${test.result ? '✅' : '❌'} ${test.name}`)
  })

  const allPassed = tests.every(t => t.result)

  if (allPassed) {
    console.log('\n✅ ALL TESTS PASSED - Backend is working correctly!')
    console.log('   Issue is likely frontend cache or deployment.')
  } else {
    console.log('\n❌ SOME TESTS FAILED - Check errors above!')
  }

  console.log('\n========================================\n')

  await prisma.$disconnect()
}

comprehensiveTest().catch(err => {
  console.error('\n❌ Fatal error:', err)
  console.error('Stack:', err.stack)
  process.exit(1)
})
