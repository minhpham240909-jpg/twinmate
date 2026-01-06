import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { CONTENT_LIMITS } from '@/lib/constants'
import { validateContent } from '@/lib/validation'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { notifyPostComment } from '@/lib/notifications/send'

// GET /api/posts/[postId]/comments - Get comments for a post (with replies)
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

    // OPTIMIZATION: Fetch top-level comments (parentId is null), post settings, and partner connections in parallel
    const [comments, post, partnerConnections] = await Promise.all([
      prisma.postComment.findMany({
        where: {
          postId,
          parentId: null, // Only top-level comments, not replies
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
          _count: {
            select: {
              replies: true, // Count of replies for "X replies" display
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      }) as Promise<any[]>,
      // Get post settings
      prisma.post.findUnique({
        where: { id: postId },
        select: {
          allowComments: true,
          allowLikes: true,
        },
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

    const partnerIds = new Set(partnerConnections.map(match =>
      match.senderId === user.id ? match.receiverId : match.senderId
    ))

    // Add onlineStatus, partner status, and reply count to commenters
    const commentsWithStatus = comments.map((comment: any) => ({
      ...comment,
      replyCount: comment._count?.replies || 0,
      user: {
        ...comment.user,
        onlineStatus: partnerIds.has(comment.user.id) ? comment.user.presence?.status : null,
        isPartner: partnerIds.has(comment.user.id),
      },
    }))

    return NextResponse.json({
      comments: commentsWithStatus,
      allowComments: post?.allowComments ?? true,
      allowLikes: post?.allowLikes ?? true,
    })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

// POST /api/posts/[postId]/comments - Add a comment or reply to a post
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
    const { content, parentId } = body // parentId is optional - if provided, this is a reply

    // Validate content
    const contentValidation = validateContent(content, CONTENT_LIMITS.COMMENT_MAX_LENGTH, 'Comment')
    if (!contentValidation.valid) {
      return NextResponse.json(
        { error: contentValidation.error },
        { status: 400 }
      )
    }

    // Check if post exists and allows comments
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        userId: true,
        allowComments: true,
      },
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check if comments are allowed on this post
    if (!post.allowComments) {
      return NextResponse.json(
        { error: 'Comments are disabled for this post' },
        { status: 403 }
      )
    }

    // If this is a reply, validate the parent comment exists and belongs to same post
    let parentComment = null
    if (parentId) {
      parentComment = await prisma.postComment.findFirst({
        where: {
          id: parentId,
          postId: postId,
          parentId: null, // Only allow replying to top-level comments (1-level deep)
        },
        select: {
          id: true,
          userId: true,
        },
      })

      if (!parentComment) {
        return NextResponse.json(
          { error: 'Parent comment not found or cannot reply to a reply' },
          { status: 400 }
        )
      }
    }

    const comment = await prisma.postComment.create({
      data: {
        postId,
        userId: user.id,
        content: content.trim(),
        parentId: parentId || null, // null for top-level comments
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

    // Send notification to post owner (for comments) or parent comment author (for replies)
    if (parentId && parentComment) {
      // Notify parent comment author about the reply (if not self-reply)
      if (parentComment.userId !== user.id) {
        notifyPostComment(user.id, parentComment.userId, postId, content.trim()).catch(console.error)
      }
    } else {
      // Notify post owner about the comment (if not self-comment)
      if (post.userId !== user.id) {
        notifyPostComment(user.id, post.userId, postId, content.trim()).catch(console.error)
      }
    }

    return NextResponse.json({ success: true, comment }, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}
