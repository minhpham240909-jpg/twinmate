/**
 * Check actual database schema
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkSchema() {
  console.log('🔍 Checking actual database schema...\n')

  // Check User table
  console.log('User table columns:')
  const { data: users, error: usersError } = await supabase
    .from('User')
    .select('*')
    .limit(1)

  if (usersError) {
    console.log('  ERROR:', usersError.message)
  } else if (users && users.length > 0) {
    console.log('  Columns:', Object.keys(users[0]).join(', '))
  }

  // Check Profile table
  console.log('\nProfile table columns:')
  const { data: profiles, error: profilesError } = await supabase
    .from('Profile')
    .select('*')
    .limit(1)

  if (profilesError) {
    console.log('  ERROR:', profilesError.message)
  } else if (profiles && profiles.length > 0) {
    console.log('  Columns:', Object.keys(profiles[0]).join(', '))
  }

  // Check Session table
  console.log('\nSession table columns:')
  const { data: sessions, error: sessionsError } = await supabase
    .from('Session')
    .select('*')
    .limit(1)

  if (sessionsError) {
    console.log('  ERROR:', sessionsError.message)
  } else if (sessions && sessions.length > 0) {
    console.log('  Columns:', Object.keys(sessions[0]).join(', '))
  }
}

checkSchema()
