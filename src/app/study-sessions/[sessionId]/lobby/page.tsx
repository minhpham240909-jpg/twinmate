'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import InviteModal from '@/components/study-sessions/InviteModal'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'

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
  const tCommon = useTranslations('common')

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
        console.log('Fetch session: Session data received:', sess)
        console.log('Fetch session: waitingExpiresAt:', sess.waitingExpiresAt)

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
          console.log('Fetch session: Initial time remaining:', diff, 'seconds')
          setTimeRemaining(diff)

          // If expired, show message and redirect
          if (diff === 0) {
            toast.error(t('sessionHasExpired'))
            router.push('/study-sessions')
          }
        } else {
          console.log('Fetch session: No waitingExpiresAt found in session data!')
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
      router.push('/auth/signin')
      return
    }

    if (user) {
      fetchSession()
    }
  }, [user, loading, fetchSession, router])

  // Countdown timer - updates every second
  useEffect(() => {
    if (!session?.waitingExpiresAt) {
      console.log('Timer: No waitingExpiresAt found')
      return
    }

    const expiresAt = new Date(session.waitingExpiresAt).getTime()
    console.log('Timer: Starting countdown. Expires at:', new Date(expiresAt))

    // Calculate and set initial time
    const updateTimer = () => {
      const now = Date.now()
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000))
      console.log('Timer: Updating... Time remaining:', diff, 'seconds')
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
      console.log('Timer: Cleanup interval')
      clearInterval(interval)
    }
  }, [session?.waitingExpiresAt, router])

  // Real-time: Listen for session status changes
  useEffect(() => {
    if (!sessionId) return

    console.log('[Lobby RT] Setting up session status listener...')
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
          console.log('[Lobby RT] Session status update received:', payload)
          const newStatus = (payload.new as { status?: string }).status
          if (newStatus === 'ACTIVE') {
            console.log('[Lobby RT] Session is now ACTIVE, redirecting to call...')
            toast.success(t('sessionIsStarting'))
            router.push(`/study-sessions/${sessionId}/call`)
          }
        }
      )
      .subscribe((status) => {
        console.log('[Lobby RT] Session status subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('[Lobby RT] Successfully subscribed to session status changes')
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[Lobby RT] Failed to subscribe to session status changes')
        }
      })

    return () => {
      console.log('[Lobby RT] Cleaning up session status listener')
      supabase.removeChannel(channel)
    }
  }, [sessionId, supabase, router])

  // Real-time: Listen for participant changes (joins/leaves)
  useEffect(() => {
    if (!sessionId) return

    console.log('[Lobby RT] Setting up participant listener...')
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
          console.log('[Lobby RT] New participant joined:', payload)
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
          console.log('[Lobby RT] Participant updated:', payload)
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
          console.log('[Lobby RT] Participant left:', payload)
          toast('Someone left the session', { icon: '👋' })
          fetchSession() // Refresh to get updated participant list
        }
      )
      .subscribe((status) => {
        console.log('[Lobby RT] Participant subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('[Lobby RT] Successfully subscribed to participant changes')
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[Lobby RT] Failed to subscribe to participant changes')
        }
      })

    return () => {
      console.log('[Lobby RT] Cleaning up participant listener')
      supabase.removeChannel(channel)
    }
  }, [sessionId, supabase, fetchSession])

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

  // Real-time messages with fast polling for instant updates
  useEffect(() => {
    if (!sessionId) return

    let isSubscribed = true
    let pollingInterval: NodeJS.Timeout | null = null

    // Fast polling (500ms) for instant message updates
    const startFastPolling = () => {
      if (pollingInterval) return

      pollingInterval = setInterval(async () => {
        if (!isSubscribed) return

        try {
          const lastMessageTime = messages.length > 0
            ? new Date(messages[messages.length - 1].createdAt).toISOString()
            : new Date(0).toISOString()

          const res = await fetch(`/api/study-sessions/${sessionId}/messages?after=${encodeURIComponent(lastMessageTime)}`)
          const data = await res.json()

          if (data.success && data.messages && data.messages.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map(m => m.id))
              const newMessages = data.messages
                .filter((m: any) => !existingIds.has(m.id))
                .map((m: any) => ({
                  id: m.id,
                  content: m.content,
                  senderId: m.sender.id,
                  senderName: m.sender.name,
                  senderAvatar: m.sender.avatarUrl,
                  createdAt: m.createdAt,
                }))

              return newMessages.length > 0 ? [...prev, ...newMessages] : prev
            })
          }
        } catch (error) {
          // Silently handle errors
        }
      }, 200) // 200ms for fast message updates
    }

    // Start fast polling immediately
    startFastPolling()

    // Also try Supabase realtime as enhancement
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
      .subscribe()

    return () => {
      isSubscribed = false
      supabase.removeChannel(channel)
      if (pollingInterval) clearInterval(pollingInterval)
    }
  }, [sessionId, supabase, messages])

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loadingWaitingLobby')}</p>
        </div>
      </div>
    )
  }

  if (!user || !session) return null

  const isCreator = session.createdBy.id === user.id
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/study-sessions')} className="text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-blue-600">{session.title}</h1>
                <p className="text-sm text-gray-600">{t('waitingLobby')}</p>
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-orange-100 rounded-lg">
                <p className="text-xs text-orange-600 font-medium mb-1">{t('sessionExpiresIn')}</p>
                <p className="text-2xl font-bold text-orange-700">
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
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">{t('sessionDetails')}</h2>
                <div className="space-y-3">
                  {session.description && (
                    <div>
                      <p className="text-sm text-gray-500">{t('description')}</p>
                      <p className="text-gray-900">{session.description}</p>
                    </div>
                  )}
                  {session.subject && (
                    <div>
                      <p className="text-sm text-gray-500">{t('subject')}</p>
                      <p className="font-medium text-gray-900">{session.subject}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500">{t('type')}</p>
                    <p className="font-medium text-gray-900">{session.type.replace('_', ' ')}</p>
                  </div>
                  {session.durationMinutes && (
                    <div>
                      <p className="text-sm text-gray-500">{t('plannedDuration')}</p>
                      <p className="font-medium text-gray-900">{session.durationMinutes} {t('minutes')}</p>
                    </div>
                  )}
                  {session.goals.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">{t('goals')}</p>
                      <ul className="space-y-1">
                        {session.goals.map((goal) => (
                          <li key={goal.id} className="flex items-center gap-2 text-gray-900">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

              {/* Chat */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col h-[400px]">
                <div className="bg-blue-600 px-6 py-3">
                  <h3 className="text-white font-semibold">{t('waitingRoomChat')}</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-8">{t('noMessagesYet')}</p>
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
                        <p className="text-sm font-medium text-gray-900">{msg.senderName}</p>
                        <p className="text-sm text-gray-700">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                      placeholder={t('typeMessage')}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
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
              <div className="bg-white rounded-xl shadow-sm p-6">
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  {t('invitePartnersOrMembers')}
                </button>
              </div>

              {/* Start Button (only for creator) */}
              {isCreator && (
                <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                  <h3 className="text-lg font-bold mb-2">{t('readyToStart')}</h3>
                  <p className="text-sm opacity-90 mb-4">{t('startNotification')}</p>
                  <button
                    onClick={handleStartSession}
                    disabled={starting}
                    className="w-full px-6 py-3 bg-white text-green-600 rounded-lg font-bold hover:bg-gray-100 transition disabled:opacity-50"
                  >
                    {starting ? t('starting') : t('startStudying')}
                  </button>
                </div>
              )}

              {/* Participants */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">
                  {t('participants')} ({session.participants.length}/{session.maxParticipants})
                </h3>
                <div className="space-y-3">
                  {session.participants.map((participant) => (
                    <div key={participant.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <PartnerAvatar
                        avatarUrl={participant.avatarUrl}
                        name={participant.name}
                        size="sm"
                        showStatus={false}
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{participant.name}</h4>
                        <p className="text-xs text-gray-500">{participant.role}</p>
                      </div>
                      {onlineUsers.has(participant.userId) ? (
                        <span className="w-2 h-2 bg-green-500 rounded-full" title={t('online')}></span>
                      ) : participant.status === 'JOINED' ? (
                        <span className="w-2 h-2 bg-yellow-500 rounded-full" title={t('joined')}></span>
                      ) : (
                        <span className="w-2 h-2 bg-gray-300 rounded-full" title={t('invited')}></span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Info Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
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
