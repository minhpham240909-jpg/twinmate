'use client'

/**
 * Simple Avatar Component
 * PWA Edition: Simplified avatar without presence indicators
 */

import Image from 'next/image'

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
}

export default function Avatar({ name, avatarUrl, size = 'md', className = '' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={64}
        height={64}
        className={`rounded-full object-cover ${sizeClasses[size]} ${className}`}
      />
    )
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold ${sizeClasses[size]} ${className}`}
    >
      {initials}
    </div>
  )
}
