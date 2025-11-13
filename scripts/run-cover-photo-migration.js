const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// Load .env.local file
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

async function runMigration() {
  const connectionString = process.env.DATABASE_URL?.replace('?pgbouncer=true', '')

  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables')
    process.exit(1)
  }

  const client = new Client({ connectionString })

  try {
    console.log('🚀 Connecting to Supabase database...')
    await client.connect()
    console.log('✅ Connected successfully!\n')

    console.log('📊 Running migration: Adding coverPhotoUrl column...\n')

    // Add coverPhotoUrl column
    console.log('1️⃣ Adding coverPhotoUrl column...')
    await client.query(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coverPhotoUrl" TEXT;
    `)
    console.log('   ✅ coverPhotoUrl column added\n')

    console.log('2️⃣ Verifying migration...')
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'User' AND column_name = 'coverPhotoUrl';
    `)
    console.log('   ✅ Verification results:')
    console.table(result.rows)

    console.log('✅ Migration completed successfully!\n')
    console.log('📝 New column added to User table:')
    console.log('   - coverPhotoUrl (text)\n')

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  } finally {
    await client.end()
    console.log('🔌 Database connection closed\n')
    console.log('🎉 All done! Your database is ready for cover photos!')
  }
}

runMigration()
