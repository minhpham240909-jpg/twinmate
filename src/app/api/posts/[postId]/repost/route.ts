import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'

// POST /api/posts/[postId]/repost - Repost a post
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    // Rate limit: 10 reposts per minute (stricter than likes as reposts create content)
    const rateLimitResult = await rateLimit(req, { max: 10, windowMs: 60000, keyPrefix: 'reposts' })
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
    const body = await req.json()
    const { comment } = body // Optional comment for quote repost

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check if already reposted
    const existingRepost = await prisma.postRepost.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    })

    if (existingRepost) {
      return NextResponse.json(
        { error: 'Already reposted' },
        { status: 400 }
      )
    }

    // Validate comment if provided
    if (comment && comment.length > 1000) {
      return NextResponse.json(
        { error: 'Comment too long (max 1000 characters)' },
        { status: 400 }
      )
    }

    // Create repost
    const repost = await prisma.postRepost.create({
      data: {
        postId,
        userId: user.id,
        comment: comment?.trim() || null,
      },
      include: {
        post: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ success: true, repost }, { status: 201 })
  } catch (error) {
    console.error('Error reposting:', error)
    return NextResponse.json(
      { error: 'Failed to repost' },
      { status: 500 }
    )
  }
}

// DELETE /api/posts/[postId]/repost - Remove repost
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

    // Check if repost exists before attempting to delete
    const existingRepost = await prisma.postRepost.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    })

    if (!existingRepost) {
      return NextResponse.json(
        { error: 'Repost not found' },
        { status: 404 }
      )
    }

    // Delete repost
    await prisma.postRepost.delete({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing repost:', error)
    return NextResponse.json(
      { error: 'Failed to remove repost' },
      { status: 500 }
    )
  }
}
