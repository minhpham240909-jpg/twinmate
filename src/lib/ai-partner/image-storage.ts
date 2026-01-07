/**
 * AI Partner Image Storage Utility
 * 
 * Handles uploading AI partner images to Supabase Storage instead of storing
 * base64 data directly in the database.
 * 
 * FIX: Base64 images in database is expensive and slow. 
 * This module provides efficient cloud storage for AI partner images.
 */

import { createClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'

const BUCKET_NAME = 'ai-partner-images'
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

interface UploadResult {
  success: boolean
  url?: string
  path?: string
  error?: string
}

/**
 * Get Supabase client for server-side storage operations
 */
function getStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing')
  }

  return createClient(supabaseUrl, supabaseKey)
}

/**
 * Upload a base64 image to Supabase Storage
 * 
 * @param base64Data - Base64 encoded image data (with or without data URI prefix)
 * @param userId - User ID for organizing files
 * @param sessionId - Session ID for organizing files
 * @param type - Type of image ('uploaded' | 'generated' | 'whiteboard')
 * @returns Upload result with URL or error
 */
export async function uploadBase64Image(
  base64Data: string,
  userId: string,
  sessionId: string,
  type: 'uploaded' | 'generated' | 'whiteboard' = 'uploaded'
): Promise<UploadResult> {
  try {
    // Extract base64 content and determine mime type
    let base64Content: string
    let mimeType: string = 'image/png'
    
    if (base64Data.startsWith('data:')) {
      // Has data URI prefix
      const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/)
      if (!matches) {
        return { success: false, error: 'Invalid base64 data format' }
      }
      mimeType = matches[1]
      base64Content = matches[2]
    } else {
      // Raw base64 content
      base64Content = base64Data
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Content, 'base64')

    // Check file size
    if (buffer.length > MAX_IMAGE_SIZE) {
      return { success: false, error: `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB` }
    }

    // Determine file extension
    const extension = mimeType.split('/')[1] || 'png'
    
    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 10)
    const filename = `${userId}/${sessionId}/${type}-${timestamp}-${randomStr}.${extension}`

    const supabase = getStorageClient()

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, buffer, {
        contentType: mimeType,
        cacheControl: '31536000', // 1 year cache
        upsert: false
      })

    if (error) {
      logger.error('Image upload to storage failed', { error: error.message, filename })
      return { success: false, error: error.message }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path)

    logger.debug('Image uploaded to storage', { 
      filename, 
      size: buffer.length,
      url: urlData.publicUrl 
    })

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Image upload exception', { error: errorMessage })
    return { success: false, error: errorMessage }
  }
}

/**
 * Delete an image from Supabase Storage
 * 
 * @param path - Storage path of the image
 * @returns Success or error
 */
export async function deleteImage(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getStorageClient()

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path])

    if (error) {
      logger.error('Image deletion failed', { error: error.message, path })
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Image deletion exception', { error: errorMessage })
    return { success: false, error: errorMessage }
  }
}

/**
 * Get a signed URL for temporary access to a private image
 * 
 * @param path - Storage path of the image
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Signed URL or error
 */
export async function getSignedImageUrl(
  path: string,
  expiresIn: number = 3600
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = getStorageClient()

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn)

    if (error) {
      logger.error('Signed URL generation failed', { error: error.message, path })
      return { success: false, error: error.message }
    }

    return { success: true, url: data.signedUrl }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Signed URL exception', { error: errorMessage })
    return { success: false, error: errorMessage }
  }
}

/**
 * Migrate base64 image from database to storage
 * Used for cleaning up existing base64 images in the database
 * 
 * @param base64Data - Base64 data from database
 * @param userId - User ID
 * @param sessionId - Session ID
 * @param messageId - Message ID for reference
 * @returns Upload result with URL
 */
export async function migrateBase64ToStorage(
  base64Data: string,
  userId: string,
  sessionId: string,
  messageId: string
): Promise<UploadResult> {
  const result = await uploadBase64Image(base64Data, userId, sessionId, 'uploaded')
  
  if (result.success) {
    logger.info('Migrated base64 image to storage', { 
      messageId, 
      newUrl: result.url 
    })
  }
  
  return result
}

export default {
  uploadBase64Image,
  deleteImage,
  getSignedImageUrl,
  migrateBase64ToStorage,
}

