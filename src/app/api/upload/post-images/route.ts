import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMultipleImages, FILE_SIZE_LIMITS } from '@/lib/file-validation'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { processPostImage, isImageProcessingAvailable } from '@/lib/security/image-processing'
import logger from '@/lib/logger'

export async function POST(req: NextRequest) {
  // Rate limiting: 10 uploads per hour
  const rateLimitResult = await rateLimit(req, { ...RateLimitPresets.hourly, keyPrefix: 'post-images-upload' })
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many upload attempts. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const files = formData.getAll('images') as File[]

    // Comprehensive validation for all files
    const validation = await validateMultipleImages(
      files,
      FILE_SIZE_LIMITS.MAX_POST_IMAGES,
      FILE_SIZE_LIMITS.POST_IMAGE
    )

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const uploadedUrls: string[] = []
    const processingAvailable = await isImageProcessingAvailable()

    for (const file of files) {
      // Convert File to ArrayBuffer then to Buffer
      const arrayBuffer = await file.arrayBuffer()
      let buffer = Buffer.from(arrayBuffer)
      let contentType = file.type

      // OPTIMIZATION: Compress images using sharp (WebP format for smaller size)
      if (processingAvailable) {
        const processed = await processPostImage(buffer)
        if (processed) {
          buffer = Buffer.from(processed.buffer)
          contentType = `image/${processed.format}`
          logger.info('Post image compressed', {
            data: {
              userId: user.id,
              originalSize: arrayBuffer.byteLength,
              compressedSize: processed.size,
              compressionRatio: Math.round((1 - processed.size / arrayBuffer.byteLength) * 100) + '%',
              format: processed.format,
            }
          })
        }
      }

      // Generate safe filename with appropriate extension
      const extension = contentType.split('/')[1] || 'webp'
      const fileName = `${user.id}/${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(fileName, buffer, {
          contentType,
          cacheControl: '3600',
          upsert: false,
        })

      if (error) {
        console.error('Upload error:', error)
        return NextResponse.json(
          { error: `Failed to upload image: ${error.message}` },
          { status: 500 }
        )
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(data.path)

      uploadedUrls.push(publicUrl)
    }

    return NextResponse.json({
      urls: uploadedUrls,
      count: uploadedUrls.length,
    })
  } catch (error) {
    console.error('Error uploading images:', error)
    return NextResponse.json(
      { error: 'Failed to upload images' },
      { status: 500 }
    )
  }
}
