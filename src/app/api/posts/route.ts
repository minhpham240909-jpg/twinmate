import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { PAGINATION, CONTENT_LIMITS, ENGAGEMENT_WEIGHTS } from '@/lib/constants'
import { validatePaginationLimit, validateContent } from '@/lib/validation'

// GET /api/posts - Get feed posts
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    // H11 FIX: Use stable cursor (createdAt + id) for consistent pagination
    const cursor = searchParams.get('cursor') // Format: "createdAt_id" or just "id" for backwards compat
    const limit = validatePaginationLimit(searchParams.get('limit'), PAGINATION.POSTS_LIMIT)
    
    // H11 FIX: Parse stable cursor
    let cursorId: string | null = null
    let cursorCreatedAt: Date | null = null
    if (cursor) {
      if (cursor.includes('_')) {
        const [timestamp, id] = cursor.split('_')
        cursorCreatedAt = new Date(timestamp)
        cursorId = id
      } else {
        // Backwards compatibility: just an ID
        cursorId = cursor
      }
    }

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

    // PERF: Get ALL user connections in one query (avoid duplicate match query later)
    // This query includes both ACCEPTED (for partner posts) and PENDING (for connection status)
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

    // Extract partner IDs from accepted matches only (for post visibility)
    const partnerIds = userConnections
      .filter(match => match.status === 'ACCEPTED')
      .map(match => match.senderId === user.id ? match.receiverId : match.senderId)

    // H11 FIX: Build query with stable cursor for consistent pagination
    // Using createdAt + id combination prevents duplicates/missing posts when new posts are created
    const posts = await prisma.post.findMany({
      where: {
        // H11 FIX: Stable cursor condition
        ...(cursorCreatedAt && cursorId ? {
          OR: [
            // Posts with earlier createdAt
            { createdAt: { lt: cursorCreatedAt } },
            // Posts with same createdAt but earlier id (for same-timestamp ordering)
            {
              createdAt: cursorCreatedAt,
              id: { lt: cursorId },
            },
          ],
        } : cursorId ? { id: { lt: cursorId } } : {}),
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
    }) as any

    // Post-process for TRENDING and RECOMMENDED algorithms
    let finalPosts = posts

    if (feedAlgorithm === 'TRENDING') {
      // Calculate engagement score for each post
      const scoredPosts = posts.map((post: any) => {
        const hoursSinceCreated = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60)
        const engagementScore = (
          post._count.likes * (ENGAGEMENT_WEIGHTS.LIKE_WEIGHT + 1) +
          post._count.comments * (ENGAGEMENT_WEIGHTS.COMMENT_WEIGHT + 2) +
          post._count.reposts * (ENGAGEMENT_WEIGHTS.REPOST_WEIGHT + 3)
        ) / Math.max(hoursSinceCreated, 1) // Decay over time

        return { post, score: engagementScore }
      })

      // Sort by score and take limit
      finalPosts = scoredPosts
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, limit)
        .map(({ post }: any) => post)
    } else if (feedAlgorithm === 'RECOMMENDED') {
      // Simple recommendation: prioritize posts from connections, then by engagement
      const scoredPosts = posts.map((post: any) => {
        const isFromPartner = partnerIds.includes(post.userId)
        const hoursSinceCreated = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60)
        const engagementScore = (
          post._count.likes * ENGAGEMENT_WEIGHTS.LIKE_WEIGHT +
          post._count.comments * ENGAGEMENT_WEIGHTS.COMMENT_WEIGHT +
          post._count.reposts * ENGAGEMENT_WEIGHTS.REPOST_WEIGHT
        ) / Math.max(hoursSinceCreated * 0.5, 1)

        const partnerBoost = isFromPartner ? 10 : 1
        const totalScore = engagementScore * partnerBoost

        return { post, score: totalScore }
      })

      finalPosts = scoredPosts
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, limit)
        .map(({ post }: any) => post)
    } else {
      // CHRONOLOGICAL - already sorted, just take limit
      finalPosts = posts.slice(0, limit)
    }

    // PERF: Reuse userConnections from above (already fetched) - no duplicate query needed
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

    // PERFORMANCE: Run both group queries in parallel to eliminate N+1
    const postAuthorIds = Array.from(new Set(finalPosts.map((p: any) => p.userId))) as string[]

    const [userGroups, authorGroupMemberships] = await Promise.all([
      // Get current user's groups for finding shared groups
      prisma.groupMember.findMany({
        where: {
          userId: user.id,
        },
        select: {
          groupId: true,
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      // Get all post authors' group memberships (batch query)
      postAuthorIds.length > 0
        ? prisma.groupMember.findMany({
            where: {
              userId: { in: postAuthorIds },
            },
            select: {
              userId: true,
              groupId: true,
              group: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ])

    const userGroupIds = userGroups.map(g => g.groupId)

    // Filter to only shared groups (both user and author are members)
    const sharedAuthorMemberships = userGroupIds.length > 0
      ? authorGroupMemberships.filter(m => userGroupIds.includes(m.groupId))
      : []

    // Create map of userId -> shared groups (using filtered memberships)
    const sharedGroupsMap = new Map<string, Array<{ id: string; name: string }>>()
    sharedAuthorMemberships.forEach(membership => {
      if (!sharedGroupsMap.has(membership.userId)) {
        sharedGroupsMap.set(membership.userId, [])
      }
      sharedGroupsMap.get(membership.userId)!.push({
        id: membership.group.id,
        name: membership.group.name,
      })
    })

    // Check if user has liked each post and add connection status + shared groups
    const postsWithUserData = finalPosts.map((post: any) => {
      const connectionStatus = post.user.id === user.id ? undefined : (connectionStatusMap.get(post.user.id) || 'none')
      const sharedGroups = post.user.id === user.id ? undefined : (sharedGroupsMap.get(post.user.id) || [])
      return {
        ...post,
        user: {
          ...post.user,
          onlineStatus: connectionStatus === 'connected' ? (post.user.presence?.status === 'online' ? 'ONLINE' : 'OFFLINE') : null,
        },
        // PERFORMANCE: Since we filtered likes/reposts to user.id, just check if array has items
        isLikedByUser: post.likes.length > 0,
        isRepostedByUser: post.reposts.length > 0,
        connectionStatus,
        sharedGroups, // Array of groups that both users are members of
      }
    })

    // H11 FIX: Build stable cursor for next page
    let nextCursor: string | null = null
    if (finalPosts.length === limit && finalPosts.length > 0) {
      const lastPost = finalPosts[finalPosts.length - 1] as { id: string; createdAt: Date }
      // Stable cursor format: "ISO_timestamp_id"
      nextCursor = `${lastPost.createdAt.toISOString()}_${lastPost.id}`
    }

    return NextResponse.json({
      posts: postsWithUserData,
      nextCursor,
      feedAlgorithm, // Include in response so frontend knows which algorithm was used
    }, {
      headers: {
        // Cache feed for short time - posts change frequently
        'Cache-Control': 'private, max-age=15, stale-while-revalidate=30',
      }
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
    // Rate limit: 20 posts per minute
    const rateLimitResult = await rateLimit(req, { ...RateLimitPresets.moderate, keyPrefix: 'posts' })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many posts. Please wait a moment.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { content = '', imageUrls = [], postUrl = null, allowSharing = true } = body

    // Allow posts with only images or only links (content can be empty in those cases)
    const hasImages = Array.isArray(imageUrls) && imageUrls.length > 0
    const hasLink = postUrl && typeof postUrl === 'string' && postUrl.trim().length > 0
    const hasContent = content && typeof content === 'string' && content.trim().length > 0

    // Must have at least one of: content, images, or link
    if (!hasContent && !hasImages && !hasLink) {
      return NextResponse.json(
        { error: 'Post must have content, images, or a link' },
        { status: 400 }
      )
    }

    // Validate content length if content exists
    if (hasContent) {
      const contentValidation = validateContent(content, CONTENT_LIMITS.POST_MAX_LENGTH, 'Post content')
      if (!contentValidation.valid) {
        return NextResponse.json(
          { error: contentValidation.error },
          { status: 400 }
        )
      }
    }

    // Determine final content (use empty string if not provided - will have images/link)
    const finalContent = hasContent
      ? content.trim()
      : hasImages
        ? 'Posted images'
        : 'Shared a link'

    const post = await prisma.post.create({
      data: {
        userId: user.id,
        content: finalContent,
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
            presence: {
              select: {
                status: true,
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
