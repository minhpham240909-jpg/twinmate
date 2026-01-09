// Admin Check API - Verify if current user is an admin
// SECURITY: Admins must have 2FA enabled and active session
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

// Admin session timeout: 30 minutes of inactivity
const ADMIN_SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const ADMIN_SESSION_COOKIE = 'admin_session_ts'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { isAdmin: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Check if user is admin with 2FA status
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        isAdmin: true,
        name: true,
        email: true,
        avatarUrl: true,
        adminGrantedAt: true,
        deactivatedAt: true,
        twoFactorEnabled: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json(
        { isAdmin: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // User must be admin and not deactivated
    const isAdminUser = dbUser.isAdmin === true && dbUser.deactivatedAt === null

    if (!isAdminUser) {
      return NextResponse.json({
        isAdmin: false,
        user: null,
      })
    }

    // SECURITY: Require 2FA for all admin users
    if (!dbUser.twoFactorEnabled) {
      return NextResponse.json({
        isAdmin: false,
        requires2FASetup: true,
        error: 'Two-factor authentication is required for admin access. Please enable 2FA in your security settings.',
        user: {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
        },
      })
    }

    // SECURITY: Check admin session timeout (30 min inactivity)
    const cookieStore = await cookies()
    const adminSessionTs = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
    const now = Date.now()

    if (adminSessionTs) {
      const lastActivity = parseInt(adminSessionTs, 10)
      if (!isNaN(lastActivity) && now - lastActivity > ADMIN_SESSION_TIMEOUT_MS) {
        // Session expired due to inactivity
        // Clear the admin session cookie
        const response = NextResponse.json({
          isAdmin: false,
          sessionExpired: true,
          error: 'Admin session expired due to inactivity. Please refresh to continue.',
        })
        response.cookies.delete(ADMIN_SESSION_COOKIE)
        return response
      }
    }

    // Update admin session timestamp (sliding window)
    const response = NextResponse.json({
      isAdmin: true,
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        avatarUrl: dbUser.avatarUrl,
        adminGrantedAt: dbUser.adminGrantedAt,
        twoFactorEnabled: dbUser.twoFactorEnabled,
      },
      sessionTimeout: ADMIN_SESSION_TIMEOUT_MS,
    })

    // Set/refresh admin session cookie with new timestamp
    response.cookies.set(ADMIN_SESSION_COOKIE, now.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/admin',
      maxAge: ADMIN_SESSION_TIMEOUT_MS / 1000, // Cookie expires when session should timeout
    })

    return response
  } catch (error) {
    console.error('[Admin Check] Error:', error)
    return NextResponse.json(
      { isAdmin: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
