/**
 * File Upload Validation & Security
 * 
 * Provides comprehensive validation for file uploads including:
 * - MIME type validation
 * - File size limits
 * - File extension whitelisting
 * - Magic number (file signature) verification
 * - Filename sanitization
 */

// Allowed MIME types with their corresponding file signatures (magic numbers)
export const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': { extensions: ['jpg', 'jpeg'], signature: [0xFF, 0xD8, 0xFF] },
  'image/png': { extensions: ['png'], signature: [0x89, 0x50, 0x4E, 0x47] },
  'image/gif': { extensions: ['gif'], signature: [0x47, 0x49, 0x46, 0x38] },
  'image/webp': { extensions: ['webp'], signature: [0x52, 0x49, 0x46, 0x46] }, // RIFF
} as const

export const ALLOWED_DOCUMENT_TYPES = {
  'application/pdf': { extensions: ['pdf'], signature: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  'application/msword': { extensions: ['doc'], signature: [0xD0, 0xCF, 0x11, 0xE0] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extensions: ['docx'],
    signature: [0x50, 0x4B, 0x03, 0x04], // ZIP (DOCX is a ZIP)
  },
  'text/plain': { extensions: ['txt'], signature: [] }, // No specific signature for text
} as const

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  AVATAR: 5 * 1024 * 1024, // 5MB
  COVER_PHOTO: 5 * 1024 * 1024, // 5MB
  POST_IMAGE: 5 * 1024 * 1024, // 5MB per image
  GROUP_AVATAR: 5 * 1024 * 1024, // 5MB
  MESSAGE_FILE: 10 * 1024 * 1024, // 10MB for documents
  MAX_POST_IMAGES: 4, // Max images per post
} as const

export type FileValidationResult = {
  valid: boolean
  error?: string
  sanitizedName?: string
}

/**
 * Validate image file for upload
 */
export async function validateImageFile(
  file: File,
  maxSize: number = FILE_SIZE_LIMITS.AVATAR
): Promise<FileValidationResult> {
  // Check file exists
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  // Check file size
  if (file.size === 0) {
    return { valid: false, error: 'File is empty' }
  }

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1)
    return { valid: false, error: `File size must be less than ${maxSizeMB}MB` }
  }

  // Check MIME type
  if (!file.type || !Object.keys(ALLOWED_IMAGE_TYPES).includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed' }
  }

  // Verify file extension matches MIME type
  const extension = getFileExtension(file.name)
  const typeInfo = ALLOWED_IMAGE_TYPES[file.type as keyof typeof ALLOWED_IMAGE_TYPES]
  if (!typeInfo) {
    return { valid: false, error: 'Invalid file type' }
  }
  const allowedExtensions = typeInfo.extensions as readonly string[]
  
  if (!extension || !(allowedExtensions as string[]).includes(extension)) {
    return { valid: false, error: 'File extension does not match file type' }
  }

  // Verify file signature (magic number)
  const isValidSignature = await verifyFileSignature(file, file.type)
  if (!isValidSignature) {
    return { valid: false, error: 'File content does not match declared type' }
  }

  // Sanitize filename
  const sanitizedName = sanitizeFilename(file.name)

  return { valid: true, sanitizedName }
}

/**
 * Validate document file for upload
 */
export async function validateDocumentFile(
  file: File,
  maxSize: number = FILE_SIZE_LIMITS.MESSAGE_FILE
): Promise<FileValidationResult> {
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty' }
  }

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1)
    return { valid: false, error: `File size must be less than ${maxSizeMB}MB` }
  }

  // Check MIME type
  if (!file.type || !Object.keys(ALLOWED_DOCUMENT_TYPES).includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed' }
  }

  // Verify file extension
  const extension = getFileExtension(file.name)
  const typeInfo = ALLOWED_DOCUMENT_TYPES[file.type as keyof typeof ALLOWED_DOCUMENT_TYPES]
  if (!typeInfo) {
    return { valid: false, error: 'Invalid file type' }
  }
  const allowedExtensions = typeInfo.extensions as readonly string[]
  
  if (!extension || !(allowedExtensions as string[]).includes(extension)) {
    return { valid: false, error: 'File extension does not match file type' }
  }

  // Verify file signature (skip for text files which don't have a signature)
  if (file.type !== 'text/plain') {
    const isValidSignature = await verifyFileSignature(file, file.type)
    if (!isValidSignature) {
      return { valid: false, error: 'File content does not match declared type' }
    }
  }

  const sanitizedName = sanitizeFilename(file.name)

  return { valid: true, sanitizedName }
}

/**
 * Verify file signature (magic number) matches declared MIME type
 */
async function verifyFileSignature(file: File, mimeType: string): Promise<boolean> {
  try {
    // Get expected signature for this MIME type
    const allTypes = { ...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES }
    const typeInfo = allTypes[mimeType as keyof typeof allTypes]
    
    if (!typeInfo || typeInfo.signature.length === 0) {
      return true // No signature to verify (e.g., text files)
    }

    // Read first bytes of file
    const headerBytes = typeInfo.signature.length
    const blob = file.slice(0, headerBytes)
    const arrayBuffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    // Special handling for WebP (RIFF container)
    if (mimeType === 'image/webp') {
      // Check for RIFF signature + WEBP signature at offset 8
      if (bytes.length >= 12) {
        const riffMatch = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
        const webpMatch = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
        return riffMatch && webpMatch
      }
      return false
    }

    // Compare signature
    for (let i = 0; i < typeInfo.signature.length; i++) {
      if (bytes[i] !== typeInfo.signature[i]) {
        return false
      }
    }

    return true
  } catch (error) {
    console.error('Error verifying file signature:', error)
    return false
  }
}

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let sanitized = filename.replace(/[\/\\:\0]/g, '')
  
  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, '')
  
  // Replace spaces and special characters with dashes
  sanitized = sanitized.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '-')
  
  // Limit length
  const MAX_FILENAME_LENGTH = 255
  if (sanitized.length > MAX_FILENAME_LENGTH) {
    const ext = getFileExtension(sanitized)
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'))
    const truncatedName = nameWithoutExt.substring(0, MAX_FILENAME_LENGTH - ext.length - 1)
    sanitized = `${truncatedName}.${ext}`
  }
  
  return sanitized.toLowerCase()
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

/**
 * Generate safe filename for storage
 */
export function generateSafeFilename(userId: string, originalFilename: string): string {
  const sanitized = sanitizeFilename(originalFilename)
  const extension = getFileExtension(sanitized)
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  
  return `${userId}-${timestamp}-${random}.${extension}`
}

/**
 * Validate multiple image files (for post images)
 */
export async function validateMultipleImages(
  files: File[],
  maxFiles: number = FILE_SIZE_LIMITS.MAX_POST_IMAGES,
  maxSize: number = FILE_SIZE_LIMITS.POST_IMAGE
): Promise<FileValidationResult> {
  if (files.length === 0) {
    return { valid: false, error: 'No files provided' }
  }

  if (files.length > maxFiles) {
    return { valid: false, error: `Maximum ${maxFiles} images allowed` }
  }

  // Validate each file
  for (const file of files) {
    const result = await validateImageFile(file, maxSize)
    if (!result.valid) {
      return result
    }
  }

  return { valid: true }
}
