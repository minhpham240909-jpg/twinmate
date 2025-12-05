// Admin Management API - List and manage admin users
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET - List all admin users
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify admin status
    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, email: true },
    })

    if (!adminUser?.isAdmin) {
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

    // Get who granted admin access
    const grantedByIds = admins
      .filter(a => a.adminGrantedBy)
      .map(a => a.adminGrantedBy as string)

    const granters = await prisma.user.findMany({
      where: { id: { in: grantedByIds } },
      select: { id: true, name: true, email: true },
    })

    const granterMap = new Map(granters.map(g => [g.id, g]))

    const adminsWithGranter = admins.map(admin => ({
      ...admin,
      isSuperAdmin: admin.email === superAdminEmail,
      grantedBy: admin.adminGrantedBy ? granterMap.get(admin.adminGrantedBy) : null,
    }))

    return NextResponse.json({
      success: true,
      data: {
        admins: adminsWithGranter,
        currentUserId: user.id,
        isSuperAdmin,
        superAdminEmail,
      },
    })
  } catch (error) {
    console.error('[Admin Admins] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
