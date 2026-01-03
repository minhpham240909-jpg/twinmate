// Admin Management API - List and manage admin users
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { adminRateLimit } from '@/lib/admin/rate-limit'

// GET - List all admin users
export async function GET(req: NextRequest) {
  try {
    // Apply rate limiting (users preset: 60 requests/minute)
    const rateLimitResult = await adminRateLimit(req, 'users')
    if (rateLimitResult) return rateLimitResult

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify admin status - CRITICAL: Also check deactivatedAt to prevent deactivated admins from accessing
    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, email: true, deactivatedAt: true },
    })

    // SECURITY: Deactivated admins should not have access
    if (!adminUser?.isAdmin || adminUser.deactivatedAt !== null) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Check if current user is super admin
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
    const isSuperAdmin = adminUser.email === superAdminEmail

    // Get all admin users
    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isAdmin: true,
        adminGrantedAt: true,
        adminGrantedBy: true,
        createdAt: true,
        lastLoginAt: true,
        twoFactorEnabled: true,
      },
      orderBy: { adminGrantedAt: 'desc' },
    })

    // Get who granted admin access (adminGrantedBy is a plain string ID, not a relation)
    // This is acceptable since the admin list is typically small (<100 users)
    const grantedByIds = admins
      .filter(a => a.adminGrantedBy)
      .map(a => a.adminGrantedBy as string)

    const granters = grantedByIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: grantedByIds } },
          select: { id: true, name: true, email: true },
        })
      : []

    const granterMap = new Map(granters.map(g => [g.id, g]))

    const adminsWithGranter = admins.map(admin => ({
      ...admin,
      isSuperAdmin: admin.email === superAdminEmail,
      grantedBy: admin.adminGrantedBy ? granterMap.get(admin.adminGrantedBy) : null,
    }))

    // SECURITY: Don't expose super admin email in response
    return NextResponse.json({
      success: true,
      data: {
        admins: adminsWithGranter,
        currentUserId: user.id,
        isSuperAdmin,
        // Removed superAdminEmail from response to prevent information disclosure
      },
    })
  } catch (error) {
    console.error('[Admin Admins] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
