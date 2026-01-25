import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

// POST /api/history/cleanup - Cleanup permanently delete items older than 30 days
// This should be called by a cron job or scheduled task
export async function POST(request: NextRequest) {
  try {
    // Authentication: Support multiple methods
    const authHeader = request.headers.get('authorization')
    const vercelCronSecret = request.headers.get('x-vercel-cron-secret')
    const expectedKey = process.env.CLEANUP_API_KEY
    const vercelCronKey = process.env.CRON_SECRET

    // Check authentication
    let isAuthenticated = false

    // Method 1: Vercel Cron (if using Vercel)
    if (vercelCronKey && vercelCronSecret === vercelCronKey) {
      isAuthenticated = true
    }
    // Method 2: API Key Bearer token
    else if (expectedKey && authHeader === `Bearer ${expectedKey}`) {
      isAuthenticated = true
    }
    // Method 3: Allow if no key is set (development only - NOT recommended for production)
    else if (!expectedKey && !vercelCronKey) {
      console.warn('⚠️  WARNING: Cleanup endpoint is not secured! Set CLEANUP_API_KEY in production.')
      isAuthenticated = true
    }

    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized. Provide valid Authorization header or Vercel cron secret.' },
        { status: 401 }
      )
    }

    const supabase = await createClient()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    let deletedCount = {
      messages: 0,
      groups: 0,
      posts: 0,
    }

    // Cleanup expired messages
    const expiredMessages = await prisma.message.findMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      } as any,
      select: {
        id: true,
        fileUrl: true,
      },
    })

    // Delete files from storage
    for (const message of expiredMessages) {
      if (message.fileUrl) {
        try {
          const urlParts = message.fileUrl.split('/')
          const fileName = urlParts[urlParts.length - 1]
          if (fileName) {
            await supabase.storage.from('messages').remove([fileName])
          }
        } catch (error) {
          console.error('Error deleting message file:', error)
        }
      }
    }

    deletedCount.messages = await prisma.message.deleteMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      } as any,
    }).then(result => result.count)

    // Cleanup expired groups
    const expiredGroups = await prisma.group.findMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      } as any,
      select: {
        id: true,
        avatarUrl: true,
      },
    })

    // Delete avatars from storage
    for (const group of expiredGroups) {
      if (group.avatarUrl) {
        try {
          const urlParts = group.avatarUrl.split('/')
          const fileName = urlParts[urlParts.length - 1]
          if (fileName) {
            await supabase.storage.from('groups').remove([fileName])
          }
        } catch (error) {
          console.error('Error deleting group avatar:', error)
        }
      }
    }

    deletedCount.groups = await prisma.group.deleteMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      } as any,
    }).then(result => result.count)

    // Cleanup expired posts (if not already handled)
    const expiredPosts = await prisma.post.findMany({
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

    // Delete images from storage
    for (const post of expiredPosts) {
      if (post.imageUrls && post.imageUrls.length > 0) {
        for (const imageUrl of post.imageUrls) {
          try {
            const urlParts = imageUrl.split('/post-images/')
            if (urlParts.length === 2) {
              const filePath = urlParts[1]
              await supabase.storage.from('post-images').remove([filePath])
            }
          } catch (error) {
            console.error('Error deleting post image:', error)
          }
        }
      }
    }

    deletedCount.posts = await prisma.post.deleteMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      } as any,
    }).then(result => result.count)

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      deleted: deletedCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error during cleanup:', error)
    return NextResponse.json(
      { error: 'Failed to run cleanup' },
      { status: 500 }
    )
  }
}

// GET /api/history/cleanup - Health check endpoint
export async function GET(request: NextRequest) {
  // Rate limiting - lenient for health check
  const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  return NextResponse.json({
    status: 'ok',
    message: 'Cleanup endpoint is active',
    timestamp: new Date().toISOString(),
  })
}
