import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET /api/posts/deleted - Get user's deleted posts (for history/restore)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // First, cleanup posts older than 30 days (automatic cleanup)
    const expiredPosts = await prisma.post.findMany({
      where: {
        userId: user.id,
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      },
      select: {
        id: true,
        imageUrls: true,
      },
    })

    // Delete images from storage for expired posts
    // N+1 FIX: Collect all file paths first, then batch delete
    const allFilePaths: string[] = []
    for (const post of expiredPosts) {
      if (post.imageUrls && post.imageUrls.length > 0) {
        for (const imageUrl of post.imageUrls) {
          const urlParts = imageUrl.split('/post-images/')
          if (urlParts.length === 2) {
            allFilePaths.push(urlParts[1])
          }
        }
      }
    }

    // Batch delete all images at once
    if (allFilePaths.length > 0) {
      try {
        await supabase.storage.from('post-images').remove(allFilePaths)
      } catch (error) {
        console.error('Error batch deleting images:', error)
      }
    }

    // Permanently delete expired posts
    await prisma.post.deleteMany({
      where: {
        userId: user.id,
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      },
    })

    // Get remaining deleted posts (within 30 days)
    const deletedPosts = await prisma.post.findMany({
      where: {
        userId: user.id,
        isDeleted: true,
        deletedAt: {
          gt: thirtyDaysAgo,
        },
      },
      include: {
        _count: {
          select: {
            likes: true,
            comments: true,
            reposts: true,
          },
        },
      },
      orderBy: {
        deletedAt: 'desc',
      },
    })

    // Calculate days remaining for each post
    const postsWithDaysRemaining = deletedPosts.map((post) => {
      const daysRemaining = post.deletedAt
        ? 30 - Math.floor((Date.now() - new Date(post.deletedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 30

      return {
        ...post,
        daysRemaining: Math.max(0, daysRemaining),
      }
    })

    return NextResponse.json({
      posts: postsWithDaysRemaining,
      count: postsWithDaysRemaining.length,
    })
  } catch (error) {
    console.error('Error fetching deleted posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deleted posts' },
      { status: 500 }
    )
  }
}
