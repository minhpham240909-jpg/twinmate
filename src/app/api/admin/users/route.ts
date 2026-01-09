// Admin Users API - Manage users
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin/utils'
import { handlePrivilegeChange } from '@/lib/security/session-rotation'
import logger from '@/lib/logger'
import { adminRateLimit } from '@/lib/admin/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'

// GET - List users with search, filter, and pagination
export async function GET(request: NextRequest) {
  // SCALABILITY: Rate limit admin user list requests
  const rateLimitResult = await adminRateLimit(request, 'users')
  if (rateLimitResult) return rateLimitResult

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

    // Parse query parameters with validation
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    // SCALABILITY: Cap limit to prevent large data fetches (max 100)
    const rawLimit = parseInt(searchParams.get('limit') || '20') || 20
    const limit = Math.min(100, Math.max(1, rawLimit))
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

    // FIX N+1: Fetch users and count in parallel, then bans separately
    // This eliminates the N+1 pattern (previously fetched ban per user)
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
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    // FIX N+1: Fetch all bans for the current page of users in a single query
    const userIds = users.map((u) => u.id)
    const bans = await prisma.userBan.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        type: true,
        expiresAt: true,
        reason: true,
      },
    })

    // Create a map for O(1) lookup
    const bansByUserId = new Map(bans.map((b) => [b.userId, b]))

    // Transform users with signup method and ban info
    const usersWithBanInfo = users.map((user) => {
      const ban = bansByUserId.get(user.id)
      return {
        ...user,
        signupMethod: user.googleId ? 'google' : 'email',
        ban: ban ? { type: ban.type, expiresAt: ban.expiresAt, reason: ban.reason } : null,
      }
    })

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
// SECURITY: Protected with CSRF token validation
export async function POST(request: NextRequest) {
  // Apply rate limiting (userActions preset: 30 actions/minute)
  const rateLimitResult = await adminRateLimit(request, 'userActions')
  if (rateLimitResult) return rateLimitResult

  // SECURITY: Wrap dangerous admin actions with CSRF protection
  return withCsrfProtection(request, async () => {
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
    // Use database flag instead of email comparison to prevent email-based attacks
    // Super-admin is determined by a special flag in the database (set via migration)
    const actingAdmin = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        email: true,
        // Check for super admin flag (can be added via migration: isSuperAdmin boolean field)
        // For now, fallback to environment variable check but use constant-time comparison
        id: true,
      },
    })
    
    // SECURITY: Use constant-time comparison to prevent timing attacks
    // In production, this should be replaced with a database flag (isSuperAdmin)
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
    let isSuperAdmin = false
    if (superAdminEmail && actingAdmin?.email) {
      // Use timing-safe comparison
      const emailBuffer = Buffer.from(actingAdmin.email.toLowerCase().trim())
      const expectedBuffer = Buffer.from(superAdminEmail.toLowerCase().trim())
      if (emailBuffer.length === expectedBuffer.length) {
        isSuperAdmin = require('crypto').timingSafeEqual(emailBuffer, expectedBuffer)
      }
    }

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

      case 'permanent_delete': {
        // CRITICAL: Only super-admin can permanently delete users
        if (!isSuperAdmin) {
          return NextResponse.json(
            { error: 'Only the super-admin can permanently delete users' },
            { status: 403 }
          )
        }

        // SECURITY: Cannot delete yourself
        if (userId === user.id) {
          return NextResponse.json(
            { error: 'Cannot delete your own account' },
            { status: 403 }
          )
        }

        // Fetch user details before deletion for audit log
        const userToDelete = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            _count: {
              select: {
                sentMessages: true,
                posts: true,
                groupMemberships: true,
                sentMatches: true,
                receivedMatches: true,
              },
            },
          },
        })

        if (!userToDelete) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // PERFORMANCE: Use transaction for atomic deletion
        // Most relations have onDelete: Cascade, so they will be auto-deleted
        // Some relations have onDelete: SetNull (Messages, Reports) to preserve data
        await prisma.$transaction(async (tx) => {
          // 1. Delete user bans first (has userId unique constraint)
          await tx.userBan.deleteMany({ where: { userId } })

          // 2. Delete user warnings
          await tx.userWarning.deleteMany({ where: { userId } })

          // 3. Delete conversation archives
          await tx.conversationArchive.deleteMany({ where: { userId } })

          // 4. Delete announcement dismissals
          await tx.announcementDismissal.deleteMany({ where: { userId } })

          // 5. Delete activity tracking data (to avoid orphaned analytics)
          await tx.userPageVisit.deleteMany({ where: { userId } })
          await tx.userFeatureUsage.deleteMany({ where: { userId } })
          await tx.userSearchQuery.deleteMany({ where: { userId } })
          await tx.userSessionAnalytics.deleteMany({ where: { userId } })
          await tx.userActivitySummary.deleteMany({ where: { userId } })
          await tx.suspiciousActivityLog.deleteMany({ where: { userId } })

          // 6. Delete AI-related data
          await tx.aIUserMemory.deleteMany({ where: { userId } })
          await tx.aIMemoryEntry.deleteMany({ where: { userId } })
          await tx.aIUsageLog.deleteMany({ where: { userId } })
          await tx.aIUsageDailySummary.deleteMany({ where: { userId } })

          // 7. Delete flagged content records (preserve but nullify sender for audit)
          await tx.flaggedContent.updateMany({
            where: { senderId: userId },
            data: { senderId: 'deleted-user' },
          })

          // 8. Transfer group ownership or delete user's groups
          // First, find groups where user is the sole owner
          const ownedGroups = await tx.group.findMany({
            where: { ownerId: userId },
            select: {
              id: true,
              members: {
                where: {
                  userId: { not: userId },
                  role: { in: ['ADMIN', 'OWNER'] },
                },
                select: { userId: true, role: true },
                take: 1,
              },
            },
          })

          for (const group of ownedGroups) {
            if (group.members.length > 0) {
              // Transfer ownership to first admin/member
              await tx.group.update({
                where: { id: group.id },
                data: { ownerId: group.members[0].userId },
              })
              await tx.groupMember.update({
                where: {
                  groupId_userId: {
                    groupId: group.id,
                    userId: group.members[0].userId,
                  },
                },
                data: { role: 'OWNER' },
              })
            } else {
              // Mark group as deleted if no other admins
              await tx.group.update({
                where: { id: group.id },
                data: { isDeleted: true, deletedAt: new Date() },
              })
            }
          }

          // 9. Finally, delete the user (cascades most relations)
          await tx.user.delete({ where: { id: userId } })
        })

        // Log the permanent deletion action
        await logAdminAction({
          adminId: user.id,
          action: 'user_permanently_deleted',
          targetType: 'user',
          targetId: userId,
          details: {
            reason,
            deletedUserEmail: userToDelete.email,
            deletedUserName: userToDelete.name,
            accountAge: Math.floor(
              (Date.now() - userToDelete.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            ),
            stats: userToDelete._count,
          },
          ipAddress,
          userAgent,
        })

        logger.info('User permanently deleted', {
          data: {
            deletedUserId: userId,
            deletedBy: user.id,
            email: userToDelete.email,
          },
        })

        return NextResponse.json({
          success: true,
          message: 'User permanently deleted',
          deletedUser: {
            id: userToDelete.id,
            email: userToDelete.email,
            name: userToDelete.name,
          },
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Admin Users] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  })
}
