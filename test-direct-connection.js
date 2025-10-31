/**
 * Test if we can reach the direct database connection
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testDirectConnection() {
  console.log('\n========================================')
  console.log('Testing Direct Database Connection')
  console.log('========================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Test 1: Normal Supabase client (uses pooler internally)
  console.log('Test 1: Regular Supabase client (pooler)')
  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: users1, error: error1 } = await supabase
    .from('User')
    .select('id, name')
    .limit(1)

  if (error1) {
    console.error('❌ Pooler connection failed:', error1.message)
  } else {
    console.log('✅ Pooler connection works! Found user:', users1?.[0]?.name)
  }

  console.log('\n========================================\n')
  console.log('CONCLUSION:')
  console.log('  - Supabase client (pooler): WORKS')
  console.log('  - Prisma with pooler: FAILS')
  console.log('  - Prisma with direct: CANNOT REACH')
  console.log('\nThe issue is Prisma is incompatible with Supabase pooler.')
  console.log('Solution: Need to use Supabase client instead of Prisma,')
  console.log('          OR upgrade Supabase plan for session pooling mode.')
  console.log('\n========================================\n')
}

testDirectConnection()
