/**
 * Test Supabase .not() syntax which might be causing the error
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function testNotSyntax() {
  console.log('🧪 Testing Supabase .not() syntax')

  try {
    // Get a test user
    const { data: users } = await supabase
      .from('User')
      .select('id')
      .limit(1)

    if (!users || users.length === 0) {
      console.log('No users found')
      return
    }

    const testUserId = users[0].id
    const pendingUserIds = new Set(['fake-id-1', 'fake-id-2'])

    console.log('\n=== TEST 1: Current syntax (might be wrong) ===')
    try {
      let query1 = supabase
        .from('Profile')
        .select('userId')
        .neq('userId', testUserId)

      if (pendingUserIds.size > 0) {
        query1 = query1.not('userId', 'in', `(${Array.from(pendingUserIds).join(',')})`)
      }

      query1 = query1.limit(5)

      const { data, error } = await query1

      if (error) {
        console.error('❌ ERROR with current syntax:', error.message)
        console.error('Details:', error)
      } else {
        console.log('✅ Current syntax works, found:', data?.length, 'profiles')
      }
    } catch (err) {
      console.error('❌ Exception with current syntax:', err.message)
    }

    console.log('\n=== TEST 2: Correct Supabase syntax ===')
    try {
      let query2 = supabase
        .from('Profile')
        .select('userId')
        .neq('userId', testUserId)

      if (pendingUserIds.size > 0) {
        // Correct syntax: use .not('userId', 'in', `(id1,id2,id3)`)
        // without the outer parentheses in the string
        query2 = query2.not('userId', 'in', `(${Array.from(pendingUserIds).join(',')})`)
      }

      query2 = query2.limit(5)

      const { data, error } = await query2

      if (error) {
        console.error('❌ ERROR with test 2:', error.message)
      } else {
        console.log('✅ Test 2 works, found:', data?.length, 'profiles')
      }
    } catch (err) {
      console.error('❌ Exception with test 2:', err.message)
    }

    console.log('\n=== TEST 3: Alternative syntax with negated in() ===')
    try {
      let query3 = supabase
        .from('Profile')
        .select('userId')
        .neq('userId', testUserId)

      if (pendingUserIds.size > 0) {
        // Alternative: Negate the .in() filter
        const idsArray = Array.from(pendingUserIds)
        query3 = query3.not('userId', 'in', `(${idsArray.join(',')})`)
      }

      query3 = query3.limit(5)

      const { data, error } = await query3

      if (error) {
        console.error('❌ ERROR with test 3:', error.message)
      } else {
        console.log('✅ Test 3 works, found:', data?.length, 'profiles')
      }
    } catch (err) {
      console.error('❌ Exception with test 3:', err.message)
    }

    console.log('\n=== TEST 4: With real user IDs (if any matches exist) ===')
    try {
      // Get actual matches
      const { data: matches } = await supabase
        .from('Match')
        .select('senderId, receiverId, status')
        .or(`senderId.eq.${testUserId},receiverId.eq.${testUserId}`)
        .limit(5)

      console.log('Found', matches?.length || 0, 'matches for test user')

      if (matches && matches.length > 0) {
        const realPendingIds = new Set()
        matches.forEach(match => {
          const otherUserId = match.senderId === testUserId ? match.receiverId : match.senderId
          if (match.status !== 'ACCEPTED') {
            realPendingIds.add(otherUserId)
          }
        })

        console.log('Pending/rejected user IDs:', Array.from(realPendingIds))

        if (realPendingIds.size > 0) {
          let query4 = supabase
            .from('Profile')
            .select('userId')
            .neq('userId', testUserId)
            .not('userId', 'in', `(${Array.from(realPendingIds).join(',')})`)
            .limit(5)

          const { data, error } = await query4

          if (error) {
            console.error('❌ ERROR with real IDs:', error.message)
            console.error('Full error:', error)
          } else {
            console.log('✅ Query with real IDs works, found:', data?.length, 'profiles')
          }
        }
      }
    } catch (err) {
      console.error('❌ Exception with test 4:', err.message)
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testNotSyntax().catch(console.error)
