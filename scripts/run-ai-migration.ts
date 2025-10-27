/**
 * Run AI Agent Tables Migration
 * Executes SQL to add agent_memory, agent_task, availability_block, match_candidate
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function runMigration() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log('🔄 Running AI Agent tables migration...')

  const sqlPath = join(process.cwd(), 'prisma/migrations/add_ai_agent_tables.sql')
  const sql = readFileSync(sqlPath, 'utf-8')

  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  let successCount = 0
  let errorCount = 0

  for (const statement of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement })

      if (error) {
        // Try direct query if RPC fails
        const { error: directError } = await (supabase as any).from('_').rpc(statement)

        if (directError && !directError.message.includes('already exists')) {
          console.error(`❌ Error:`, directError.message.substring(0, 100))
          errorCount++
        } else {
          successCount++
        }
      } else {
        successCount++
      }
    } catch (err: any) {
      if (!err.message?.includes('already exists')) {
        console.error(`❌ Statement error:`, err.message?.substring(0, 100))
        errorCount++
      } else {
        successCount++
      }
    }
  }

  console.log(`\n✅ Migration complete: ${successCount} statements succeeded, ${errorCount} errors`)

  // Verify tables exist
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .in('table_name', ['agent_memory', 'agent_task', 'availability_block', 'match_candidate'])

  if (!tablesError && tables) {
    console.log(`\n📊 Tables created: ${tables.map((t: any) => t.table_name).join(', ')}`)
  }
}

runMigration().catch(console.error)
