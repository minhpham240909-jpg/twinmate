import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateImageFile, FILE_SIZE_LIMITS } from '@/lib/file-validation'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { invalidateUserCache } from '@/lib/cache'
import { processAvatarImage, isImageProcessingAvailable } from '@/lib/security/image-processing'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

export async function POST(request: NextRequest) {
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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

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

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    let buffer: Buffer = Buffer.from(arrayBuffer)
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
            originalSize: arrayBuffer.byteLength,
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
