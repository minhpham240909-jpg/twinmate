// Admin User Search API - For announcement targeting
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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

    // Get search query
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const ids = searchParams.get('ids') // Comma-separated IDs for batch lookup
    const limit = parseInt(searchParams.get('limit') || '10')

    // If IDs are provided, do a batch lookup (for loading existing targeted users)
    if (ids) {
      const userIds = ids.split(',').filter(id => id.trim())
      if (userIds.length === 0) {
        return NextResponse.json({ success: true, users: [] })
      }

      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          subscriptionStatus: true,
          isAdmin: true,
        },
      })

      const formattedUsers = users.map(u => ({
        id: u.id,
        name: u.name || 'Unknown',
        email: u.email,
        avatarUrl: u.avatarUrl,
        tier: u.subscriptionStatus === 'active' ? 'PREMIUM' : 'FREE',
        isAdmin: u.isAdmin,
      }))

      return NextResponse.json({ success: true, users: formattedUsers })
    }

    // Regular search by name/email
    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        users: [],
        message: 'Search query must be at least 2 characters'
      })
    }

    // Search users by name or email
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        subscriptionStatus: true,
        isAdmin: true,
      },
      take: limit,
      orderBy: { name: 'asc' }
    })

    // Format response with tier info and isAdmin status
    const formattedUsers = users.map(u => ({
      id: u.id,
      name: u.name || 'Unknown',
      email: u.email,
      avatarUrl: u.avatarUrl,
      tier: u.subscriptionStatus === 'active' ? 'PREMIUM' : 'FREE',
      isAdmin: u.isAdmin,
    }))

    return NextResponse.json({
      success: true,
      users: formattedUsers,  // Match frontend expectation (data.users)
    })
  } catch (error) {
    console.error('[Admin User Search] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
