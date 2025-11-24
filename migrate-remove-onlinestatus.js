/**
 * Migration Script: Remove deprecated onlineStatus field from Profile table
 *
 * This script removes the legacy onlineStatus column and its index.
 * UserPresence.status is now the single source of truth for online status.
 */

const { PrismaClient } = require('@prisma/client')

// Use session mode connection for DDL operations
// Remove pgbouncer parameter to allow DDL commands
const sessionModeUrl = process.env.DATABASE_URL?.replace('?pgbouncer=true', '')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: sessionModeUrl || process.env.DATABASE_URL
    }
  }
})

async function runMigration() {
  console.log('🔄 Starting migration: Remove onlineStatus from Profile table...\n')

  try {
    // Step 1: Drop the index on onlineStatus (if it exists)
    console.log('Step 1: Dropping index on onlineStatus...')
    await prisma.$executeRawUnsafe(`
      DROP INDEX IF EXISTS "Profile_onlineStatus_idx";
    `)
    console.log('✅ Index dropped successfully\n')

    // Step 2: Drop the onlineStatus column from Profile table
    console.log('Step 2: Dropping onlineStatus column from Profile table...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Profile" DROP COLUMN IF EXISTS "onlineStatus";
    `)
    console.log('✅ Column dropped successfully\n')

    // Step 3: Verify the changes
    console.log('Step 3: Verifying migration...')
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Profile'
      AND column_name = 'onlineStatus';
    `)

    if (result.length === 0) {
      console.log('✅ VERIFICATION PASSED: onlineStatus column has been removed\n')
      console.log('🎉 Migration completed successfully!')
      console.log('   - Dropped index: Profile_onlineStatus_idx')
      console.log('   - Dropped column: Profile.onlineStatus')
      console.log('   - UserPresence.status is now the single source of truth\n')
    } else {
      throw new Error('VERIFICATION FAILED: onlineStatus column still exists')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error('\nFull error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('✅ Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error)
    process.exit(1)
  })
