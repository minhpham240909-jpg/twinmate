import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// NOTE: These types will be available after running:
// 1. Run migration SQL in Supabase
// 2. Run `npx prisma generate`
type HelpMessageStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
type HelpMessagePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

const VALID_STATUSES: HelpMessageStatus[] = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const VALID_PRIORITIES: HelpMessagePriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

/**
 * Check if user is admin
 */
async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { isAdmin: false, user: null }
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, isAdmin: true, isSuperAdmin: true, name: true },
  })

  return {
    isAdmin: dbUser?.isAdmin === true,
    isSuperAdmin: dbUser?.isSuperAdmin === true,
    user: dbUser,
  }
}

/**
 * GET /api/admin/help - Get help messages with filtering and pagination
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    const { isAdmin } = await checkAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    // Filters
    const status = searchParams.get('status') as HelpMessageStatus | null
    const priority = searchParams.get('priority') as HelpMessagePriority | null
    const search = searchParams.get('search')
    const assignedToMe = searchParams.get('assignedToMe') === 'true'

    // Build where clause
    const where: Parameters<typeof prisma.helpMessage.findMany>[0]['where'] = {}

    if (status) {
      where.status = status
    }

    if (priority) {
      where.priority = priority
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (assignedToMe) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        where.assignedToId = user.id
      }
    }

    // Execute queries in parallel for performance
    const [messages, total, statusCounts] = await Promise.all([
      prisma.helpMessage.findMany({
        where,
        orderBy: [
          { status: 'asc' }, // PENDING first
          { priority: 'desc' }, // URGENT first within same status
          { createdAt: 'desc' }, // Newest first within same priority
        ],
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          subject: true,
          message: true,
          category: true,
          priority: true,
          status: true,
          assignedToId: true,
          resolvedById: true,
          resolvedAt: true,
          adminNotes: true,
          responseCount: true,
          lastResponseAt: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
        },
      }),
      prisma.helpMessage.count({ where }),
      // Get counts by status for dashboard summary
      prisma.helpMessage.groupBy({
        by: ['status'],
        _count: true,
      }),
    ])

    // Format status counts
    const counts = {
      pending: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0,
      total: 0,
    }
    for (const item of statusCounts) {
      counts.total += item._count
      switch (item.status) {
        case 'PENDING':
          counts.pending = item._count
          break
        case 'IN_PROGRESS':
          counts.inProgress = item._count
          break
        case 'RESOLVED':
          counts.resolved = item._count
          break
        case 'CLOSED':
          counts.closed = item._count
          break
      }
    }

    return NextResponse.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts,
    })
  } catch (error) {
    console.error('Error fetching help messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch help messages' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/help - Update a help message (status, priority, notes, assign)
 * Admin only
 */
export async function PATCH(request: NextRequest) {
  try {
    const { isAdmin, user } = await checkAdmin()
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { id, status, priority, adminNotes, assignedToId } = body

    if (!id) {
      return NextResponse.json({ error: 'Message ID required' }, { status: 400 })
    }

    // Verify message exists
    const existing = await prisma.helpMessage.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {}

    if (status && VALID_STATUSES.includes(status)) {
      updateData.status = status as HelpMessageStatus

      // If resolving, set resolved info
      if (status === 'RESOLVED' || status === 'CLOSED') {
        updateData.resolvedById = user.id
        updateData.resolvedAt = new Date()
      }
    }

    if (priority && VALID_PRIORITIES.includes(priority)) {
      updateData.priority = priority as HelpMessagePriority
    }

    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes
    }

    if (assignedToId !== undefined) {
      updateData.assignedToId = assignedToId || null
      // If assigning, auto-set to in progress if pending
      if (assignedToId && existing.status === 'PENDING') {
        updateData.status = 'IN_PROGRESS'
      }
    }

    const updated = await prisma.helpMessage.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, message: updated })
  } catch (error) {
    console.error('Error updating help message:', error)
    return NextResponse.json(
      { error: 'Failed to update help message' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/help - Delete a help message
 * Admin only
 */
export async function DELETE(request: NextRequest) {
  try {
    const { isAdmin } = await checkAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Message ID required' }, { status: 400 })
    }

    await prisma.helpMessage.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting help message:', error)
    return NextResponse.json(
      { error: 'Failed to delete help message' },
      { status: 500 }
    )
  }
}
