'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'
import SessionChat from '@/components/SessionChat'
import SessionGoals from '@/components/SessionGoals'
import SessionTimer from '@/components/study-sessions/SessionTimer'
import PresenceIndicator from '@/components/PresenceIndicator'
import { createClient } from '@/lib/supabase/client'
import SessionHistoryModal from '@/components/SessionHistoryModal'
import { useBackgroundSession } from '@/lib/session/BackgroundSessionContext'
import VideoCall from '@/components/study-sessions/VideoCallDynamic'
import SessionFlashcards from '@/components/session/SessionFlashcards'
import SessionNotes from '@/components/session/SessionNotes'
import SessionWhiteboard from '@/components/session/SessionWhiteboard'
import ElectricBorder from '@/components/landing/ElectricBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'

interface Participant {
  id: string
  userId: string
  name: string
  avatarUrl: string | null
  role: string
  joinedAt: string
}

interface Goal {
  id: string
  title: string
  description: string | null
  isCompleted: boolean
  order: number
}

interface Partner {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface GroupMember {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  groupName?: string
}

interface Session {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  subject: string | null
  tags: string[]
  scheduledAt: string | null
  startedAt: string
  endedAt: string | null
  durationMinutes: number | null
  agoraChannel: string | null
  maxParticipants: number
  createdBy: {
    id: string
    name: string
    avatarUrl: string | null
  }
  participants: Participant[]
  goals: Goal[]
}

export default function SessionRoomPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string
  const { setActiveSessionId } = useBackgroundSession()
  const t = useTranslations('studySessions')
  const tCommon = useTranslations('common')

