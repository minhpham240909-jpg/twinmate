'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef, Suspense } from 'react'
import { subscribeToDM, subscribeToTypingDM, type TypingUser } from '@/lib/supabase/realtime'
import TypingIndicator from '@/components/chat/TypingIndicator'
import MessageVideoCall from '@/components/messages/MessageVideoCall'
import PartnerAvatar from '@/components/PartnerAvatar'
import { useTranslations } from 'next-intl'
import PartnerSearchBar from '@/components/chat/PartnerSearchBar'

interface Conversation {
  id: string
  name: string
  avatarUrl: string | null
  type: 'partner' | 'group'
  onlineStatus?: string
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
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
}

// Helper function to check if content contains an image URL or markdown image
function isImageMessage(msg: Message): { isImage: boolean; imageUrl: string | null; fileName: string | null } {
  // Check if message has fileUrl and is an image type
  if (msg.fileUrl && (msg.type === 'IMAGE' || msg.type === 'FILE')) {
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(msg.fileUrl) ||
                    msg.content.startsWith('[Image:')
    if (isImage) {
      return { isImage: true, imageUrl: msg.fileUrl, fileName: msg.fileName || null }
    }
  }

  // Check for markdown-style image format: [Image: filename](url)
  const imageMarkdownRegex = /^\[Image:\s*([^\]]+)\]\(([^)]+)\)$/
  const match = msg.content.match(imageMarkdownRegex)
  if (match) {
    return { isImage: true, imageUrl: match[2], fileName: match[1] }
  }

  // Check for markdown-style file format that is an image: [File: filename.jpg](url)
  const fileMarkdownRegex = /^\[File:\s*([^\]]+)\]\(([^)]+)\)$/
  const fileMatch = msg.content.match(fileMarkdownRegex)
  if (fileMatch && /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileMatch[1])) {
    return { isImage: true, imageUrl: fileMatch[2], fileName: fileMatch[1] }
  }

  return { isImage: false, imageUrl: null, fileName: null }
}

// Helper function to check if content is a file attachment
function isFileMessage(msg: Message): { isFile: boolean; fileUrl: string | null; fileName: string | null } {
  // Check if message has fileUrl
  if (msg.fileUrl && msg.type === 'FILE') {
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(msg.fileUrl)
    if (!isImage) {
      return { isFile: true, fileUrl: msg.fileUrl, fileName: msg.fileName || null }
    }
  }

  // Check for markdown-style file format: [File: filename](url)
  const fileMarkdownRegex = /^\[File:\s*([^\]]+)\]\(([^)]+)\)$/
  const match = msg.content.match(fileMarkdownRegex)
  if (match && !/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(match[1])) {
    return { isFile: true, fileUrl: match[2], fileName: match[1] }
  }

  return { isFile: false, fileUrl: null, fileName: null }
}

