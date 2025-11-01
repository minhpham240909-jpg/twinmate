/**
 * Check actual profile data in database
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function checkProfileData() {
  console.log('🔍 Checking Profile Data for Minh Pham\n')

  try {
    const { data: user } = await supabase
      .from('User')
      .select('id, name, email')
      .eq('email', 'minhpham240909@gmail.com')
      .single()

    if (!user) {
      console.error('❌ User not found')
      return
    }

    console.log('👤 User:', user.name, `(${user.email})`)
    console.log('ID:', user.id)
    console.log('')

    const { data: profile, error } = await supabase
      .from('Profile')
      .select('*')
      .eq('userId', user.id)
      .single()

    if (error || !profile) {
      console.error('❌ Profile not found!')
      return
    }

    console.log('📋 COMPLETE PROFILE DATA:')
    console.log('='.repeat(80))
    console.log(JSON.stringify(profile, null, 2))
    console.log('')
    console.log('='.repeat(80))
    console.log('CRITICAL MATCHING FIELDS:')
    console.log('='.repeat(80))
    console.log('✓ subjects:', profile.subjects)
    console.log('✓ interests:', profile.interests)
    console.log('✓ goals:', profile.goals)
    console.log('✓ studyStyle:', profile.studyStyle)
    console.log('✓ skillLevel:', profile.skillLevel)
    console.log('✓ bio:', profile.bio || '(empty)')
    console.log('✓ school:', profile.school || '(empty)')
    console.log('✓ languages:', profile.languages || '(empty)')
    console.log('')

    // Check if fields are actually populated
    const issues = []
    if (!profile.subjects || profile.subjects.length === 0) {
      issues.push('❌ Subjects is empty/null')
    }
    if (!profile.interests || profile.interests.length === 0) {
      issues.push('❌ Interests is empty/null')
    }
    if (!profile.goals || profile.goals.length === 0) {
      issues.push('❌ Goals is empty/null')
    }

    if (issues.length > 0) {
      console.log('⚠️  ISSUES FOUND:')
      issues.forEach(issue => console.log('   ' + issue))
      console.log('\nThese empty fields reduce matching quality.')
      console.log('Go to Profile Settings and add:')
      console.log('  1. Subjects you want to study')
      console.log('  2. Your interests')
      console.log('  3. Your learning goals')
    } else {
      console.log('✅ Profile is complete!')
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

checkProfileData().catch(console.error)
