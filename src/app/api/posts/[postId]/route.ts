import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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

    // Check if post exists and user owns it
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true, content: true, createdAt: true, updatedAt: true },
    })

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (existingPost.userId !== user.id) {
      return NextResponse.json(
        { error: 'You can only edit your own posts' },
        { status: 403 }
      )
    }

    // Note: Edit history tracking requires schema migration to add:
    // - editHistory Json[] @default([]) - Array of {content, editedAt} objects
    // - isEdited Boolean @default(false)
    // For now, we track edits via updatedAt timestamp difference from createdAt

    // Update the post
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        content: content.trim(),
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

    // Check if post exists and user owns it
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true, isDeleted: true, imageUrls: true },
    })

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (existingPost.userId !== user.id) {
      return NextResponse.json(
        { error: 'You can only delete your own posts' },
        { status: 403 }
      )
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