function PartnersChatContent() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('messages')
  const tChat = useTranslations('chat')
  const tCommon = useTranslations('common')

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('chatPartnerConversations')
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
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [isInCall, setIsInCall] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const callMessageId = useRef<string | null>(null)
  const callStartTime = useRef<number>(0)
  const currentCallType = useRef<'VIDEO' | 'AUDIO'>('VIDEO')
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const sendTypingRef = useRef<((isTyping: boolean, user: TypingUser) => void) | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingStateRef = useRef<boolean>(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  // Fetch partner conversations
  useEffect(() => {
    if (!user) return

    const fetchConversations = async () => {
      try {
        setLoadingConversations(true)
        const res = await fetch('/api/messages/conversations?type=partner')
        const data = await res.json()

        if (data.success) {
          const partnerConversations = data.conversations.filter((c: Conversation) => c.type === 'partner')
          setConversations(partnerConversations)
          localStorage.setItem('chatPartnerConversations', JSON.stringify(partnerConversations))
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
    if (conversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === conversationId)
      if (conversation) {
        handleSelectConversation(conversation)
      }
    }
  }, [searchParams, conversations])

  // Fetch messages for selected conversation
  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation)
    setHasMoreMessages(false)
    setNextCursor(null)
    const cacheKey = `chatMessages_partner_${conversation.id}`

    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try {
          const cachedMessages = JSON.parse(cached)
          setMessages(cachedMessages)
          setLoadingMessages(false)
        } catch (e) {
          setLoadingMessages(true)
        }
      } else {
        setLoadingMessages(true)
      }
    }

    try {
      const res = await fetch(`/api/messages/${conversation.id}?type=partner&limit=50`)
      const data = await res.json()

      if (data.success) {
        setMessages(data.messages)
        setHasMoreMessages(data.pagination?.hasMore || false)
        setNextCursor(data.pagination?.nextCursor || null)
        localStorage.setItem(cacheKey, JSON.stringify(data.messages))

        // Mark all messages in this conversation as read
        fetch('/api/messages/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationType: 'partner',
            conversationId: conversation.id
          })
        }).catch(err => console.error('Error marking messages as read:', err))
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  // Load more messages (older messages)
  const loadMoreMessages = async () => {
    if (!selectedConversation || !nextCursor || loadingMoreMessages) return

    setLoadingMoreMessages(true)
    const container = messagesContainerRef.current
    const previousScrollHeight = container?.scrollHeight || 0

    try {
      const res = await fetch(
        `/api/messages/${selectedConversation.id}?type=partner&limit=50&cursor=${nextCursor}`
      )
      const data = await res.json()

      if (data.success) {
        // Prepend older messages
        setMessages(prev => [...data.messages, ...prev])
        setHasMoreMessages(data.pagination?.hasMore || false)
        setNextCursor(data.pagination?.nextCursor || null)

        // Maintain scroll position after loading older messages
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight
            container.scrollTop = newScrollHeight - previousScrollHeight
          }
        })

        // Update cache with all messages
        const cacheKey = `chatMessages_partner_${selectedConversation.id}`
        setMessages(prev => {
          localStorage.setItem(cacheKey, JSON.stringify(prev))
          return prev
        })
      }
    } catch (error) {
      console.error('Error loading more messages:', error)
    } finally {
      setLoadingMoreMessages(false)
    }
  }

  // Subscribe to real-time messages
  useEffect(() => {
    if (!selectedConversation || !user) return

    const cleanup = subscribeToDM(
      user.id,
      selectedConversation.id,
      (newMessage) => {
        const msg = newMessage as unknown as Message
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          const updated = [...prev, msg]
          const cacheKey = `chatMessages_partner_${selectedConversation.id}`
          localStorage.setItem(cacheKey, JSON.stringify(updated))
          return updated
        })
      }
    )

    return () => {
      if (cleanup) cleanup()
    }
  }, [selectedConversation, user])

  // Subscribe to typing indicators
  useEffect(() => {
    if (!selectedConversation || !user || !profile) return

    const { cleanup, sendTyping } = subscribeToTypingDM(
      user.id,
      selectedConversation.id,
      (users) => setTypingUsers(users)
    )

    sendTypingRef.current = sendTyping

    return () => {
      cleanup()
      sendTypingRef.current = null
      setTypingUsers([])
    }
  }, [selectedConversation, user, profile])

  // Handle typing broadcast
  const handleTyping = () => {
    if (!sendTypingRef.current || !user || !profile) return

    // Send typing=true
    if (!lastTypingStateRef.current) {
      lastTypingStateRef.current = true
      sendTypingRef.current(true, {
        id: user.id,
        name: profile.name || 'User',
        avatarUrl: profile.avatarUrl
      })
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set timeout to send typing=false after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (sendTypingRef.current && lastTypingStateRef.current) {
        lastTypingStateRef.current = false
        sendTypingRef.current(false, {
          id: user.id,
          name: profile.name || 'User',
          avatarUrl: profile.avatarUrl
        })
      }
    }, 2000)
  }

  // Auto-scroll
  useEffect(() => {
    if (shouldAutoScroll && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, shouldAutoScroll])

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShouldAutoScroll(true)
    setShowScrollButton(false)
  }

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedConversation || !user) return

    setUploadingFile(true)
    try {
      // Upload file to server
      const formData = new FormData()
      formData.append('file', file)
      formData.append('conversationId', selectedConversation.id)
      formData.append('conversationType', 'partner')

      const uploadRes = await fetch('/api/messages/upload-file', {
        method: 'POST',
        body: formData,
      })

      const uploadData = await uploadRes.json()

      if (!uploadData.success) {
        alert(uploadData.error || 'Failed to upload file')
        return
      }

      // Send message with file URL
      const fileUrl = uploadData.file.url
      const fileName = uploadData.file.fileName
      const isImage = uploadData.file.isImage

      let messageContent = isImage
        ? `[Image: ${fileName}](${fileUrl})`
        : `[File: ${fileName}](${fileUrl})`

      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageContent,
          conversationId: selectedConversation.id,
          conversationType: 'partner'
        })
      })

      const data = await res.json()
      if (data.success) {
        setMessages(prev => [...prev, data.message])
        setShouldAutoScroll(true)
        setTimeout(() => scrollToBottom(), 100)
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Failed to upload file')
    } finally {
      setUploadingFile(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Send message
  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation || !user) return

    const messageContent = message
    setMessage('')

    // Use crypto.randomUUID() for truly unique optimistic IDs to prevent collisions
    const optimisticId = `temp-${crypto.randomUUID()}`
    const optimisticMessage: Message = {
      id: optimisticId,
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

    setMessages(prev => [...prev, optimisticMessage])
    setShouldAutoScroll(true)
    setTimeout(() => scrollToBottom(), 100)

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageContent,
          conversationId: selectedConversation.id,
          conversationType: 'partner'
        })
      })

      const data = await res.json()
      if (data.success) {
        setMessages(prev => {
          const realExists = prev.some(m => m.id === data.message.id)
          if (realExists) {
            return prev.filter(msg => msg.id !== optimisticId)
          } else {
            return prev.map(msg => msg.id === optimisticId ? data.message : msg)
          }
        })
      } else {
        setMessages(prev => prev.filter(msg => msg.id !== optimisticId))
        setMessage(messageContent)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId))
      setMessage(messageContent)
    }
  }

  // Start call
  const startCall = async (callType: 'VIDEO' | 'AUDIO' = 'VIDEO') => {
    if (!selectedConversation || !user) return

    try {
      const callMessageRes = await fetch('/api/messages/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          conversationId: selectedConversation.id,
          conversationType: 'partner',
          callType
        })
      })

      const callMessageData = await callMessageRes.json()
      if (callMessageData.success) {
        callMessageId.current = callMessageData.message.id
        callStartTime.current = Date.now()
        currentCallType.current = callType
        setMessages(prev => [...prev, callMessageData.message])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        setIsInCall(true)
      }
    } catch (error) {
      console.error('Error starting call:', error)
    }
  }

  const handleCallEnd = () => {
    setIsInCall(false)
    callMessageId.current = null
    callStartTime.current = 0
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
      } else {
        alert(data.error || 'Failed to delete message')
      }
    } catch (error) {
      console.error('Error deleting message:', error)
      alert('Failed to delete message')
    }
  }

  // Handle search conversation select
  const handleSearchConversationSelect = (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId)
    if (conversation) {
      handleSelectConversation(conversation)
      router.push(`/chat/partners?conversation=${conversationId}`)
    }
  }

  const formatTime = (date: string | null) => {
    if (!date) return ''
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return tCommon('justNow')
    if (minutes < 60) return tCommon('minutesAgo', { count: minutes })
    if (hours < 24) return tCommon('hoursAgo', { count: hours })
    return tCommon('daysAgo', { count: days })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-500 dark:text-neutral-400">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="h-screen bg-white dark:bg-neutral-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/chat')}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-neutral-700 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-white tracking-tight">
              {tChat('partnerChat')}
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Partner List Sidebar */}
        <div className="w-80 bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
          {/* Search Bar with Find Partner Button */}
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <PartnerSearchBar onConversationSelect={handleSearchConversationSelect} />
              </div>
              <button
                onClick={() => router.push('/find-partner')}
                className="flex-shrink-0 p-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
                title={tChat('findPartner')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{tCommon('loading')}</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('noConversationsYet')}</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => {
                      handleSelectConversation(conv)
                      router.push(`/chat/partners?conversation=${conv.id}`)
                    }}
                    className={`w-full p-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${
                      selectedConversation?.id === conv.id
                        ? 'bg-neutral-100 dark:bg-neutral-800 border-l-2 border-neutral-900 dark:border-white'
                        : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <PartnerAvatar
                        avatarUrl={conv.avatarUrl}
                        name={conv.name}
                        size="md"
                        onlineStatus={conv.onlineStatus as 'ONLINE' | 'OFFLINE'}
                        showStatus={true}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-neutral-900 dark:text-white truncate">{conv.name}</h3>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">{formatTime(conv.lastMessageTime)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate">{conv.lastMessage || t('noMessages')}</p>
                          {conv.unreadCount > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs rounded-full font-medium">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-neutral-950">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="flex-shrink-0 p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900">
                <div className="flex items-center gap-3">
                  <PartnerAvatar
                    avatarUrl={selectedConversation.avatarUrl}
                    name={selectedConversation.name}
                    size="md"
                    onlineStatus={selectedConversation.onlineStatus as 'ONLINE' | 'OFFLINE'}
                    showStatus={true}
                  />
                  <div>
                    <h3 className="font-medium text-neutral-900 dark:text-white">{selectedConversation.name}</h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {selectedConversation.onlineStatus === 'ONLINE' ? t('online') : t('offline')}
                    </p>
                  </div>
                </div>
                {!isInCall && (
                  <div className="flex gap-1">
                    {/* Find More Partners Button */}
                    <button
                      onClick={() => router.push('/dashboard/partners')}
                      className="p-2.5 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                      title={tChat('findMorePartners')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => startCall('AUDIO')}
                      className="p-2.5 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                      title={t('audioCall')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => startCall('VIDEO')}
                      className="p-2.5 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                      title={t('videoCall')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Video Call Interface */}
              {isInCall && selectedConversation && user && profile && callMessageId.current && (
                <MessageVideoCall
                  conversationId={selectedConversation.id}
                  conversationType="partner"
                  userId={user.id}
                  userName={profile.name || user.email || 'User'}
                  onCallEnd={handleCallEnd}
                  callMessageId={callMessageId.current}
                  callStartTime={callStartTime.current}
                  callType={currentCallType.current}
                />
              )}

              {/* Messages */}
              {!isInCall && (
                <>
                  <div className="flex-1 relative overflow-hidden">
                    <div ref={messagesContainerRef} className="h-full overflow-y-auto overflow-x-hidden p-4">
                      {loadingMessages ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="w-8 h-8 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <p className="text-neutral-600 dark:text-neutral-400">{t('noMessages')}</p>
                            <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-1">{t('sendMessageToStart')}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Load More Button */}
                          {hasMoreMessages && (
                            <div className="flex justify-center pb-2">
                              <button
                                onClick={loadMoreMessages}
                                disabled={loadingMoreMessages}
                                className="px-4 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                              >
                                {loadingMoreMessages ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-neutral-600 dark:border-neutral-400 border-t-transparent rounded-full animate-spin"></div>
                                    {tCommon('loading')}
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                    {t('loadMore')}
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                          {messages.map((msg) => {
                            const isOwnMessage = msg.senderId === user.id

                            if (msg.type === 'CALL') {
                              const callIcon = msg.callType === 'VIDEO' ? '📹' : '📞'
                              const callStatusIcon = msg.callStatus === 'COMPLETED' ? '✓' :
                                                    msg.callStatus === 'MISSED' ? '✕' :
                                                    msg.callStatus === 'CANCELLED' ? '—' : '...'

                              return (
                                <div key={msg.id} className="flex justify-center">
                                  <div className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <span className="text-base">{callIcon}</span>
                                      <p className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">{msg.content}</p>
                                      <span className="text-sm text-neutral-500">{callStatusIcon}</span>
                                    </div>
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 block">
                                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                              )
                            }

                            const isDeleted = !!msg.deletedAt
                            const canDelete = isOwnMessage

                            return (
                              <div key={msg.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex gap-2 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                                  <div className="relative">
                                    {(() => {
                                      const imageInfo = isImageMessage(msg)
                                      const fileInfo = isFileMessage(msg)

                                      return (
                                        <div
                                          className={`rounded-2xl ${imageInfo.isImage ? 'p-1' : 'px-4 py-2'} ${
                                            isDeleted
                                              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 italic border border-neutral-200 dark:border-neutral-700'
                                              : isOwnMessage
                                              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700'
                                          } ${!isDeleted && canDelete ? 'cursor-pointer' : ''}`}
                                          onClick={() => {
                                            if (!isDeleted && canDelete) {
                                              setSelectedMessageId(msg.id === selectedMessageId ? null : msg.id)
                                            }
                                          }}
                                        >
                                          {isDeleted ? (
                                            <p className="text-sm whitespace-pre-wrap break-words px-3 py-1">
                                              {t('messageDeleted')}
                                            </p>
                                          ) : imageInfo.isImage && imageInfo.imageUrl ? (
                                            // Render image
                                            <div className="space-y-1">
                                              <a
                                                href={imageInfo.imageUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <img
                                                  src={imageInfo.imageUrl}
                                                  alt={imageInfo.fileName || 'Shared image'}
                                                  className="max-w-[280px] max-h-[300px] rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                  loading="lazy"
                                                  onError={(e) => {
                                                    // Fallback if image fails to load
                                                    const target = e.target as HTMLImageElement
                                                    target.style.display = 'none'
                                                    target.parentElement?.insertAdjacentHTML('afterbegin',
                                                      `<div class="px-3 py-2 text-sm">📷 ${imageInfo.fileName || 'Image'}</div>`)
                                                  }}
                                                />
                                              </a>
                                              {imageInfo.fileName && (
                                                <p className={`text-xs px-2 pb-1 truncate max-w-[280px] ${isOwnMessage ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-500 dark:text-neutral-400'}`}>
                                                  {imageInfo.fileName}
                                                </p>
                                              )}
                                            </div>
                                          ) : fileInfo.isFile && fileInfo.fileUrl ? (
                                            // Render file attachment
                                            <a
                                              href={fileInfo.fileUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className={`flex items-center gap-2 hover:opacity-80 transition-opacity ${isOwnMessage ? 'text-white dark:text-neutral-900' : 'text-neutral-900 dark:text-neutral-100'}`}
                                            >
                                              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                              </svg>
                                              <span className="text-sm truncate max-w-[200px]">{fileInfo.fileName || 'File'}</span>
                                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                              </svg>
                                            </a>
                                          ) : (
                                            // Regular text message
                                            <p className="text-sm whitespace-pre-wrap break-words">
                                              {msg.content}
                                            </p>
                                          )}
                                          <span className={`text-xs mt-1 block ${imageInfo.isImage ? 'px-2' : ''} ${isOwnMessage && !isDeleted ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-500 dark:text-neutral-400'}`}>
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
                                                Delete
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })()}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      )}

                      {showScrollButton && messages.length > 0 && (
                        <div className="absolute bottom-4 right-4 z-10">
                          <button
                            onClick={scrollToBottom}
                            className="w-10 h-10 bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-900 rounded-full shadow-lg flex items-center justify-center transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Typing Indicator */}
                  {typingUsers.length > 0 && (
                    <div className="flex-shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                      <TypingIndicator typingUsers={typingUsers} />
                    </div>
                  )}

                  {/* Message Input */}
                  <div className="flex-shrink-0 p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                    {/* Character count indicator - shows when approaching limit */}
                    {message.length > 800 && (
                      <div className="mb-2 flex justify-end">
                        <span className={`text-xs font-medium ${
                          message.length > 1000
                            ? 'text-red-500'
                            : message.length > 900
                              ? 'text-amber-500'
                              : 'text-neutral-500 dark:text-neutral-400'
                        }`}>
                          {message.length}/1000
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />

                      {/* File upload button */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFile}
                        className="p-2.5 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
                        title="Attach file or image"
                      >
                        {uploadingFile ? (
                          <div className="w-5 h-5 border-2 border-neutral-500 dark:border-neutral-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        )}
                      </button>

                      <input
                        type="text"
                        value={message}
                        onChange={(e) => {
                          // Enforce max length on input
                          if (e.target.value.length <= 1000) {
                            setMessage(e.target.value)
                            // Broadcast typing indicator
                            if (e.target.value.length > 0) {
                              handleTyping()
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            if (message.trim() && message.length <= 1000) {
                              handleSendMessage()
                            }
                          }
                        }}
                        maxLength={1000}
                        placeholder={t('typeMessageHint')}
                        className={`flex-1 px-4 py-2.5 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 border rounded-xl focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:border-transparent transition-all ${
                          message.length > 1000
                            ? 'border-red-500'
                            : 'border-neutral-200 dark:border-neutral-700'
                        }`}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!message.trim() || message.length > 1000}
                        className="p-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-1">{t('selectConversation')}</h3>
                <p className="text-neutral-500 dark:text-neutral-400">{tChat('selectPartnerToStart')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PartnersChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-500 dark:text-neutral-400">Loading...</p>
        </div>
      </div>
    }>
      <PartnersChatContent />
    </Suspense>
  )
}

