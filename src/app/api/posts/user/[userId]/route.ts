import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET /api/posts/user/[userId] - Get posts by specific user (for profile page)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await params

    // OPTIMIZED: Get user's posts with counts only (not all likes/comments)
    // Only fetch current user's like/repost status, use _count for totals
    const posts = await prisma.post.findMany({
      where: {
        userId: userId,
        isDeleted: false, // Exclude soft-deleted posts
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        // Only fetch current user's like (for isLikedByUser check)
        likes: {
          where: { userId: user.id },
          select: { userId: true },
          take: 1,
        },
        // Only fetch current user's repost (for isRepostedByUser check)
        reposts: {
          where: { userId: user.id },
          select: { userId: true },
          take: 1,
        },
        // Use _count for totals instead of fetching all records
        _count: {
          select: {
            likes: true,
            comments: true,
            reposts: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Map to include isLikedByUser and isRepostedByUser flags
    const postsWithUserData = posts.map(post => ({
      ...post,
      isLikedByUser: post.likes.length > 0,
      isRepostedByUser: post.reposts.length > 0,
      // Remove the filtered likes/reposts arrays from response (we only needed them for the check)
      likes: undefined,
      reposts: undefined,
    }))

    return NextResponse.json({ posts: postsWithUserData })
  } catch (error) {
    console.error('Error fetching user posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user posts' },
      { status: 500 }
    )
  }
}
