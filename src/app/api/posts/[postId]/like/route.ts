import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { notifyPostLike } from '@/lib/notifications/send'
import { PAGINATION } from '@/lib/constants'

// GET /api/posts/[postId]/like - Get users who liked the post
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = await params
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const cursor = searchParams.get('cursor')

    // OPTIMIZATION: Fetch likes and partner connections in parallel
    const [likes, partnerConnections] = await Promise.all([
      prisma.postLike.findMany({
        where: {
          postId,
          ...(cursor ? { id: { lt: cursor } } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              presence: {
                select: {
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Fetch one extra to check if there are more
      }),
      // Get user's partner connections
      prisma.match.findMany({
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
      }),
    ])

    // Build partner IDs set
    const partnerIds = new Set(partnerConnections.map(match =>
      match.senderId === user.id ? match.receiverId : match.senderId
    ))

    // Check if there are more results
    const hasMore = likes.length > limit
    const likesToReturn = hasMore ? likes.slice(0, limit) : likes
    const nextCursor = hasMore ? likesToReturn[likesToReturn.length - 1].id : null

    // Map likes with user details and online status
    const likersWithDetails = likesToReturn.map((like: any) => ({
      id: like.id,
      createdAt: like.createdAt,
      user: {
        id: like.user.id,
        name: like.user.name,
        avatarUrl: like.user.avatarUrl,
        // Only show online status for partners
        onlineStatus: partnerIds.has(like.user.id) ? (like.user.presence?.status === 'online' ? 'ONLINE' : 'OFFLINE') : null,
        isPartner: partnerIds.has(like.user.id),
      },
    }))

    return NextResponse.json({
      likers: likersWithDetails,
      nextCursor,
      hasMore,
    })
  } catch (error) {
    console.error('Error fetching post likers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch likers' },
      { status: 500 }
    )
  }
}

// POST /api/posts/[postId]/like - Like a post
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    // Rate limit: 100 likes per minute (lenient for quick interactions)
    const rateLimitResult = await rateLimit(req, { ...RateLimitPresets.lenient, keyPrefix: 'likes' })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = await params

    // Check if post exists and allows likes
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        userId: true,
        allowLikes: true,
      },
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check if likes are allowed on this post
    if (!post.allowLikes) {
      return NextResponse.json(
        { error: 'Likes are disabled for this post' },
        { status: 403 }
      )
    }

    // Check if already liked
    const existingLike = await prisma.postLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    })

    if (existingLike) {
      return NextResponse.json(
        { error: 'Already liked' },
        { status: 400 }
      )
    }

    // Create like
    const like = await prisma.postLike.create({
      data: {
        postId,
        userId: user.id,
      },
    })

    // Send notification to post owner (async, don't wait)
    notifyPostLike(user.id, post.userId, postId).catch(console.error)

    return NextResponse.json({ success: true, like })
  } catch (error) {
    console.error('Error liking post:', error)
    return NextResponse.json(
      { error: 'Failed to like post' },
      { status: 500 }
    )
  }
}

// DELETE /api/posts/[postId]/like - Unlike a post
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = await params

    // Check if like exists before attempting to delete
    const existingLike = await prisma.postLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    })

    if (!existingLike) {
      return NextResponse.json(
        { error: 'Like not found' },
        { status: 404 }
      )
    }

    // Delete like
    await prisma.postLike.delete({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unliking post:', error)
    return NextResponse.json(
      { error: 'Failed to unlike post' },
      { status: 500 }
    )
  }
}
