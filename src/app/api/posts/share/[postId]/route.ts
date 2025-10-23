import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/posts/share/[postId] - Get public post for sharing (no auth required)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params

    // Get post with public access (no auth required for shared links)
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            // Only name and avatar for public viewing
          },
        },
        likes: {
          select: {
            userId: true,
          },
        },
        comments: {
          take: 3, // Only show first 3 comments to public
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
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

    // Check if post exists
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // Check if post is deleted
    if (post.isDeleted) {
      return NextResponse.json(
        { error: 'This post has been removed' },
        { status: 404 }
      )
    }

    // Check if sharing is allowed
    if (!post.allowSharing) {
      return NextResponse.json(
        { error: 'This post cannot be shared' },
        { status: 403 }
      )
    }

    // Return post data for public viewing
    return NextResponse.json({
      post: {
        id: post.id,
        content: post.content,
        imageUrls: post.imageUrls,
        createdAt: post.createdAt,
        user: post.user,
        _count: post._count,
        likesCount: post._count.likes,
        commentsCount: post._count.comments,
        repostsCount: post._count.reposts,
        comments: post.comments,
        hasMoreComments: post._count.comments > 3,
      },
    })
  } catch (error) {
    console.error('Error fetching shared post:', error)
    return NextResponse.json(
      { error: 'Failed to fetch post' },
      { status: 500 }
    )
  }
}
