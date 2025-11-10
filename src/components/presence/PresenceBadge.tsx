'use client'

export interface PresenceBadgeProps {
  status: 'online' | 'away' | 'offline'
  size?: 'sm' | 'md' | 'lg'
  showDot?: boolean
  className?: string
}

export function PresenceBadge({
  status,
  size = 'md',
  showDot = true,
  className = '',
}: PresenceBadgeProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }

  const statusClasses = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    offline: 'bg-gray-400',
  }

  if (!showDot) return null

  return (
    <span
      className={`inline-block rounded-full border-2 border-white ${sizeClasses[size]} ${statusClasses[status]} ${className}`}
      aria-label={`Status: ${status}`}
    />
  )
}
