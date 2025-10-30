/**
 * Debug endpoint: Check who is currently logged in
 * GET /api/debug-current-user
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      return NextResponse.json({
        success: false,
        error: authError.message,
        authenticated: false
      })
    }
    
    if (!user) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        message: 'No user logged in'
      })
    }
    
    // Get user details from database
    const { data: dbUser, error: dbError } = await supabase
      .from('User')
      .select('id, name, email, role')
      .eq('id', user.id)
      .single()
    
    return NextResponse.json({
      success: true,
      authenticated: true,
      authUserId: user.id,
      authEmail: user.email,
      dbUser: dbUser || null,
      note: 'The searchUsers tool will NOT show this user in results (filtered out)'
    })
    
  } catch (error: any) {
    console.error('[DEBUG-USER] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

