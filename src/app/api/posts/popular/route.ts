import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { PAGINATION, TIME_PERIODS, ENGAGEMENT_WEIGHTS } from '@/lib/constants'
import { validatePaginationLimit, validatePositiveInt } from '@/lib/validation'
import { HTTP_CACHE } from '@/lib/cache'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query params
    const { searchParams } = new URL(req.url)
    const limit = validatePaginationLimit(searchParams.get('limit'), PAGINATION.POSTS_LIMIT)
    const days = validatePositiveInt(searchParams.get('days'), TIME_PERIODS.POPULAR_POSTS_DAYS)

    // Calculate date threshold
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - days)

    // OPTIMIZATION: Single query to get ALL user connections (for both privacy filtering and connection status)
    // This eliminates the duplicate N+1 query pattern
    const allConnections = await prisma.match.findMany({
      where: {
        OR: [{ senderId: user.id }, { receiverId: user.id }],
      },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        status: true,
      },
    })

    // Build partner IDs (ACCEPTED only) for privacy filtering
    const partnerIds: string[] = []
    // Build connection status map for all connections
    const connectionStatusMap = new Map<string, 'none' | 'pending' | 'connected'>()
    
    allConnections.forEach(connection => {
      const otherUserId = connection.senderId === user.id ? connection.receiverId : connection.senderId
      
      // For privacy filtering: only ACCEPTED partners
      if (connection.status === 'ACCEPTED') {
        partnerIds.push(otherUserId)
        connectionStatusMap.set(otherUserId, 'connected')
      } else if (connection.status === 'PENDING') {
        connectionStatusMap.set(otherUserId, 'pending')
      }
    })
    partnerIds.push(user.id) // Include user's own posts

    // Fetch posts with engagement counts
    // FIX: Order by likes count DESC as a proxy for engagement
    // This ensures we get posts with high engagement first, not just recent posts
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
            presence: {
              select: {
                status: true,
              },
            },
          },
        },
        // PERFORMANCE: Only fetch current user's like/repost, not all of them
        // This dramatically reduces data transfer for popular posts (100s of likes -> 1)
        likes: {
          where: { userId: user.id },
          select: { userId: true },
          take: 1,
        },
        reposts: {
          where: { userId: user.id },
          select: { userId: true },
          take: 1,
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            reposts: true,
          },
        },
      },
      // FIX: Order by engagement metrics to ensure we get popular posts first
      // Primary: likes (most common engagement), Secondary: comments, Tertiary: reposts
      // This prevents the bug where only recent posts were shown in popular tab
      orderBy: [
        { likes: { _count: 'desc' } },
        { comments: { _count: 'desc' } },
        { reposts: { _count: 'desc' } },
      ],
      take: PAGINATION.POPULAR_POSTS_FETCH, // Get more to calculate scores
    })

    // Calculate engagement score for each post
    // Formula: (likes × 2) + (comments × 3) + (reposts × 4)
    // Comments and reposts weighted higher as they require more effort
    const postsWithScore = posts.map((post: any) => {
      const connectionStatus = post.user.id === user.id ? undefined : (connectionStatusMap.get(post.user.id) || 'none')
      return {
        ...post,
        user: {
          ...post.user,
          // Only show online status for connected partners
          onlineStatus: connectionStatus === 'connected' ? (post.user.presence?.status === 'online' ? 'ONLINE' : 'OFFLINE') : null,
        },
        engagementScore:
          post._count.likes * ENGAGEMENT_WEIGHTS.LIKE_WEIGHT +
          post._count.comments * ENGAGEMENT_WEIGHTS.COMMENT_WEIGHT +
          post._count.reposts * ENGAGEMENT_WEIGHTS.REPOST_WEIGHT,
        // PERFORMANCE: Since we filtered likes/reposts to user.id, just check if array has items
        isLikedByUser: post.likes.length > 0,
        isRepostedByUser: post.reposts.length > 0,
        connectionStatus,
      }
    })

    // Sort by engagement score and take top N
    const popularPosts = postsWithScore
      .sort((a: any, b: any) => b.engagementScore - a.engagementScore)
      .slice(0, limit)

    // Return with private cache (user-specific data, cache for 2 minutes)
    return NextResponse.json({
      posts: popularPosts,
      metadata: {
        days,
        total: popularPosts.length,
        minScore: popularPosts[popularPosts.length - 1]?.engagementScore || 0,
      },
    }, {
      headers: HTTP_CACHE.PRIVATE_SHORT,
    })
  } catch (error) {
    console.error('Error fetching popular posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch popular posts' },
      { status: 500 }
    )
  }
}
