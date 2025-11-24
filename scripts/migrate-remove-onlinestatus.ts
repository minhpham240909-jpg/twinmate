/**
 * Migration Script: Remove deprecated onlineStatus field from Profile table
 *
 * This script removes the legacy onlineStatus column and its index.
 * UserPresence.status is now the single source of truth for online status.
 *
 * Usage: npx tsx scripts/migrate-remove-onlinestatus.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'

// Load environment variables from .env files (try .env.local first, then .env)
const envLocalPath = resolve(__dirname, '../.env.local')
const envPath = resolve(__dirname, '../.env')

config({ path: envLocalPath })
if (!process.env.DATABASE_URL) {
  config({ path: envPath })
}

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set')
  console.error('   Checked paths:')
  console.error('   - ', envLocalPath)
  console.error('   - ', envPath)
  process.exit(1)
}

console.log('✅ Environment variables loaded')
console.log(`   Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('?')[0] || 'unknown'}\n`)

const prisma = new PrismaClient()

async function runMigration() {
  console.log('🔄 Starting migration: Remove onlineStatus from Profile table...\n')

  try {
    // Step 1: Drop the index on onlineStatus (if it exists)
    console.log('Step 1: Dropping index on onlineStatus...')
    try {
      await prisma.$executeRawUnsafe(`
        DROP INDEX IF EXISTS "Profile_onlineStatus_idx";
      `)
      console.log('✅ Index dropped successfully\n')
    } catch (error: any) {
      if (error.message.includes('does not exist')) {
        console.log('ℹ️  Index does not exist (already removed or never existed)\n')
      } else {
        console.log('⚠️  Index drop warning:', error.message, '\n')
      }
    }

    // Step 2: Drop the onlineStatus column from Profile table
    console.log('Step 2: Dropping onlineStatus column from Profile table...')
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Profile" DROP COLUMN IF EXISTS "onlineStatus";
      `)
      console.log('✅ Column dropped successfully\n')
    } catch (error: any) {
      if (error.message.includes('does not exist')) {
        console.log('ℹ️  Column does not exist (already removed)\n')
      } else {
        throw error
      }
    }

    // Step 3: Verify the changes
    console.log('Step 3: Verifying migration...')
    const result = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Profile'
      AND column_name = 'onlineStatus';
      `
    )

    if (result.length === 0) {
      console.log('✅ VERIFICATION PASSED: onlineStatus column has been removed\n')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🎉 Migration completed successfully!')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('✅ Dropped index: Profile_onlineStatus_idx')
      console.log('✅ Dropped column: Profile.onlineStatus')
      console.log('✅ UserPresence.status is now the single source of truth')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    } else {
      throw new Error('VERIFICATION FAILED: onlineStatus column still exists in the database')
    }

  } catch (error: any) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ Migration failed')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('Error:', error.message)
    console.error('\nFull error:', error)
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('✅ Migration script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error.message)
    process.exit(1)
  })
