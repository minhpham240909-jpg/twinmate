import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET /api/posts - Get feed posts
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor') // For pagination
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get user's profile and settings
    const [profile, settings] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId: user.id },
      }),
      prisma.userSettings.findUnique({
        where: { userId: user.id },
      }),
    ])

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get feed algorithm preference (default: RECOMMENDED)
    const feedAlgorithm = settings?.feedAlgorithm || 'RECOMMENDED'

    // Get user's partner IDs (accepted matches)
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

    // Build query - include posts based on privacy settings
    const posts = await prisma.post.findMany({
      where: {
        ...(cursor ? { id: { lt: cursor } } : {}),
        isDeleted: false, // Exclude soft-deleted posts
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
      orderBy: feedAlgorithm === 'CHRONOLOGICAL'
        ? { createdAt: 'desc' }
        : feedAlgorithm === 'TRENDING'
        ? [
            // For trending, prioritize recent posts with high engagement
            // Note: This is a simplified version, you might want to use raw SQL for better scoring
            { createdAt: 'desc' }, // Still favor recency
          ]
        : { createdAt: 'desc' }, // RECOMMENDED - for now, use chronological (can be enhanced later)
      take: limit * 2, // Fetch more for sorting
    })

    // Post-process for TRENDING and RECOMMENDED algorithms
    let finalPosts = posts

    if (feedAlgorithm === 'TRENDING') {
      // Calculate engagement score for each post
      const scoredPosts = posts.map(post => {
        const hoursSinceCreated = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60)
        const engagementScore = (
          post._count.likes * 3 +
          post._count.comments * 5 +
          post._count.reposts * 7
        ) / Math.max(hoursSinceCreated, 1) // Decay over time

        return { post, score: engagementScore }
      })

      // Sort by score and take limit
      finalPosts = scoredPosts
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ post }) => post)
    } else if (feedAlgorithm === 'RECOMMENDED') {
      // Simple recommendation: prioritize posts from connections, then by engagement
      const scoredPosts = posts.map(post => {
        const isFromPartner = partnerIds.includes(post.userId)
        const hoursSinceCreated = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60)
        const engagementScore = (
          post._count.likes * 2 +
          post._count.comments * 3 +
          post._count.reposts * 4
        ) / Math.max(hoursSinceCreated * 0.5, 1)

        const partnerBoost = isFromPartner ? 10 : 1
        const totalScore = engagementScore * partnerBoost

        return { post, score: totalScore }
      })

      finalPosts = scoredPosts
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ post }) => post)
    } else {
      // CHRONOLOGICAL - already sorted, just take limit
      finalPosts = posts.slice(0, limit)
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

    // Check if user has liked each post and add connection status
    const postsWithUserData = finalPosts.map(post => ({
      ...post,
      isLikedByUser: post.likes.some(like => like.userId === user.id),
      isRepostedByUser: post.reposts.some(repost => repost.userId === user.id),
      connectionStatus: post.user.id === user.id ? undefined : (connectionStatusMap.get(post.user.id) || 'none'),
    }))

    return NextResponse.json({
      posts: postsWithUserData,
      nextCursor: finalPosts.length === limit ? finalPosts[finalPosts.length - 1].id : null,
      feedAlgorithm, // Include in response so frontend knows which algorithm was used
    })
  } catch (error) {
    console.error('Error fetching posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}

// POST /api/posts - Create new post
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { content, imageUrls = [], postUrl = null, allowSharing = true } = body

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: 'Content too long (max 5000 characters)' },
        { status: 400 }
      )
    }

    const post = await prisma.post.create({
      data: {
        userId: user.id,
        content: content.trim(),
        imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
        postUrl: postUrl && typeof postUrl === 'string' ? postUrl.trim() : null,
        allowSharing: typeof allowSharing === 'boolean' ? allowSharing : true,
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
        _count: {
          select: {
            likes: true,
            comments: true,
            reposts: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, post }, { status: 201 })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    )
  }
}
