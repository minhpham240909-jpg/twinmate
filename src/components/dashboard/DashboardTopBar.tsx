'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import AvatarDropdown from '@/components/AvatarDropdown'
import DashboardMenuDropdown from './DashboardMenuDropdown'

interface DashboardTopBarProps {
  profileName: string
  profileAvatarUrl: string | null
  profileRole: string
  isAdmin: boolean
  onSignOut: () => void
  unreadCount: number
  unreadMessagesCount: number
  pendingInvitesCount: number
  connectionRequestsCount: number
  groupInvitesCount: number
  newCommunityPostsCount: number
  onNotificationsClick: () => void
  onChatClick: () => void
}

export default function DashboardTopBar({
  profileName,
  profileAvatarUrl,
  profileRole,
  isAdmin,
  onSignOut,
  unreadCount,
  unreadMessagesCount,
  pendingInvitesCount,
  connectionRequestsCount,
  groupInvitesCount,
  newCommunityPostsCount,
  onNotificationsClick,
  onChatClick,
}: DashboardTopBarProps) {
  const router = useRouter()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('navigation')

  return (
    <header className="bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 px-4 sm:px-6 lg:px-8 py-4 sticky top-0 z-30">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Logo + Menu */}
        <div className="flex items-center gap-4">
          {/* Logo */}
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Image src="/logo.png" alt="Clerva" width={36} height={36} className="rounded-xl" />
            <span className="text-lg font-bold text-neutral-900 dark:text-white hidden sm:inline">
              Clerva
            </span>
          </button>

          {/* Menu Dropdown */}
          <DashboardMenuDropdown
            pendingInvitesCount={pendingInvitesCount}
            unreadMessagesCount={unreadMessagesCount}
            connectionRequestsCount={connectionRequestsCount}
            groupInvitesCount={groupInvitesCount}
            newCommunityPostsCount={newCommunityPostsCount}
          />
        </div>

        {/* Center: Welcome (hidden on mobile) */}
        <div className="hidden lg:block flex-1 text-center">
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
            {t('welcomeTitle')}
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {t('welcomeMessage')}
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Chat Messages */}
          <button
            onClick={onChatClick}
            className="relative p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition"
            title={tNav('chat')}
          >
            <svg className="w-5 h-5 text-neutral-700 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {unreadMessagesCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
              </span>
            )}
          </button>

          {/* Notifications Bell */}
          <button
            onClick={onNotificationsClick}
            className="relative p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition"
          >
            <svg className="w-5 h-5 text-neutral-700 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Avatar */}
          <div className="hidden sm:block">
            <AvatarDropdown
              avatarUrl={profileAvatarUrl}
              name={profileName}
              onSignOut={onSignOut}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </div>

      {/* Mobile Welcome (shown only on small screens) */}
      <div className="lg:hidden mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
          {t('welcomeTitle')}
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
          {t('welcomeMessage')}
        </p>
      </div>
    </header>
  )
}
