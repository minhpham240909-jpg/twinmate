/**
 * Test if Prisma can connect to database
 */

const { PrismaClient } = require('@prisma/client')
require('dotenv').config({ path: '.env.local' })

async function testPrisma() {
  console.log('\n========================================')
  console.log('Testing Prisma Database Connection')
  console.log('========================================\n')

  console.log('Environment variables:')
  console.log('  DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...')
  console.log('  DIRECT_URL:', process.env.DIRECT_URL?.substring(0, 50) + '...')
  console.log('')

  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  })

  try {
    console.log('Test 1: Simple database query')
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Connection works! Result:', result)

    console.log('\nTest 2: Count users')
    const userCount = await prisma.user.count()
    console.log(`✅ Found ${userCount} users in database`)

    console.log('\nTest 3: Search for "Gia Khang"')
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: 'Gia', mode: 'insensitive' } },
          { name: { contains: 'Khang', mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      take: 5,
    })
    console.log(`✅ Found ${users.length} users:`)
    users.forEach(u => console.log(`  - ${u.name} (${u.email})`))

    console.log('\nTest 4: Profile search')
    const profiles = await prisma.profile.findMany({
      where: {
        subjects: {
          hasSome: ['Computer Science'],
        },
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      take: 3,
    })
    console.log(`✅ Found ${profiles.length} profiles with Computer Science:`)
    profiles.forEach(p => console.log(`  - ${p.user.name}`))

    console.log('\n========================================')
    console.log('✅ ALL PRISMA TESTS PASSED!')
    console.log('========================================\n')

  } catch (error) {
    console.error('\n❌ PRISMA CONNECTION FAILED!')
    console.error('Error:', error.message)
    console.error('\nFull error:', error)
    console.error('\n========================================\n')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testPrisma()
