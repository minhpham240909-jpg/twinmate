'use client'

import Image from 'next/image'
import { useState, useCallback } from 'react'

/**
 * OptimizedImage Component
 *
 * A performance-optimized image component that wraps Next.js Image with:
 * - Lazy loading by default
 * - Blur placeholder with custom color
 * - Loading skeleton state
 * - Error fallback
 * - Responsive sizing support
 *
 * Use this for post images, banners, and other content images.
 * For avatars, use OptimizedAvatar component instead.
 */

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  className?: string
  priority?: boolean
  quality?: number
  sizes?: string
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  onLoad?: () => void
  onError?: () => void
  fallbackSrc?: string
  blurColor?: string
}

// Simple shimmer/placeholder SVG as base64
const shimmer = (w: number, h: number, color: string = '#1e293b') =>
  `<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${color}"/>
    <rect id="r" width="${w}" height="${h}" fill="url(#g)"/>
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop stop-color="${color}" offset="0%"><animate attributeName="offset" values="-2;1" dur="2s" repeatCount="indefinite"/></stop>
        <stop stop-color="#334155" offset="50%"><animate attributeName="offset" values="-1;2" dur="2s" repeatCount="indefinite"/></stop>
        <stop stop-color="${color}" offset="100%"><animate attributeName="offset" values="0;3" dur="2s" repeatCount="indefinite"/></stop>
      </linearGradient>
    </defs>
  </svg>`

const toBase64 = (str: string) =>
  typeof window === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str)

export default function OptimizedImage({
  src,
  alt,
  width = 400,
  height = 300,
  fill = false,
  className = '',
  priority = false,
  quality = 75,
  sizes,
  objectFit = 'cover',
  onLoad,
  onError,
  fallbackSrc = '/images/placeholder.png',
  blurColor = '#1e293b',
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [imgSrc, setImgSrc] = useState(src)

  const handleLoad = useCallback(() => {
    setIsLoading(false)
    onLoad?.()
  }, [onLoad])

  const handleError = useCallback(() => {
    setHasError(true)
    setIsLoading(false)
    if (fallbackSrc && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc)
    }
    onError?.()
  }, [fallbackSrc, imgSrc, onError])

  // Generate placeholder
  const blurDataURL = `data:image/svg+xml;base64,${toBase64(shimmer(width, height, blurColor))}`

  // Determine sizes for responsive images
  const responsiveSizes = sizes || (fill
    ? '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
    : undefined
  )

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={!fill ? { width, height } : undefined}
    >
      {/* Loading skeleton overlay */}
      {isLoading && (
        <div
          className="absolute inset-0 animate-pulse bg-slate-700/50 z-10"
          aria-hidden="true"
        />
      )}

      {/* Error state */}
      {hasError && imgSrc === fallbackSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800 z-10">
          <span className="text-slate-500 text-sm">Failed to load</span>
        </div>
      )}

      <Image
        src={imgSrc}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        className={`transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        style={{ objectFit }}
        priority={priority}
        quality={quality}
        sizes={responsiveSizes}
        placeholder="blur"
        blurDataURL={blurDataURL}
        loading={priority ? undefined : 'lazy'}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  )
}

/**
 * OptimizedAvatar Component
 *
 * Specialized avatar component with:
 * - Preset size variants (xs, sm, md, lg, xl)
 * - Circular shape by default
 * - Initials fallback
 * - Online status indicator support
 */

interface OptimizedAvatarProps {
  src?: string | null
  alt: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  className?: string
  showOnlineStatus?: boolean
  isOnline?: boolean
  fallbackInitials?: string
  priority?: boolean
}

const AVATAR_SIZES = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
} as const

export function OptimizedAvatar({
  src,
  alt,
  size = 'md',
  className = '',
  showOnlineStatus = false,
  isOnline = false,
  fallbackInitials,
  priority = false,
}: OptimizedAvatarProps) {
  const [hasError, setHasError] = useState(false)
  const pixelSize = typeof size === 'number' ? size : AVATAR_SIZES[size]

  // Get initials from alt text if no fallbackInitials provided
  const initials = fallbackInitials || alt
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const showInitials = !src || hasError

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: pixelSize, height: pixelSize }}
    >
      {showInitials ? (
        // Initials fallback
        <div
          className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center"
          style={{ fontSize: pixelSize * 0.4 }}
        >
          <span className="text-white font-medium">{initials}</span>
        </div>
      ) : (
        // Image avatar
        <Image
          src={src}
          alt={alt}
          width={pixelSize}
          height={pixelSize}
          className="rounded-full object-cover"
          priority={priority}
          quality={80}
          onError={() => setHasError(true)}
        />
      )}

      {/* Online status indicator */}
      {showOnlineStatus && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-slate-900 ${
            isOnline ? 'bg-green-500' : 'bg-slate-500'
          }`}
          style={{
            width: Math.max(8, pixelSize * 0.25),
            height: Math.max(8, pixelSize * 0.25)
          }}
        />
      )}
    </div>
  )
}

/**
 * Helper function to generate srcset for responsive avatars
 * Use this when you need custom avatar URLs at different sizes
 */
export function getAvatarSrcSet(baseUrl: string, sizes: number[]): string {
  // If using a CDN that supports image transformations (like Cloudinary, Imgix)
  // you can modify this to generate transformed URLs
  // For now, we return the base URL (assumes server handles sizing)
  return sizes.map(size => `${baseUrl} ${size}w`).join(', ')
}

/**
 * Preload critical images
 * Call this for above-the-fold images that need to load immediately
 */
export function preloadImage(src: string): void {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = src
    document.head.appendChild(link)
  }
}
