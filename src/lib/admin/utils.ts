// Admin Utility Functions
// CEO Control Panel - Core Utilities

import { prisma } from '@/lib/prisma'

/**
 * Check if a user is an admin
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, deactivatedAt: true },
    })

    // User must exist, be admin, and not deactivated
    return user?.isAdmin === true && user?.deactivatedAt === null
  } catch (error) {
    console.error('[Admin] Error checking admin status:', error)
    return false
  }
}

/**
 * Get admin user details
 */
export async function getAdminUser(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, isAdmin: true },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isAdmin: true,
        adminGrantedAt: true,
        createdAt: true,
      },
    })

    return user
  } catch (error) {
    console.error('[Admin] Error getting admin user:', error)
    return null
  }
}

/**
 * Grant admin access to a user (only super admin can do this)
 */
export async function grantAdminAccess(
  targetUserId: string,
  grantedByUserId: string
): Promise<boolean> {
  try {
    // First verify the granting user is an admin
    const grantingUser = await prisma.user.findUnique({
      where: { id: grantedByUserId },
      select: { isAdmin: true },
    })

    if (!grantingUser?.isAdmin) {
      console.error('[Admin] Non-admin tried to grant admin access')
      return false
    }

    // Grant admin access
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        isAdmin: true,
        adminGrantedAt: new Date(),
        adminGrantedBy: grantedByUserId,
      },
    })

    // Log the action
    await logAdminAction({
      adminId: grantedByUserId,
      action: 'admin_granted',
      targetType: 'user',
      targetId: targetUserId,
      details: { message: 'Admin access granted' },
    })

    return true
  } catch (error) {
    console.error('[Admin] Error granting admin access:', error)
    return false
  }
}

/**
 * Revoke admin access from a user
 */
export async function revokeAdminAccess(
  targetUserId: string,
  revokedByUserId: string
): Promise<boolean> {
  try {
    // First verify the revoking user is an admin
    const revokingUser = await prisma.user.findUnique({
      where: { id: revokedByUserId },
      select: { isAdmin: true },
    })

    if (!revokingUser?.isAdmin) {
      console.error('[Admin] Non-admin tried to revoke admin access')
      return false
    }

    // Revoke admin access
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        isAdmin: false,
        adminGrantedAt: null,
        adminGrantedBy: null,
      },
    })

    // Log the action
    await logAdminAction({
      adminId: revokedByUserId,
      action: 'admin_revoked',
      targetType: 'user',
      targetId: targetUserId,
      details: { message: 'Admin access revoked' },
    })

    return true
  } catch (error) {
    console.error('[Admin] Error revoking admin access:', error)
    return false
  }
}

/**
 * Log an admin action for audit trail
 */
export async function logAdminAction(params: {
  adminId: string
  action: string
  targetType: string
  targetId: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        details: params.details || {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
  } catch (error) {
    console.error('[Admin] Error logging admin action:', error)
  }
}

/**
 * Get admin audit logs with pagination
 */
export async function getAdminAuditLogs(options: {
  page?: number
  limit?: number
  adminId?: string
  action?: string
}) {
  const { page = 1, limit = 50, adminId, action } = options

  try {
    const where: any = {}
    if (adminId) where.adminId = adminId
    if (action) where.action = action

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        include: {
          admin: {
            select: { name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adminAuditLog.count({ where }),
    ])

    return {
      logs,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
    }
  } catch (error) {
    console.error('[Admin] Error getting audit logs:', error)
    return { logs: [], total: 0, pages: 0, currentPage: 1 }
  }
}

// =====================================================
// ADMIN DASHBOARD STATISTICS
// =====================================================

/**
 * Get overview statistics for admin dashboard
 */
export async function getAdminDashboardStats() {
  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      activeUsersToday,
      totalGroups,
      totalMessages,
      totalStudySessions,
      totalMatches,
      pendingReports,
      premiumUsers,
      deactivatedUsers,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),
      // New users today
      prisma.user.count({
        where: { createdAt: { gte: today } },
      }),
      // New users this week
      prisma.user.count({
        where: { createdAt: { gte: thisWeek } },
      }),
      // New users this month
      prisma.user.count({
        where: { createdAt: { gte: thisMonth } },
      }),
      // Active users today (logged in today)
      prisma.user.count({
        where: { lastLoginAt: { gte: today } },
      }),
      // Total groups
      prisma.group.count({
        where: { isDeleted: false },
      }),
      // Total messages
      prisma.message.count(),
      // Total study sessions
      prisma.studySession.count(),
      // Total matches (accepted)
      prisma.match.count({
        where: { status: 'ACCEPTED' },
      }),
      // Pending reports
      prisma.report.count({
        where: { status: 'PENDING' },
      }),
      // Premium users
      prisma.user.count({
        where: { role: 'PREMIUM' },
      }),
      // Deactivated users
      prisma.user.count({
        where: { deactivatedAt: { not: null } },
      }),
    ])

    return {
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersThisWeek,
        newThisMonth: newUsersThisMonth,
        activeToday: activeUsersToday,
        premium: premiumUsers,
        deactivated: deactivatedUsers,
      },
      content: {
        groups: totalGroups,
        messages: totalMessages,
        studySessions: totalStudySessions,
        matches: totalMatches,
      },
      moderation: {
        pendingReports: pendingReports,
      },
    }
  } catch (error) {
    console.error('[Admin] Error getting dashboard stats:', error)
    return null
  }
}

/**
 * Get user growth data for charts
 */
export async function getUserGrowthData(days: number = 30) {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const users = await prisma.user.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    // Group by date
    const growthByDate: Record<string, number> = {}
    users.forEach((user) => {
      const date = user.createdAt.toISOString().split('T')[0]
      growthByDate[date] = (growthByDate[date] || 0) + 1
    })

    // Convert to array format for charts
    const data = Object.entries(growthByDate).map(([date, count]) => ({
      date,
      users: count,
    }))

    return data
  } catch (error) {
    console.error('[Admin] Error getting user growth data:', error)
    return []
  }
}

/**
 * Get recent user signups
 */
export async function getRecentSignups(limit: number = 10) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        googleId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return users.map((user) => ({
      ...user,
      signupMethod: user.googleId ? 'google' : 'email',
    }))
  } catch (error) {
    console.error('[Admin] Error getting recent signups:', error)
    return []
  }
}
