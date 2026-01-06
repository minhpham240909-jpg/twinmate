import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

// DELETE /api/posts/[postId]/comments/[commentId] - Delete a comment
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  try {
    // Rate limit: 30 deletes per minute (lenient for legitimate use)
    const rateLimitResult = await rateLimit(req, { ...RateLimitPresets.lenient, keyPrefix: 'comment-delete' })
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

    const { postId, commentId } = await params

    // Find the comment and check ownership
    // Using findFirst with compound where for efficiency (single query)
    const comment = await prisma.postComment.findFirst({
      where: {
        id: commentId,
        postId: postId,
      },
      select: {
        id: true,
        userId: true,
        post: {
          select: {
            userId: true,
          },
        },
      },
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // SECURITY: Only allow deletion by:
    // 1. The comment author
    // 2. The post owner (can delete any comment on their post)
    const isCommentAuthor = comment.userId === user.id
    const isPostOwner = comment.post.userId === user.id

    if (!isCommentAuthor && !isPostOwner) {
      return NextResponse.json(
        { error: 'You can only delete your own comments' },
        { status: 403 }
      )
    }

    // Delete the comment
    await prisma.postComment.delete({
      where: { id: commentId },
    })

    return NextResponse.json({ success: true, message: 'Comment deleted' })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    )
  }
}
