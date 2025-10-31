/**
 * Check if school and languages columns exist in production database
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function checkColumns() {
  console.log('\n========================================')
  console.log('Checking for Missing Columns')
  console.log('========================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Test 1: Try selecting all fields including school and languages
  console.log('Test 1: Select all profile fields (including school, languages)')
  console.log('================================================================')

  const { data: allFields, error: allError } = await supabase
    .from('Profile')
    .select('userId, subjects, interests, goals, studyStyle, skillLevel, bio, school, languages, aboutYourself, aboutYourselfItems')
    .limit(1)

  if (allError) {
    console.error('❌ ERROR selecting all fields:')
    console.error('   Message:', allError.message)
    console.error('   Details:', allError.details)
    console.error('   Hint:', allError.hint)

    if (allError.message.includes('school')) {
      console.error('\n❗ PROBLEM: "school" column does NOT exist in database!')
    }
    if (allError.message.includes('languages')) {
      console.error('❗ PROBLEM: "languages" column does NOT exist in database!')
    }
  } else {
    console.log('✅ All fields exist!')
    console.log('   Sample data:', allFields?.[0])
  }

  // Test 2: Try selecting without school and languages
  console.log('\n\nTest 2: Select without school and languages')
  console.log('================================================================')

  const { data: noNewFields, error: noNewError } = await supabase
    .from('Profile')
    .select('userId, subjects, interests, goals, studyStyle, skillLevel, bio, aboutYourself, aboutYourselfItems')
    .limit(1)

  if (noNewError) {
    console.error('❌ ERROR even without school/languages:', noNewError.message)
  } else {
    console.log('✅ Works without school/languages')
    console.log('   Sample data:', noNewFields?.[0])
  }

  // Test 3: Try selecting only school
  console.log('\n\nTest 3: Try selecting ONLY school column')
  console.log('================================================================')

  const { data: onlySchool, error: schoolError } = await supabase
    .from('Profile')
    .select('userId, school')
    .limit(1)

  if (schoolError) {
    console.error('❌ school column does NOT exist')
    console.error('   Error:', schoolError.message)
  } else {
    console.log('✅ school column exists')
    console.log('   Data:', onlySchool?.[0])
  }

  // Test 4: Try selecting only languages
  console.log('\n\nTest 4: Try selecting ONLY languages column')
  console.log('================================================================')

  const { data: onlyLang, error: langError } = await supabase
    .from('Profile')
    .select('userId, languages')
    .limit(1)

  if (langError) {
    console.error('❌ languages column does NOT exist')
    console.error('   Error:', langError.message)
  } else {
    console.log('✅ languages column exists')
    console.log('   Data:', onlyLang?.[0])
  }

  console.log('\n\n========================================')
  console.log('SUMMARY')
  console.log('========================================')

  let missingColumns = []
  if (schoolError) missingColumns.push('school')
  if (langError) missingColumns.push('languages')

  if (missingColumns.length > 0) {
    console.log('❌ MISSING COLUMNS:', missingColumns.join(', '))
    console.log('\n🔧 SOLUTION:')
    console.log('   Run these SQL commands in Supabase SQL Editor:')
    console.log('')
    if (schoolError) {
      console.log('   ALTER TABLE "Profile" ADD COLUMN "school" TEXT;')
    }
    if (langError) {
      console.log('   ALTER TABLE "Profile" ADD COLUMN "languages" TEXT;')
    }
    console.log('')
    console.log('   Or go to: https://supabase.com/dashboard/project/[your-project]/sql')
  } else {
    console.log('✅ All required columns exist!')
  }

  console.log('========================================\n')
}

checkColumns().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
