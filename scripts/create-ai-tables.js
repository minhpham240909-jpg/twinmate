/**
 * Create AI Agent Tables - Simple Script
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

async function createTables() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables')
    console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'set' : 'missing')
    console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'set' : 'missing')
    process.exit(1)
  }

  console.log('🔄 Creating AI agent tables...')

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Read SQL file
  const sqlPath = path.join(__dirname, '../prisma/migrations/add_ai_agent_tables.sql')
  const sql = fs.readFileSync(sqlPath, 'utf-8')

  // Split into statements (basic split by semicolon)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && s !== '')

  console.log(`📋 Found ${statements.length} SQL statements`)

  let successCount = 0
  let skipCount = 0

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]

    // Skip comments and empty
    if (statement.startsWith('--') || statement.trim() === '') {
      continue
    }

    try {
      // Use raw query
      const { error } = await supabase.rpc('exec', { sql_query: statement })

      if (error) {
        // Check if it's "already exists" error
        if (error.message.includes('already exists') || error.code === '42P07') {
          skipCount++
          console.log(`⏭️  Skipped (already exists): ${statement.substring(0, 50)}...`)
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error.message)
        }
      } else {
        successCount++
        console.log(`✅ Success ${i + 1}/${statements.length}`)
      }
    } catch (err) {
      if (err.message?.includes('already exists')) {
        skipCount++
      } else {
        console.error(`❌ Exception:`, err.message)
      }
    }
  }

  console.log(`\n✅ Migration complete!`)
  console.log(`   - Success: ${successCount}`)
  console.log(`   - Skipped: ${skipCount}`)
  console.log(`   - Total: ${statements.length}`)

  // Verify tables
  const tables = ['agent_memory', 'agent_task', 'availability_block', 'match_candidate']
  console.log('\n🔍 Verifying tables...')

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1)

    if (error) {
      console.log(`   ❌ ${table}: ${error.message}`)
    } else {
      console.log(`   ✅ ${table}: exists`)
    }
  }
}

createTables().catch(console.error)
