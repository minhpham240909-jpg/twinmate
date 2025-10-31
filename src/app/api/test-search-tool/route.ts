/**
 * Test endpoint to verify searchUsers tool works in production
 * Access: /api/test-search-tool?query=Gia%20Khang%20Pham
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSearchUsersTool } from '@/../packages/ai-agent/src/tools/searchUsers'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('query') || 'test'
    const searchBy = searchParams.get('searchBy') || 'all'

    console.log('[test-search-tool] Testing with query:', query)

    // Create Supabase client (service role)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({
        error: 'Missing environment variables',
        supabaseUrl: !!supabaseUrl,
        serviceKey: !!serviceKey
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Test 1: Direct database query
    console.log('[test-search-tool] Test 1: Direct DB query')
    const searchTerms = query.trim().split(/\s+/)
    const conditions: string[] = []
    for (const term of searchTerms) {
      if (term.length > 0) {
        conditions.push(`name.ilike.%${term}%`)
        conditions.push(`email.ilike.%${term}%`)
      }
    }

    const { data: directUsers, error: directError } = await supabase
      .from('User')
      .select('id, name, email')
      .or(conditions.join(','))
      .limit(10)

    console.log('[test-search-tool] Direct query result:', {
      found: directUsers?.length || 0,
      error: directError?.message
    })

    // Test 2: Using searchUsers tool
    console.log('[test-search-tool] Test 2: Using searchUsers tool')
    const searchUsersTool = createSearchUsersTool(supabase)

    // Mock context (use first user found or a dummy ID)
    const mockUserId = directUsers?.[0]?.id || '00000000-0000-0000-0000-000000000000'

    const toolResult = await searchUsersTool.call(
      { query, searchBy, limit: 10 },
      { userId: mockUserId, conversationHistory: [] }
    )

    console.log('[test-search-tool] Tool result:', {
      totalFound: toolResult.totalFound,
      userCount: toolResult.users.length
    })

    return NextResponse.json({
      success: true,
      query,
      searchBy,
      directQueryResults: {
        found: directUsers?.length || 0,
        users: directUsers?.map(u => ({ name: u.name, email: u.email })) || [],
        error: directError?.message
      },
      toolResults: {
        totalFound: toolResult.totalFound,
        users: toolResult.users.map(u => ({
          name: u.name,
          email: u.email,
          subjects: u.subjects,
          goals: u.goals
        }))
      }
    })

  } catch (error: any) {
    console.error('[test-search-tool] Error:', error)
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
