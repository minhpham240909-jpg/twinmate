import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const { Client } = pg

async function runMigration() {
  // Use session mode pooler (port 5432) for DDL statements
  const client = new Client({
    host: 'aws-1-us-east-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.zuukijevgtcfsgylbsqj',
    password: 'Eminh2342009!!',
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    console.log('Connecting to database...')
    await client.connect()
    console.log('Connected!')

    const sqlPath = path.join(__dirname, '../prisma/migrations/enable_rls_only.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    console.log('Running migration...')
    await client.query(sql)
    console.log('Migration completed successfully!')

  } catch (error) {
    console.error('Migration error:', error.message)
    // If error is about already existing objects, that's OK
    if (error.message.includes('already exists')) {
      console.log('Some objects already exist, which is expected.')
    }
  } finally {
    await client.end()
    console.log('Connection closed.')
  }
}

runMigration()
