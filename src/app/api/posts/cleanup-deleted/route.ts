import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET /api/posts/cleanup-deleted - Permanently delete posts older than 30 days
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

    // Find posts to permanently delete
    const postsToDelete = await prisma.post.findMany({
      where: {
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

    // Delete images from Supabase Storage
    for (const post of postsToDelete) {
      if (post.imageUrls && post.imageUrls.length > 0) {
        for (const imageUrl of post.imageUrls) {
          try {
            // Extract file path from URL
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
    }

    // Permanently delete posts (CASCADE will delete likes, comments, reposts)
    const result = await prisma.post.deleteMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `Permanently deleted ${result.count} posts`,
      deletedCount: result.count,
    })
  } catch (error) {
    console.error('Error cleaning up deleted posts:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup deleted posts' },
      { status: 500 }
    )
  }
}
