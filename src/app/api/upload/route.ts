import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateImageFile, FILE_SIZE_LIMITS } from '@/lib/file-validation'
import { rateLimit } from '@/lib/rate-limit'

// Allowed buckets for security - only these buckets can be used
const ALLOWED_BUCKETS = ['feedback-images', 'user-uploads'] as const
type AllowedBucket = typeof ALLOWED_BUCKETS[number]

// Map bucket names to storage paths
const BUCKET_PATHS: Record<AllowedBucket, string> = {
  'feedback-images': 'feedback',
  'user-uploads': 'general',
}

export async function POST(request: NextRequest) {
  // Rate limiting: 20 uploads per hour
  const rateLimitResult = await rateLimit(request, { max: 20, windowMs: 60 * 60 * 1000, keyPrefix: 'general-upload' })
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
    const bucket = formData.get('bucket') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate bucket
    if (!bucket || !ALLOWED_BUCKETS.includes(bucket as AllowedBucket)) {
      return NextResponse.json(
        { error: 'Invalid upload destination' },
        { status: 400 }
      )
    }

    // Comprehensive file validation (5MB limit for general uploads)
    const validation = await validateImageFile(file, FILE_SIZE_LIMITS.POST_IMAGE)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType = file.type

    // Generate safe filename
    const extension = contentType.split('/')[1] || 'jpg'
    const fileName = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`
    const storagePath = BUCKET_PATHS[bucket as AllowedBucket]
    const filePath = `${storagePath}/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, buffer, {
        contentType,
        upsert: false,
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

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
