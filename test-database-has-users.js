/**
 * Test if database actually has users
 * This will tell us if the problem is:
 * A) Empty database (no users exist)
 * B) Query problems (users exist but queries don't find them)
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.log('SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.log('SERVICE_KEY:', supabaseServiceKey ? '✅' : '❌')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkDatabase() {
  console.log('🔍 CHECKING DATABASE FOR USERS...\n')

  // Check 1: Count total users in User table
  const { data: allUsers, error: userError, count: userCount } = await supabase
    .from('User')
    .select('*', { count: 'exact' })
    .limit(10)

  console.log('📊 USER TABLE:')
  console.log('  Total users:', userCount || 0)
  if (userError) {
    console.error('  ❌ Error:', userError.message)
  } else if (allUsers && allUsers.length > 0) {
    console.log('  ✅ Sample users:')
    allUsers.forEach(user => {
      console.log(`     - ${user.name || 'No name'} (${user.email})`)
    })
  } else {
    console.log('  ⚠️  No users found in database!')
  }

  console.log()

  // Check 2: Count profiles
  const { data: allProfiles, error: profileError, count: profileCount } = await supabase
    .from('Profile')
    .select('*', { count: 'exact' })
    .limit(10)

  console.log('📊 PROFILE TABLE:')
  console.log('  Total profiles:', profileCount || 0)
  if (profileError) {
    console.error('  ❌ Error:', profileError.message)
  } else if (allProfiles && allProfiles.length > 0) {
    console.log('  ✅ Sample profiles:')
    allProfiles.forEach(profile => {
      console.log(`     - userId: ${profile.userId}`)
      console.log(`       subjects: ${profile.subjects?.join(', ') || 'none'}`)
      console.log(`       interests: ${profile.interests?.join(', ') || 'none'}`)
    })
  } else {
    console.log('  ⚠️  No profiles found in database!')
  }

  console.log()

  // Check 3: Test specific searches
  console.log('🔍 TEST SEARCHES:')

  // Search for "Gia Khang Pham"
  const { data: giaKhangResults } = await supabase
    .from('User')
    .select('id, name, email')
    .or('name.ilike.%Gia%,name.ilike.%Khang%,name.ilike.%Pham%')

  console.log('  Search "Gia Khang Pham":', giaKhangResults?.length || 0, 'results')
  if (giaKhangResults && giaKhangResults.length > 0) {
    giaKhangResults.forEach(u => console.log(`    - ${u.name} (${u.email})`))
  }

  // Search for users with Computer Science subject
  const { data: csProfiles } = await supabase
    .from('Profile')
    .select('userId, subjects')
    .contains('subjects', ['Computer Science'])

  console.log('  Users with "Computer Science":', csProfiles?.length || 0, 'results')

  console.log()

  // Check 4: Show ALL user names (to see what's actually in database)
  const { data: allNames } = await supabase
    .from('User')
    .select('name, email')
    .order('name')

  console.log('📋 ALL USERS IN DATABASE:')
  if (allNames && allNames.length > 0) {
    console.log(`  Total: ${allNames.length} users`)
    console.log()
    allNames.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.name || 'No name'} (${user.email})`)
    })
  } else {
    console.log('  ❌ DATABASE IS EMPTY - NO USERS EXIST!')
  }

  console.log()

  // DIAGNOSIS
  console.log('🎯 DIAGNOSIS:')
  if (userCount === 0 || profileCount === 0) {
    console.log('  ❌ PROBLEM: Database is empty or nearly empty!')
    console.log('  📝 Solution: You need to create user accounts first')
    console.log('     1. Sign up users through the app')
    console.log('     2. Have them complete their profiles')
    console.log('     3. Then AI agent will find them')
  } else if (userCount > 0 && profileCount === 0) {
    console.log('  ❌ PROBLEM: Users exist but have no profiles!')
    console.log('  📝 Solution: Users need to complete their profile setup')
  } else {
    console.log('  ✅ Database has users and profiles!')
    console.log('  📝 If searches still fail, it\'s a query/deployment issue')
  }
}

checkDatabase().catch(console.error)
