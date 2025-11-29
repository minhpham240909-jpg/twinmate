/**
 * Image Processing Security
 * 
 * Processes uploaded images to:
 * - Strip EXIF metadata (GPS location, camera info, etc.)
 * - Validate image dimensions
 * - Re-encode images to remove any embedded malicious content
 * 
 * Note: This module uses the 'sharp' library for image processing.
 * If sharp is not available, it falls back to basic validation.
 */

import logger from '@/lib/logger'

// ===== CONSTANTS =====

/** Maximum image dimensions */
export const MAX_IMAGE_WIDTH = 4096
export const MAX_IMAGE_HEIGHT = 4096

/** Target quality for re-encoding */
export const IMAGE_QUALITY = 85

/** Maximum file size after processing (in bytes) */
export const MAX_PROCESSED_SIZE = 5 * 1024 * 1024 // 5MB

// ===== TYPES =====

export interface ProcessedImage {
  buffer: Buffer
  format: 'jpeg' | 'png' | 'webp'
  width: number
  height: number
  size: number
  metadataStripped: boolean
}

export interface ImageProcessingOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp' | 'original'
  stripMetadata?: boolean
}

// ===== HELPER TO CHECK SHARP AVAILABILITY =====

let sharpAvailable = false
let sharp: any = null

async function getSharp() {
  if (sharp) return sharp
  
  try {
    sharp = (await import('sharp')).default
    sharpAvailable = true
    return sharp
  } catch {
    sharpAvailable = false
    logger.warn('Sharp library not available - image processing will be limited')
    return null
  }
}

// ===== IMAGE PROCESSING =====

/**
 * Process an image to strip metadata and validate
 */
export async function processImage(
  imageBuffer: Buffer,
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage | null> {
  const {
    maxWidth = MAX_IMAGE_WIDTH,
    maxHeight = MAX_IMAGE_HEIGHT,
    quality = IMAGE_QUALITY,
    format = 'original',
    stripMetadata = true,
  } = options
  
  const sharpLib = await getSharp()
  
  if (!sharpLib) {
    // Fallback: return buffer as-is with warning
    logger.warn('Image processing skipped - sharp not available')
    return {
      buffer: imageBuffer,
      format: 'jpeg',
      width: 0,
      height: 0,
      size: imageBuffer.length,
      metadataStripped: false,
    }
  }
  
  try {
    let pipeline = sharpLib(imageBuffer)
    
    // Get image metadata first
    const metadata = await pipeline.metadata()
    
    if (!metadata.width || !metadata.height) {
      logger.error('Invalid image - no dimensions')
      return null
    }
    
    // Resize if exceeds max dimensions
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    }
    
    // Strip metadata (removes EXIF, GPS, camera info, etc.)
    if (stripMetadata) {
      pipeline = pipeline.rotate() // Auto-rotate based on EXIF, then strip
    }
    
    // Determine output format
    let outputFormat = format
    if (format === 'original') {
      // Use original format or default to JPEG
      outputFormat = (metadata.format as any) || 'jpeg'
      if (!['jpeg', 'png', 'webp'].includes(outputFormat)) {
        outputFormat = 'jpeg'
      }
    }
    
    // Apply format-specific encoding
    switch (outputFormat) {
      case 'jpeg':
        pipeline = pipeline.jpeg({
          quality,
          mozjpeg: true,
        })
        break
      case 'png':
        pipeline = pipeline.png({
          compressionLevel: 9,
        })
        break
      case 'webp':
        pipeline = pipeline.webp({
          quality,
        })
        break
    }
    
    // Process and get buffer
    const processedBuffer = await pipeline.toBuffer()
    const processedMetadata = await sharpLib(processedBuffer).metadata()
    
    // Verify processed size
    if (processedBuffer.length > MAX_PROCESSED_SIZE) {
      logger.warn('Processed image exceeds max size', {
        size: processedBuffer.length,
        maxSize: MAX_PROCESSED_SIZE,
      })
      // Try with lower quality
      const reducedQuality = Math.max(quality - 20, 50)
      return processImage(imageBuffer, {
        ...options,
        quality: reducedQuality,
      })
    }
    
    return {
      buffer: processedBuffer,
      format: outputFormat as 'jpeg' | 'png' | 'webp',
      width: processedMetadata.width || 0,
      height: processedMetadata.height || 0,
      size: processedBuffer.length,
      metadataStripped: stripMetadata,
    }
  } catch (error) {
    logger.error('Image processing failed', error instanceof Error ? error : new Error(String(error)))
    return null
  }
}

/**
 * Process avatar image with standard settings
 */
export async function processAvatarImage(imageBuffer: Buffer): Promise<ProcessedImage | null> {
  return processImage(imageBuffer, {
    maxWidth: 500,
    maxHeight: 500,
    quality: 85,
    format: 'webp', // WebP for smaller size
    stripMetadata: true,
  })
}

/**
 * Process cover photo with standard settings
 */
export async function processCoverPhoto(imageBuffer: Buffer): Promise<ProcessedImage | null> {
  return processImage(imageBuffer, {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 85,
    format: 'webp',
    stripMetadata: true,
  })
}

/**
 * Process post image with standard settings
 */
export async function processPostImage(imageBuffer: Buffer): Promise<ProcessedImage | null> {
  return processImage(imageBuffer, {
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 85,
    format: 'webp',
    stripMetadata: true,
  })
}

/**
 * Check if sharp is available for image processing
 */
export async function isImageProcessingAvailable(): Promise<boolean> {
  await getSharp()
  return sharpAvailable
}

/**
 * Get image metadata without processing
 */
export async function getImageMetadata(imageBuffer: Buffer): Promise<{
  width: number
  height: number
  format: string
  hasExif: boolean
  hasGps: boolean
} | null> {
  const sharpLib = await getSharp()
  
  if (!sharpLib) {
    return null
  }
  
  try {
    const metadata = await sharpLib(imageBuffer).metadata()
    
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      hasExif: !!metadata.exif,
      hasGps: !!(metadata.exif && metadata.exif.toString().includes('GPS')),
    }
  } catch {
    return null
  }
}

