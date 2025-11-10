'use client'

import Image from 'next/image'
import { PresenceBadge } from './PresenceBadge'
import { usePartnerPresence } from '@/hooks/usePartnerPresence'

export interface UserAvatarWithPresenceProps {
  userId: string
  name: string
  avatarUrl?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showPresence?: boolean
  className?: string
}

export function UserAvatarWithPresence({
  userId,
  name,
  avatarUrl,
  size = 'md',
  showPresence = true,
  className = '',
}: UserAvatarWithPresenceProps) {
  const { presences } = usePartnerPresence([userId])
  const presence = presences[userId]

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }

  const badgeSizeMap = {
    sm: 'sm' as const,
    md: 'sm' as const,
    lg: 'md' as const,
    xl: 'lg' as const,
  }

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          fill
          className="rounded-full object-cover"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">
          <span className="text-gray-600 font-semibold">
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {showPresence && presence && !presence.isPrivate && (
        <div className="absolute bottom-0 right-0">
          <PresenceBadge
            status={presence.status}
            size={badgeSizeMap[size]}
          />
        </div>
      )}
    </div>
  )
}
