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

// DELETE - Delete post
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

    // Check if post exists and user owns it
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
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
