import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// POST /api/posts/[postId]/restore - Restore a soft-deleted post
export async function POST(
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
      select: {
        userId: true,
        isDeleted: true,
        deletedAt: true,
      },
    })

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (existingPost.userId !== user.id) {
      return NextResponse.json(
        { error: 'You can only restore your own posts' },
        { status: 403 }
      )
    }

    if (!existingPost.isDeleted) {
      return NextResponse.json(
        { error: 'Post is not deleted' },
        { status: 400 }
      )
    }

    // Check if post is past 30 days (should be permanently deleted)
    if (existingPost.deletedAt) {
      const daysSinceDeleted = Math.floor(
        (Date.now() - new Date(existingPost.deletedAt).getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysSinceDeleted > 30) {
        return NextResponse.json(
          { error: 'Post cannot be restored after 30 days' },
          { status: 400 }
        )
      }
    }

    // Restore the post
    const restoredPost = await prisma.post.update({
      where: { id: postId },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Post restored successfully',
      post: restoredPost,
    })
  } catch (error) {
    console.error('Error restoring post:', error)
    return NextResponse.json(
      { error: 'Failed to restore post' },
      { status: 500 }
    )
  }
}
