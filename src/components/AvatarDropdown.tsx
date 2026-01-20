'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

interface AvatarDropdownProps {
  avatarUrl: string | null
  name: string
  onSignOut: () => void
  isAdmin?: boolean
}

export default function AvatarDropdown({ avatarUrl, name, onSignOut, isAdmin }: AvatarDropdownProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('common')

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleViewProfile = () => {
    setIsOpen(false)
    router.push('/profile')
  }

  const handleEditProfile = () => {
    setIsOpen(false)
    router.push('/profile/edit')
  }

  const handleAdminDashboard = () => {
    setIsOpen(false)
    router.push('/admin')
  }

  const handleSettings = () => {
    setIsOpen(false)
    router.push('/settings')
  }

  const handleLogout = () => {
    setIsOpen(false)
    onSignOut()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 w-full hover:opacity-80 transition-opacity cursor-pointer"
      >
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt={name} 
            className="w-12 h-12 rounded-full ring-2 ring-white cursor-pointer object-cover" 
          />
        ) : (
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg ring-2 ring-white cursor-pointer">
            {name[0]}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-xl py-2 z-50">
          {/* View Profile */}
          <button
            onClick={handleViewProfile}
            className="w-full px-4 py-3 text-left text-slate-300 hover:bg-slate-700/50 transition flex items-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {t('viewProfile')}
          </button>

          {/* Edit Profile */}
          <button
            onClick={handleEditProfile}
            className="w-full px-4 py-3 text-left text-slate-300 hover:bg-slate-700/50 transition flex items-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {t('editProfile')}
          </button>

          {/* Divider */}
          <div className="my-1 border-t border-slate-700/50" />

          {isAdmin && (
            <button
              onClick={handleAdminDashboard}
              className="w-full px-4 py-3 text-left text-blue-400 hover:bg-blue-500/10 transition flex items-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Admin Dashboard
            </button>
          )}
          <button
            onClick={handleSettings}
            className="w-full px-4 py-3 text-left text-slate-300 hover:bg-slate-700/50 transition flex items-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t('settings')}
          </button>

          {/* Feedback */}
          <a
            href="https://forms.gle/clerva-feedback"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-4 py-3 text-left text-slate-300 hover:bg-slate-700/50 transition flex items-center gap-3"
            onClick={() => setIsOpen(false)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {t('feedback')}
          </a>

          {/* Divider */}
          <div className="my-1 border-t border-slate-700/50" />

          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 text-left text-red-400 hover:bg-red-500/10 transition flex items-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t('logout')}
          </button>
        </div>
      )}
    </div>
  )
}

