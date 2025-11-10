'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef, Suspense } from 'react'
import { subscribeToDM, subscribeToMessages } from '@/lib/supabase/realtime'
import MessageVideoCall from '@/components/messages/MessageVideoCall'
import SearchDropdown from '@/components/messages/SearchDropdown'
import { useTranslations } from 'next-intl'

interface Conversation {
  id: string
  name: string
  avatarUrl: string | null
  type: 'partner' | 'group'
  onlineStatus?: string
  memberCount?: number
  lastMessage: string | null
  lastMessageTime: string | null
  unreadCount: number
}

interface Message {
  id: string
  content: string
  type: string
  senderId: string
  sender: {
    id: string
    name: string
    avatarUrl: string | null
  }
  createdAt: string
  isRead: boolean
  deletedAt?: string | null
  callType?: string | null
  callDuration?: number | null
  callStatus?: string | null
  callStartedAt?: string | null
}

function ChatPageContent() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('messages')
  const tCommon = useTranslations('common')
  // Load cached conversations immediately from localStorage
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('chatConversations')
      if (cached) {
        try {
          return JSON.parse(cached)
        } catch (e) {
          return []
        }
      }
    }
    return []
  })
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [message, setMessage] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const conversationsCache = useRef<Conversation[]>([])
  const messagesCache = useRef<Map<string, Message[]>>(new Map())
  const [isInCall, setIsInCall] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const callMessageId = useRef<string | null>(null)
  const callStartTime = useRef<number>(0)
  const currentCallType = useRef<'VIDEO' | 'AUDIO'>('VIDEO')
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [isGroupAdmin, setIsGroupAdmin] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  // Fetch conversations with localStorage caching
  useEffect(() => {
    if (!user) return

    const fetchConversations = async () => {
      try {
        // Fetch fresh data in background
        const res = await fetch('/api/messages/conversations')
        const data = await res.json()

        if (data.success) {
          setConversations(data.conversations)
          // Cache conversations in localStorage
          localStorage.setItem('chatConversations', JSON.stringify(data.conversations))
          conversationsCache.current = data.conversations
        }
      } catch (error) {
        console.error('Error fetching conversations:', error)
      } finally {
        setLoadingConversations(false)
      }
    }

    fetchConversations()
  }, [user])

  // Check for conversation in URL params
  useEffect(() => {
    const conversationId = searchParams.get('conversation')
    const type = searchParams.get('type')

    if (conversationId && type && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === conversationId && c.type === type)
      if (conversation) {
        handleSelectConversation(conversation)
      }
    }
  }, [searchParams, conversations])

  // Fetch messages for selected conversation with localStorage caching
  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation)

    const cacheKey = `chatMessages_${conversation.type}_${conversation.id}`

    // Load cached messages from localStorage immediately
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try {
          const cachedMessages = JSON.parse(cached)
          setMessages(cachedMessages)
          messagesCache.current.set(cacheKey, cachedMessages)
          setLoadingMessages(false)
        } catch (e) {
          setLoadingMessages(true)
        }
      } else {
        setLoadingMessages(true)
      }
    }

    try {
      const res = await fetch(`/api/messages/${conversation.id}?type=${conversation.type}&limit=50`)
      const data = await res.json()

      if (data.success) {
        setMessages(data.messages)
        // Cache messages in both memory and localStorage
        messagesCache.current.set(cacheKey, data.messages)
        localStorage.setItem(cacheKey, JSON.stringify(data.messages))

        // Check if user is a group admin (for delete permissions)
        if (conversation.type === 'group' && data.conversationInfo?.members) {
          const currentUserMember = data.conversationInfo.members.find(
            (m: { id: string }) => m.id === user?.id
          )
          setIsGroupAdmin(currentUserMember?.role === 'ADMIN' || currentUserMember?.role === 'OWNER')
        } else {
          setIsGroupAdmin(false)
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  // Subscribe to real-time messages
  useEffect(() => {
    if (!selectedConversation || !user) return

    let cleanup: (() => void) | undefined
    const cacheKey = `chatMessages_${selectedConversation.type}_${selectedConversation.id}`

    if (selectedConversation.type === 'partner') {
      cleanup = subscribeToDM(
        user.id,
        selectedConversation.id,
        (newMessage) => {
          const msg = newMessage as unknown as Message
          // Prevent duplicates with comprehensive checks
          setMessages(prev => {
            // Check if message already exists by ID (most reliable check)
            const existsById = prev.some(m => m.id === msg.id)
            if (existsById) {
              console.log('[DM] Blocked duplicate by ID:', msg.id)
              return prev
            }

            // Check if exact same message exists (same content + sender + exact timestamp)
            const exactDuplicate = prev.some(m =>
              m.senderId === msg.senderId &&
              m.content === msg.content &&
              m.createdAt === msg.createdAt
            )
            if (exactDuplicate) {
              console.log('[DM] Blocked exact duplicate:', msg.content.substring(0, 20))
              return prev
            }

            // Check if this is a very recent duplicate (within 2 seconds with same content/sender)
            const now = new Date(msg.createdAt).getTime()
            const recentDuplicate = prev.some(m =>
              m.senderId === msg.senderId &&
              m.content.trim() === msg.content.trim() &&
              Math.abs(new Date(m.createdAt).getTime() - now) < 2000
            )
            if (recentDuplicate) {
              console.log('[DM] Blocked recent duplicate:', msg.content.substring(0, 20))
              return prev
            }

            console.log('[DM] Adding new message:', msg.id)
            const updated = [...prev, msg]
            messagesCache.current.set(cacheKey, updated)
            localStorage.setItem(cacheKey, JSON.stringify(updated))
            return updated
          })
        }
      )
    } else if (selectedConversation.type === 'group') {
      cleanup = subscribeToMessages(`group:${selectedConversation.id}`, (newMessage) => {
        const msg = newMessage as unknown as Message
        // Prevent duplicates with comprehensive checks
        setMessages(prev => {
          // Check if message already exists by ID (most reliable check)
          const existsById = prev.some(m => m.id === msg.id)
          if (existsById) {
            console.log('[Group] Blocked duplicate by ID:', msg.id)
            return prev
          }

          // Check if exact same message exists (same content + sender + exact timestamp)
          const exactDuplicate = prev.some(m =>
            m.senderId === msg.senderId &&
            m.content === msg.content &&
            m.createdAt === msg.createdAt
          )
          if (exactDuplicate) {
            console.log('[Group] Blocked exact duplicate:', msg.content.substring(0, 20))
            return prev
          }

          // Check if this is a very recent duplicate (within 2 seconds with same content/sender)
          const now = new Date(msg.createdAt).getTime()
          const recentDuplicate = prev.some(m =>
            m.senderId === msg.senderId &&
            m.content.trim() === msg.content.trim() &&
            Math.abs(new Date(m.createdAt).getTime() - now) < 2000
          )
          if (recentDuplicate) {
            console.log('[Group] Blocked recent duplicate:', msg.content.substring(0, 20))
            return prev
          }

          console.log('[Group] Adding new message:', msg.id)
          const updated = [...prev, msg]
          messagesCache.current.set(cacheKey, updated)
          localStorage.setItem(cacheKey, JSON.stringify(updated))
          return updated
        })
      })
    }

    return () => {
      if (cleanup) cleanup()
    }
  }, [selectedConversation, user])

  // Smart scroll: only auto-scroll if user is near bottom
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const isNearBottom = () => {
      const threshold = 100
      return container.scrollHeight - container.scrollTop - container.clientHeight < threshold
    }

    // Only auto-scroll if user is already near the bottom
    if (shouldAutoScroll && isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, shouldAutoScroll])

  // Detect when user scrolls up
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const threshold = 100
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold

      setShouldAutoScroll(isNearBottom)
      setShowScrollButton(!isNearBottom)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShouldAutoScroll(true)
    setShowScrollButton(false)
  }

  // Scroll to specific message function
  const scrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`)
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Highlight the message briefly
      messageElement.classList.add('ring-4', 'ring-yellow-400', 'ring-opacity-50')
      setTimeout(() => {
        messageElement.classList.remove('ring-4', 'ring-yellow-400', 'ring-opacity-50')
      }, 2000)
    }
  }

  // Handle conversation selection from search
  const handleSearchConversationSelect = (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId)
    if (conversation) {
      handleSelectConversation(conversation)
    }
  }

  // Handle message selection from search - open conversation and scroll to message
  const handleSearchMessageSelect = async (conversationId: string, messageId: string) => {
    // First, find and select the conversation
    const conversation = conversations.find(c => c.id === conversationId)
    if (!conversation) return

    // If this is not the currently selected conversation, switch to it
    if (!selectedConversation || selectedConversation.id !== conversationId) {
      await handleSelectConversation(conversation)
      // Wait for messages to load before scrolling
      setTimeout(() => scrollToMessage(messageId), 500)
    } else {
      // Already in the conversation, just scroll to the message
      scrollToMessage(messageId)
    }
  }

  // Send message
  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation || !user) return

    const messageContent = message
    setMessage('')
    const cacheKey = `chatMessages_${selectedConversation.type}_${selectedConversation.id}`

    // Create optimistic message to show immediately
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      type: 'TEXT',
      senderId: user.id,
      sender: {
        id: user.id,
        name: profile?.name || 'You',
        avatarUrl: profile?.avatarUrl || null
      },
      createdAt: new Date().toISOString(),
      isRead: false
    }

    // Add message to UI immediately (optimistic update)
    setMessages(prev => {
      const updated = [...prev, optimisticMessage]
      messagesCache.current.set(cacheKey, updated)
      localStorage.setItem(cacheKey, JSON.stringify(updated))
      return updated
    })

    // Always scroll to bottom when user sends a message
    setShouldAutoScroll(true)
    setTimeout(() => scrollToBottom(), 100)

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageContent,
          conversationId: selectedConversation.id,
          conversationType: selectedConversation.type
        })
      })

      const data = await res.json()

      if (data.success) {
        // Replace optimistic message with real message from server
        setMessages(prev => {
          // Check if real message already exists (from real-time subscription)
          const realMessageExists = prev.some(m => m.id === data.message.id)

          if (realMessageExists) {
            // Real-time already added it, just remove the optimistic one
            const updated = prev.filter(msg => msg.id !== optimisticMessage.id)
            messagesCache.current.set(cacheKey, updated)
            localStorage.setItem(cacheKey, JSON.stringify(updated))
            return updated
          } else {
            // Real-time hasn't fired yet, replace optimistic with real
            const updated = prev.map(msg =>
              msg.id === optimisticMessage.id ? data.message : msg
            )
            messagesCache.current.set(cacheKey, updated)
            localStorage.setItem(cacheKey, JSON.stringify(updated))
            return updated
          }
        })
      } else {
        // Remove optimistic message on error
        setMessages(prev => {
          const updated = prev.filter(msg => msg.id !== optimisticMessage.id)
          messagesCache.current.set(cacheKey, updated)
          localStorage.setItem(cacheKey, JSON.stringify(updated))
          return updated
        })
        setMessage(messageContent) // Restore message on error
      }
    } catch (error) {
      console.error('Error sending message:', error)
      // Remove optimistic message on error
      setMessages(prev => {
        const updated = prev.filter(msg => msg.id !== optimisticMessage.id)
        messagesCache.current.set(cacheKey, updated)
        localStorage.setItem(cacheKey, JSON.stringify(updated))
        return updated
      })
      setMessage(messageContent) // Restore message on error
    }
  }

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) {
      return
    }

    try {
      const res = await fetch(`/api/messages/${messageId}/delete`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (data.success) {
        // Update the message in the UI to show as deleted
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, deletedAt: new Date().toISOString() } : msg
          )
        )
        setSelectedMessageId(null)

        // Update cache
        if (selectedConversation) {
          const cacheKey = `chatMessages_${selectedConversation.type}_${selectedConversation.id}`
          const updatedMessages = messages.map((msg) =>
            msg.id === messageId ? { ...msg, deletedAt: new Date().toISOString() } : msg
          )
          messagesCache.current.set(cacheKey, updatedMessages)
          localStorage.setItem(cacheKey, JSON.stringify(updatedMessages))
        }
      } else {
        alert(data.error || 'Failed to delete message')
      }
    } catch (error) {
      console.error('Error deleting message:', error)
      alert('Failed to delete message')
    }
  }

  // Video/Audio call functions - Simplified with VideoCall component
  const startCall = async (callType: 'VIDEO' | 'AUDIO' = 'VIDEO') => {
    if (!selectedConversation || !user) return

    try {
      // Create call message first
      const callMessageRes = await fetch('/api/messages/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          conversationId: selectedConversation.id,
          conversationType: selectedConversation.type,
          callType
        })
      })

      const callMessageData = await callMessageRes.json()

      if (callMessageData.success) {
        callMessageId.current = callMessageData.message.id
        callStartTime.current = Date.now()
        currentCallType.current = callType // Store call type

        // Add message to UI immediately
        setMessages(prev => [...prev, callMessageData.message])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

        // Start the video call interface
        setIsInCall(true)
      } else {
        alert(callMessageData.error || 'Failed to start call')
      }
    } catch (error) {
      console.error('Error starting call:', error)
      alert('Failed to start call. Please try again.')
    }
  }

  const handleCallEnd = () => {
    setIsInCall(false)
    // Reset call tracking
    callMessageId.current = null
    callStartTime.current = 0
  }

  // Redirect if not authenticated, but don't block UI
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const formatTime = (date: string | null) => {
    if (!date) return ''
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-blue-600">Messages</h1>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
            <div className="grid grid-cols-3 h-full overflow-hidden">
              {/* Chat List */}
              <div className="col-span-1 border-r border-gray-200 flex flex-col overflow-hidden">
                {/* Search bar - Fixed at top */}
                <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
                  <SearchDropdown
                    onConversationSelect={handleSearchConversationSelect}
                    onMessageSelect={handleSearchMessageSelect}
                  />
                </div>
                
                {/* Conversations list - Scrollable */}
                <div className="flex-1 overflow-y-auto">
                  {/* Loading State */}
                  {loadingConversations ? (
                    <div className="p-8 text-center">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Loading conversations...</p>
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-gray-200">
                      {conversations.map((conv: Conversation) => (
                        <button
                          key={`${conv.type}-${conv.id}`}
                          onClick={() => handleSelectConversation(conv)}
                          className={`w-full p-4 text-left hover:bg-gray-50 transition ${
                            selectedConversation?.id === conv.id && selectedConversation?.type === conv.type ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                              {conv.avatarUrl ? (
                                <img src={conv.avatarUrl} alt={conv.name} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                conv.name[0].toUpperCase()
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-gray-900 truncate">{conv.name}</h3>
                                  {conv.type === 'partner' && conv.onlineStatus === 'ONLINE' && (
                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">{formatTime(conv.lastMessageTime)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600 truncate">
                                  {conv.lastMessage || (conv.type === 'group' ? `${conv.memberCount} ${t('members')}` : t('noMessages'))}
                                </p>
                                {conv.unreadCount > 0 && (
                                  <span className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                                    {conv.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Empty State */}
                    {conversations.length === 0 && (
                      <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600">
                          {t('noConversationsYet')}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          Connect with partners or join groups to start chatting
                        </p>
                      </div>
                    )}
                  </>
                  )}
                </div>
              </div>

              {/* Chat Window */}
              <div className="col-span-2 flex flex-col h-full overflow-hidden">
                {selectedConversation ? (
                  <>
                    {/* Chat Header - Fixed at top */}
                    <div className="flex-shrink-0 p-4 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {selectedConversation.avatarUrl ? (
                            <img src={selectedConversation.avatarUrl} alt={selectedConversation.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            selectedConversation.name[0].toUpperCase()
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{selectedConversation.name}</h3>
                          {selectedConversation.type === 'partner' && (
                            <p className={`text-xs ${selectedConversation.onlineStatus === 'ONLINE' ? 'text-green-600' : 'text-gray-500'}`}>
                              {selectedConversation.onlineStatus === 'ONLINE' ? t('online') : t('offline')}
                            </p>
                          )}
                          {selectedConversation.type === 'group' && (
                            <p className="text-xs text-gray-500">{selectedConversation.memberCount} {t('members')}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!isInCall && (
                          <>
                            <button
                              onClick={() => startCall('AUDIO')}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                              title={t('audioCall')}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => startCall('VIDEO')}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                              title={t('videoCall')}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Full Screen Video Call Interface */}
                    {isInCall && selectedConversation && user && profile && callMessageId.current && (
                      <MessageVideoCall
                        conversationId={selectedConversation.id}
                        conversationType={selectedConversation.type}
                        userId={user.id}
                        userName={profile.name || user.email || 'User'}
                        onCallEnd={handleCallEnd}
                        callMessageId={callMessageId.current}
                        callStartTime={callStartTime.current}
                        callType={currentCallType.current}
                      />
                    )}

                    {/* Messages - Scrollable area */}
                    <div className="flex-1 relative overflow-hidden">
                      <div ref={messagesContainerRef} className="h-full overflow-y-auto overflow-x-hidden">
                        {loadingMessages ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                              <p className="text-gray-500">{t('noMessages')}</p>
                              <p className="text-sm text-gray-400 mt-1">{t('sendMessageToStart')}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 space-y-4">
                            {messages.map((msg) => {
                              const isOwnMessage = msg.senderId === user.id

                              // Special rendering for CALL messages
                              if (msg.type === 'CALL') {
                                const callIcon = msg.callType === 'VIDEO' ? '📹' : '📞'
                                const callStatusIcon = msg.callStatus === 'COMPLETED' ? '✅' :
                                                      msg.callStatus === 'MISSED' ? '❌' :
                                                      msg.callStatus === 'CANCELLED' ? '🚫' : '⏳'

                                return (
                                  <div key={msg.id} id={`message-${msg.id}`} className="flex justify-center transition-all duration-300">
                                    <div className="max-w-md w-full">
                                      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                          <span className="text-lg">{callIcon}</span>
                                          <p className="text-sm text-gray-700 font-medium">{msg.content}</p>
                                          <span className="text-lg">{callStatusIcon}</span>
                                        </div>
                                        <span className="text-xs text-gray-500 mt-1 block">
                                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              }

                              // Regular message rendering
                              const isDeleted = !!msg.deletedAt
                              const canDelete = isOwnMessage || isGroupAdmin

                              return (
                                <div key={msg.id} id={`message-${msg.id}`} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} transition-all duration-300`}>
                                  <div className={`flex gap-2 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {/* Message Content */}
                                    <div className="relative">
                                      {!isOwnMessage && selectedConversation.type === 'group' && (
                                        <p className="text-xs text-gray-500 mb-1 px-4">{msg.sender.name}</p>
                                      )}
                                      <div
                                        className={`rounded-2xl px-4 py-2 relative group cursor-pointer ${
                                          isDeleted
                                            ? 'bg-gray-200 text-gray-500 italic'
                                            : isOwnMessage
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-900'
                                        }`}
                                        onClick={() => {
                                          if (!isDeleted && canDelete) {
                                            setSelectedMessageId(msg.id === selectedMessageId ? null : msg.id)
                                          }
                                        }}
                                      >
                                        <p className="text-sm whitespace-pre-wrap break-words">
                                          {isDeleted ? t('messageDeleted') : msg.content}
                                        </p>
                                        <span className={`text-xs mt-1 block ${isOwnMessage && !isDeleted ? 'text-blue-200' : 'text-gray-500'}`}>
                                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>

                                        {/* Delete button - shows on click */}
                                        {!isDeleted && canDelete && selectedMessageId === msg.id && (
                                          <div className="absolute -top-1 -right-1 z-10">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                handleDeleteMessage(msg.id)
                                              }}
                                              className="px-2 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 transition whitespace-nowrap shadow-lg"
                                            >
                                              {tCommon('delete')}
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                            <div ref={messagesEndRef} />
                          </div>
                        )}
                      </div>

                      {/* Scroll to bottom button - positioned relative to messages container */}
                      {showScrollButton && messages.length > 0 && (
                        <div className="absolute bottom-4 right-4 z-10">
                          <button
                            onClick={scrollToBottom}
                            className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200"
                            aria-label="Scroll to bottom"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Message Input - Fixed at bottom */}
                    <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        </button>
                        <input
                          type="text"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              if (message.trim()) {
                                handleSendMessage()
                              }
                            }
                          }}
                          placeholder={t('typeMessageHint')}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!message.trim()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {t('selectConversation')}
                      </h3>
                      <p className="text-gray-600">
                        Choose a chat from the list to start messaging
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  )
}
