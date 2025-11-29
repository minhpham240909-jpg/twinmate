// Admin Users API - Manage users
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin/utils'
import { handlePrivilegeChange } from '@/lib/security/session-rotation'
import logger from '@/lib/logger'

// GET - List users with search, filter, and pagination
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify admin status
    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const status = searchParams.get('status') || '' // active, deactivated, banned
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (role === 'FREE' || role === 'PREMIUM') {
      where.role = role
    }

    if (status === 'active') {
      where.deactivatedAt = null
    } else if (status === 'deactivated') {
      where.deactivatedAt = { not: null }
    }

    // Execute query
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          isAdmin: true,
          emailVerified: true,
          googleId: true,
          createdAt: true,
          lastLoginAt: true,
          deactivatedAt: true,
          deactivationReason: true,
          twoFactorEnabled: true,
          _count: {
            select: {
              sentMessages: true,
              posts: true,
              groupMemberships: true,
              studySessions: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    // Check for active bans
    const userIds = users.map((u) => u.id)
    const bans = await prisma.userBan.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, type: true, expiresAt: true },
    })

    const banMap = new Map(bans.map((b) => [b.userId, b]))

    const usersWithBanInfo = users.map((user) => ({
      ...user,
      signupMethod: user.googleId ? 'google' : 'email',
      ban: banMap.get(user.id) || null,
    }))

    return NextResponse.json({
      success: true,
      data: {
        users: usersWithBanInfo,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          limit,
        },
      },
    })
  } catch (error) {
    console.error('[Admin Users] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Admin actions on users (ban, unban, warn, etc.)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify admin status
    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { action, userId, reason, duration, severity } = body

    if (!action || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // SECURITY: Prevent self-actions
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot perform admin actions on yourself' },
        { status: 403 }
      )
    }

    // SECURITY: Check if target is an admin (for protected actions)
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, adminGrantedBy: true },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // SECURITY: Super-admin protection
    // CEO/Super-admin email - only this user can grant/revoke admin rights
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
    const actingAdmin = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true },
    })
    const isSuperAdmin = actingAdmin?.email === superAdminEmail

    // Protected actions that require super-admin for targeting other admins
    const protectedActions = ['ban', 'warn', 'deactivate', 'grant_admin', 'revoke_admin']

    if (protectedActions.includes(action)) {
      // Only super-admin can take protected actions on other admins
      if (targetUser.isAdmin && !isSuperAdmin) {
        return NextResponse.json(
          { error: 'Only the super-admin can perform this action on other administrators' },
          { status: 403 }
        )
      }

      // Admin grant/revoke always requires super-admin
      if ((action === 'grant_admin' || action === 'revoke_admin') && !isSuperAdmin) {
        return NextResponse.json(
          { error: 'Only the super-admin can grant or revoke admin privileges' },
          { status: 403 }
        )
      }
    }

    // Get IP and user agent for audit log
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    switch (action) {
      case 'ban': {
        // Create ban record
        const expiresAt = duration
          ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
          : null

        await prisma.userBan.upsert({
          where: { userId },
          create: {
            userId,
            issuedById: user.id,
            type: duration ? 'TEMPORARY' : 'PERMANENT',
            reason: reason || 'No reason provided',
            expiresAt,
          },
          update: {
            issuedById: user.id,
            type: duration ? 'TEMPORARY' : 'PERMANENT',
            reason: reason || 'No reason provided',
            expiresAt,
            updatedAt: new Date(),
          },
        })

        // SECURITY: Rotate session to immediately invalidate banned user's access
        await handlePrivilegeChange(userId, { accountStatusChanged: true })

        await logAdminAction({
          adminId: user.id,
          action: 'user_banned',
          targetType: 'user',
          targetId: userId,
          details: { reason, duration, banType: duration ? 'temporary' : 'permanent' },
          ipAddress,
          userAgent,
        })

        return NextResponse.json({ success: true, message: 'User banned' })
      }

      case 'unban': {
        await prisma.userBan.delete({
          where: { userId },
        })

        await logAdminAction({
          adminId: user.id,
          action: 'user_unbanned',
          targetType: 'user',
          targetId: userId,
          details: { reason },
          ipAddress,
          userAgent,
        })

        return NextResponse.json({ success: true, message: 'User unbanned' })
      }

      case 'warn': {
        await prisma.userWarning.create({
          data: {
            userId,
            issuedById: user.id,
            reason: reason || 'No reason provided',
            severity: severity || 1,
          },
        })

        await logAdminAction({
          adminId: user.id,
          action: 'user_warned',
          targetType: 'user',
          targetId: userId,
          details: { reason, severity },
          ipAddress,
          userAgent,
        })

        return NextResponse.json({ success: true, message: 'Warning issued' })
      }

      case 'deactivate': {
        await prisma.user.update({
          where: { id: userId },
          data: {
            deactivatedAt: new Date(),
            deactivationReason: reason || 'Deactivated by admin',
          },
        })

        // SECURITY: Rotate session to immediately invalidate deactivated user's access
        await handlePrivilegeChange(userId, { accountStatusChanged: true })

        await logAdminAction({
          adminId: user.id,
          action: 'user_deactivated',
          targetType: 'user',
          targetId: userId,
          details: { reason },
          ipAddress,
          userAgent,
        })

        return NextResponse.json({ success: true, message: 'User deactivated' })
      }

      case 'reactivate': {
        await prisma.user.update({
          where: { id: userId },
          data: {
            deactivatedAt: null,
            deactivationReason: null,
          },
        })

        await logAdminAction({
          adminId: user.id,
          action: 'user_reactivated',
          targetType: 'user',
          targetId: userId,
          details: { reason },
          ipAddress,
          userAgent,
        })

        return NextResponse.json({ success: true, message: 'User reactivated' })
      }

      case 'grant_admin': {
        await prisma.user.update({
          where: { id: userId },
          data: {
            isAdmin: true,
            adminGrantedAt: new Date(),
            adminGrantedBy: user.id,
          },
        })

        // SECURITY: Rotate session to reflect new admin privileges
        await handlePrivilegeChange(userId, { adminStatusChanged: true })

        await logAdminAction({
          adminId: user.id,
          action: 'admin_granted',
          targetType: 'user',
          targetId: userId,
          details: {},
          ipAddress,
          userAgent,
        })

        logger.info('Admin access granted', { data: { targetUserId: userId, grantedBy: user.id } })
        return NextResponse.json({ success: true, message: 'Admin access granted' })
      }

      case 'revoke_admin': {
        await prisma.user.update({
          where: { id: userId },
          data: {
            isAdmin: false,
            adminGrantedAt: null,
            adminGrantedBy: null,
          },
        })

        // SECURITY: Rotate session to immediately revoke admin privileges
        await handlePrivilegeChange(userId, { adminStatusChanged: true })

        await logAdminAction({
          adminId: user.id,
          action: 'admin_revoked',
          targetType: 'user',
          targetId: userId,
          details: {},
          ipAddress,
          userAgent,
        })

        logger.info('Admin access revoked', { data: { targetUserId: userId, revokedBy: user.id } })
        return NextResponse.json({ success: true, message: 'Admin access revoked' })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Admin Users] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
