'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Search, X, Loader2 } from 'lucide-react'

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

interface DashboardSearchProps {
  onShowAIPartnerModal: () => void
}

export default function DashboardSearch({ onShowAIPartnerModal }: DashboardSearchProps) {
  const router = useRouter()
  const t = useTranslations('dashboard')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ partners: Partner[]; groups: Group[] }>({ partners: [], groups: [] })
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

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
    }
  }, [searchQuery])

  const getMatchingFields = (partner: Partner, query: string): string[] => {
    const searchLower = query.toLowerCase().trim()
    const matchingFields: string[] = []

    if (partner.subjects?.some(s => s.toLowerCase().includes(searchLower))) {
      matchingFields.push(t('subjects'))
    }
    if (partner.bio?.toLowerCase().includes(searchLower)) {
      matchingFields.push(t('bio'))
    }
    if (partner.interests?.some(i => i.toLowerCase().includes(searchLower))) {
      matchingFields.push(t('interests'))
    }
    return matchingFields
  }

  const getGroupMatchingFields = (group: Group, query: string): string[] => {
    const searchLower = query.toLowerCase().trim()
    const matchingFields: string[] = []

    if (group.subject?.toLowerCase().includes(searchLower)) {
      matchingFields.push(t('subject'))
    }
    if (group.description?.toLowerCase().includes(searchLower)) {
      matchingFields.push(t('description'))
    }
    if (group.name?.toLowerCase().includes(searchLower)) {
      matchingFields.push(t('name'))
    }
    return matchingFields
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-3 sm:p-4 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center">
              <Search className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-700 dark:text-neutral-300" />
            </div>
          </div>

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
            placeholder={t('searchPlaceholder')}
            className="flex-1 px-2 py-2 text-sm sm:text-base border-0 focus:ring-0 focus:outline-none text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 bg-transparent"
          />

          {isSearching && (
            <div className="flex-shrink-0 pr-2">
              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-neutral-500" />
            </div>
          )}

          {searchQuery && !isSearching && (
            <button
              onClick={() => setSearchQuery('')}
              className="flex-shrink-0 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300" />
            </button>
          )}

          {searchQuery.trim().length >= 2 && !isSearching && (
            <button
              onClick={handleSearch}
              className="flex-shrink-0 p-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg transition-all"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* No Results - AI Partner Suggestion */}
      {hasSearched && !isSearching && searchResults.partners.length === 0 && searchResults.groups.length === 0 && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 text-center">
            <div className="p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-700/50 max-w-lg mx-auto">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white mb-2">
                {searchQuery.trim()} partners aren&apos;t available right now
              </h3>

              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 mb-4">
                But I can be your {searchQuery.trim()} study partner! Let&apos;s learn together.
              </p>

              <div className="flex flex-wrap justify-center gap-2 mb-4">
                <span className="px-3 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 text-xs rounded-full">
                  Search: {searchQuery.trim().length > 25 ? searchQuery.trim().slice(0, 25) + '...' : searchQuery.trim()}
                </span>
              </div>

              <button
                onClick={onShowAIPartnerModal}
                className="px-5 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg flex items-center gap-2 mx-auto text-sm sm:text-base"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start Studying with AI Partner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {hasSearched && (searchResults.partners.length > 0 || searchResults.groups.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 relative z-10">
          {/* Partners Results */}
          {searchResults.partners.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-neutral-900 dark:text-white text-lg">{t('partners')}</h3>
                <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-full">{searchResults.partners.length}</span>
              </div>
              <div className="space-y-2 max-h-80 sm:max-h-96 overflow-y-auto">
                {searchResults.partners.slice(0, 5).map((partner) => {
                  const matchingFields = getMatchingFields(partner, searchQuery)
                  const isAlreadyPartner = (partner as any).isAlreadyPartner

                  return (
                    <button
                      key={partner.id}
                      onClick={() => router.push(`/profile/${partner.user.id}`)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all duration-200 text-left group"
                    >
                      {partner.user.avatarUrl ? (
                        <Image src={partner.user.avatarUrl} alt={partner.user.name} width={48} height={48} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full ring-2 ring-neutral-200 dark:ring-neutral-700 group-hover:ring-neutral-400 dark:group-hover:ring-neutral-500 transition-all" />
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-neutral-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-neutral-900 font-semibold text-base sm:text-lg ring-2 ring-neutral-200 dark:ring-neutral-700 group-hover:ring-neutral-400 dark:group-hover:ring-neutral-500 transition-all">
                          {partner.user.name[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-neutral-900 dark:text-white truncate group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors text-sm sm:text-base">{partner.user.name}</p>
                          {isAlreadyPartner && (
                            <span className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold rounded-full whitespace-nowrap">
                              {t('alreadyPartnered')}
                            </span>
                          )}
                        </div>
                        {matchingFields.length > 0 ? (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                            {t('matchesIn')} {matchingFields.join(', ')}
                          </p>
                        ) : partner.subjects.length > 0 ? (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{partner.subjects.slice(0, 2).join(', ')}</p>
                        ) : null}
                      </div>
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-400 dark:text-neutral-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Groups Results */}
          {searchResults.groups.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-neutral-900 dark:text-white text-lg">{t('groups')}</h3>
                <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-full">{searchResults.groups.length}</span>
              </div>
              <div className="space-y-2 max-h-80 sm:max-h-96 overflow-y-auto">
                {searchResults.groups.slice(0, 5).map((group) => {
                  const matchingFields = getGroupMatchingFields(group, searchQuery)
                  const isMember = group.isMember

                  return (
                    <button
                      key={group.id}
                      onClick={() => router.push(`/groups/${group.id}`)}
                      className="w-full flex items-start gap-3 p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all duration-200 text-left group"
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-neutral-800 dark:bg-neutral-200 rounded-xl flex items-center justify-center text-white dark:text-neutral-900 font-bold text-base sm:text-lg flex-shrink-0 group-hover:scale-105 transition-transform">
                        {group.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-neutral-900 dark:text-white truncate group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors text-sm sm:text-base">{group.name}</p>
                          {isMember && (
                            <span className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold rounded-full whitespace-nowrap">
                              {t('alreadyInGroup')}
                            </span>
                          )}
                        </div>
                        {matchingFields.length > 0 ? (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                            {t('matchesIn')} {matchingFields.join(', ')}
                          </p>
                        ) : (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{group.subject} • {group.memberCount} {t('members')}</p>
                        )}
                      </div>
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-400 dark:text-neutral-500 group-hover:translate-x-1 transition-all mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
