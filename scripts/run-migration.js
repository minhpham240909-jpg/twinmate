const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function runMigration() {
  try {
    console.log('🚀 Starting database migration...')
    console.log('📊 Adding 2FA and account deactivation fields to User table...\n')

    // Add deactivation fields
    console.log('1️⃣ Adding deactivation fields...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deactivationReason" TEXT;
    `)
    console.log('   ✅ Deactivation fields added')

    // Add 2FA fields
    console.log('\n2️⃣ Adding 2FA fields...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
    `)
    console.log('   ✅ 2FA fields added')

    // Create indexes
    console.log('\n3️⃣ Creating indexes for better performance...')
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "User_deactivatedAt_idx" ON "User"("deactivatedAt");
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "User_twoFactorEnabled_idx" ON "User"("twoFactorEnabled");
    `)
    console.log('   ✅ Indexes created')

    // Verify migration
    console.log('\n4️⃣ Verifying migration...')
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'User'
      AND column_name IN ('deactivatedAt', 'deactivationReason', 'twoFactorEnabled', 'twoFactorSecret', 'twoFactorBackupCodes')
      ORDER BY column_name;
    `
    console.log('   ✅ Verification results:')
    console.table(result)

    console.log('\n✅ Migration completed successfully!')
    console.log('📝 Next step: Run "npx prisma generate" to update Prisma client')

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

runMigration()
  .then(() => {
    console.log('\n🎉 All done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Error:', error)
    process.exit(1)
  })
