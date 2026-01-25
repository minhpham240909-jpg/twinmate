import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { PAGINATION } from '@/lib/constants'
import { validatePaginationLimit } from '@/lib/validation'

// GET /api/history/community-activity - Get user's community activity summary
export async function GET(request: NextRequest) {
  try {
    // Rate limiting - lenient for community activity reads
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = validatePaginationLimit(searchParams.get('limit'), PAGINATION.HISTORY_LIMIT)

    // Get user's posts (not deleted)
    const posts = await prisma.post.findMany({
      where: {
        userId: user.id,
        isDeleted: false,
      },
      include: {
        _count: {
          select: {
            likes: true,
            comments: true,
            reposts: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    // Get user's comments
    const comments = await prisma.postComment.findMany({
      where: {
        userId: user.id,
        post: {
          isDeleted: false,
        },
      },
      include: {
        post: {
          select: {
            id: true,
            content: true,
            userId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    // Get user's likes
    const likes = await prisma.postLike.findMany({
      where: {
        userId: user.id,
        post: {
          isDeleted: false,
        },
      },
      include: {
        post: {
          select: {
            id: true,
            content: true,
            userId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    // Get user's reposts
    const reposts = await prisma.postRepost.findMany({
      where: {
        userId: user.id,
        post: {
          isDeleted: false,
        },
      },
      include: {
        post: {
          select: {
            id: true,
            content: true,
            userId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    // Calculate statistics
    const totalPosts = await prisma.post.count({
      where: {
        userId: user.id,
        isDeleted: false,
      },
    })

    const totalComments = await prisma.postComment.count({
      where: {
        userId: user.id,
        post: {
          isDeleted: false,
        },
      },
    })

    const totalLikes = await prisma.postLike.count({
      where: {
        userId: user.id,
        post: {
          isDeleted: false,
        },
      },
    })

    const totalReposts = await prisma.postRepost.count({
      where: {
        userId: user.id,
        post: {
          isDeleted: false,
        },
      },
    })

    // Get total likes received on user's posts
    const totalLikesReceived = await prisma.postLike.count({
      where: {
        post: {
          userId: user.id,
          isDeleted: false,
        },
      },
    })

    return NextResponse.json({
      recentPosts: posts.map(post => ({
        id: post.id,
        content: post.content,
        createdAt: post.createdAt,
        _count: post._count,
      })),
      recentComments: comments.map(comment => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        post: comment.post,
      })),
      recentLikes: likes.map(like => ({
        id: like.id,
        createdAt: like.createdAt,
        post: like.post,
      })),
      recentReposts: reposts.map(repost => ({
        id: repost.id,
        comment: repost.comment,
        createdAt: repost.createdAt,
        post: repost.post,
      })),
      statistics: {
        totalPosts,
        totalComments,
        totalLikesGiven: totalLikes,
        totalReposts,
        totalLikesReceived,
      },
    })
  } catch (error) {
    console.error('Error fetching community activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch community activity' },
      { status: 500 }
    )
  }
}

