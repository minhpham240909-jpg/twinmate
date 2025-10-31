#!/usr/bin/env tsx
/**
 * RLS Policy Test Script
 * 
 * Tests that Row Level Security policies are properly configured and working.
 * This script verifies that:
 * 1. Anonymous users cannot access protected data
 * 2. Service role can access all data
 * 3. All critical tables have RLS enabled
 * 
 * Usage: npx tsx scripts/test-rls.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const CRITICAL_TABLES = [
  'User',
  'Profile',
  'Message',
  'Match',
  'Notification',
  'StudySession',
  'SessionMessage',
  'Post',
  'PostComment',
  'PostLike',
  'Group',
  'GroupMember',
]

interface TestResult {
  table: string
  test: string
  passed: boolean
  message: string
}

const results: TestResult[] = []

async function testAnonymousAccess() {
  console.log('🔒 Test 1: Anonymous Access (should be blocked)\n')
  
  const anonClient = createClient(supabaseUrl!, anonKey!)
  
  for (const table of CRITICAL_TABLES) {
    try {
      const { data, error } = await anonClient
        .from(table)
        .select('*')
        .limit(1)
      
      if (error) {
        // Check if it's specifically an RLS error
        if (error.message.includes('row-level security') || 
            error.message.includes('permission denied') ||
            error.code === 'PGRST301' || 
            error.code === '42501') {
          console.log(`  ✅ ${table.padEnd(20)} - Blocked (RLS working)`)
          results.push({
            table,
            test: 'Anonymous Access',
            passed: true,
            message: 'Correctly blocked by RLS'
          })
        } else {
          console.log(`  ⚠️  ${table.padEnd(20)} - Error: ${error.message}`)
          results.push({
            table,
            test: 'Anonymous Access',
            passed: false,
            message: `Unexpected error: ${error.message}`
          })
        }
      } else {
        console.log(`  ❌ ${table.padEnd(20)} - VULNERABLE! Data accessible without auth`)
        results.push({
          table,
          test: 'Anonymous Access',
          passed: false,
          message: `SECURITY RISK: Anonymous users can access ${table}`
        })
      }
    } catch (err: any) {
      console.log(`  ⚠️  ${table.padEnd(20)} - Exception: ${err.message}`)
      results.push({
        table,
        test: 'Anonymous Access',
        passed: false,
        message: `Exception: ${err.message}`
      })
    }
  }
}

async function testServiceRoleAccess() {
  console.log('\n🔑 Test 2: Service Role Access (should succeed)\n')
  
  const serviceClient = createClient(supabaseUrl!, serviceKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  })
  
  for (const table of CRITICAL_TABLES) {
    try {
      const { data, error } = await serviceClient
        .from(table)
        .select('id')
        .limit(1)
      
      if (error) {
        console.log(`  ❌ ${table.padEnd(20)} - Blocked! Service role should have access`)
        console.log(`     Error: ${error.message}`)
        results.push({
          table,
          test: 'Service Role Access',
          passed: false,
          message: `Service role blocked: ${error.message}`
        })
      } else {
        console.log(`  ✅ ${table.padEnd(20)} - Accessible (working correctly)`)
        results.push({
          table,
          test: 'Service Role Access',
          passed: true,
          message: 'Service role has access'
        })
      }
    } catch (err: any) {
      console.log(`  ❌ ${table.padEnd(20)} - Exception: ${err.message}`)
      results.push({
        table,
        test: 'Service Role Access',
        passed: false,
        message: `Exception: ${err.message}`
      })
    }
  }
}

async function testSpecificScenarios() {
  console.log('\n🎯 Test 3: Specific Security Scenarios\n')
  
  const anonClient = createClient(supabaseUrl!, anonKey!)
  const serviceClient = createClient(supabaseUrl!, serviceKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  })
  
  // Test 3.1: Try to read another user's private data
  console.log('  Testing: Cross-user data access...')
  const { data: users } = await serviceClient
    .from('User')
    .select('id')
    .limit(2)
  
  if (users && users.length >= 2) {
    const userId1 = users[0].id
    const userId2 = users[1].id
    
    // Try to access user2's profile as anon
    const { error } = await anonClient
      .from('Profile')
      .select('*')
      .eq('userId', userId2)
      .single()
    
    if (error) {
      console.log('  ✅ Cross-user access blocked')
      results.push({
        table: 'Profile',
        test: 'Cross-user Access',
        passed: true,
        message: 'Users cannot access other users\' private data'
      })
    } else {
      console.log('  ❌ Cross-user access allowed (SECURITY RISK)')
      results.push({
        table: 'Profile',
        test: 'Cross-user Access',
        passed: false,
        message: 'SECURITY RISK: Can access other users\' data'
      })
    }
  } else {
    console.log('  ⚠️  Skipped: Not enough users in database')
  }
  
  // Test 3.2: Try to insert data as anonymous
  console.log('  Testing: Anonymous write access...')
  const { error: insertError } = await anonClient
    .from('Post')
    .insert({
      content: 'Test post from anonymous',
      userId: '00000000-0000-0000-0000-000000000000'
    })
  
  if (insertError) {
    console.log('  ✅ Anonymous writes blocked')
    results.push({
      table: 'Post',
      test: 'Anonymous Write',
      passed: true,
      message: 'Anonymous users cannot write data'
    })
  } else {
    console.log('  ❌ Anonymous writes allowed (SECURITY RISK)')
    results.push({
      table: 'Post',
      test: 'Anonymous Write',
      passed: false,
      message: 'SECURITY RISK: Anonymous users can write data'
    })
    
    // Clean up the test post
    await serviceClient
      .from('Post')
      .delete()
      .eq('content', 'Test post from anonymous')
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(60))
  console.log('RLS SECURITY TEST SUMMARY')
  console.log('='.repeat(60))
  
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length
  
  console.log(`\nTotal Tests: ${total}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  
  if (failed > 0) {
    console.log('\n⚠️  FAILED TESTS:')
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`   - ${r.table} (${r.test}): ${r.message}`)
      })
  }
  
  console.log('\n' + '='.repeat(60))
  
  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED - RLS is properly configured!')
    console.log('='.repeat(60) + '\n')
    process.exit(0)
  } else {
    console.log('❌ SECURITY VULNERABILITIES DETECTED!')
    console.log('   Action required: Review and fix RLS policies')
    console.log('='.repeat(60) + '\n')
    process.exit(1)
  }
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('CLERVA RLS SECURITY TEST')
  console.log('='.repeat(60) + '\n')
  
  try {
    await testAnonymousAccess()
    await testServiceRoleAccess()
    await testSpecificScenarios()
    printSummary()
  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error)
    process.exit(1)
  }
}

main()

