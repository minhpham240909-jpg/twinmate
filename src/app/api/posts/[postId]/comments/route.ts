import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { CONTENT_LIMITS } from '@/lib/constants'
import { validateContent } from '@/lib/validation'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { notifyPostComment } from '@/lib/notifications/send'

// GET /api/posts/[postId]/comments - Get comments for a post
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = await params

    // OPTIMIZATION: Fetch comments and partner connections in parallel to reduce latency
    const [comments, partnerConnections] = await Promise.all([
      prisma.postComment.findMany({
        where: { postId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              presence: {
                select: {
                  // @ts-ignore - Prisma type inference issue
                  onlineStatus: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      }) as Promise<any[]>,
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

    const partnerIds = new Set(partnerConnections.map(match =>
      match.senderId === user.id ? match.receiverId : match.senderId
    ))

    // Add onlineStatus only for partners
    const commentsWithStatus = comments.map((comment: any) => ({
      ...comment,
      user: {
        ...comment.user,
        onlineStatus: partnerIds.has(comment.user.id) ? comment.user.presence?.onlineStatus : null,
      },
    }))

    return NextResponse.json({ comments: commentsWithStatus })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

// POST /api/posts/[postId]/comments - Add a comment to a post
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    // Rate limit: 20 comments per minute
    const rateLimitResult = await rateLimit(req, { ...RateLimitPresets.moderate, keyPrefix: 'comments' })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many comments. Please wait a moment.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = await params
    const body = await req.json()
    const { content } = body

    // Validate content
    const contentValidation = validateContent(content, CONTENT_LIMITS.COMMENT_MAX_LENGTH, 'Comment')
    if (!contentValidation.valid) {
      return NextResponse.json(
        { error: contentValidation.error },
        { status: 400 }
      )
    }

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const comment = await prisma.postComment.create({
      data: {
        postId,
        userId: user.id,
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    })

    // Send notification to post owner (async, don't wait)
    notifyPostComment(user.id, post.userId, postId, content.trim()).catch(console.error)

    return NextResponse.json({ success: true, comment }, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}
