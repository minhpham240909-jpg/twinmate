/**
 * Quick script to test Redis connection
 * Run with: npx tsx scripts/test-redis.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { Redis } from '@upstash/redis'

async function testRedis() {
  console.log('🔍 Testing Upstash Redis connection...\n')

  // Check if environment variables are set
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    console.error('❌ Missing environment variables:')
    console.error('   UPSTASH_REDIS_REST_URL:', url ? '✓ Set' : '✗ Missing')
    console.error('   UPSTASH_REDIS_REST_TOKEN:', token ? '✓ Set' : '✗ Missing')
    process.exit(1)
  }

  console.log('✓ Environment variables found')
  console.log('  URL:', url.substring(0, 30) + '...')

  try {
    // Create Redis client
    const redis = new Redis({ url, token })

    // Test 1: Simple SET/GET
    console.log('\n📝 Test 1: SET/GET...')
    const testKey = 'test:connection:' + Date.now()
    await redis.set(testKey, { message: 'Hello from Clerva!', timestamp: new Date().toISOString() }, { ex: 60 })
    const result = await redis.get(testKey)
    console.log('   SET:', testKey)
    console.log('   GET:', JSON.stringify(result))
    console.log('   ✓ SET/GET working!')

    // Test 2: Increment
    console.log('\n📝 Test 2: INCR...')
    const counterKey = 'test:counter:' + Date.now()
    const count1 = await redis.incr(counterKey)
    const count2 = await redis.incr(counterKey)
    console.log('   First INCR:', count1)
    console.log('   Second INCR:', count2)
    console.log('   ✓ INCR working!')

    // Test 3: Delete
    console.log('\n📝 Test 3: DEL...')
    await redis.del(testKey, counterKey)
    const deleted = await redis.get(testKey)
    console.log('   After DEL:', deleted)
    console.log('   ✓ DEL working!')

    // Test 4: Check latency
    console.log('\n📝 Test 4: Latency check...')
    const start = Date.now()
    await redis.ping()
    const latency = Date.now() - start
    console.log('   PING latency:', latency + 'ms')
    console.log('   ✓ Latency:', latency < 100 ? 'Excellent!' : latency < 300 ? 'Good' : 'Consider closer region')

    console.log('\n✅ All Redis tests passed! Your cache layer is ready.\n')

  } catch (error) {
    console.error('\n❌ Redis connection failed:')
    console.error('  ', error instanceof Error ? error.message : error)
    console.error('\nTroubleshooting:')
    console.error('  1. Check if your Upstash Redis database is active')
    console.error('  2. Verify the URL and token are correct')
    console.error('  3. Make sure you\'re using REST API credentials (not Redis protocol)')
    process.exit(1)
  }
}

testRedis()
