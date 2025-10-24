import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query params
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const days = parseInt(searchParams.get('days') || '7') // Last N days

    // Calculate date threshold
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - days)

    // Get accepted partners for privacy filtering
    const matches = await prisma.match.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: user.id }, { receiverId: user.id }],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
    })

    const partnerIds = matches.map((match) =>
      match.senderId === user.id ? match.receiverId : match.senderId
    )
    partnerIds.push(user.id) // Include user's own posts

    // Fetch posts with engagement counts
    const posts = await prisma.post.findMany({
      where: {
        isDeleted: false, // Exclude soft-deleted posts
        createdAt: {
          gte: dateThreshold,
        },
        OR: [
          // Public posts from everyone
          {
            user: {
              profile: {
                postPrivacy: 'PUBLIC',
              },
            },
          },
          // Partners-only posts from user's partners
          {
            userId: { in: partnerIds },
            user: {
              profile: {
                postPrivacy: 'PARTNERS_ONLY',
              },
            },
          },
          // User's own posts (always visible)
          {
            userId: user.id,
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            profile: {
              select: {
                postPrivacy: true,
              },
            },
          },
        },
        likes: {
          select: {
            userId: true,
          },
        },
        comments: {
          select: {
            id: true,
          },
        },
        reposts: {
          select: {
            id: true,
            userId: true,
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
      take: 100, // Get more to calculate scores
    })

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

    // Calculate engagement score for each post
    // Formula: (likes × 2) + (comments × 3) + (reposts × 4)
    // Comments and reposts weighted higher as they require more effort
    const postsWithScore = posts.map((post) => ({
      ...post,
      engagementScore:
        post._count.likes * 2 +
        post._count.comments * 3 +
        post._count.reposts * 4,
      isLikedByUser: post.likes.some((like) => like.userId === user.id),
      isRepostedByUser: post.reposts.some((repost) => repost.userId === user.id),
      connectionStatus: post.user.id === user.id ? undefined : (connectionStatusMap.get(post.user.id) || 'none'),
    }))

    // Sort by engagement score and take top N
    const popularPosts = postsWithScore
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit)

    return NextResponse.json({
      posts: popularPosts,
      metadata: {
        days,
        total: popularPosts.length,
        minScore: popularPosts[popularPosts.length - 1]?.engagementScore || 0,
      },
    })
  } catch (error) {
    console.error('Error fetching popular posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch popular posts' },
      { status: 500 }
    )
  }
}
