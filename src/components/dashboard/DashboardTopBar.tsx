'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Search, X, Loader2 } from 'lucide-react'
import AvatarDropdown from '@/components/AvatarDropdown'
import DashboardMenuDropdown from './DashboardMenuDropdown'

interface Partner {
  id: string
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
  bio: string | null
  subjects: string[]
  interests: string[]
  matchScore?: number
  isAlreadyPartner?: boolean
}

interface Group {
  id: string
  name: string
  description: string | null
  subject: string
  memberCount: number
  ownerName: string
  isMember: boolean
}

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
  onShowAIPartnerModal?: () => void
}

export default function DashboardTopBar({
  profileName,
  profileAvatarUrl,
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
  onShowAIPartnerModal,
}: DashboardTopBarProps) {
  const router = useRouter()
  const t = useTranslations('dashboard')
  const tNav = useTranslations('navigation')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ partners: Partner[]; groups: Group[] }>({ partners: [], groups: [] })
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Search functionality
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults({ partners: [], groups: [] })
      return
    }

    setIsSearching(true)
    try {
      const queryLower = query.toLowerCase()
      const hasGroupKeyword = queryLower.includes('group')
      const hasPartnerKeyword = queryLower.includes('partner')

      let cleanedQuery = query
      if (hasGroupKeyword) {
        cleanedQuery = cleanedQuery.replace(/\bgroups?\b/gi, '').trim()
      }
      if (hasPartnerKeyword) {
        cleanedQuery = cleanedQuery.replace(/\bpartners?\b/gi, '').replace(/\bstudy\s+partner\b/gi, '').trim()
      }

      if (!cleanedQuery || cleanedQuery.length < 2) {
        cleanedQuery = query
      }

      const [partnersRes, groupsRes] = await Promise.all([
        fetch('/api/partners/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchQuery: cleanedQuery, searchType: 'simple' }),
        }).then(async r => {
          if (!r.ok) return { profiles: [] }
          return r.json()
        }).catch(() => ({ profiles: [] })),
        fetch('/api/groups/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: cleanedQuery,
            subject: cleanedQuery,
            subjectCustomDescription: cleanedQuery
          }),
        }).then(async r => {
          if (!r.ok) return { groups: [] }
          return r.json()
        }).catch(() => ({ groups: [] }))
      ])

      let partners = partnersRes.profiles || []
      let groups = groupsRes.groups || []

      if (hasGroupKeyword && !hasPartnerKeyword) {
        partners = []
      } else if (hasPartnerKeyword && !hasGroupKeyword) {
        groups = []
      }

      setSearchResults({ partners, groups })
      setShowResults(true)
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults({ partners: [], groups: [] })
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleSearch = useCallback(() => {
    if (searchQuery.trim().length >= 2) {
      setHasSearched(true)
      performSearch(searchQuery)
    }
  }, [searchQuery, performSearch])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setHasSearched(false)
      setSearchResults({ partners: [], groups: [] })
      setShowResults(false)
    }
  }, [searchQuery])

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.search-container')) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 px-4 sm:px-6 lg:px-8 py-3 sticky top-0 z-30">
      {/* Top Row: Logo + Search + Actions */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Logo */}
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center hover:opacity-80 transition-opacity flex-shrink-0"
        >
          <Image src="/logo.png" alt="Clerva" width={40} height={40} className="rounded-xl" />
        </button>

        {/* Center: Floating Search Bar */}
        <div className="flex-1 max-w-xl mx-auto relative search-container">
          <div className="relative flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-full px-4 py-2 shadow-sm hover:shadow-md transition-shadow border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700">
            <Search className="w-5 h-5 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearch()
                }
              }}
              onFocus={() => {
                if (hasSearched && (searchResults.partners.length > 0 || searchResults.groups.length > 0)) {
                  setShowResults(true)
                }
              }}
              placeholder={t('searchPlaceholder')}
              className="flex-1 bg-transparent border-0 outline-none px-3 py-0.5 text-sm text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400"
            />
            {isSearching && (
              <Loader2 className="w-5 h-5 animate-spin text-neutral-500 flex-shrink-0" />
            )}
            {searchQuery && !isSearching && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showResults && hasSearched && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl z-50 overflow-hidden max-h-96 overflow-y-auto">
              {searchResults.partners.length === 0 && searchResults.groups.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-white mb-1">
                    No results for &quot;{searchQuery}&quot;
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                    Try studying with AI Partner instead!
                  </p>
                  {onShowAIPartnerModal && (
                    <button
                      onClick={() => {
                        setShowResults(false)
                        onShowAIPartnerModal()
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all"
                    >
                      Start with AI Partner
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-2">
                  {/* Partners Results */}
                  {searchResults.partners.length > 0 && (
                    <div className="mb-2">
                      <div className="px-3 py-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        {t('partners')} ({searchResults.partners.length})
                      </div>
                      {searchResults.partners.slice(0, 4).map((partner) => (
                        <button
                          key={partner.id}
                          onClick={() => {
                            setShowResults(false)
                            router.push(`/profile/${partner.user.id}`)
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-left"
                        >
                          {partner.user.avatarUrl ? (
                            <Image src={partner.user.avatarUrl} alt={partner.user.name} width={36} height={36} className="w-9 h-9 rounded-full" />
                          ) : (
                            <div className="w-9 h-9 bg-neutral-800 dark:bg-neutral-200 rounded-full flex items-center justify-center text-white dark:text-neutral-900 font-semibold text-sm">
                              {partner.user.name[0]}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-neutral-900 dark:text-white truncate">{partner.user.name}</p>
                            {partner.subjects.length > 0 && (
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{partner.subjects.slice(0, 2).join(', ')}</p>
                            )}
                          </div>
                          {partner.isAlreadyPartner && (
                            <span className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs rounded-full">
                              Partner
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Groups Results */}
                  {searchResults.groups.length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        {t('groups')} ({searchResults.groups.length})
                      </div>
                      {searchResults.groups.slice(0, 4).map((group) => (
                        <button
                          key={group.id}
                          onClick={() => {
                            setShowResults(false)
                            router.push(`/groups/${group.id}`)
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-left"
                        >
                          <div className="w-9 h-9 bg-neutral-800 dark:bg-neutral-200 rounded-xl flex items-center justify-center text-white dark:text-neutral-900 font-bold text-sm">
                            {group.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-neutral-900 dark:text-white truncate">{group.name}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{group.subject} • {group.memberCount} members</p>
                          </div>
                          {group.isMember && (
                            <span className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs rounded-full">
                              Joined
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Chat Messages */}
          <button
            onClick={onChatClick}
            className="relative p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition"
            title={tNav('chat')}
            aria-label={tNav('chat')}
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
            title={tNav('notifications')}
            aria-label={tNav('notifications')}
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

      {/* Navigation Row (below logo) */}
      <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
        <DashboardMenuDropdown
          pendingInvitesCount={pendingInvitesCount}
          unreadMessagesCount={unreadMessagesCount}
          connectionRequestsCount={connectionRequestsCount}
          groupInvitesCount={groupInvitesCount}
          newCommunityPostsCount={newCommunityPostsCount}
        />
      </div>
    </header>
  )
}
