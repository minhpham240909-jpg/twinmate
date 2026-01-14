'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Menu,
  X,
  Home,
  Calendar,
  MessageSquare,
  Users,
  Search,
  UserPlus,
  Globe,
  Settings,
  HelpCircle,
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
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

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
      id: 'settings',
      labelKey: 'settings',
      icon: <Settings className="w-5 h-5" />,
      href: '/settings',
    },
    {
      id: 'help',
      labelKey: 'help',
      icon: <HelpCircle className="w-5 h-5" />,
      href: '/help',
    },
  ]

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
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

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleNavigation = (href: string) => {
    setIsOpen(false)
    router.push(href)
  }

  return (
    <div className="relative">
      {/* Menu Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl transition-all font-medium text-neutral-700 dark:text-neutral-300"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Open navigation menu"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <Menu className="w-5 h-5" />
        )}
        <span className="hidden sm:inline">Menu</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div 
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel */}
          <div
            ref={menuRef}
            className="absolute left-0 top-full mt-2 w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
            role="menu"
            aria-orientation="vertical"
          >
            <div className="p-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.href)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left group ${
                    item.id === 'home'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                  role="menuitem"
                >
                  <span className={item.id === 'home' ? 'text-white' : 'text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200'}>
                    {item.icon}
                  </span>
                  <span className="flex-1 font-medium">
                    {item.id === 'connections' ? t('connectionRequests') : tNav(item.labelKey)}
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-2 py-0.5 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 text-xs rounded-full font-bold">
                      {item.badge}
                    </span>
                  )}
                  {item.badge === -1 && (
                    <span className="w-2 h-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
