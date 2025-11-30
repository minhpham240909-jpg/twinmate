import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

async function runMigration() {
  console.log('Connecting via Prisma...')

  const sqlPath = path.join(__dirname, '../prisma/migrations/enable_rls_only.sql')
  const fullSql = fs.readFileSync(sqlPath, 'utf8')

  // Split into individual statements
  const statements = fullSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 10 && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements to execute`)

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    if (!stmt) continue

    const preview = stmt.slice(0, 60).replace(/\n/g, ' ')
    console.log(`\n[${i + 1}/${statements.length}] ${preview}...`)

    try {
      await prisma.$executeRawUnsafe(stmt)
      console.log('  ✓ Success')
      successCount++
    } catch (error) {
      const msg = error.message || ''
      if (msg.includes('already exists') ||
          msg.includes('duplicate') ||
          msg.includes('does not exist') ||
          msg.includes('42710') ||
          msg.includes('42P07')) {
        console.log('  ⚠ Skipped (already exists or N/A)')
        skipCount++
      } else {
        console.log(`  ✗ Error: ${msg.slice(0, 100)}`)
        errorCount++
      }
    }
  }

  console.log(`\n========================================`)
  console.log(`Migration completed!`)
  console.log(`  ✓ Success: ${successCount}`)
  console.log(`  ⚠ Skipped: ${skipCount}`)
  console.log(`  ✗ Errors:  ${errorCount}`)
  console.log(`========================================`)

  await prisma.$disconnect()
}

runMigration().catch(async (e) => {
  console.error('Migration failed:', e)
  await prisma.$disconnect()
  process.exit(1)
})
