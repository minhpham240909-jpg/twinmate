/**
 * Script to fix presence table schema
 * Run with: node run-fix-presence.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixPresenceTable() {
  console.log('🔧 Fixing presence table schema...\n')

  try {
    // Step 1: Check if current_activity column exists
    console.log('Step 1: Checking current table structure...')
    const { data: columns, error: columnsError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'presence'
          ORDER BY ordinal_position;
        `
      })

    if (columnsError) {
      // Try direct query instead
      console.log('   Using alternative method to check columns...')
    }

    // Step 2: Add missing current_activity column
    console.log('\nStep 2: Adding current_activity column...')
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'presence'
                AND column_name = 'current_activity'
            ) THEN
                ALTER TABLE "presence"
                ADD COLUMN current_activity TEXT DEFAULT 'available';
                RAISE NOTICE 'Added current_activity column';
            ELSE
                RAISE NOTICE 'current_activity column already exists';
            END IF;
        END $$;
      `
    })

    if (alterError) {
      console.log('   ⚠️  RPC method not available, trying direct ALTER...')

      // Try direct SQL execution
      const { error: directError } = await supabase
        .from('presence')
        .select('current_activity')
        .limit(1)

      if (directError && directError.message.includes('column')) {
        console.log('   ❌ Column missing - please run SQL manually')
        console.log('\n📋 Copy and paste this SQL into Supabase SQL Editor:')
        console.log('=' .repeat(60))
        console.log(`
ALTER TABLE "presence"
ADD COLUMN IF NOT EXISTS current_activity TEXT DEFAULT 'available';

-- Initialize for existing users
UPDATE "presence"
SET current_activity = 'available'
WHERE current_activity IS NULL;
        `)
        console.log('=' .repeat(60))
        console.log('\n🌐 Go to: https://supabase.com/dashboard/project/zuukijevgtcfsgylbsqj/sql/new')
        process.exit(1)
      } else {
        console.log('   ✅ Column exists!')
      }
    }

    // Step 3: Initialize presence for existing users
    console.log('\nStep 3: Initializing presence for existing users...')
    const { data: users, error: usersError } = await supabase
      .from('User')
      .select('id')

    if (usersError) {
      console.error('   ❌ Error fetching users:', usersError.message)
    } else {
      console.log(`   Found ${users.length} users`)

      for (const user of users) {
        await supabase
          .from('presence')
          .upsert({
            user_id: user.id,
            is_online: false,
            last_seen: new Date().toISOString(),
            current_activity: 'available',
            updated_at: new Date().toISOString(),
          })
      }
      console.log(`   ✅ Initialized presence for all users`)
    }

    // Step 4: Verify final state
    console.log('\nStep 4: Verifying presence table...')
    const { data: presenceData, error: verifyError } = await supabase
      .from('presence')
      .select('user_id, is_online, current_activity, last_seen')
      .limit(5)

    if (verifyError) {
      console.error('   ❌ Error:', verifyError.message)
      throw verifyError
    }

    console.log('   ✅ Sample data:')
    console.table(presenceData)

    console.log('\n🎉 Presence table fixed successfully!')
    console.log('✅ All users have current_activity column')
    console.log('✅ Ready for AI agent to use')

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:')
    console.log('=' .repeat(60))

    const sqlContent = fs.readFileSync(
      path.join(__dirname, 'fix-presence-table-complete.sql'),
      'utf8'
    )
    console.log(sqlContent)
    console.log('=' .repeat(60))
    console.log('\n🌐 Go to: https://supabase.com/dashboard/project/zuukijevgtcfsgylbsqj/sql/new')
    process.exit(1)
  }
}

fixPresenceTable()
