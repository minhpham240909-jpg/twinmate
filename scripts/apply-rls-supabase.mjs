import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SUPABASE_URL = 'https://zuukijevgtcfsgylbsqj.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1dWtpamV2Z3RjZnNneWxic3FqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIwMTcwOCwiZXhwIjoyMDc0Nzc3NzA4fQ.VNXNMCBCAJ8Oae6_-O6W85FyhjWPm9aSR4HgoOMWoP4'

async function executeSql(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`SQL execution failed: ${text}`)
  }

  return response.json()
}

async function runMigration() {
  console.log('Reading SQL file...')
  const sqlPath = path.join(__dirname, '../prisma/migrations/add_activity_tracking.sql')
  const fullSql = fs.readFileSync(sqlPath, 'utf8')

  // Split into individual statements (handle DO blocks specially)
  const statements = []
  let currentStatement = ''
  let inDoBlock = false

  for (const line of fullSql.split('\n')) {
    const trimmedLine = line.trim()

    // Skip comments
    if (trimmedLine.startsWith('--') && !inDoBlock) continue

    // Track DO blocks
    if (trimmedLine.startsWith('DO $$')) {
      inDoBlock = true
    }

    currentStatement += line + '\n'

    if (inDoBlock && trimmedLine === 'END $$;') {
      statements.push(currentStatement.trim())
      currentStatement = ''
      inDoBlock = false
    } else if (!inDoBlock && trimmedLine.endsWith(';')) {
      statements.push(currentStatement.trim())
      currentStatement = ''
    }
  }

  console.log(`Found ${statements.length} SQL statements to execute`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    if (!stmt || stmt.length < 5) continue

    console.log(`\nExecuting statement ${i + 1}/${statements.length}...`)
    console.log(`Preview: ${stmt.slice(0, 80)}...`)

    try {
      await executeSql(stmt)
      console.log(`✓ Statement ${i + 1} executed successfully`)
    } catch (error) {
      // Some errors are expected (already exists, etc.)
      if (error.message.includes('already exists') ||
          error.message.includes('duplicate') ||
          error.message.includes('42710')) {
        console.log(`⚠ Statement ${i + 1}: Object already exists (OK)`)
      } else {
        console.error(`✗ Statement ${i + 1} failed:`, error.message)
      }
    }
  }

  console.log('\n✓ Migration completed!')
}

runMigration().catch(console.error)
