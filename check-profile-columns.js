/**
 * Check if Profile table has the new columns
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function checkColumns() {
  console.log('\n========================================')
  console.log('Checking Profile Table Columns')
  console.log('========================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const adminSupabase = createClient(supabaseUrl, serviceKey)

  // Try to select with NEW fields
  console.log('Test 1: Select with NEW fields (school, languages, aboutYourself, aboutYourselfItems)')
  const { data: withNew, error: errorNew } = await adminSupabase
    .from('Profile')
    .select('userId, school, languages, aboutYourself, aboutYourselfItems')
    .limit(1)

  if (errorNew) {
    console.error('❌ ERROR with new fields:', errorNew.message)
    console.error('Details:', errorNew)
  } else {
    console.log('✅ NEW fields exist! Sample:', withNew?.[0])
  }

  // Try to select with OLD fields only
  console.log('\n\nTest 2: Select with OLD fields only')
  const { data: withOld, error: errorOld } = await adminSupabase
    .from('Profile')
    .select('userId, subjects, interests, goals, studyStyle, skillLevel')
    .limit(1)

  if (errorOld) {
    console.error('❌ ERROR with old fields:', errorOld.message)
  } else {
    console.log('✅ OLD fields work! Sample:', withOld?.[0])
  }

  console.log('\n========================================\n')
}

checkColumns().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
