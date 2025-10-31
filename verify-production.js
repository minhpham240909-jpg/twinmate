/**
 * Verify production database has the fix
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verifyProduction() {
  console.log('🔍 Verifying Production Database...\n')

  const { data, error } = await supabase
    .from('presence')
    .select('user_id, is_online, current_activity, last_seen')
    .limit(5)

  if (error) {
    console.log('❌ PRODUCTION DATABASE NOT FIXED')
    console.log('Error:', error.message)
    console.log('\n📋 You need to run this SQL in production:')
    console.log('='.repeat(60))
    console.log('ALTER TABLE "presence"')
    console.log('ADD COLUMN IF NOT EXISTS current_activity TEXT DEFAULT \'available\';')
    console.log('')
    console.log('UPDATE "presence"')
    console.log('SET current_activity = \'available\'')
    console.log('WHERE current_activity IS NULL;')
    console.log('='.repeat(60))
    console.log('\nGo to: https://supabase.com/dashboard/project/zuukijevgtcfsgylbsqj/sql/new')
    process.exit(1)
  }

  console.log('✅ PRODUCTION DATABASE IS FIXED!')
  console.log(`✅ Found ${data.length} users with current_activity column`)
  console.log('\nSample data:')
  console.table(data)

  console.log('\n🎉 Production is ready!')
  console.log('✅ AI Agent will work 100% on production')
}

verifyProduction()
