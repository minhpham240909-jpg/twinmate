/**
 * List all users in the database
 * GET /api/list-all-users
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get ALL users
    const { data: users, error } = await supabase
      .from('User')
      .select('id, name, email, createdAt')
      .order('createdAt', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      totalUsers: users?.length || 0,
      users: users?.map(u => ({
        name: u.name,
        email: u.email,
        createdAt: u.createdAt
      })) || []
    })

  } catch (error: any) {
    console.error('[LIST-USERS] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
