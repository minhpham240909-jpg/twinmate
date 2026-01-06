import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

// PATCH /api/posts/[postId]/settings - Update post settings (allowComments, allowLikes)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    // Rate limit: 30 updates per minute
    const rateLimitResult = await rateLimit(req, { ...RateLimitPresets.lenient, keyPrefix: 'post-settings' })
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
    const { allowComments, allowLikes } = body

    // Validate that at least one setting is provided
    if (allowComments === undefined && allowLikes === undefined) {
      return NextResponse.json(
        { error: 'No settings to update' },
        { status: 400 }
      )
    }

    // Check post exists and user owns it
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        userId: true,
      },
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Only post owner can update settings
    if (post.userId !== user.id) {
      return NextResponse.json(
        { error: 'Only the post owner can update settings' },
        { status: 403 }
      )
    }

    // Build update data
    const updateData: { allowComments?: boolean; allowLikes?: boolean } = {}
    if (typeof allowComments === 'boolean') {
      updateData.allowComments = allowComments
    }
    if (typeof allowLikes === 'boolean') {
      updateData.allowLikes = allowLikes
    }

    // Update the post settings
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: updateData,
      select: {
        id: true,
        allowComments: true,
        allowLikes: true,
      },
    })

    return NextResponse.json({
      success: true,
      post: updatedPost,
    })
  } catch (error) {
    console.error('Error updating post settings:', error)
    return NextResponse.json(
      { error: 'Failed to update post settings' },
      { status: 500 }
    )
  }
}

// GET /api/posts/[postId]/settings - Get post settings
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = await params

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        userId: true,
        allowComments: true,
        allowLikes: true,
        allowSharing: true,
      },
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      settings: {
        allowComments: post.allowComments,
        allowLikes: post.allowLikes,
        allowSharing: post.allowSharing,
        isOwner: post.userId === user.id,
      },
    })
  } catch (error) {
    console.error('Error fetching post settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch post settings' },
      { status: 500 }
    )
  }
}
