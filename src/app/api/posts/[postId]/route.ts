import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { moderateContent, flagContent } from '@/lib/moderation/content-moderator'

// PATCH - Edit post
export async function PATCH(
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
    const { content } = await req.json()

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: 'Content must be 5000 characters or less' },
        { status: 400 }
      )
    }

    // CONTENT MODERATION: Check edited content for inappropriate language
    const trimmedContent = content.trim()
    if (trimmedContent.length > 0) {
      const moderationResult = await moderateContent(trimmedContent, 'post')

      // Block if content contains profanity, hate speech, or other inappropriate content
      if (moderationResult.action === 'block') {
        // Get user info for logging
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { name: true, email: true },
        })

        // Flag the content for admin review
        await flagContent({
          contentType: 'post',
          contentId: `edit-blocked-${postId}`, // Reference the post being edited
          content: trimmedContent,
          senderId: user.id,
          senderEmail: dbUser?.email,
          senderName: dbUser?.name,
          moderationResult,
        })

        // Return user-friendly error based on category
        const categoryMessages: Record<string, string> = {
          profanity: 'Your post contains inappropriate language. Please remove profanity and try again.',
          hate_speech: 'Your post contains language that violates our community guidelines. Please revise and try again.',
          harassment: 'Your post contains content that may be harmful to others. Please revise and try again.',
          violence: 'Your post contains content that promotes violence. This is not allowed.',
          sexual_content: 'Your post contains inappropriate content. Please keep posts safe for all users.',
          self_harm: 'Your post contains concerning content. If you need support, please reach out to a trusted person or helpline.',
          spam: 'Your post appears to be spam. Please share genuine, meaningful content.',
          dangerous: 'Your post contains potentially harmful content. Please revise and try again.',
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

      // Store moderation result for flagging after update (if suspicious but not blocked)
      if (moderationResult.action === 'flag' || moderationResult.action === 'escalate') {
        (req as any).__moderationResult = moderationResult
      }
    }

    // SECURITY: Check ownership IN the database query to prevent IDOR
    // This prevents revealing whether posts exist that the user doesn't own
    const existingPost = await prisma.post.findFirst({
      where: {
        id: postId,
        userId: user.id, // Check ownership in DB, not after fetching
      },
      select: { userId: true, content: true, createdAt: true, updatedAt: true },
    })

    // Return 404 for both "doesn't exist" and "not authorized" cases
    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Note: Edit history tracking requires schema migration to add:
    // - editHistory Json[] @default([]) - Array of {content, editedAt} objects
    // - isEdited Boolean @default(false)
    // For now, we track edits via updatedAt timestamp difference from createdAt

    // Update the post
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        content: trimmedContent,
        // updatedAt is automatically set by Prisma
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
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

    // If content was flagged for review (but not blocked), flag the edited post
    const moderationResult = (req as any).__moderationResult
    if (moderationResult && (moderationResult.action === 'flag' || moderationResult.action === 'escalate')) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true, email: true },
      })

      await flagContent({
        contentType: 'post',
        contentId: postId,
        content: trimmedContent,
        senderId: user.id,
        senderEmail: dbUser?.email,
        senderName: dbUser?.name,
        moderationResult,
      })
    }

    return NextResponse.json({ post: updatedPost })
  } catch (error) {
    console.error('Error updating post:', error)
    return NextResponse.json(
      { error: 'Failed to update post' },
      { status: 500 }
    )
  }
}

// DELETE - Delete post (soft delete or permanent delete)
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

    // Check for permanent delete flag in query params
    const { searchParams } = new URL(req.url)
    const permanent = searchParams.get('permanent') === 'true'

    // SECURITY: Check ownership IN the database query to prevent IDOR
    const existingPost = await prisma.post.findFirst({
      where: {
        id: postId,
        userId: user.id, // Check ownership in DB
      },
      select: { userId: true, isDeleted: true, imageUrls: true },
    })

    // Return 404 for both "doesn't exist" and "not authorized" cases
    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Permanent delete - remove from database completely
    if (permanent) {
      // Only allow permanent delete on already soft-deleted posts
      if (!existingPost.isDeleted) {
        return NextResponse.json(
          { error: 'Post must be soft-deleted first before permanent deletion' },
          { status: 400 }
        )
      }

      // Delete associated images from Supabase Storage
      if (existingPost.imageUrls && existingPost.imageUrls.length > 0) {
        for (const imageUrl of existingPost.imageUrls) {
          try {
            const urlParts = imageUrl.split('/post-images/')
            if (urlParts.length === 2) {
              const filePath = urlParts[1]
              await supabase.storage.from('post-images').remove([filePath])
            }
          } catch (error) {
            console.error('Error deleting image:', error)
            // Continue even if image deletion fails
          }
        }
      }

      // Delete all related records first (likes, comments, reposts)
      await prisma.$transaction([
        prisma.postLike.deleteMany({ where: { postId } }),
        prisma.postComment.deleteMany({ where: { postId } }),
        prisma.postRepost.deleteMany({ where: { postId } }),
        prisma.post.delete({ where: { id: postId } }),
      ])

      return NextResponse.json({
        success: true,
        message: 'Post permanently deleted.',
        permanent: true,
      })
    }

    // Soft delete the post (mark as deleted, keep for 30 days)
    await prisma.post.update({
      where: { id: postId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Post moved to history. You can restore it within 30 days.',
    })
  } catch (error) {
    console.error('Error deleting post:', error)
    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    )
  }
}
