import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { CONTENT_LIMITS } from '@/lib/constants'
import { validateContent } from '@/lib/validation'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { notifyPostComment } from '@/lib/notifications/send'
import { moderateContent, flagContent } from '@/lib/moderation/content-moderator'

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

    // CONTENT MODERATION: Check for inappropriate content before creating comment
    const trimmedContent = content.trim()
    if (trimmedContent.length > 0) {
      const moderationResult = await moderateContent(trimmedContent, 'comment')

      // Block if content contains profanity, hate speech, or other inappropriate content
      if (moderationResult.action === 'block') {
        // Get user info for logging (batch with post check if needed)
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { name: true, email: true },
        })

        // Flag the content for admin review
        await flagContent({
          contentType: 'comment',
          contentId: `pending-comment-${Date.now()}`, // Temporary ID since comment wasn't created
          content: trimmedContent,
          senderId: user.id,
          senderEmail: dbUser?.email,
          senderName: dbUser?.name,
          moderationResult,
        })

        // Return user-friendly error based on category
        const categoryMessages: Record<string, string> = {
          profanity: 'Your comment contains inappropriate language. Please remove profanity and try again.',
          hate_speech: 'Your comment contains language that violates our community guidelines. Please revise and try again.',
          harassment: 'Your comment contains content that may be harmful to others. Please revise and try again.',
          violence: 'Your comment contains content that promotes violence. This is not allowed.',
          sexual_content: 'Your comment contains inappropriate content. Please keep comments safe for all users.',
          self_harm: 'Your comment contains concerning content. If you need support, please reach out to a trusted person or helpline.',
          spam: 'Your comment appears to be spam. Please share genuine, meaningful content.',
          dangerous: 'Your comment contains potentially harmful content. Please revise and try again.',
        }

        const primaryCategory = moderationResult.categories.find(c => c !== 'safe') || 'dangerous'
        const errorMessage = categoryMessages[primaryCategory] || 'Your comment contains content that violates our community guidelines. Please revise and try again.'

        return NextResponse.json(
          {
            error: errorMessage,
            code: 'CONTENT_MODERATION_BLOCKED',
            category: primaryCategory,
          },
          { status: 400 }
        )
      }

      // Store moderation result for flagging after creation (if suspicious but not blocked)
      if (moderationResult.action === 'flag' || moderationResult.action === 'escalate') {
        (req as any).__moderationResult = moderationResult
      }
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
        content: trimmedContent,
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

    // If content was flagged for review (but not blocked), flag the created comment
    const moderationResult = (req as any).__moderationResult
    if (moderationResult && (moderationResult.action === 'flag' || moderationResult.action === 'escalate')) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true, email: true },
      })

      await flagContent({
        contentType: 'comment',
        contentId: comment.id,
        content: trimmedContent,
        senderId: user.id,
        senderEmail: dbUser?.email,
        senderName: dbUser?.name,
        conversationId: postId,
        moderationResult,
      })
    }

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
