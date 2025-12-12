import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateImageFile, FILE_SIZE_LIMITS } from '@/lib/file-validation'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { invalidateUserCache } from '@/lib/cache'
import { processAvatarImage, isImageProcessingAvailable } from '@/lib/security/image-processing'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

// H16 FIX: Maximum upload size constants (enforce before full buffer load)
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024 // 5MB hard limit
const MAX_AVATAR_SIZE_MB = 5

export async function POST(request: NextRequest) {
  // H16 FIX: Check Content-Length header FIRST before any processing
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (size > MAX_AVATAR_SIZE_BYTES) {
      logger.warn('Avatar upload rejected - Content-Length exceeds limit', {
        data: { contentLength: size, maxAllowed: MAX_AVATAR_SIZE_BYTES }
      })
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_AVATAR_SIZE_MB}MB.` },
        { status: 413 } // Payload Too Large
      )
    }
  }

  // Rate limiting: 10 uploads per hour
  const rateLimitResult = await rateLimit(request, { ...RateLimitPresets.hourly, keyPrefix: 'avatar-upload' })
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

    // H16 FIX: Parse form data with size tracking
    let totalBytesRead = 0
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // H16 FIX: Check file size BEFORE loading into memory
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      logger.warn('Avatar upload rejected - File size exceeds limit', {
        data: { fileSize: file.size, maxAllowed: MAX_AVATAR_SIZE_BYTES }
      })
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_AVATAR_SIZE_MB}MB.` },
        { status: 413 }
      )
    }

    // SECURITY FIX: Always use authenticated user's ID
    // Ignore any userId from form data to prevent IDOR attacks
    const targetUserId = user.id

    // Comprehensive file validation
    const validation = await validateImageFile(file, FILE_SIZE_LIMITS.AVATAR)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // H16 FIX: Stream file to buffer with size limit enforcement
    let buffer: Buffer
    try {
      const arrayBuffer = await file.arrayBuffer()
      totalBytesRead = arrayBuffer.byteLength
      
      // Double-check size after read (belt and suspenders)
      if (totalBytesRead > MAX_AVATAR_SIZE_BYTES) {
        logger.warn('Avatar upload rejected - ArrayBuffer exceeds limit', {
          data: { bytesRead: totalBytesRead, maxAllowed: MAX_AVATAR_SIZE_BYTES }
        })
        return NextResponse.json(
          { error: `File too large. Maximum size is ${MAX_AVATAR_SIZE_MB}MB.` },
          { status: 413 }
        )
      }
      
      buffer = Buffer.from(arrayBuffer)
    } catch (readError) {
      logger.error('Avatar upload - Error reading file', readError as Error)
      return NextResponse.json(
        { error: 'Error reading file. Please try a smaller file.' },
        { status: 400 }
      )
    }
    let contentType = file.type

    // SECURITY: Process image to strip EXIF metadata (GPS, camera info, etc.)
    const processingAvailable = await isImageProcessingAvailable()
    if (processingAvailable) {
      const processed = await processAvatarImage(buffer)
      if (processed) {
        buffer = Buffer.from(processed.buffer) // Ensure proper Buffer type
        contentType = `image/${processed.format}`
        logger.info('Avatar image processed', {
          data: {
            userId: targetUserId,
            originalSize: totalBytesRead,
            processedSize: processed.size,
            metadataStripped: processed.metadataStripped,
          }
        })
      }
    }

    // Generate safe filename with appropriate extension
    const extension = contentType.split('/')[1] || 'webp'
    const fileName = `${targetUserId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`
    const filePath = `avatars/${fileName}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Upload failed. Please try again.' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath)

    // Update user's avatarUrl in the database
    await prisma.user.update({
      where: { id: targetUserId },
      data: { avatarUrl: urlData.publicUrl },
    })

    // Invalidate user cache after avatar upload
    await invalidateUserCache(targetUserId)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    })
  } catch (error) {
    console.error('Avatar upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
