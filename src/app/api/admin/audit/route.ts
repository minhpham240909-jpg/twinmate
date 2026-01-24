// Admin Audit Log API
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { adminRateLimit } from '@/lib/admin/rate-limit'

// Helper to verify admin with super admin check
async function verifyAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true, isSuperAdmin: true, id: true, deactivatedAt: true },
  })

  // Check if admin and not deactivated
  if (!adminUser?.isAdmin || adminUser.deactivatedAt) {
    return null
  }

  return { ...user, dbId: adminUser.id, isSuperAdmin: adminUser.isSuperAdmin }
}

// GET - List audit logs
export async function GET(request: NextRequest) {
  // Rate limit audit log requests
  const rateLimitResult = await adminRateLimit(request, 'default')
  if (rateLimitResult) return rateLimitResult

  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)

    if (!admin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Parse query parameters with validation
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    // SCALABILITY: Cap limit to prevent large data fetches (max 100)
    const rawLimit = parseInt(searchParams.get('limit') || '50') || 50
    const limit = Math.min(100, Math.max(1, rawLimit))
    const adminId = searchParams.get('adminId') || ''
    const action = searchParams.get('action') || ''

    // Build where clause
    const where: any = {}

    if (adminId) {
      where.adminId = adminId
    }

    if (action) {
      where.action = action
    }

    // Execute query - SCALABILITY: Add limits to filter queries to prevent memory explosion
    const [logs, total, admins, actions] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        select: {
          id: true,
          adminId: true,
          adminName: true,
          adminEmail: true,
          action: true,
          targetType: true,
          targetId: true,
          details: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adminAuditLog.count({ where }),
      // Get list of admins for filter - CRITICAL: Limit to prevent unbounded query
      // Also fetch cached adminName/adminEmail to handle deleted admins
      prisma.adminAuditLog.findMany({
        distinct: ['adminId'],
        select: {
          adminId: true,
          adminName: true,
          adminEmail: true,
          admin: {
            select: { name: true, email: true },
          },
        },
        take: 100, // Limit to 100 most recent distinct admins
        orderBy: { createdAt: 'desc' },
      }),
      // Get list of actions for filter - CRITICAL: Limit to prevent unbounded query
      prisma.adminAuditLog.findMany({
        distinct: ['action'],
        select: { action: true },
        take: 50, // Limit to 50 action types
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          limit,
        },
        filters: {
          // Use cached adminName/adminEmail when admin relation is null (deleted admin)
          admins: admins.map((a) => ({
            id: a.adminId,
            name: a.admin?.name || a.adminName || a.admin?.email || a.adminEmail || 'Unknown Admin',
          })),
          actions: actions.map((a) => a.action),
        },
      },
    })
  } catch (error) {
    console.error('[Admin Audit] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete audit logs (selected or all)
export async function DELETE(request: NextRequest) {
  // Rate limit delete requests
  const rateLimitResult = await adminRateLimit(request, 'userActions')
  if (rateLimitResult) return rateLimitResult

  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)

    if (!admin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { ids, deleteAll } = body

    if (deleteAll) {
      // SECURITY: Require explicit confirmation and super admin status for deleteAll
      const { confirmDelete, retentionDays } = body

      // Check if current admin is super admin using isSuperAdmin field
      if (!admin.isSuperAdmin) {
        return NextResponse.json({
          error: 'Only super admin can delete all audit logs'
        }, { status: 403 })
      }

      if (confirmDelete !== 'DELETE_ALL_AUDIT_LOGS') {
        return NextResponse.json({
          error: 'Missing confirmation. Send confirmDelete: "DELETE_ALL_AUDIT_LOGS"'
        }, { status: 400 })
      }

      // If retentionDays is specified, only delete logs older than that
      const where: any = {}
      if (retentionDays && typeof retentionDays === 'number' && retentionDays > 0) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
        where.createdAt = { lt: cutoffDate }
      }

      // Create an audit log of this deletion BEFORE deleting
      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'AUDIT_LOGS_PURGED',
          targetType: 'AdminAuditLog',
          targetId: 'bulk',
          details: {
            retentionDays: retentionDays || 'all',
            deletedAt: new Date().toISOString(),
          },
        },
      })

      const result = await prisma.adminAuditLog.deleteMany({ where })
      return NextResponse.json({
        success: true,
        message: `Deleted ${result.count} audit logs`,
        deletedCount: result.count,
      })
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // SECURITY FIX: Only super admin can delete audit logs (even selected ones)
      // Audit logs are critical for security - regular admins should not be able to cover their tracks
      if (!admin.isSuperAdmin) {
        return NextResponse.json({
          error: 'Only super admin can delete audit logs'
        }, { status: 403 })
      }

      // SECURITY FIX: Log the deletion of selected audit logs BEFORE deleting
      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          adminName: admin.user_metadata?.name || admin.email || 'Unknown',
          adminEmail: admin.email || 'Unknown',
          action: 'AUDIT_LOGS_DELETED',
          targetType: 'AdminAuditLog',
          targetId: ids.join(',').substring(0, 255), // Store IDs (truncated to fit)
          details: {
            deletedIds: ids,
            deletedCount: ids.length,
            deletedAt: new Date().toISOString(),
          },
        },
      })

      // Delete selected audit logs
      const result = await prisma.adminAuditLog.deleteMany({
        where: { id: { in: ids } },
      })
      return NextResponse.json({
        success: true,
        message: `Deleted ${result.count} audit logs`,
        deletedCount: result.count,
      })
    }

    return NextResponse.json({ error: 'No logs specified for deletion' }, { status: 400 })
  } catch (error) {
    console.error('[Admin Audit Delete] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
