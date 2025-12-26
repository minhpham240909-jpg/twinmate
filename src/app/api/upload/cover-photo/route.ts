import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { validateImageFile, FILE_SIZE_LIMITS } from '@/lib/file-validation'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { invalidateUserCache } from '@/lib/cache'
import { processAvatarImage, isImageProcessingAvailable } from '@/lib/security/image-processing'
import logger from '@/lib/logger'

// Maximum upload size constants
const MAX_COVER_SIZE_BYTES = 10 * 1024 * 1024 // 10MB hard limit
const MAX_COVER_SIZE_MB = 10

export async function POST(request: NextRequest) {
  // Check Content-Length header FIRST before any processing
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (size > MAX_COVER_SIZE_BYTES) {
      logger.warn('Cover photo upload rejected - Content-Length exceeds limit', {
        data: { contentLength: size, maxAllowed: MAX_COVER_SIZE_BYTES }
      })
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_COVER_SIZE_MB}MB.` },
        { status: 413 }
      )
    }
  }

  // Rate limiting: 10 uploads per hour
  const rateLimitResult = await rateLimit(request, { ...RateLimitPresets.hourly, keyPrefix: 'cover-photo-upload' })
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many upload attempts. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
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

    // Check file size BEFORE loading into memory
    if (file.size > MAX_COVER_SIZE_BYTES) {
      logger.warn('Cover photo upload rejected - File size exceeds limit', {
        data: { fileSize: file.size, maxAllowed: MAX_COVER_SIZE_BYTES }
      })
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_COVER_SIZE_MB}MB.` },
        { status: 413 }
      )
    }

    // SECURITY FIX: Always use authenticated user's ID
    // Ignore any userId from form data to prevent IDOR attacks
    const targetUserId = user.id

    // Comprehensive file validation
    const validation = await validateImageFile(file, FILE_SIZE_LIMITS.COVER_PHOTO)
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

    // SECURITY: Process image to strip EXIF metadata (GPS, camera info, etc.)
    const processingAvailable = await isImageProcessingAvailable()
    if (processingAvailable) {
      const processed = await processAvatarImage(buffer)
      if (processed) {
        buffer = Buffer.from(processed.buffer)
        contentType = `image/${processed.format}`
        logger.info('Cover photo processed', {
          data: {
            userId: targetUserId,
            originalSize: arrayBuffer.byteLength,
            processedSize: processed.size,
            metadataStripped: processed.metadataStripped,
          }
        })
      }
    }

    // Generate safe filename with appropriate extension
    const extension = contentType.split('/')[1] || 'webp'
    const fileName = `${targetUserId}-cover-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`
    const filePath = `cover-photos/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      })

    if (uploadError) {
      logger.error('Cover photo upload error', uploadError)
      return NextResponse.json(
        { error: 'Upload failed. Please try again.' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath)

    // Update user's coverPhotoUrl in database
    await prisma.user.update({
      where: { id: targetUserId },
      data: { coverPhotoUrl: urlData.publicUrl } as any,
    })

    // Invalidate user cache after cover photo upload
    await invalidateUserCache(targetUserId)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    })
  } catch (error) {
    logger.error('Cover photo upload error', error as Error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
