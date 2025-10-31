/**
 * Test the EXACT query from /api/partners/search
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function testExactPartnerQuery() {
  console.log('🧪 Testing EXACT /api/partners/search query\n')

  try {
    // Get a test user
    const { data: users } = await supabase
      .from('User')
      .select('id, name')
      .limit(1)

    if (!users || users.length === 0) {
      console.log('No users found')
      return
    }

    const testUserId = users[0].id
    console.log('✅ Test user:', users[0].name, `(${testUserId})`)

    // Test 1: Simple query without join
    console.log('\n=== TEST 1: Profile query WITHOUT User join ===')
    try {
      const { data, error } = await supabase
        .from('Profile')
        .select('userId, subjects, interests')
        .neq('userId', testUserId)
        .limit(5)

      if (error) {
        console.error('❌ ERROR:', error.message)
        console.error('Details:', error)
      } else {
        console.log('✅ Works! Found', data?.length, 'profiles')
      }
    } catch (err) {
      console.error('❌ Exception:', err.message)
    }

    // Test 2: Query WITH User!inner join (this might be the problem)
    console.log('\n=== TEST 2: Profile query WITH User!inner join (EXACT from route.ts) ===')
    try {
      const { data, error } = await supabase
        .from('Profile')
        .select(`
          userId,
          subjects,
          interests,
          goals,
          studyStyle,
          skillLevel,
          availableDays,
          availableHours,
          bio,
          school,
          languages,
          aboutYourself,
          aboutYourselfItems,
          subjectCustomDescription,
          skillLevelCustomDescription,
          studyStyleCustomDescription,
          interestsCustomDescription,
          availabilityCustomDescription,
          updatedAt,
          user:User!inner(
            id,
            name,
            email,
            avatarUrl,
            role,
            createdAt
          )
        `)
        .neq('userId', testUserId)
        .limit(5)

      if (error) {
        console.error('❌ ERROR WITH JOIN:', error.message)
        console.error('Error code:', error.code)
        console.error('Error hint:', error.hint)
        console.error('Error details:', error.details)
        console.error('Full error:', JSON.stringify(error, null, 2))
      } else {
        console.log('✅ Join works! Found', data?.length, 'profiles')
        if (data && data.length > 0) {
          console.log('Sample profile:', JSON.stringify(data[0], null, 2))
        }
      }
    } catch (err) {
      console.error('❌ Exception with join:', err.message)
      console.error('Full exception:', err)
    }

    // Test 3: Check foreign key relationship exists
    console.log('\n=== TEST 3: Verify Profile -> User relationship ===')
    try {
      const { data: profiles } = await supabase
        .from('Profile')
        .select('userId')
        .limit(1)

      if (profiles && profiles.length > 0) {
        const { data: user } = await supabase
          .from('User')
          .select('id, name')
          .eq('id', profiles[0].userId)
          .single()

        if (user) {
          console.log('✅ Relationship exists: Profile.userId -> User.id')
          console.log('Profile userId:', profiles[0].userId)
          console.log('User found:', user.name)
        } else {
          console.log('⚠️  Profile exists but no matching User found')
        }
      }
    } catch (err) {
      console.error('❌ Relationship check error:', err.message)
    }

    // Test 4: Try alternative join syntax
    console.log('\n=== TEST 4: Alternative join syntax (User:userId) ===')
    try {
      const { data, error } = await supabase
        .from('Profile')
        .select(`
          userId,
          subjects,
          User!Profile_userId_fkey(id, name, email)
        `)
        .neq('userId', testUserId)
        .limit(5)

      if (error) {
        console.error('❌ ERROR:', error.message)
      } else {
        console.log('✅ Alternative syntax works! Found', data?.length, 'profiles')
      }
    } catch (err) {
      console.error('❌ Exception:', err.message)
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testExactPartnerQuery().catch(console.error)
