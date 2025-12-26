import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { validateImageFile, FILE_SIZE_LIMITS } from '@/lib/file-validation'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { processAvatarImage, isImageProcessingAvailable } from '@/lib/security/image-processing'
import logger from '@/lib/logger'

// Maximum upload size constants
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024 // 5MB hard limit
const MAX_AVATAR_SIZE_MB = 5

// POST handler for file upload
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  // Check Content-Length header FIRST
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (size > MAX_AVATAR_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_AVATAR_SIZE_MB}MB.` },
        { status: 413 }
      )
    }
  }

  // Rate limiting
  const rateLimitResult = await rateLimit(request, { ...RateLimitPresets.hourly, keyPrefix: 'group-avatar-upload' })
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many upload attempts. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    const { groupId } = await params

    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is the group owner
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { ownerId: true }
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    if (group.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Only group owner can update avatar' },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Check file size
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_AVATAR_SIZE_MB}MB.` },
        { status: 413 }
      )
    }

    // Comprehensive file validation
    const validation = await validateImageFile(file, FILE_SIZE_LIMITS.AVATAR)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    let buffer = Buffer.from(arrayBuffer)
    let contentType = file.type

    // SECURITY: Process image to strip EXIF metadata
    const processingAvailable = await isImageProcessingAvailable()
    if (processingAvailable) {
      const processed = await processAvatarImage(buffer)
      if (processed) {
        buffer = Buffer.from(processed.buffer)
        contentType = `image/${processed.format}`
        logger.info('Group avatar processed', {
          data: {
            groupId,
            originalSize: arrayBuffer.byteLength,
            processedSize: processed.size,
            metadataStripped: processed.metadataStripped,
          }
        })
      }
    }

    // Generate safe filename
    const extension = contentType.split('/')[1] || 'webp'
    const fileName = `group-${groupId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`
    const filePath = `group-avatars/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      })

    if (uploadError) {
      logger.error('Group avatar upload error', uploadError)
      return NextResponse.json(
        { error: 'Upload failed. Please try again.' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath)

    // Update group avatar in database
    await prisma.group.update({
      where: { id: groupId },
      data: { avatarUrl: urlData.publicUrl }
    })

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    })
  } catch (error) {
    logger.error('Group avatar upload error', error as Error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH handler for URL update (legacy support)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params

    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { avatarUrl } = body

    if (!avatarUrl) {
      return NextResponse.json(
        { error: 'Avatar URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format and ensure it's from our storage
    try {
      const url = new URL(avatarUrl)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      if (!avatarUrl.startsWith(supabaseUrl)) {
        return NextResponse.json(
          { error: 'Invalid avatar URL. Must be uploaded through our service.' },
          { status: 400 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Check if user is the group owner
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { ownerId: true }
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    if (group.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Only group owner can update avatar' },
        { status: 403 }
      )
    }

    // Update group avatar
    await prisma.group.update({
      where: { id: groupId },
      data: { avatarUrl }
    })

    return NextResponse.json({
      success: true,
      message: 'Avatar updated successfully'
    })
  } catch (error) {
    logger.error('Error updating group avatar', error as Error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
