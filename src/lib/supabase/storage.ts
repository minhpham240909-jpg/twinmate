/**
 * Supabase Storage Utility Functions
 * Handles file uploads for group avatars and message attachments
 */

import { createClient } from '@/lib/supabase/client'

export interface UploadResult {
  success: boolean
  url?: string
  path?: string
  error?: string
}

/**
 * Upload a file to Supabase Storage
 * @param file - File to upload
 * @param bucket - Storage bucket name
 * @param path - Optional path within bucket (auto-generated if not provided)
 * @returns Upload result with URL or error
 */
export async function uploadFile(
  file: File,
  bucket: 'group-avatars' | 'message-attachments',
  path?: string
): Promise<UploadResult> {
  try {
    const supabase = createClient()

    // Generate unique path if not provided
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExt = file.name.split('.').pop()
    const filePath = path || `${timestamp}-${randomString}.${fileExt}`

    // Upload file
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Upload error:', error)
      return {
        success: false,
        error: error.message
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path)

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path
    }
  } catch (error) {
    console.error('Upload exception:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }
  }
}

/**
 * Upload group avatar
 * @param file - Image file to upload
 * @param groupId - Group ID for organizing files
 * @returns Upload result with URL or error
 */
export async function uploadGroupAvatar(
  file: File,
  groupId: string
): Promise<UploadResult> {
  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) {
    return {
      success: false,
      error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.'
    }
  }

  // Validate file size (5MB limit)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    return {
      success: false,
      error: 'File too large. Maximum size is 5MB.'
    }
  }

  const fileExt = file.name.split('.').pop()
  const path = `${groupId}/avatar-${Date.now()}.${fileExt}`

  return uploadFile(file, 'group-avatars', path)
}

/**
 * Upload message attachment (image or PDF)
 * @param file - File to upload
 * @param conversationId - Conversation ID for organizing files
 * @param userId - User ID of uploader
 * @returns Upload result with URL or error
 */
export async function uploadMessageAttachment(
  file: File,
  conversationId: string,
  userId: string
): Promise<UploadResult> {
  // Validate file type
  const validTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]
  if (!validTypes.includes(file.type)) {
    return {
      success: false,
      error: 'Invalid file type. Please upload an image (JPEG, PNG, WebP, GIF) or PDF.'
    }
  }

  // Validate file size (10MB limit)
  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    return {
      success: false,
      error: 'File too large. Maximum size is 10MB.'
    }
  }

  const fileExt = file.name.split('.').pop()
  const path = `${conversationId}/${userId}-${Date.now()}.${fileExt}`

  return uploadFile(file, 'message-attachments', path)
}

/**
 * Delete file from storage
 * @param bucket - Storage bucket name
 * @param path - File path within bucket
 * @returns Success or error
 */
export async function deleteFile(
  bucket: 'group-avatars' | 'message-attachments',
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])

    if (error) {
      console.error('Delete error:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete exception:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed'
    }
  }
}

/**
 * Get signed URL for private file access
 * @param bucket - Storage bucket name
 * @param path - File path within bucket
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL or error
 */
export async function getSignedUrl(
  bucket: 'message-attachments',
  path: string,
  expiresIn: number = 3600
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)

    if (error) {
      console.error('Signed URL error:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      url: data.signedUrl
    }
  } catch (error) {
    console.error('Signed URL exception:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate signed URL'
    }
  }
}

/**
 * Format file size for display
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
