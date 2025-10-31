/**
 * Run the missing migration to add school and languages columns
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

async function runMigration() {
  console.log('\n========================================')
  console.log('Running Missing Migration')
  console.log('========================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  console.log('1. Checking if school and languages columns exist...')

  // Try to select these columns to see if they exist
  const { data: testData, error: testError } = await supabase
    .from('Profile')
    .select('userId, school, languages')
    .limit(1)

  if (testError) {
    if (testError.message.includes('school') || testError.message.includes('languages')) {
      console.log('❌ Columns missing! Running migration...\n')

      // Run the migration
      console.log('2. Adding school column...')
      const { error: error1 } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "school" TEXT'
      })

      if (error1) {
        console.error('❌ Failed to add school column:', error1)
      } else {
        console.log('✅ School column added')
      }

      console.log('3. Adding languages column...')
      const { error: error2 } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "languages" TEXT'
      })

      if (error2) {
        console.error('❌ Failed to add languages column:', error2)
      } else {
        console.log('✅ Languages column added')
      }

      // Verify the columns were added
      console.log('\n4. Verifying migration...')
      const { data: verifyData, error: verifyError } = await supabase
        .from('Profile')
        .select('userId, school, languages')
        .limit(1)

      if (verifyError) {
        console.error('❌ Verification failed:', verifyError.message)
      } else {
        console.log('✅ Migration successful! Columns now exist.')
        console.log('Sample data:', verifyData?.[0])
      }
    } else {
      console.error('❌ Unexpected error:', testError.message)
    }
  } else {
    console.log('✅ Columns already exist! No migration needed.')
    console.log('Sample data:', testData?.[0])
  }

  console.log('\n========================================\n')
}

runMigration().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
