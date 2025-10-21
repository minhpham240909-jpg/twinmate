'use client'

import { useAuth } from '@/lib/auth/context'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Message {
  id: string
  content: string
  type: string
  createdAt: string
  deletedAt?: string | null
  sender: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
}

interface SessionChatProps {
  sessionId: string
  isHost?: boolean
  onUnreadCountChange?: (count: number) => void
  isVisible?: boolean // Whether chat is currently visible to user
}

export default function SessionChat({ sessionId, isHost = false, onUnreadCountChange, isVisible = true }: SessionChatProps) {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<Message[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const supabase = createClient()

  // Initialize notification sound
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Create audio element for notification sound
      audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS56+ibSw0PVKzo7qdaFgpHouDyv28fBSh+zPLajjoIFl616+uoVxYJRp/h8sBuHwUnfs7y24s5CBVkuevrm0oODlOq6O+rYBkKRJzf8rxsFAUqgc7y2Ik2CBhmvevpn1ESDU+k5vK6aRsKRJzg8r1uHwUpgM3y24s5CBVjuOvrnE0NDFBL')
    }
  }, [])

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Handle unread count changes
  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadCount)
    }
  }, [unreadCount, onUnreadCountChange])

  // Mark messages as read when chat becomes visible
  useEffect(() => {
    if (isVisible && messages.length > 0) {
      const latestMessage = messages[messages.length - 1]
      setLastReadMessageId(latestMessage.id)
      setUnreadCount(0)
    }
  }, [isVisible, messages])

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Play notification sound
  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3 // 30% volume
      audioRef.current.play().catch(() => {
        // Ignore errors (e.g., if user hasn't interacted with page yet)
      })
    }
  }

  // Show notification toast for new message
  const showMessageNotification = (message: Message) => {
    const preview = message.content.length > 50
      ? message.content.substring(0, 50) + '...'
      : message.content

    toast(
      (t) => (
        <div className="flex items-start gap-3">
          {message.sender.avatarUrl ? (
            <img
              src={message.sender.avatarUrl}
              alt={message.sender.name}
              className="w-10 h-10 rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {message.sender.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">{message.sender.name}</p>
            <p className="text-gray-600 text-sm truncate">{preview}</p>
          </div>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ),
      {
        duration: 5000,
        icon: '💬',
        position: 'top-right',
      }
    )
  }

  // Fetch initial messages
  useEffect(() => {
    if (!sessionId) return

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/study-sessions/${sessionId}/messages`)
        const data = await res.json()

        if (data.success) {
          setMessages(data.messages)
        }
      } catch (error) {
        console.error('Error fetching messages:', error)
      }
    }

    fetchMessages()
  }, [sessionId])

  // Subscribe to real-time messages with fast polling fallback
  useEffect(() => {
    if (!sessionId) return

    let isSubscribed = true
    let pollingInterval: NodeJS.Timeout | null = null
    let realtimeWorking = false

    // Fast polling fallback (500ms) for instant updates if realtime fails
    const startFastPolling = () => {
      if (pollingInterval) return

      pollingInterval = setInterval(async () => {
        if (!isSubscribed) return

        try {
          const currentMessages = messagesRef.current
          const lastMessageTime = currentMessages.length > 0
            ? new Date(currentMessages[currentMessages.length - 1].createdAt).toISOString()
            : new Date(0).toISOString()

          const res = await fetch(`/api/study-sessions/${sessionId}/messages?after=${encodeURIComponent(lastMessageTime)}`)
          const data = await res.json()

          if (data.success && data.messages && data.messages.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map(m => m.id))
              const newMessages = data.messages.filter((m: Message) => !existingIds.has(m.id))

              newMessages.forEach((msg: Message) => {
                if (msg.sender.id !== user?.id) {
                  if (!isVisible) {
                    playNotificationSound()
                    showMessageNotification(msg)
                    setUnreadCount((prev) => prev + 1)
                  } else {
                    playNotificationSound()
                  }
                }
              })

              return newMessages.length > 0 ? [...prev, ...newMessages] : prev
            })
          }
        } catch (error) {
          // Silently handle errors
        }
      }, 500) // 500ms for near-instant updates
    }

    // Start polling immediately for reliability
    startFastPolling()

    // Try Supabase Realtime as enhancement
    const channel = supabase
      .channel(`session-${sessionId}-messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'SessionMessage',
          filter: `sessionId=eq.${sessionId}`,
        },
        async (payload) => {
          if (!isSubscribed) return
          realtimeWorking = true

          const newData = payload.new as { id: string; senderId: string }
          const messageId = newData.id

          try {
            const res = await fetch(`/api/study-sessions/${sessionId}/messages/${messageId}`)
            const data = await res.json()

            if (data.success && data.message) {
              const newMessage = data.message

              setMessages((prev) => {
                const exists = prev.some(m => m.id === newMessage.id)
                if (exists) return prev

                if (newMessage.sender.id !== user?.id) {
                  if (!isVisible) {
                    playNotificationSound()
                    showMessageNotification(newMessage)
                    setUnreadCount((prevCount) => prevCount + 1)
                  } else {
                    playNotificationSound()
                  }
                }

                return [...prev, newMessage]
              })
            }
          } catch (error) {
            console.error('Error fetching new message:', error)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'SessionMessage',
          filter: `sessionId=eq.${sessionId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as { id: string; deletedAt?: string | null }
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMsg.id
                ? { ...msg, deletedAt: updatedMsg.deletedAt }
                : msg
            )
          )
        }
      )
      .subscribe()

    return () => {
      isSubscribed = false
      supabase.removeChannel(channel)
      if (pollingInterval) clearInterval(pollingInterval)
    }
  }, [sessionId, supabase, user?.id, isVisible])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim() || sending || !user) return

    const messageContent = newMessage.trim()
    const tempId = `temp-${Date.now()}-${Math.random()}`

    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      content: messageContent,
      type: 'TEXT',
      createdAt: new Date().toISOString(),
      sender: {
        id: user.id,
        name: profile?.name || user.email || 'You',
        email: user.email || '',
        avatarUrl: profile?.avatarUrl || null,
      },
    }

    // Add message to UI immediately (optimistic update)
    setMessages((prev) => [...prev, optimisticMessage])
    setNewMessage('')
    setSending(true)

    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent }),
      })

      const data = await res.json()

      if (data.success) {
        // Replace optimistic message with real message from server
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...data.message } : msg
          )
        )
      } else {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
        toast.error(data.error || 'Failed to send message')
      }
    } catch (error) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) {
      return
    }

    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/messages/${messageId}/delete`, {
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
        toast.success('Message deleted')
      } else {
        toast.error(data.error || 'Failed to delete message')
      }
    } catch (error) {
      console.error('Error deleting message:', error)
      toast.error('Failed to delete message')
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p>💬 No messages yet</p>
            <p className="text-sm mt-2">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.sender.id === user?.id
            const canDelete = isOwnMessage || isHost
            const isDeleted = !!message.deletedAt

            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  {!isOwnMessage && (
                    <div className="flex-shrink-0">
                      {message.sender.avatarUrl ? (
                        <img
                          src={message.sender.avatarUrl}
                          alt={message.sender.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                          {message.sender.name[0]}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="relative">
                    {!isOwnMessage && (
                      <p className="text-xs text-gray-600 mb-1">{message.sender.name}</p>
                    )}
                    <div
                      className={`px-4 py-2 rounded-lg relative group ${
                        isDeleted
                          ? 'bg-gray-200 text-gray-500 italic'
                          : isOwnMessage
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                      onClick={() => {
                        if (!isDeleted && canDelete) {
                          setSelectedMessageId(message.id === selectedMessageId ? null : message.id)
                        }
                      }}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {isDeleted ? 'This message was deleted' : message.content}
                      </p>

                      {/* Delete button - shows on click */}
                      {!isDeleted && canDelete && selectedMessageId === message.id && (
                        <div className="absolute -top-1 -right-1 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteMessage(message.id)
                            }}
                            className="px-2 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 transition whitespace-nowrap shadow-lg"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message... (Press Enter to send)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}
