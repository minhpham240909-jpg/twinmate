// Admin Audit Log API
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// Helper to verify admin
async function verifyAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true, id: true },
  })

  return adminUser?.isAdmin ? { ...user, dbId: adminUser.id } : null
}

// GET - List audit logs
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
    const limit = parseInt(searchParams.get('limit') || '50')
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

    // Execute query
    const [logs, total, admins, actions] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        include: {
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
      // Get list of admins for filter
      prisma.adminAuditLog.findMany({
        distinct: ['adminId'],
        select: {
          adminId: true,
          admin: {
            select: { name: true, email: true },
          },
        },
      }),
      // Get list of actions for filter
      prisma.adminAuditLog.findMany({
        distinct: ['action'],
        select: { action: true },
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
          admins: admins.map((a) => ({
            id: a.adminId,
            name: a.admin.name || a.admin.email,
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
  try {
    const supabase = await createClient()
    const admin = await verifyAdmin(supabase)

    if (!admin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { ids, deleteAll } = body

    if (deleteAll) {
      // Delete all audit logs
      const result = await prisma.adminAuditLog.deleteMany({})
      return NextResponse.json({
        success: true,
        message: `Deleted ${result.count} audit logs`,
        deletedCount: result.count,
      })
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
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
