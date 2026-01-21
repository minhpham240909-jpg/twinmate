'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Home,
  Calendar,
  MessageSquare,
  Users,
  Search,
  UserPlus,
  Globe,
  Gamepad2,
} from 'lucide-react'

interface NavItem {
  id: string
  labelKey: string
  icon: React.ReactNode
  href: string
  badge?: number
}

interface DashboardMenuDropdownProps {
  pendingInvitesCount: number
  unreadMessagesCount: number
  connectionRequestsCount: number
  groupInvitesCount: number
  newCommunityPostsCount: number
}

export default function DashboardMenuDropdown({
  pendingInvitesCount,
  unreadMessagesCount,
  connectionRequestsCount,
  groupInvitesCount,
  newCommunityPostsCount,
}: DashboardMenuDropdownProps) {
  const router = useRouter()
  const tNav = useTranslations('navigation')
  const t = useTranslations('dashboard')

  const navItems: NavItem[] = [
    {
      id: 'home',
      labelKey: 'home',
      icon: <Home className="w-5 h-5" />,
      href: '/dashboard',
    },
    {
      id: 'study-sessions',
      labelKey: 'studyWithPartner',
      icon: <Calendar className="w-5 h-5" />,
      href: '/study-sessions',
      badge: pendingInvitesCount,
    },
    {
      id: 'chat',
      labelKey: 'chat',
      icon: <MessageSquare className="w-5 h-5" />,
      href: '/chat',
      badge: unreadMessagesCount,
    },
    {
      id: 'connections',
      labelKey: 'connections',
      icon: <UserPlus className="w-5 h-5" />,
      href: '/connections',
      badge: connectionRequestsCount,
    },
    {
      id: 'search',
      labelKey: 'findPartner',
      icon: <Search className="w-5 h-5" />,
      href: '/search',
    },
    {
      id: 'groups',
      labelKey: 'studyGroups',
      icon: <Users className="w-5 h-5" />,
      href: '/groups',
      badge: groupInvitesCount,
    },
    {
      id: 'community',
      labelKey: 'community',
      icon: <Globe className="w-5 h-5" />,
      href: '/community',
      badge: newCommunityPostsCount > 0 ? -1 : undefined, // -1 = dot indicator
    },
    {
      id: 'arcade',
      labelKey: 'arcade',
      icon: <Gamepad2 className="w-5 h-5" />,
      href: '/arena',
    },
  ]

  const handleNavigation = (href: string) => {
    router.push(href)
  }

  return (
    <nav className="flex items-center gap-1 flex-wrap" role="navigation" aria-label="Main navigation">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => handleNavigation(item.href)}
          className={`relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-base font-medium ${
            item.id === 'home'
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
              : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white'
          }`}
          title={item.id === 'connections' ? t('connectionRequests') : tNav(item.labelKey)}
        >
          <span className={item.id === 'home' ? 'text-white' : ''}>
            {item.icon}
          </span>
          <span className="hidden lg:inline">
            {item.id === 'connections' ? t('connectionRequests') : tNav(item.labelKey)}
          </span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 bg-red-500 text-white text-xs rounded-full font-bold flex items-center justify-center">
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
          {item.badge === -1 && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </button>
      ))}
    </nav>
  )
}
