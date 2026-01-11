'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import InviteModal from '@/components/study-sessions/InviteModal'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'
import GlowBorder from '@/components/ui/GlowBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'

interface Participant {
  id: string
  userId: string
  name: string
  avatarUrl: string | null
  role: string
  status: string
}

interface Session {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  subject: string | null
  tags: string[]
  waitingExpiresAt: string | null
  agoraChannel: string | null
  maxParticipants: number
  createdBy: {
    id: string
    name: string
    avatarUrl: string | null
  }
  participants: Participant[]
  goals: { id: string; title: string }[]
  durationMinutes: number | null
}

interface WaitingMessage {
  id: string
  content: string
  senderId: string
  senderName: string
  senderAvatar: string | null
  createdAt: string
}

export default function WaitingLobbyPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string
  const supabase = createClient()
  const t = useTranslations('studySessions')

  const [session, setSession] = useState<Session | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState<number>(0) // seconds
  const [messages, setMessages] = useState<WaitingMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [starting, setStarting] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [showInviteModal, setShowInviteModal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch session
  const fetchSession = useCallback(async () => {
    if (!user || !sessionId) return

    try {
      const res = await fetch(`/api/study-sessions/${sessionId}`)
      const data = await res.json()

      if (data.success) {
        const sess = data.session

        // If session is ACTIVE, redirect to call page
        if (sess.status === 'ACTIVE') {
          toast.success(t('sessionHasStarted'))
          router.push(`/study-sessions/${sessionId}/call`)
          return
        }

        // If session is COMPLETED or CANCELLED, redirect to history
        if (sess.status === 'COMPLETED' || sess.status === 'CANCELLED') {
          toast.error(t('sessionHasEnded'))
          router.push('/study-sessions')
          return
        }

        setSession(sess)

        // Calculate time remaining (initial value, timer effect will take over)
        if (sess.waitingExpiresAt) {
          const expiresAt = new Date(sess.waitingExpiresAt)
          const now = new Date()
          const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
          setTimeRemaining(diff)

          // If expired, show message and redirect
          if (diff === 0) {
            toast.error(t('sessionHasExpired'))
            router.push('/study-sessions')
          }
        }
      } else {
        toast.error(data.error || t('failedToLoadSession'))
        router.push('/study-sessions')
      }
    } catch (error) {
      console.error('Error fetching session:', error)
      toast.error(t('failedToLoadSession'))
    } finally {
      setLoadingSession(false)
    }
  }, [user, sessionId, router])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
      return
    }

    if (user) {
      fetchSession()
    }
  }, [user, loading, fetchSession, router])

  // Countdown timer - updates every second
  useEffect(() => {
    if (!session?.waitingExpiresAt) return

    const expiresAt = new Date(session.waitingExpiresAt).getTime()

    // Calculate and set initial time
    const updateTimer = () => {
      const now = Date.now()
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000))
      setTimeRemaining(diff)

      if (diff === 0) {
        toast.error(t('sessionHasExpired'))
        router.push('/study-sessions')
        return false // Stop interval
      }
      return true // Continue interval
    }

    // Set initial value immediately
    updateTimer()

    // Update every second
    const interval = setInterval(() => {
      if (!updateTimer()) {
        clearInterval(interval)
      }
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [session?.waitingExpiresAt, router])

  // Real-time: Listen for session status changes
  // Smart polling: only poll when realtime fails, stop polling when realtime works
  useEffect(() => {
    if (!sessionId) return

    console.log('[Lobby RT] Setting up session status listener for:', sessionId)
    let realtimeWorking = false
    let pollInterval: NodeJS.Timeout | null = null
    let isCleanedUp = false

    // Function to check session status via API
    const checkSessionStatus = async () => {
      if (isCleanedUp || realtimeWorking) return // Stop polling if realtime is working

      try {
        const res = await fetch(`/api/study-sessions/${sessionId}`)
        const data = await res.json()
        if (!isCleanedUp && data.success && data.session?.status === 'ACTIVE') {
          console.log('[Lobby RT] Polling detected session is ACTIVE - redirecting')
          toast.success(t('sessionIsStarting'))
          router.push(`/study-sessions/${sessionId}/call`)
        }
      } catch (error) {
        console.error('[Lobby RT] Error checking session status:', error)
      }
    }

    // Stop polling when realtime works
    const stopPolling = () => {
      if (pollInterval) {
        console.log('[Lobby RT] Stopping session status polling (realtime working)')
        clearInterval(pollInterval)
        pollInterval = null
      }
    }

    // Start polling fallback (slower rate to reduce server load)
    const startPollingFallback = () => {
      if (pollInterval || isCleanedUp || realtimeWorking) return

      console.log('[Lobby RT] Starting session status polling fallback')
      pollInterval = setInterval(checkSessionStatus, 5000) // Poll every 5 seconds (slower)
    }

    const channel = supabase
      .channel(`lobby-status-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'StudySession',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (isCleanedUp) return

          console.log('[Lobby RT] Session UPDATE received:', payload)
          realtimeWorking = true
          stopPolling() // Stop polling when realtime event received

          const newStatus = (payload.new as { status?: string }).status
          if (newStatus === 'ACTIVE') {
            console.log('[Lobby RT] Session is now ACTIVE - redirecting to call page')
            toast.success(t('sessionIsStarting'))
            router.push(`/study-sessions/${sessionId}/call`)
          }
        }
      )
      .subscribe((status) => {
        if (isCleanedUp) return

        console.log('[Lobby RT] Session status subscription:', status)
        if (status === 'SUBSCRIBED') {
          console.log('[Lobby RT] Successfully subscribed to session status changes')
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[Lobby RT] Failed to subscribe - starting polling fallback for session status')
          realtimeWorking = false
          startPollingFallback()
        }
      })

    // FALLBACK: Start polling after 5 seconds if no realtime events received
    const fallbackTimeout = setTimeout(() => {
      if (!realtimeWorking && !isCleanedUp) {
        startPollingFallback()
      }
    }, 5000)

    return () => {
      isCleanedUp = true
      console.log('[Lobby RT] Cleaning up session status listener')
      clearTimeout(fallbackTimeout)
      stopPolling()
      supabase.removeChannel(channel)
    }
  }, [sessionId, supabase, router, t])

  // Real-time: Listen for participant changes (joins/leaves)
  // Smart polling: only poll when realtime fails, stop polling when realtime works
  useEffect(() => {
    if (!sessionId) return

    console.log('[Lobby RT] Setting up participant listener for session:', sessionId)
    let realtimeWorking = false
    let pollInterval: NodeJS.Timeout | null = null
    let isCleanedUp = false

    // Stop polling when realtime works
    const stopPolling = () => {
      if (pollInterval) {
        console.log('[Lobby RT] Stopping participant polling (realtime working)')
        clearInterval(pollInterval)
        pollInterval = null
      }
    }

    // Start polling fallback (slower rate to reduce server load)
    const startPollingFallback = () => {
      if (pollInterval || isCleanedUp || realtimeWorking) return

      console.log('[Lobby RT] Starting participant polling fallback')
      pollInterval = setInterval(() => {
        if (!realtimeWorking && !isCleanedUp) {
          fetchSession()
        }
      }, 5000) // Poll every 5 seconds (slower to reduce server load)
    }

    const channel = supabase
      .channel(`lobby-participants-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'SessionParticipant',
          filter: `sessionId=eq.${sessionId}`,
        },
        (payload) => {
          if (isCleanedUp) return

          console.log('[Lobby RT] Participant INSERT received:', payload)
          realtimeWorking = true
          stopPolling() // Stop polling when realtime event received
          toast.success(t('someoneJoinedSession'))
          fetchSession() // Refresh to get new participant list
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'SessionParticipant',
          filter: `sessionId=eq.${sessionId}`,
        },
        (payload) => {
          if (isCleanedUp) return

          console.log('[Lobby RT] Participant UPDATE received:', payload)
          realtimeWorking = true
          stopPolling() // Stop polling when realtime event received
          fetchSession() // Refresh to get updated participant data
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'SessionParticipant',
          filter: `sessionId=eq.${sessionId}`,
        },
        (payload) => {
          if (isCleanedUp) return

          console.log('[Lobby RT] Participant DELETE received:', payload)
          realtimeWorking = true
          stopPolling() // Stop polling when realtime event received
          toast('Someone left the session', { icon: '👋' })
          fetchSession() // Refresh to get updated participant list
        }
      )
      .subscribe((status) => {
        if (isCleanedUp) return

        console.log('[Lobby RT] Participant subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('[Lobby RT] Successfully subscribed to participant changes')
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[Lobby RT] Failed to subscribe - starting polling fallback')
          realtimeWorking = false
          startPollingFallback()
        }
      })

    // FALLBACK: Start polling after 5 seconds if no realtime events received
    const fallbackTimeout = setTimeout(() => {
      if (!realtimeWorking && !isCleanedUp) {
        startPollingFallback()
      }
    }, 5000)

    return () => {
      isCleanedUp = true
      console.log('[Lobby RT] Cleaning up participant listener')
      clearTimeout(fallbackTimeout)
      stopPolling()
      supabase.removeChannel(channel)
    }
  }, [sessionId, supabase, fetchSession, t])

  // Track presence
  useEffect(() => {
    if (!user || !sessionId) return

    const channel = supabase.channel(`lobby-presence-${sessionId}`, {
      config: { presence: { key: sessionId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const userIds = new Set<string>()
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            const p = presence as unknown as { user_id?: string }
            if (p.user_id) userIds.add(p.user_id)
          })
        })
        setOnlineUsers(userIds)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, sessionId, supabase])

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/study-sessions/${sessionId}/messages`)
        const data = await res.json()
        if (data.success) {
          setMessages(
            data.messages.map((m: { id: string; content: string; sender: { id: string; name: string; avatarUrl: string | null }; createdAt: string }) => ({
              id: m.id,
              content: m.content,
              senderId: m.sender.id,
              senderName: m.sender.name,
              senderAvatar: m.sender.avatarUrl,
              createdAt: m.createdAt,
            }))
          )
        }
      } catch (error) {
        console.error('Error fetching messages:', error)
      }
    }

    if (sessionId) {
      fetchMessages()
    }
  }, [sessionId])

  // FIX: Real-time messages via Supabase with fallback polling
  // REMOVED: 200ms polling that was creating 500 req/sec per session
  // Now uses Supabase real-time as primary with 10s fallback polling
  useEffect(() => {
    if (!sessionId) return

    let isSubscribed = true
    let fallbackPollingInterval: NodeJS.Timeout | null = null
    // Store last known message time for efficient polling
    const lastMessageTimeRef = { current: new Date(0).toISOString() }

    // Update last message time whenever messages change
    if (messages.length > 0) {
      lastMessageTimeRef.current = new Date(messages[messages.length - 1].createdAt).toISOString()
    }

    // Fallback polling function - only called at longer intervals (10s)
    // This is a backup in case real-time fails, NOT the primary mechanism
    const fetchNewMessages = async () => {
      if (!isSubscribed) return

      try {
        const res = await fetch(`/api/study-sessions/${sessionId}/messages?after=${encodeURIComponent(lastMessageTimeRef.current)}`)
        const data = await res.json()

        if (data.success && data.messages && data.messages.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map(m => m.id))
            const newMessages = data.messages
              .filter((m: { id: string }) => !existingIds.has(m.id))
              .map((m: { id: string; content: string; createdAt: string; sender: { id: string; name: string; avatarUrl: string | null } }) => ({
                id: m.id,
                content: m.content,
                senderId: m.sender.id,
                senderName: m.sender.name,
                senderAvatar: m.sender.avatarUrl,
                createdAt: m.createdAt,
              }))

            if (newMessages.length > 0) {
              // Update last message time for next poll
              lastMessageTimeRef.current = newMessages[newMessages.length - 1].createdAt
              return [...prev, ...newMessages]
            }
            return prev
          })
        }
      } catch (error) {
        // Silent fail for fallback polling - real-time is primary
        console.warn('[Lobby] Fallback polling error:', error)
      }
    }

    // Primary: Supabase real-time subscription for instant updates
    const channel = supabase
      .channel(`lobby-messages-${sessionId}`)
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

          const newMsg = payload.new as { id: string; senderId: string }
          try {
            const res = await fetch(`/api/study-sessions/${sessionId}/messages/${newMsg.id}`)
            const data = await res.json()
            if (data.success && data.message) {
              setMessages((prev) => {
                const exists = prev.some(m => m.id === data.message.id)
                if (exists) return prev

                // Update last message time
                lastMessageTimeRef.current = data.message.createdAt

                return [
                  ...prev,
                  {
                    id: data.message.id,
                    content: data.message.content,
                    senderId: data.message.sender.id,
                    senderName: data.message.sender.name,
                    senderAvatar: data.message.sender.avatarUrl,
                    createdAt: data.message.createdAt,
                  },
                ]
              })
            }
          } catch (error) {
            console.error('Error fetching new message:', error)
          }
        }
      )
      .subscribe((status) => {
        // Log real-time connection status
        if (status === 'SUBSCRIBED') {
          console.log('[Lobby] Real-time connected')
        }
        
        // If real-time fails, start slower fallback polling (10 seconds)
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (!fallbackPollingInterval) {
            console.warn('[Lobby] Real-time failed, starting fallback polling')
            fallbackPollingInterval = setInterval(fetchNewMessages, 10000) // 10s fallback
          }
        }
      })

    // Start very slow fallback polling (10s) as safety net
    // This catches any messages that might be missed
    fallbackPollingInterval = setInterval(fetchNewMessages, 10000)

    return () => {
      isSubscribed = false
      supabase.removeChannel(channel)
      if (fallbackPollingInterval) clearInterval(fallbackPollingInterval)
    }
  }, [sessionId, supabase]) // FIX: Removed 'messages' dependency to prevent re-subscription on every message

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return

    const messageContent = newMessage.trim()
    setNewMessage('')
    setSending(true)

    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent }),
      })

      const data = await res.json()
      if (!data.success) {
        toast.error(t('failedToSendMessage'))
        setNewMessage(messageContent) // Restore message on error
      }
      // Message will appear via real-time polling
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error(t('failedToSendMessage'))
      setNewMessage(messageContent) // Restore message on error
    } finally {
      setSending(false)
    }
  }

  const handleStartSession = async () => {
    if (starting) return

    try {
      setStarting(true)
      const res = await fetch(`/api/study-sessions/${sessionId}/start-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()
      if (data.success) {
        toast.success(t('startingSession'))
        router.push(`/study-sessions/${sessionId}/call`)
      } else {
        toast.error(data.error || t('failedToStartSession'))
      }
    } catch (error) {
      console.error('Error starting session:', error)
      toast.error(t('failedToStartSession'))
    } finally {
      setStarting(false)
    }
  }

  if (loading || loadingSession) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-slate-300">{t('loadingWaitingLobby')}</p>
        </div>
      </div>
    )
  }

  if (!user || !session) return null

  const isCreator = session.createdBy.id === user.id
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="bg-gray-50 dark:bg-white/5 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/study-sessions')} className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{session.title}</h1>
                <p className="text-sm text-gray-600 dark:text-slate-400">{t('waitingLobby')}</p>
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg backdrop-blur-sm">
                <p className="text-xs text-orange-400 font-medium mb-1">{t('sessionExpiresIn')}</p>
                <p className="text-2xl font-bold text-orange-300">
                  {minutes}:{seconds.toString().padStart(2, '0')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-3 gap-6">
            {/* Left Column - Session Info */}
            <div className="col-span-2 space-y-6">
              {/* Session Details Card */}
              <FadeIn delay={0.1}>
                <GlowBorder color="#3b82f6" intensity="medium" animated={false}  style={{ borderRadius: 12 }}>
                  <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl shadow-lg dark:shadow-sm p-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('sessionDetails')}</h2>
                <div className="space-y-3">
                  {session.description && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-slate-400">{t('description')}</p>
                      <p className="text-gray-700 dark:text-slate-300">{session.description}</p>
                    </div>
                  )}
                  {session.subject && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-slate-400">{t('subject')}</p>
                      <p className="font-medium text-gray-900 dark:text-white">{session.subject}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600 dark:text-slate-400">{t('type')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">{session.type.replace('_', ' ')}</p>
                  </div>
                  {session.durationMinutes && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-slate-400">{t('plannedDuration')}</p>
                      <p className="font-medium text-gray-900 dark:text-white">{session.durationMinutes} {t('minutes')}</p>
                    </div>
                  )}
                  {session.goals.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">{t('goals')}</p>
                      <ul className="space-y-1">
                        {session.goals.map((goal) => (
                          <li key={goal.id} className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            {goal.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                  </div>
                </GlowBorder>
              </FadeIn>

              {/* Chat */}
              <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl shadow-lg dark:shadow-sm overflow-hidden flex flex-col h-[400px]">
                <div className="bg-gradient-to-r from-blue-600 to-blue-600 px-6 py-3">
                  <h3 className="text-white font-semibold">{t('waitingRoomChat')}</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 && (
                    <p className="text-center text-gray-600 dark:text-slate-500 text-sm py-8">{t('noMessagesYet')}</p>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-3">
                      <PartnerAvatar
                        avatarUrl={msg.senderAvatar}
                        name={msg.senderName}
                        size="sm"
                        showStatus={false}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{msg.senderName}</p>
                        <p className="text-sm text-gray-700 dark:text-slate-300">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t border-gray-200 dark:border-white/10 p-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                      placeholder={t('typeMessage')}
                      className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-600 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition disabled:opacity-50"
                    >
                      {t('send')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Participants & Actions */}
            <div className="col-span-1 space-y-6">
              {/* Invite Button */}
              <FadeIn delay={0.2}>
                <GlowBorder color="#3b82f6" intensity="medium" animated={false}  style={{ borderRadius: 12 }}>
                  <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl shadow-lg dark:shadow-sm p-6">
                    <Bounce>
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        {t('invitePartnersOrMembers')}
                      </button>
                    </Bounce>
                  </div>
                </GlowBorder>
              </FadeIn>

              {/* Start Button (only for creator) */}
              {isCreator && (
                <FadeIn delay={0.3}>
                  <GlowBorder color="#10b981" intensity="medium" animated={false}  style={{ borderRadius: 12 }}>
                    <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-xl shadow-lg p-6 text-white border border-white/10">
                      <Bounce delay={0.1}>
                        <h3 className="text-lg font-bold mb-2">{t('readyToStart')}</h3>
                      </Bounce>
                      <Bounce delay={0.2}>
                        <p className="text-sm text-white/90 mb-4">{t('startNotification')}</p>
                      </Bounce>
                      <Bounce delay={0.3}>
                        <button
                          onClick={handleStartSession}
                          disabled={starting}
                          className="w-full px-6 py-3 bg-white/95 text-green-600 rounded-lg font-bold hover:bg-white hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-lg"
                        >
                          {starting ? t('starting') : t('startStudying')}
                        </button>
                      </Bounce>
                    </div>
                  </GlowBorder>
                </FadeIn>
              )}

              {/* Participants */}
              <FadeIn delay={0.4}>
                <GlowBorder color="#8b5cf6" intensity="medium" animated={false}  style={{ borderRadius: 12 }}>
                  <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl shadow-lg dark:shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      {t('participants')} {session.participants.length > 0 && (
                        <Pulse>
                          <span className="text-blue-400">({session.participants.length}/{session.maxParticipants})</span>
                        </Pulse>
                      )}
                    </h3>
                    <div className="space-y-3">
                      {session.participants.map((participant, index) => (
                        <FadeIn key={participant.id} delay={index * 0.05}>
                          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-all border border-gray-200 dark:border-white/5">
                      <PartnerAvatar
                        avatarUrl={participant.avatarUrl}
                        name={participant.name}
                        size="sm"
                        showStatus={false}
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">{participant.name}</h4>
                        <p className="text-xs text-gray-600 dark:text-slate-400">{participant.role}</p>
                      </div>
                            {onlineUsers.has(participant.userId) ? (
                              <Pulse>
                                <span className="w-2 h-2 bg-green-400 rounded-full" title={t('online')}></span>
                              </Pulse>
                            ) : participant.status === 'JOINED' ? (
                              <Pulse>
                                <span className="w-2 h-2 bg-yellow-400 rounded-full" title={t('joined')}></span>
                              </Pulse>
                            ) : (
                              <span className="w-2 h-2 bg-slate-600 rounded-full" title={t('invited')}></span>
                            )}
                          </div>
                        </FadeIn>
                      ))}
                    </div>
                  </div>
                </GlowBorder>
              </FadeIn>

              {/* Info Notice */}
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-sm text-blue-600 dark:text-blue-300">
                  {isCreator
                    ? t('hostMessage')
                    : t('waitingForHost', { host: session.createdBy.name })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Invite Modal */}
      <InviteModal
        sessionId={sessionId}
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />
    </div>
  )
}
