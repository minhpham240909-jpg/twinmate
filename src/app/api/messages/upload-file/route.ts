import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateImageFile, validateDocumentFile, generateSafeFilename, FILE_SIZE_LIMITS } from '@/lib/file-validation'
import { rateLimit } from '@/lib/rate-limit'
import logger from '@/lib/logger'

/**
 * POST /api/messages/upload-file
 * Upload file or image for message sharing
 * Supports: Images (JPG, PNG, GIF, WebP) and Documents (PDF, DOC, DOCX, TXT)
 */
export async function POST(request: NextRequest) {
  // Rate limit: 10 uploads per hour
  const rateLimitResult = await rateLimit(request, {
    max: 10,
    windowMs: 60 * 60 * 1000,
    keyPrefix: 'message-file-upload',
  })
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many upload attempts. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const conversationId = formData.get('conversationId') as string
    const conversationType = formData.get('conversationType') as string // 'partner' or 'group'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!conversationId || !conversationType) {
      return NextResponse.json(
        { error: 'Conversation ID and type are required' },
        { status: 400 }
      )
    }

    // Determine file type (image or document)
    const isImage = file.type.startsWith('image/')
    const isDocument = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(file.type)

    if (!isImage && !isDocument) {
      return NextResponse.json(
        { error: 'Unsupported file type. Only images (JPG, PNG, GIF, WebP) and documents (PDF, DOC, DOCX, TXT) are allowed.' },
        { status: 400 }
      )
    }

    // Validate file
    const validation = isImage
      ? await validateImageFile(file, FILE_SIZE_LIMITS.MESSAGE_FILE)
      : await validateDocumentFile(file, FILE_SIZE_LIMITS.MESSAGE_FILE)

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate safe filename
    const fileName = generateSafeFilename(user.id, file.name)
    const filePath = `message-files/${conversationType}/${conversationId}/${fileName}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      logger.error('File upload error', { error: uploadError, userId: user.id })
      return NextResponse.json(
        { error: 'Upload failed', details: uploadError.message },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath)

    // For images, optionally generate thumbnail
    let thumbnailUrl: string | null = null
    if (isImage) {
      // Thumbnail generation would happen here
      // For now, we'll use the same URL (Supabase can handle image transformations on-the-fly)
      thumbnailUrl = `${urlData.publicUrl}?width=200&height=200`
    }

    logger.info('Message file uploaded', {
      userId: user.id,
      conversationId,
      conversationType,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    })

    return NextResponse.json({
      success: true,
      file: {
        url: urlData.publicUrl,
        thumbnailUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isImage,
      },
    })
  } catch (error) {
    logger.error('Message file upload error', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
