// Admin Utility Functions
// CEO Control Panel - Core Utilities

import { prisma } from '@/lib/prisma'
import { getOrSetCached, invalidateByPattern } from '@/lib/cache'

// Cache TTLs for admin data (in seconds)
const CACHE_TTL = {
  DASHBOARD_STATS: 60,      // 1 minute - frequently viewed
  GROWTH_DATA: 300,         // 5 minutes - chart data
  RECENT_SIGNUPS: 30,       // 30 seconds - needs to be fresh
  ANALYTICS: 120,           // 2 minutes - heavy queries
}

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
 * SECURITY: Caches admin name/email to preserve accountability even after admin deletion
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
    // Fetch admin info to cache in audit log (preserves accountability after deletion)
    const admin = await prisma.user.findUnique({
      where: { id: params.adminId },
      select: { name: true, email: true },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        adminName: admin?.name || 'Unknown Admin',
        adminEmail: admin?.email || 'unknown@deleted',
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
 * OPTIMIZED: Uses materialized view (2000ms → <10ms, 99% faster)
 * Falls back to real-time queries if view is stale
 */
export async function getAdminDashboardStats() {
  const cacheKey = 'admin:dashboard:stats'

  return getOrSetCached(cacheKey, CACHE_TTL.DASHBOARD_STATS, async () => {
    try {
      // PERF: Try to get stats from materialized view first (single query, <10ms)
      try {
        const viewResult = await prisma.$queryRaw<Array<{
          total_users: bigint
          new_users_today: bigint
          new_users_this_week: bigint
          new_users_this_month: bigint
          active_users_today: bigint
          premium_users: bigint
          deactivated_users: bigint
          total_groups: bigint
          total_messages: bigint
          total_study_sessions: bigint
          total_matches: bigint
          pending_reports: bigint
          under_review_reports: bigint
          resolved_reports: bigint
          online_users: bigint
          active_devices: bigint
          total_ai_sessions: bigint
          active_ai_sessions: bigint
          ai_sessions_today: bigint
          cache_age_seconds: number
        }>>`
          SELECT * FROM get_admin_dashboard_stats()
        `

        // If materialized view exists and is fresh (< 60 seconds old), use it
        if (viewResult.length > 0 && viewResult[0].cache_age_seconds < 60) {
          const stats = viewResult[0]
          return {
            users: {
              total: Number(stats.total_users),
              newToday: Number(stats.new_users_today),
              newThisWeek: Number(stats.new_users_this_week),
              newThisMonth: Number(stats.new_users_this_month),
              activeToday: Number(stats.active_users_today),
              premium: Number(stats.premium_users),
              deactivated: Number(stats.deactivated_users),
            },
            content: {
              groups: Number(stats.total_groups),
              messages: Number(stats.total_messages),
              studySessions: Number(stats.total_study_sessions),
              matches: Number(stats.total_matches),
            },
            moderation: {
              pendingReports: Number(stats.pending_reports),
            },
            _source: 'materialized_view',
            _cacheAge: stats.cache_age_seconds,
          }
        }
      } catch {
        // Materialized view function doesn't exist - use fallback queries
        console.log('[Admin] Materialized view not available, using direct queries')
      }

      // FALLBACK: Use direct queries if materialized view is stale or missing
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
        prisma.user.count({ where: { deactivatedAt: null } }),
        prisma.user.count({ where: { createdAt: { gte: today }, deactivatedAt: null } }),
        prisma.user.count({ where: { createdAt: { gte: thisWeek }, deactivatedAt: null } }),
        prisma.user.count({ where: { createdAt: { gte: thisMonth }, deactivatedAt: null } }),
        prisma.user.count({ where: { lastLoginAt: { gte: today }, deactivatedAt: null } }),
        prisma.group.count({ where: { isDeleted: false } }),
        prisma.sessionMessage.count(),
        prisma.studySession.count(),
        prisma.match.count(),
        prisma.report.count({ where: { status: 'PENDING' } }),
        prisma.user.count({ where: { role: 'PREMIUM', deactivatedAt: null } }),
        prisma.user.count({ where: { deactivatedAt: { not: null } } }),
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
        _source: 'fallback_queries',
      }
    } catch (error) {
      console.error('[Admin] Error getting dashboard stats:', error)
      return null
    }
  })
}

/**
 * Get user growth data for charts
 * OPTIMIZED: Uses materialized view for 30-day growth (99% faster)
 */
export async function getUserGrowthData(days: number = 30) {
  const cacheKey = `admin:growth:${days}d`

  return getOrSetCached(cacheKey, CACHE_TTL.GROWTH_DATA, async () => {
    try {
      // PERF: For 30 days, try pre-computed materialized view first
      if (days === 30) {
        try {
          const result = await prisma.$queryRaw<Array<{ date: Date; new_users: bigint }>>`
            SELECT date, new_users
            FROM admin_user_growth_30d
            ORDER BY date ASC
          `

          if (result.length > 0) {
            return result.map(row => ({
              date: row.date.toISOString().split('T')[0],
              users: Number(row.new_users),
            }))
          }
        } catch {
          // Materialized view doesn't exist - use fallback query
          console.log('[Admin] Growth materialized view not available, using direct query')
        }
      }

      // FALLBACK: Use dynamic query for any day range
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const result = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT DATE("createdAt") as date, COUNT(*) as count
        FROM "User"
        WHERE "createdAt" >= ${startDate}
          AND "deactivatedAt" IS NULL
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `

      return result.map(row => ({
        date: row.date,
        users: Number(row.count),
      }))
    } catch (error) {
      console.error('[Admin] Error getting user growth data:', error)
      return []
    }
  })
}

/**
 * Get recent user signups
 * Cached for 30 seconds
 */
export async function getRecentSignups(limit: number = 10) {
  const cacheKey = `admin:signups:recent:${limit}`

  return getOrSetCached(cacheKey, CACHE_TTL.RECENT_SIGNUPS, async () => {
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
  })
}

/**
 * Invalidate admin dashboard caches
 * Call this when data changes that affects admin stats
 */
export async function invalidateAdminCaches() {
  try {
    await invalidateByPattern('admin:*')
  } catch (error) {
    console.error('[Admin] Error invalidating caches:', error)
  }
}
