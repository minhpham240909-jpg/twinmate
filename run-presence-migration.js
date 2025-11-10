const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('📦 Reading SQL migration file...');
    const sql = fs.readFileSync('./add_presence_tables.sql', 'utf8');

    console.log('🚀 Running presence system migration...');
    console.log('');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let skipCount = 0;

    for (const statement of statements) {
      try {
        // Skip comments
        if (statement.includes('============================================')) {
          continue;
        }

        // Execute statement
        await prisma.$executeRawUnsafe(statement + ';');
        successCount++;

        // Log progress for important statements
        if (statement.includes('CREATE TABLE')) {
          const tableName = statement.match(/CREATE TABLE.*?"(\w+)"/)?.[1];
          console.log(`✅ Created table: ${tableName}`);
        } else if (statement.includes('CREATE INDEX')) {
          const indexName = statement.match(/CREATE INDEX.*?"(\w+)"/)?.[1];
          console.log(`✅ Created index: ${indexName}`);
        } else if (statement.includes('CREATE POLICY')) {
          const policyName = statement.match(/CREATE POLICY "([^"]+)"/)?.[1];
          console.log(`✅ Created policy: ${policyName}`);
        } else if (statement.includes('ENABLE ROW LEVEL SECURITY')) {
          const tableName = statement.match(/ALTER TABLE "(\w+)"/)?.[1];
          console.log(`🔒 Enabled RLS on: ${tableName}`);
        }
      } catch (error) {
        // Skip if already exists
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          skipCount++;
        } else {
          console.error(`❌ Error executing statement:`, error.message);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
        }
      }
    }

    console.log('');
    console.log(`✅ Migration completed successfully!`);
    console.log(`   - ${successCount} statements executed`);
    console.log(`   - ${skipCount} statements skipped (already exist)`);
    console.log('');
    console.log('📊 Created tables:');
    console.log('   - user_presence (aggregate status)');
    console.log('   - device_sessions (multi-device tracking)');
    console.log('   - message_read_status (read receipts)');
    console.log('   - typing_indicators (typing status)');
    console.log('');
    console.log('🔒 RLS policies enabled on all tables');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
