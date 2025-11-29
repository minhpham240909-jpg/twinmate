import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { validateImageFile, generateSafeFilename, FILE_SIZE_LIMITS } from '@/lib/file-validation'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
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
    const buffer = Buffer.from(arrayBuffer)

    // Generate safe filename
    const fileName = `${targetUserId}-cover-${generateSafeFilename(targetUserId, file.name)}`
    const filePath = `cover-photos/${fileName}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, buffer, {
        contentType: file.type,
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

    // Update user's coverPhotoUrl in database
    await prisma.user.update({
      where: { id: targetUserId },
      data: { coverPhotoUrl: urlData.publicUrl } as any,
    })

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    })
  } catch (error) {
    console.error('Cover photo upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

