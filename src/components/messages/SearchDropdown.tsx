'use client'

import { useState, useEffect, useRef } from 'react'
import { MagnifyingGlassIcon, UserIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

interface ConversationResult {
  id: string
  name: string
  type: 'dm' | 'group'
  avatarUrl: string | null
  lastMessage?: string
  lastMessageAt?: string
}

interface MessageResult {
  id: string
  content: string
  conversationId: string
  conversationName: string
  conversationType: 'dm' | 'group'
  senderId: string
  senderName: string
  senderAvatarUrl: string | null
  createdAt: string
}

interface SearchResults {
  conversations: ConversationResult[]
  messages: MessageResult[]
}

interface SearchDropdownProps {
  onConversationSelect: (conversationId: string) => void
  onMessageSelect: (conversationId: string, messageId: string) => void
}

export default function SearchDropdown({
  onConversationSelect,
  onMessageSelect,
}: SearchDropdownProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<SearchResults>({ conversations: [], messages: [] })
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search effect
  useEffect(() => {
    // Clear previous timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }

    // Reset results if query is too short
    if (searchQuery.trim().length < 2) {
      setResults({ conversations: [], messages: [] })
      setShowDropdown(false)
      setIsSearching(false)
      return
    }

    // Set loading state
    setIsSearching(true)

    // Debounce search by 300ms
    debounceTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/messages/search?q=${encodeURIComponent(searchQuery.trim())}`
        )

        if (response.ok) {
          const data: SearchResults = await response.json()
          setResults(data)
          setShowDropdown(true)
        } else {
          console.error('Search failed:', response.statusText)
          setResults({ conversations: [], messages: [] })
        }
      } catch (error) {
        console.error('Search error:', error)
        setResults({ conversations: [], messages: [] })
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [searchQuery])

  const handleConversationClick = (conversationId: string) => {
    onConversationSelect(conversationId)
    setShowDropdown(false)
    setSearchQuery('')
  }

  const handleMessageClick = (conversationId: string, messageId: string) => {
    onMessageSelect(conversationId, messageId)
    setShowDropdown(false)
    setSearchQuery('')
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const hasResults = results.conversations.length > 0 || results.messages.length > 0

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder={t('searchConversationsAndMessages') || 'Search conversations and messages...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && searchQuery.trim().length >= 2 && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto">
          {!isSearching && !hasResults && (
            <div className="p-4 text-center text-gray-500">
              No results found for &quot;{searchQuery}&quot;
            </div>
          )}

          {/* Conversation Results */}
          {results.conversations.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                Conversations ({results.conversations.length})
              </div>
              {results.conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => handleConversationClick(conversation.id)}
                  className="w-full px-4 py-3 hover:bg-gray-50 border-b border-gray-100 flex items-center gap-3 text-left transition-colors"
                >
                  {/* Avatar/Icon */}
                  <div className="flex-shrink-0">
                    {conversation.avatarUrl ? (
                      <img
                        src={conversation.avatarUrl}
                        alt={`${conversation.name} avatar`}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        {conversation.type === 'group' ? (
                          <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-600" />
                        ) : (
                          <UserIcon className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Conversation Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900 truncate">
                        {conversation.name}
                      </p>
                      {conversation.lastMessageAt && (
                        <span className="text-xs text-gray-500 ml-2">
                          {formatTimestamp(conversation.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    {conversation.lastMessage && (
                      <p className="text-sm text-gray-500 truncate">
                        {truncateText(conversation.lastMessage, 50)}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-gray-400">
                        {conversation.type === 'group' ? 'Group' : 'Direct Message'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Message Results */}
          {results.messages.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                Messages ({results.messages.length})
              </div>
              {results.messages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => handleMessageClick(message.conversationId, message.id)}
                  className="w-full px-4 py-3 hover:bg-gray-50 border-b border-gray-100 flex items-center gap-3 text-left transition-colors"
                >
                  {/* Sender Avatar */}
                  <div className="flex-shrink-0">
                    {message.senderAvatarUrl ? (
                      <img
                        src={message.senderAvatarUrl}
                        alt={`${message.senderName}'s profile picture`}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-green-600" />
                      </div>
                    )}
                  </div>

                  {/* Message Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm">
                          {message.senderName}
                        </p>
                        <span className="text-xs text-gray-400">in</span>
                        <p className="font-medium text-gray-600 text-sm truncate max-w-32">
                          {message.conversationName}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 ml-2">
                        {formatTimestamp(message.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">
                      {truncateText(message.content, 80)}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <ChatBubbleLeftRightIcon className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-400">
                        {message.conversationType === 'group' ? 'Group Message' : 'Direct Message'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