  const [session, setSession] = useState<Session | null>(() => {
    // Try to load cached session from localStorage for instant display
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`session_${sessionId}`)
        if (cached) {
          return JSON.parse(cached)
        }
      } catch (error) {
        console.error('Error loading cached session:', error)
      }
    }
    return null
  })
  const [loadingSession, setLoadingSession] = useState(!session) // Only show loading if no cached data
  const [activeTab, setActiveTab] = useState<'chat' | 'goals' | 'participants' | 'timer' | 'flashcards' | 'notes' | 'whiteboard'>('timer')
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [showVideoCall, setShowVideoCall] = useState(false)
  const [videoPipMode, setVideoPipMode] = useState(false) // Picture-in-Picture mode
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  // Fetch session details
  const fetchSession = async (showLoading = true) => {
    if (!user || !sessionId) return

    try {
      if (showLoading) {
        setLoadingSession(true)
      }

      const res = await fetch(`/api/study-sessions/${sessionId}`, {
        cache: 'no-store', // Ensure fresh data
      })
      const data = await res.json()

      if (data.success) {
        setSession(data.session)
        // Cache session data for instant return
        localStorage.setItem(`session_${sessionId}`, JSON.stringify(data.session))
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
  }

  useEffect(() => {
    // Fetch fresh data in background (don't show loading if we have cached data)
    fetchSession(!session)

    // Clear active session when user RETURNS to the session page
    // Use a delay to ensure we're actually staying on this page (not just passing through)
    const storedSessionId = localStorage.getItem('activeSessionId')
    if (storedSessionId === sessionId) {
      const timer = setTimeout(() => {
        setActiveSessionId(null)
      }, 500) // 500ms delay to allow navigation to complete

      return () => clearTimeout(timer)
    }
  }, [user, sessionId, router, setActiveSessionId])

  // Track presence
  useEffect(() => {
    if (!user || !sessionId) return

    const channel = supabase.channel(`session-${sessionId}-presence`, {
      config: {
        presence: {
          key: sessionId,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const userIds = new Set<string>()

        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            const p = presence as unknown as { user_id?: string }
            if (p.user_id) {
              userIds.add(p.user_id)
            }
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

  const handleLeaveSession = async () => {
    try {
      setIsLeaving(true)
      const res = await fetch(`/api/study-sessions/${sessionId}/leave`, {
        method: 'POST',
      })

      const data = await res.json()

      if (data.success) {
        // Clear active session from context
        setActiveSessionId(null)
        // Clear cached session data
        localStorage.removeItem(`session_${sessionId}`)

        if (data.action === 'deleted') {
          toast.success(t('sessionEndedNoParticipants'))
        } else if (data.action === 'left_transferred') {
          toast.success(t('leftSessionTransferred', { name: data.newHost.name }))
        } else {
          toast.success(t('leftSessionSuccessfully'))
        }

        router.push('/study-sessions')
      } else {
        toast.error(data.error || t('failedToLeaveSession'))
      }
    } catch (error) {
      console.error('Error leaving session:', error)
      toast.error(t('failedToLeaveSession'))
    } finally {
      setIsLeaving(false)
      setShowLeaveModal(false)
    }
  }

  const handleBackArrowClick = () => {
    if (!session) return

    const isHost = session.createdBy.id === user?.id
    const participantCount = session.participants.length

    // If host is alone, show different message
    if (isHost && participantCount === 1) {
      if (confirm(t('confirmLeaveLastParticipant'))) {
        handleLeaveSession()
      }
    } else {
      // Normal leave confirmation
      setShowLeaveModal(true)
    }
  }

  const handleEndSession = async () => {
    if (!confirm(t('confirmEndSession'))) return

    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/end`, {
        method: 'POST',
      })

      const data = await res.json()

      if (data.success) {
        toast.success(t('sessionEnded'))
        // Clear active session from context
        setActiveSessionId(null)
        // Clear cached session data
        localStorage.removeItem(`session_${sessionId}`)
        router.push('/study-sessions')
      } else {
        toast.error(data.error || t('failedToEndSession'))
      }
    } catch (error) {
      console.error('Error ending session:', error)
      toast.error(t('failedToEndSession'))
    }
  }

  if (loading || loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loadingSession')}</p>
        </div>
      </div>
    )
  }

  if (!user || !session) return null

  const isHost = session.createdBy.id === user.id

  // If session is completed or cancelled, show history modal instead
  if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
    return (
      <>
        <SessionHistoryModal
          sessionId={sessionId}
          isOpen={true}
          onClose={() => router.push('/study-sessions')}
        />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackArrowClick}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-blue-600">{session.title}</h1>
                {session.description && (
                  <p className="text-sm text-gray-600">{session.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 text-xs rounded-full ${
                  session.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                  session.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {session.status}
                </span>
                <span className="text-sm text-gray-600">
                  {session.participants.length} / {session.maxParticipants} participants
                </span>
                <PresenceIndicator sessionId={sessionId} />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Set active session in context (also updates localStorage)
                    setActiveSessionId(sessionId)
                    router.push('/dashboard')
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  {t('goToDashboard')}
                </button>
                {isHost && session.status !== 'COMPLETED' && (
                  <button
                    onClick={handleEndSession}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                  >
                    {t('endSession')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-3 gap-6">
            {/* Main Area */}
            <div className="col-span-2">
              <FadeIn delay={0.1}>
                <ElectricBorder color="#3b82f6" speed={1} chaos={0.2} thickness={2} style={{ borderRadius: 12 }}>
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {/* Tabs */}
                    <nav className="flex overflow-x-auto border-b border-gray-200">
                      <button
                        onClick={() => setActiveTab('timer')}
                        className={`px-6 py-4 text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all hover:scale-105 ${
                          activeTab === 'timer'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        ⏱️ {t('timer')}
                      </button>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-6 py-4 text-sm font-medium relative whitespace-nowrap flex-shrink-0 ${
                      activeTab === 'chat'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    💬 {t('chat')}
                    {unreadMessageCount > 0 && (
                      <Pulse>
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                        </span>
                      </Pulse>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('goals')}
                    className={`px-6 py-4 text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                      activeTab === 'goals'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t('goals')} ({session.goals.filter(g => g.isCompleted).length}/{session.goals.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('participants')}
                    className={`px-6 py-4 text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                      activeTab === 'participants'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t('participants')} ({session.participants.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('flashcards')}
                    className={`px-6 py-4 text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                      activeTab === 'flashcards'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📚 Flashcards
                  </button>
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`px-6 py-4 text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                      activeTab === 'notes'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📝 Notes
                  </button>
                  <button
                    onClick={() => setActiveTab('whiteboard')}
                    className={`px-6 py-4 text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                      activeTab === 'whiteboard'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🎨 Whiteboard
                  </button>
                </nav>

                {/* Tab Content */}
                <div className={activeTab === 'chat' ? 'h-[500px]' : 'p-6 min-h-[500px]'}>
                  {/* Keep timer mounted but hidden to avoid re-fetching */}
                  <div style={{ display: activeTab === 'timer' ? 'block' : 'none' }}>
                    <SessionTimer sessionId={sessionId} isHost={isHost} size="large" />
                  </div>

                  {activeTab === 'chat' && (
                    <SessionChat
                      sessionId={sessionId}
                      isHost={isHost}
                      onUnreadCountChange={setUnreadMessageCount}
                      isVisible={activeTab === 'chat' && !showVideoCall}
                    />
                  )}

                  {activeTab === 'goals' && (
                    <SessionGoals
                      sessionId={sessionId}
                      goals={session.goals}
                      onGoalsUpdate={fetchSession}
                    />
                  )}

                  {activeTab === 'participants' && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">{t('participants')}</h3>
                      <div className="space-y-3">
                        {session.participants.map(participant => (
                          <div
                            key={participant.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            {participant.avatarUrl ? (
                              <img
                                src={participant.avatarUrl}
                                alt={participant.name}
                                className="w-10 h-10 rounded-full"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {participant.name[0]}
                              </div>
                            )}
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{participant.name}</h4>
                              <p className="text-xs text-gray-500">{participant.role}</p>
                            </div>
                            {onlineUsers.has(participant.userId) ? (
                              <span className="w-2 h-2 bg-green-500 rounded-full" title={tCommon('online')}></span>
                            ) : (
                              <span className="w-2 h-2 bg-gray-300 rounded-full" title={tCommon('offline')}></span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'flashcards' && (
                    <SessionFlashcards sessionId={sessionId} />
                  )}

                  {activeTab === 'notes' && (
                    <SessionNotes sessionId={sessionId} />
                  )}

                  {activeTab === 'whiteboard' && (
                    <SessionWhiteboard sessionId={sessionId} />
                  )}
                </div>
                  </div>
                </ElectricBorder>
              </FadeIn>
            </div>

            {/* Sidebar */}
            <div className="col-span-1">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">{t('sessionInfo')}</h3>

                <div className="space-y-4">
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

                  <div>
                    <p className="text-sm text-gray-500">{t('host')}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {session.createdBy.avatarUrl ? (
                        <img
                          src={session.createdBy.avatarUrl}
                          alt={session.createdBy.name}
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs">
                          {session.createdBy.name[0]}
                        </div>
                      )}
                      <p className="font-medium text-gray-900">{session.createdBy.name}</p>
                    </div>
                  </div>

                  {session.tags.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">{t('tags')}</p>
                      <div className="flex flex-wrap gap-2">
                        {session.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-gray-500">{t('started')}</p>
                    <p className="font-medium text-gray-900">
                      {new Date(session.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Session Timer - Small Display (Read-only) */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">{t('timer')}</h3>
                <SessionTimer
                  sessionId={sessionId}
                  isHost={isHost}
                  size="small"
                  displayOnly={true}
                />
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
                <h3 className="text-lg font-semibold mb-4">{t('quickActions')}</h3>
                <div className="space-y-2">
                  {isHost && (
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                    >
                      👥 {t('invitePartnersAction')}
                    </button>
                  )}
                  <button
                    onClick={() => setShowVideoCall(true)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                  >
                    📹 {showVideoCall ? t('returnToCall') : t('startVideoCall')}
                  </button>
                  <button
                    onClick={() => {
                      if (showVideoCall) {
                        toast('Screen share available in video call controls')
                      } else {
                        toast('Join the video call first to share your screen')
                      }
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                  >
                    🖥️ {t('shareScreen')}
                  </button>
                  <button
                    onClick={() => setActiveTab('goals')}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                  >
                    ✅ {t('viewGoals')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Invite Partners Modal */}
      {showInviteModal && (
        <InvitePartnersModal
          sessionId={sessionId}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false)
            fetchSession()
          }}
        />
      )}

      {/* Leave Session Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('leaveSessionTitle')}</h2>
            <p className="text-gray-600 mb-6">
              {t('leaveSessionMessage')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveModal(false)}
                disabled={isLeaving}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleLeaveSession}
                disabled={isLeaving}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {isLeaving ? t('leaving') : t('yesLeave')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Call Modal */}
      {showVideoCall && session?.agoraChannel && user && profile && (
        <VideoCall
          sessionId={sessionId}
          agoraChannel={session.agoraChannel}
          userId={user.id}
          userName={profile.name}
          onCallEnd={() => setShowVideoCall(false)}
          onOpenChat={() => {
            setShowVideoCall(false)
            setActiveTab('chat')
          }}
        />
      )}
    </div>
  )
}

// Invite Partners Modal
function InvitePartnersModal({
  sessionId,
  onClose,
  onSuccess
}: {
  sessionId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [selectedInvites, setSelectedInvites] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingInvites, setLoadingInvites] = useState(false)
  const [inviting, setInviting] = useState(false)
  const t = useTranslations('studySessions')
  const tCommon = useTranslations('common')

  // Fetch available partners and group members
  useEffect(() => {
    const fetchAvailableInvites = async () => {
      try {
        setLoadingInvites(true)
        const res = await fetch('/api/study-sessions/available-invites')
        const data = await res.json()

        if (data.success) {
          setPartners(data.partners || [])
          setGroupMembers(data.groupMembers || [])
        }
      } catch (error) {
        console.error('Error fetching invites:', error)
      } finally {
        setLoadingInvites(false)
      }
    }

    fetchAvailableInvites()
  }, [])

  const toggleInvite = (userId: string) => {
    setSelectedInvites(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleInvite = async () => {
    if (selectedInvites.length === 0) {
      toast.error(t('pleaseSelectPartnerToInvite'))
      return
    }

    try {
      setInviting(true)
      const res = await fetch(`/api/study-sessions/${sessionId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteUserIds: selectedInvites,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success(selectedInvites.length > 1 ? t('invitedPartnersPlural', { count: selectedInvites.length }) : t('invitedPartners', { count: selectedInvites.length }))
        onSuccess()
      } else {
        toast.error(data.error || t('failedToSendInvitations'))
      }
    } catch (error) {
      console.error('Error inviting partners:', error)
      toast.error(t('failedToSendInvitations'))
    } finally {
      setInviting(false)
    }
  }

  // Filter partners and group members by search term
  const filteredPartners = partners.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredGroupMembers = groupMembers.filter(m =>
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-md w-full p-6 my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">{t('invitePartnersModal')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Search */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchPartnersModal')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {/* Selected count */}
          {selectedInvites.length > 0 && (
            <p className="text-sm text-blue-600">
              {selectedInvites.length} {selectedInvites.length > 1 ? t('partnersSelected') : t('partnerSelected')}
            </p>
          )}

          {/* Partners and Group Members List */}
          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
            {loadingInvites ? (
              <p className="p-4 text-sm text-gray-500 text-center">{tCommon('loading')}</p>
            ) : (
              <>
                {/* Study Partners Section */}
                {filteredPartners.length > 0 && (
                  <div>
                    <p className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                      {t('studyPartners')}
                    </p>
                    {filteredPartners.map((partner) => (
                      <label
                        key={partner.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedInvites.includes(partner.id)}
                          onChange={() => toggleInvite(partner.id)}
                          className="w-4 h-4 text-blue-600"
                        />
                        {partner.avatarUrl ? (
                          <img
                            src={partner.avatarUrl}
                            alt={partner.name}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs">
                            {partner.name?.[0] || 'U'}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{partner.name}</p>
                          <p className="text-xs text-gray-500">{partner.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* Group Members Section */}
                {filteredGroupMembers.length > 0 && (
                  <div>
                    <p className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                      {t('groupMembers')}
                    </p>
                    {filteredGroupMembers.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedInvites.includes(member.id)}
                          onChange={() => toggleInvite(member.id)}
                          className="w-4 h-4 text-blue-600"
                        />
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs">
                            {member.name?.[0] || 'U'}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* No results */}
                {filteredPartners.length === 0 && filteredGroupMembers.length === 0 && (
                  <p className="p-4 text-sm text-gray-500 text-center">
                    {searchTerm ? t('noMatches') : t('noPartnersAvailable')}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleInvite}
            disabled={inviting || selectedInvites.length === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {inviting ? t('inviting') : t('invite')}
          </button>
        </div>
      </div>
    </div>
  )
}
