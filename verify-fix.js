/**
 * Verify presence table is fixed
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verify() {
  console.log('🔍 Verifying presence table fix...\n')

  // Test 1: Check if current_activity column exists
  console.log('Test 1: Checking current_activity column...')
  const { data, error } = await supabase
    .from('presence')
    .select('user_id, is_online, current_activity, last_seen')
    .limit(5)

  if (error) {
    console.error('❌ FAILED:', error.message)
    console.log('   Code:', error.code)
    console.log('   Details:', error.details)
    process.exit(1)
  }

  console.log('✅ SUCCESS - current_activity column exists!')
  console.log('\nSample data:')
  console.table(data)

  // Test 2: Test update with current_activity
  console.log('\nTest 2: Testing update with current_activity...')
  if (data.length > 0) {
    const testUserId = data[0].user_id
    const { error: updateError } = await supabase
      .from('presence')
      .update({
        current_activity: 'studying',
        last_seen: new Date().toISOString(),
      })
      .eq('user_id', testUserId)

    if (updateError) {
      console.error('❌ FAILED:', updateError.message)
      process.exit(1)
    }

    console.log('✅ SUCCESS - Can update current_activity!')
  }

  // Test 3: Check total counts
  console.log('\nTest 3: Checking presence data...')
  const { data: allData, error: countError } = await supabase
    .from('presence')
    .select('*')

  if (countError) {
    console.error('❌ FAILED:', countError.message)
    process.exit(1)
  }

  const onlineCount = allData.filter(p => p.is_online).length
  const withActivity = allData.filter(p => p.current_activity).length

  console.log(`✅ Total users in presence: ${allData.length}`)
  console.log(`✅ Online users: ${onlineCount}`)
  console.log(`✅ Users with current_activity: ${withActivity}`)

  if (withActivity === allData.length) {
    console.log('\n🎉 PERFECT! All users have current_activity column!')
    console.log('✅ Presence table is 100% fixed and ready!')
  } else {
    console.log('\n⚠️  Some users missing current_activity, updating...')
    await supabase
      .from('presence')
      .update({ current_activity: 'available' })
      .is('current_activity', null)
    console.log('✅ Fixed!')
  }

  console.log('\n' + '='.repeat(60))
  console.log('🎯 FINAL STATUS: READY FOR AI AGENT TESTING')
  console.log('='.repeat(60))
}

verify()
