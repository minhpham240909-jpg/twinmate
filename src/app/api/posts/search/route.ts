import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET /api/posts/search - Search posts
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ posts: [] })
    }

    // Get user's partner IDs for privacy filtering
    const partnerMatches = await prisma.match.findMany({
      where: {
        OR: [
          { senderId: user.id, status: 'ACCEPTED' },
          { receiverId: user.id, status: 'ACCEPTED' },
        ],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
    })

    const partnerIds = partnerMatches.map(match =>
      match.senderId === user.id ? match.receiverId : match.senderId
    )

    const searchTerm = query.trim().toLowerCase()

    // Check if searching for hashtag or username
    const isHashtagSearch = searchTerm.startsWith('#')
    const isUsernameSearch = searchTerm.startsWith('@')

    let posts

    if (isHashtagSearch) {
      // Search by hashtag in content
      const hashtag = searchTerm.slice(1) // Remove #
      posts = await prisma.post.findMany({
        where: {
          AND: [
            { isDeleted: false }, // Exclude soft-deleted posts
            {
              content: {
                contains: `#${hashtag}`,
                mode: 'insensitive',
              },
            },
            {
              OR: [
                { user: { profile: { postPrivacy: 'PUBLIC' } } },
                { userId: { in: partnerIds }, user: { profile: { postPrivacy: 'PARTNERS_ONLY' } } },
                { userId: user.id },
              ],
            },
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              profile: { select: { postPrivacy: true } },
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              reposts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
    } else if (isUsernameSearch) {
      // Search by username
      const username = searchTerm.slice(1) // Remove @
      posts = await prisma.post.findMany({
        where: {
          AND: [
            { isDeleted: false }, // Exclude soft-deleted posts
            {
              OR: [
                { content: { contains: `@${username}`, mode: 'insensitive' } },
                { user: { name: { contains: username, mode: 'insensitive' } } },
              ],
            },
            {
              OR: [
                { user: { profile: { postPrivacy: 'PUBLIC' } } },
                { userId: { in: partnerIds }, user: { profile: { postPrivacy: 'PARTNERS_ONLY' } } },
                { userId: user.id },
              ],
            },
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              profile: { select: { postPrivacy: true } },
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              reposts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
    } else {
      // General content search
      posts = await prisma.post.findMany({
        where: {
          AND: [
            { isDeleted: false }, // Exclude soft-deleted posts
            {
              content: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              OR: [
                { user: { profile: { postPrivacy: 'PUBLIC' } } },
                { userId: { in: partnerIds }, user: { profile: { postPrivacy: 'PARTNERS_ONLY' } } },
                { userId: user.id },
              ],
            },
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              profile: { select: { postPrivacy: true } },
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              reposts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
    }

    // Get all connections for the current user
    const userConnections = await prisma.match.findMany({
      where: {
        OR: [
          { senderId: user.id },
          { receiverId: user.id },
        ],
      },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        status: true,
      },
    })

    // Create a map of userId -> connectionStatus
    const connectionStatusMap = new Map<string, 'none' | 'pending' | 'connected'>()
    userConnections.forEach(connection => {
      const otherUserId = connection.senderId === user.id ? connection.receiverId : connection.senderId
      if (connection.status === 'ACCEPTED') {
        connectionStatusMap.set(otherUserId, 'connected')
      } else if (connection.status === 'PENDING') {
        connectionStatusMap.set(otherUserId, 'pending')
      }
    })

    // Add connection status and user interaction data to posts
    const postsWithUserData = posts.map(post => ({
      ...post,
      connectionStatus: post.user.id === user.id ? undefined : (connectionStatusMap.get(post.user.id) || 'none'),
    }))

    return NextResponse.json({ posts: postsWithUserData })
  } catch (error) {
    console.error('Error searching posts:', error)
    return NextResponse.json(
      { error: 'Failed to search posts' },
      { status: 500 }
    )
  }
}
