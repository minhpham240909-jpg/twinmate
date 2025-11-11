'use client'

import Image from 'next/image'

interface PartnerAvatarProps {
  avatarUrl?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  onlineStatus?: 'ONLINE' | 'OFFLINE' | null
  showStatus?: boolean // Only show status for partners
  className?: string
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20'
}

const statusSizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
  lg: 'w-4 h-4',
  xl: 'w-5 h-5'
}

export default function PartnerAvatar({
  avatarUrl,
  name,
  size = 'md',
  onlineStatus,
  showStatus = false,
  className = ''
}: PartnerAvatarProps) {
  const sizeClass = sizeClasses[size]
  const statusSizeClass = statusSizeClasses[size]

  return (
    <div className={`relative ${className}`}>
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          width={size === 'sm' ? 40 : size === 'md' ? 48 : size === 'lg' ? 64 : 80}
          height={size === 'sm' ? 40 : size === 'md' ? 48 : size === 'lg' ? 64 : 80}
          className={`${sizeClass} rounded-full object-cover`}
        />
      ) : (
        <div className={`${sizeClass} bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold ${
          size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-3xl'
        }`}>
          {name[0]?.toUpperCase() || 'U'}
        </div>
      )}

      {/* Online Status Indicator - Only show for partners */}
      {showStatus && onlineStatus && (
        <div className="absolute bottom-0 right-0 transform translate-x-0.5 translate-y-0.5">
          <div
            className={`${statusSizeClass} rounded-full border-2 border-white shadow-sm ${
              onlineStatus === 'ONLINE' ? 'bg-green-500' : 'bg-gray-400'
            }`}
            title={onlineStatus === 'ONLINE' ? 'Online' : 'Offline'}
          />
        </div>
      )}
    </div>
  )
}
