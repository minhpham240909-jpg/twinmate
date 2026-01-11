'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'

interface GroupSearchBarProps {
  onGroupSelect: (groupId: string) => void
}

export default function GroupSearchBar({ onGroupSelect }: GroupSearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    id: string
    name: string
    description: string | null
    subject: string
    memberCount: number
  }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('chat')

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.trim().length >= 2) {
      setIsSearching(true)
      setShowResults(true)
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery)
      }, 300)
    } else {
      setSearchResults([])
      setShowResults(false)
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const performSearch = async (query: string) => {
    try {
      // Search only within user's existing groups and their conversations
      // This endpoint only returns groups the user is a member of
      const response = await fetch('/api/chat/groups/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchQuery: query }),
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      const groups = data.groups || []

      setSearchResults(groups.map((g: any) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        subject: g.subject,
        memberCount: g.memberCount || 0
      })))
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="relative" ref={resultsRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('searchGroupsAndMessages')}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        {isSearching && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        {searchQuery && !isSearching && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto">
          <div className="p-2">
            {searchResults.map((group) => (
              <button
                key={group.id}
                onClick={() => {
                  onGroupSelect(group.id)
                  setSearchQuery('')
                  setShowResults(false)
                }}
                className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition text-left"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                  {group.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{group.name}</p>
                  {group.description && (
                    <p className="text-sm text-gray-600 truncate mt-0.5">{group.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">{group.subject} • {group.memberCount} {t('members')}</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 mt-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

