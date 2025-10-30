/**
 * Test endpoint to verify searchUsers tool works
 * GET /api/test-search-users?query=Gia
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('query') || 'Gia'

    console.log('[TEST] Searching for:', query)

    const supabase = await createClient()

    // Get current user (if logged in)
    const { data: { user } } = await supabase.auth.getUser()
    const currentUserId = user?.id

    // STEP 1: Search User table
    let userQuery = supabase
      .from('User')
      .select('id, name, email, createdAt')
      .limit(20)

    // Exclude current user if logged in
    if (currentUserId) {
      userQuery = userQuery.neq('id', currentUserId)
    }

    // Search by name or email
    userQuery = userQuery.or(`name.ilike.%${query}%,email.ilike.%${query}%`)

    const { data: users, error: userError } = await userQuery

    console.log('[TEST] User search result:', {
      query,
      found: users?.length || 0,
      error: userError?.message,
      users: users?.map(u => ({ id: u.id, name: u.name }))
    })

    if (userError) {
      return NextResponse.json({
        success: false,
        error: userError.message,
        step: 'user_search'
      }, { status: 500 })
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users found',
        query,
        step: 'user_search',
        found: 0
      })
    }

    // STEP 2: Get Profile data
    const userIds = users.map(u => u.id)
    const { data: profiles, error: profileError } = await supabase
      .from('Profile')
      .select('userId, subjects, interests, goals, studyStyle, skillLevel, onlineStatus')
      .in('userId', userIds)

    console.log('[TEST] Profile search result:', {
      found: profiles?.length || 0,
      error: profileError?.message
    })

    // Map profiles
    const profileMap = new Map(
      profiles?.map(p => [p.userId, p]) || []
    )

    // Combine results
    const results = users.map(user => {
      const profile = profileMap.get(user.id)
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        hasProfile: !!profile,
        subjects: profile?.subjects || [],
        interests: profile?.interests || [],
        goals: profile?.goals || [],
        studyStyle: profile?.studyStyle,
        skillLevel: profile?.skillLevel,
        onlineStatus: profile?.onlineStatus
      }
    })

    return NextResponse.json({
      success: true,
      query,
      found: results.length,
      currentUserId,
      results
    })

  } catch (error: any) {
    console.error('[TEST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
