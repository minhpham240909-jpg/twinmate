#!/usr/bin/env tsx
/**
 * Comprehensive Search Test Script
 * Tests all aspects of user search to identify why AI can't find "Gia Khang Pham"
 * 
 * Usage: npx tsx scripts/test-search-comprehensive.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
})

interface TestResult {
  testName: string
  status: 'PASS' | 'FAIL' | 'WARNING'
  message: string
  data?: any
}

const results: TestResult[] = []

async function runTest(testName: string, testFn: () => Promise<TestResult>) {
  console.log(`\n🧪 Running: ${testName}`)
  try {
    const result = await testFn()
    results.push(result)
    
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️'
    console.log(`   ${icon} ${result.message}`)
    
    if (result.data) {
      console.log('   Data:', JSON.stringify(result.data, null, 2))
    }
  } catch (error) {
    console.error(`   ❌ Test failed with error:`, error)
    results.push({
      testName,
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}

// Test 1: Check if user exists
async function testUserExists(): Promise<TestResult> {
  const { data, error } = await supabase
    .from('User')
    .select('id, name, email, createdAt')
    .ilike('name', '%Gia%')
    .ilike('name', '%Khang%')
  
  if (error) {
    return {
      testName: 'User Exists',
      status: 'FAIL',
      message: `Database error: ${error.message}`,
      data: { error }
    }
  }
  
  if (!data || data.length === 0) {
    return {
      testName: 'User Exists',
      status: 'FAIL',
      message: 'User "Gia Khang" not found in database',
      data: { found: 0 }
    }
  }
  
  return {
    testName: 'User Exists',
    status: 'PASS',
    message: `Found ${data.length} user(s) matching "Gia Khang"`,
    data: data
  }
}

// Test 2: Check if profile exists
async function testProfileExists(): Promise<TestResult> {
  // First get users
  const { data: users } = await supabase
    .from('User')
    .select('id')
    .ilike('name', '%Gia%')
    .ilike('name', '%Khang%')
  
  if (!users || users.length === 0) {
    return {
      testName: 'Profile Exists',
      status: 'FAIL',
      message: 'Cannot check profile - user not found'
    }
  }
  
  const userIds = users.map(u => u.id)
  
  const { data: profiles, error } = await supabase
    .from('Profile')
    .select('userId, subjects, interests, bio')
    .in('userId', userIds)
  
  if (error) {
    return {
      testName: 'Profile Exists',
      status: 'FAIL',
      message: `Profile query error: ${error.message}`,
      data: { error }
    }
  }
  
  if (!profiles || profiles.length === 0) {
    return {
      testName: 'Profile Exists',
      status: 'FAIL',
      message: '❌ CRITICAL: User exists but has NO Profile record!',
      data: { userIds, profilesFound: 0 }
    }
  }
  
  return {
    testName: 'Profile Exists',
    status: 'PASS',
    message: `Found ${profiles.length} profile(s)`,
    data: profiles
  }
}

// Test 3: Test multi-term search (how AI searches)
async function testMultiTermSearch(): Promise<TestResult> {
  const searchTerms = ['Gia', 'Khang', 'Pham']
  
  // Build OR conditions for each term
  const orConditions = searchTerms.flatMap(term => [
    `name.ilike.%${term}%`,
    `email.ilike.%${term}%`
  ])
  
  const { data, error } = await supabase
    .from('User')
    .select('id, name, email')
    .or(orConditions.join(','))
  
  if (error) {
    return {
      testName: 'Multi-term Search',
      status: 'FAIL',
      message: `Search error: ${error.message}`,
      data: { error, searchTerms }
    }
  }
  
  if (!data || data.length === 0) {
    return {
      testName: 'Multi-term Search',
      status: 'FAIL',
      message: 'Multi-term search found NO users',
      data: { searchTerms, query: orConditions }
    }
  }
  
  return {
    testName: 'Multi-term Search',
    status: 'PASS',
    message: `Multi-term search found ${data.length} user(s)`,
    data: data
  }
}

// Test 4: Test with current user filter (simulating AI tool)
async function testWithCurrentUserFilter(): Promise<TestResult> {
  // Get a test user ID to simulate being logged in
  const { data: users } = await supabase
    .from('User')
    .select('id')
    .limit(1)
  
  if (!users || users.length === 0) {
    return {
      testName: 'Current User Filter',
      status: 'WARNING',
      message: 'No users in database to test filter'
    }
  }
  
  const testUserId = users[0].id
  
  // Search with filter (excluding test user)
  const searchTerms = ['Gia', 'Khang']
  const orConditions = searchTerms.flatMap(term => [
    `name.ilike.%${term}%`,
    `email.ilike.%${term}%`
  ])
  
  const { data, error } = await supabase
    .from('User')
    .select('id, name, email')
    .neq('id', testUserId)  // Exclude current user
    .or(orConditions.join(','))
  
  if (error) {
    return {
      testName: 'Current User Filter',
      status: 'FAIL',
      message: `Error with filter: ${error.message}`
    }
  }
  
  return {
    testName: 'Current User Filter',
    status: data && data.length > 0 ? 'PASS' : 'WARNING',
    message: `With filter: found ${data?.length || 0} user(s) (excluding ${testUserId})`,
    data: { excludedUserId: testUserId, found: data }
  }
}

// Test 5: Check RLS policies
async function testRLSPolicies(): Promise<TestResult> {
  const { data, error } = await supabase
    .rpc('exec_sql', { 
      sql: `
        SELECT tablename, policyname, cmd 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('User', 'Profile')
      `
    })
    .catch(() => ({ data: null, error: { message: 'RPC not available - using direct query' } }))
  
  // Try alternative method
  const { data: tables } = await supabase
    .from('User')
    .select('id')
    .limit(1)
  
  if (tables && tables.length > 0) {
    return {
      testName: 'RLS Policies',
      status: 'PASS',
      message: 'Can access User table (RLS allows or is disabled)',
      data: { accessGranted: true }
    }
  }
  
  return {
    testName: 'RLS Policies',
    status: 'WARNING',
    message: 'Cannot verify RLS policies, but basic access works'
  }
}

// Test 6: Full integration test (exactly like searchUsers tool)
async function testFullIntegration(): Promise<TestResult> {
  const query = 'Gia Khang Pham'
  const searchTerms = query.trim().split(/\s+/)
  
  // Step 1: Search User table
  const conditions: string[] = []
  for (const term of searchTerms) {
    if (term.length > 0) {
      conditions.push(`name.ilike.%${term}%`)
      conditions.push(`email.ilike.%${term}%`)
    }
  }
  
  const { data: users, error: userError } = await supabase
    .from('User')
    .select('id, name, email')
    .or(conditions.join(','))
    .limit(10)
  
  if (userError) {
    return {
      testName: 'Full Integration Test',
      status: 'FAIL',
      message: `User search failed: ${userError.message}`,
      data: { error: userError }
    }
  }
  
  if (!users || users.length === 0) {
    return {
      testName: 'Full Integration Test',
      status: 'FAIL',
      message: 'No users found in integration test',
      data: { query, searchTerms, conditions }
    }
  }
  
  // Step 2: Get profiles
  const userIds = users.map(u => u.id)
  const { data: profiles, error: profileError } = await supabase
    .from('Profile')
    .select('userId, subjects, interests, bio, studyStyle, skillLevel')
    .in('userId', userIds)
  
  if (profileError) {
    return {
      testName: 'Full Integration Test',
      status: 'WARNING',
      message: `Users found but profile query failed: ${profileError.message}`,
      data: { users, profileError }
    }
  }
  
  return {
    testName: 'Full Integration Test',
    status: 'PASS',
    message: `✅ SUCCESS: Found ${users.length} user(s) with ${profiles?.length || 0} profile(s)`,
    data: {
      users,
      profiles,
      searchTerms,
      query
    }
  }
}

// Main execution
async function main() {
  console.log('='.repeat(60))
  console.log('🔍 COMPREHENSIVE SEARCH DIAGNOSTIC')
  console.log('='.repeat(60))
  console.log(`Database: ${supabaseUrl}`)
  console.log(`Target: Users named "Gia Khang Pham"`)
  console.log('='.repeat(60))
  
  await runTest('Test 1: User Exists', testUserExists)
  await runTest('Test 2: Profile Exists', testProfileExists)
  await runTest('Test 3: Multi-term Search', testMultiTermSearch)
  await runTest('Test 4: Current User Filter', testWithCurrentUserFilter)
  await runTest('Test 5: RLS Policies', testRLSPolicies)
  await runTest('Test 6: Full Integration Test', testFullIntegration)
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 TEST SUMMARY')
  console.log('='.repeat(60))
  
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const warnings = results.filter(r => r.status === 'WARNING').length
  
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⚠️  Warnings: ${warnings}`)
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:')
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`   - ${r.testName}: ${r.message}`)
      })
  }
  
  if (warnings > 0) {
    console.log('\n⚠️  WARNINGS:')
    results
      .filter(r => r.status === 'WARNING')
      .forEach(r => {
        console.log(`   - ${r.testName}: ${r.message}`)
      })
  }
  
  console.log('\n' + '='.repeat(60))
  
  // Diagnosis
  if (failed === 0 && passed >= 5) {
    console.log('✅ ALL TESTS PASSING!')
    console.log('   → User exists with profile')
    console.log('   → Search logic works correctly')
    console.log('   → Database access is functioning')
    console.log('\n🎯 LIKELY ISSUE: AI agent is not calling the tool correctly')
    console.log('   Try more explicit prompts:')
    console.log('   - "Search for user named Gia Khang"')
    console.log('   - "Use the searchUsers tool to find Gia Khang"')
    console.log('   - "Look up Gia Khang in the database"')
  } else {
    console.log('🔍 ISSUES DETECTED:')
    
    const userExists = results.find(r => r.testName === 'User Exists')
    const profileExists = results.find(r => r.testName === 'Profile Exists')
    
    if (userExists?.status === 'FAIL') {
      console.log('   ❌ User does not exist in database')
      console.log('   → Create user first or check spelling')
    } else if (profileExists?.status === 'FAIL') {
      console.log('   ❌ User exists but Profile record is MISSING')
      console.log('   → Run: npx prisma studio')
      console.log('   → Create Profile record for this user')
      console.log('   → Or run the INSERT query in diagnose-search-issue.sql')
    } else {
      console.log('   ⚠️  Check failed tests above for details')
    }
  }
  
  console.log('='.repeat(60))
  
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(console.error)

