import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('Reading SQL files...')

  // Read the create tables SQL
  const createTablesSql = fs.readFileSync(
    path.join(process.cwd(), 'prisma', 'create_collaboration_tables.sql'),
    'utf-8'
  )

  console.log('Creating tables...')

  // Split by semicolons and execute each statement
  const statements = createTablesSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement)
      console.log('✓ Executed statement')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('⚠ Table/index already exists, skipping...')
      } else {
        console.error('✗ Error executing statement:', error.message)
        throw error
      }
    }
  }

  console.log('\n✓ Tables created successfully!')

  // Read and apply RLS policies
  const rlsSql = fs.readFileSync(
    path.join(process.cwd(), 'prisma', 'add_collaboration_rls.sql'),
    'utf-8'
  )

  console.log('\nApplying RLS policies...')

  const rlsStatements = rlsSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const statement of rlsStatements) {
    try {
      await prisma.$executeRawUnsafe(statement)
      console.log('✓ Executed RLS statement')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('⚠ Policy already exists, skipping...')
      } else {
        console.error('✗ Error executing RLS statement:', error.message)
        throw error
      }
    }
  }

  console.log('\n✓ RLS policies applied successfully!')
  console.log('\nVerifying tables exist...')

  // Verify tables were created
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename LIKE 'Session%'
    ORDER BY tablename
  `

  console.log('\nExisting Session tables:')
  tables.forEach(t => console.log(`  - ${t.tablename}`))

  console.log('\n🎉 Migration completed successfully!')
}

main()
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
