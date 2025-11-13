const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function runMigration() {
  // Use the pooler connection (remove pgbouncer parameter for raw SQL)
  const connectionString = process.env.DATABASE_URL.replace('?pgbouncer=true', '')

  const client = new Client({
    connectionString,
  })

  try {
    console.log('🚀 Connecting to Supabase database...')
    await client.connect()
    console.log('✅ Connected successfully!\n')

    console.log('📊 Running migration: Adding 2FA and account deactivation fields...\n')

    // Add deactivation fields
    console.log('1️⃣ Adding deactivation fields...')
    await client.query(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);
    `)
    await client.query(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deactivationReason" TEXT;
    `)
    console.log('   ✅ Deactivation fields added')

    // Add 2FA fields
    console.log('\n2️⃣ Adding 2FA fields...')
    await client.query(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
    `)
    await client.query(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
    `)
    await client.query(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
    `)
    console.log('   ✅ 2FA fields added')

    // Create indexes
    console.log('\n3️⃣ Creating indexes for better performance...')
    await client.query(`
      CREATE INDEX IF NOT EXISTS "User_deactivatedAt_idx" ON "User"("deactivatedAt");
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS "User_twoFactorEnabled_idx" ON "User"("twoFactorEnabled");
    `)
    console.log('   ✅ Indexes created')

    // Verify migration
    console.log('\n4️⃣ Verifying migration...')
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'User'
      AND column_name IN ('deactivatedAt', 'deactivationReason', 'twoFactorEnabled', 'twoFactorSecret', 'twoFactorBackupCodes')
      ORDER BY column_name;
    `)

    console.log('   ✅ Verification results:')
    console.table(result.rows)

    console.log('\n✅ Migration completed successfully!')
    console.log('\n📝 New columns added to User table:')
    console.log('   - deactivatedAt (timestamp)')
    console.log('   - deactivationReason (text)')
    console.log('   - twoFactorEnabled (boolean)')
    console.log('   - twoFactorSecret (text)')
    console.log('   - twoFactorBackupCodes (text array)')

    console.log('\n📝 Next step: Run "npx prisma generate" to update Prisma client')

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message)
    throw error
  } finally {
    await client.end()
    console.log('\n🔌 Database connection closed')
  }
}

runMigration()
  .then(() => {
    console.log('\n🎉 All done! Your database is ready for 2FA and account management features!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Error:', error)
    process.exit(1)
  })
