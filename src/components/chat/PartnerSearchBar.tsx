'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'

interface PartnerSearchBarProps {
  onConversationSelect: (conversationId: string) => void
}

export default function PartnerSearchBar({ onConversationSelect }: PartnerSearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    id: string
    name: string
    avatarUrl: string | null
    onlineStatus?: string
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
      // Search only within user's existing partners and their conversations
      // This endpoint only returns partners the user is connected with
      const response = await fetch('/api/chat/partners/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchQuery: query }),
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      const partners = data.partners || []

      setSearchResults(partners.map((p: any) => ({
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        onlineStatus: p.onlineStatus
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
          placeholder={t('searchPartnersAndMessages')}
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
            {searchResults.map((partner) => (
              <button
                key={partner.id}
                onClick={() => {
                  onConversationSelect(partner.id)
                  setSearchQuery('')
                  setShowResults(false)
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition text-left"
              >
                <PartnerAvatar
                  avatarUrl={partner.avatarUrl}
                  name={partner.name}
                  size="sm"
                  onlineStatus={partner.onlineStatus as 'ONLINE' | 'OFFLINE'}
                  showStatus={true}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{partner.name}</p>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

