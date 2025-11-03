/**
 * Test if diacritics are the problem
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testSearch() {
  console.log('🔍 TESTING DIACRITIC SEARCH\n')

  // Test 1: Search with exact diacritics
  console.log('Test 1: Search "Gia Khang Phạm" (WITH diacritics)')
  const { data: test1 } = await supabase
    .from('User')
    .select('name, email')
    .or('name.ilike.%Gia%,name.ilike.%Khang%,name.ilike.%Phạm%')

  console.log('  Results:', test1?.length || 0)
  test1?.forEach(u => console.log(`    - ${u.name}`))

  console.log()

  // Test 2: Search WITHOUT diacritics
  console.log('Test 2: Search "Gia Khang Pham" (WITHOUT diacritics)')
  const { data: test2 } = await supabase
    .from('User')
    .select('name, email')
    .or('name.ilike.%Gia%,name.ilike.%Khang%,name.ilike.%Pham%')

  console.log('  Results:', test2?.length || 0)
  test2?.forEach(u => console.log(`    - ${u.name}`))

  console.log()

  // Test 3: Search for "Computer Science"
  console.log('Test 3: Search subjects for "Computer Science"')
  const { data: test3 } = await supabase
    .from('Profile')
    .select('userId, subjects')
    .contains('subjects', ['Computer Science'])

  console.log('  Results:', test3?.length || 0)

  // Also try with overlap
  const { data: test3b } = await supabase
    .from('Profile')
    .select('userId, subjects')
    .overlaps('subjects', ['Computer Science'])

  console.log('  Results (with overlaps):', test3b?.length || 0)

  console.log()
  console.log('🎯 DIAGNOSIS:')
  if ((test1?.length || 0) > (test2?.length || 0)) {
    console.log('  ❌ PROBLEM: Diacritics are preventing matches!')
    console.log('  📝 "Phạm" ≠ "Pham" in current search')
    console.log('  🔧 Need to make search diacritic-insensitive')
  } else {
    console.log('  ✅ Diacritics are OK')
  }
}

testSearch().catch(console.error)
