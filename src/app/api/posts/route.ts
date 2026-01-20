import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { PAGINATION, CONTENT_LIMITS, ENGAGEMENT_WEIGHTS, UPLOAD_LIMITS } from '@/lib/constants'
import { validatePaginationLimit, validateContent } from '@/lib/validation'
import { moderateContent, flagContent } from '@/lib/moderation/content-moderator'
import { cacheGet, CacheKeys, CacheTTL } from '@/lib/redis'

// Cache key for user connections (partner IDs)
const getUserConnectionsCacheKey = (userId: string) => `feed:connections:${userId}`
const CONNECTIONS_CACHE_TTL = 60 // 1 minute - connections don't change often

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
    
    // FIX: Add sort parameter to force chronological sorting for "Recent" tab
    // This ensures the Recent tab always shows latest posts by date, not engagement
    const sortParam = searchParams.get('sort') // 'recent' | 'recommended' | 'trending'
    
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

    // PERF: Only fetch profile and settings if needed (not for 'recent' sort)
    // For 'recent' sort, we don't need the user's feed algorithm preference
    let feedAlgorithm: string = 'CHRONOLOGICAL'
    
    if (sortParam === 'recent') {
      // Explicit recent sort - always chronological, skip settings fetch
      feedAlgorithm = 'CHRONOLOGICAL'
    } else if (sortParam === 'trending') {
      feedAlgorithm = 'TRENDING'
    } else if (sortParam === 'recommended') {
      feedAlgorithm = 'RECOMMENDED'
    } else {
      // No explicit sort - use user's preference (requires settings fetch)
      const [profile, settings] = await Promise.all([
        prisma.profile.findUnique({
          where: { userId: user.id },
          select: { userId: true }, // Only need to check existence
        }),
        prisma.userSettings.findUnique({
          where: { userId: user.id },
          select: { feedAlgorithm: true }, // Only fetch what we need
        }),
      ])

      if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
      }

      feedAlgorithm = settings?.feedAlgorithm || 'RECOMMENDED'
    }

    // PERF: Cache user connections to reduce DB load
    // Connections don't change frequently, so 1 minute cache is safe
    interface CachedConnection {
      id: string
      senderId: string
      receiverId: string
      status: string
    }
    
    const userConnections = await cacheGet<CachedConnection[]>(
      getUserConnectionsCacheKey(user.id),
      async () => {
        return prisma.match.findMany({
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
      },
      CONNECTIONS_CACHE_TTL
    )

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
    const { content = '', imageUrls = [], postUrl = null, allowSharing = true, allowComments = true, allowLikes = true } = body

    // Allow posts with only images or only links (content can be empty in those cases)
    const hasImages = Array.isArray(imageUrls) && imageUrls.length > 0
    const hasLink = postUrl && typeof postUrl === 'string' && postUrl.trim().length > 0
    const hasContent = content && typeof content === 'string' && content.trim().length > 0

    // FIX: Validate image array to prevent unbounded growth
    // This prevents memory issues and potential abuse with large arrays
    if (hasImages) {
      // Limit number of images
      if (imageUrls.length > UPLOAD_LIMITS.MAX_POST_IMAGES) {
        return NextResponse.json(
          { error: `Maximum ${UPLOAD_LIMITS.MAX_POST_IMAGES} images allowed per post` },
          { status: 400 }
        )
      }
      
      // Validate each URL is a non-empty string and reasonable length
      const MAX_URL_LENGTH = 2048 // Standard URL length limit
      for (const url of imageUrls) {
        if (typeof url !== 'string' || url.trim().length === 0) {
          return NextResponse.json(
            { error: 'Invalid image URL format' },
            { status: 400 }
          )
        }
        if (url.length > MAX_URL_LENGTH) {
          return NextResponse.json(
            { error: 'Image URL exceeds maximum length' },
            { status: 400 }
          )
        }
      }
    }

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

    // CONTENT MODERATION: Check content, images URLs, and links for inappropriate content
    // Combine all text content for moderation
    const contentToModerate = [
      hasContent ? content.trim() : '',
      hasLink ? postUrl.trim() : '',
      hasImages ? imageUrls.join(' ') : '',
    ].filter(Boolean).join(' ')

    if (contentToModerate.length > 0) {
      const moderationResult = await moderateContent(contentToModerate, 'post')

      // Block if content is dangerous, inappropriate, or harmful
      if (moderationResult.action === 'block') {
        // Get user info for logging
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { name: true, email: true },
        })

        // Flag the content for admin review
        await flagContent({
          contentType: 'post',
          contentId: `pending-${Date.now()}`, // Temporary ID since post wasn't created
          content: contentToModerate,
          senderId: user.id,
          senderEmail: dbUser?.email,
          senderName: dbUser?.name,
          moderationResult,
        })

        // Return user-friendly error based on category
        const categoryMessages: Record<string, string> = {
          harassment: 'Your post contains content that may be harmful to others. Please revise and try again.',
          hate_speech: 'Your post contains content that violates our community guidelines. Please revise and try again.',
          violence: 'Your post contains content that promotes violence. This is not allowed.',
          sexual_content: 'Your post contains inappropriate content. Please keep posts safe for all users.',
          self_harm: 'Your post contains concerning content. If you need support, please reach out to a trusted person or helpline.',
          dangerous: 'Your post contains potentially dangerous content. Please revise and try again.',
          spam: 'Your post appears to be spam. Please share genuine, meaningful content.',
          illegal: 'Your post may contain content related to illegal activities. This is not allowed.',
        }

        const primaryCategory = moderationResult.categories.find(c => c !== 'safe') || 'dangerous'
        const errorMessage = categoryMessages[primaryCategory] || 'Your post contains content that violates our community guidelines. Please revise and try again.'

        return NextResponse.json(
          {
            error: errorMessage,
            code: 'CONTENT_MODERATION_BLOCKED',
            category: primaryCategory,
          },
          { status: 400 }
        )
      }

      // Flag for review but allow posting (suspicious but not blocked)
      if (moderationResult.action === 'flag' || moderationResult.action === 'escalate') {
        // We'll flag the post after creation (below)
        // Store the moderation result for later
        (req as any).__moderationResult = moderationResult
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
        allowComments: typeof allowComments === 'boolean' ? allowComments : true,
        allowLikes: typeof allowLikes === 'boolean' ? allowLikes : true,
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

    // If content was flagged for review (but not blocked), flag the created post
    const moderationResult = (req as any).__moderationResult
    if (moderationResult && (moderationResult.action === 'flag' || moderationResult.action === 'escalate')) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true, email: true },
      })

      await flagContent({
        contentType: 'post',
        contentId: post.id,
        content: finalContent,
        senderId: user.id,
        senderEmail: dbUser?.email,
        senderName: dbUser?.name,
        moderationResult,
      })
    }

    return NextResponse.json({ success: true, post }, { status: 201 })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    )
  }
}
