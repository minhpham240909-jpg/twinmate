'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import SessionHistoryModal from '@/components/SessionHistoryModal'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'

interface Session {
  id: string
  title: string
  description: string | null
  status: string
  type: string
  subject: string | null
  tags: string[]
  scheduledAt: string | null
  startedAt: string
  participantCount: number
  maxParticipants: number
  isHost: boolean
  createdBy: {
    id: string
    name: string
    avatarUrl: string | null
  }
}

interface PendingInvite {
  sessionId: string
  title: string
  description: string | null
  type: string
  subject: string | null
  createdAt: string
  inviter: {
    id: string
    name: string
    avatarUrl: string | null
  } | null
}

interface Partner {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  onlineStatus?: 'ONLINE' | 'OFFLINE'
}

interface GroupMember {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  groupName?: string
}

export default function StudySessionsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const t = useTranslations('studySessions')
  const tCommon = useTranslations('common')

  // Load sessions from localStorage immediately
  const [sessions, setSessions] = useState<Session[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('studySessions')
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

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [processingInvite, setProcessingInvite] = useState<string | null>(null)
  const [deletingSession, setDeletingSession] = useState<string | null>(null)
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  // Fetch sessions
  useEffect(() => {
    if (!user) return

    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/study-sessions/list')
        const data = await res.json()

        if (data.success) {
          setSessions(data.sessions)
          localStorage.setItem('studySessions', JSON.stringify(data.sessions))
        }
      } catch (error) {
        console.error('Error fetching sessions:', error)
      }
    }

    fetchSessions()
  }, [user])

  // Fetch pending invites
  useEffect(() => {
    if (!user) return

    const fetchPendingInvites = async () => {
      try {
        const res = await fetch('/api/study-sessions/pending-invites')
        const data = await res.json()

        if (data.success) {
          setPendingInvites(data.invites)
        }
      } catch (error) {
        console.error('Error fetching pending invites:', error)
      }
    }

    fetchPendingInvites()
  }, [user])

  const handleAcceptInvite = async (sessionId: string) => {
    try {
      setProcessingInvite(sessionId)
      const res = await fetch(`/api/study-sessions/invites/${sessionId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (data.success) {
        toast.success(t('invitationAccepted'))
        // Remove from pending invites
        setPendingInvites(prev => prev.filter(inv => inv.sessionId !== sessionId))
        // Auto-redirect to lobby or call based on session status
        router.push(`/study-sessions/${sessionId}/lobby`)
      } else {
        toast.error(data.error || t('failedToAcceptInvitation'))
      }
    } catch (error) {
      console.error('Error accepting invitation:', error)
      toast.error(t('failedToAcceptInvitation'))
    } finally {
      setProcessingInvite(null)
    }
  }

  const handleDeclineInvite = async (sessionId: string) => {
    try {
      setProcessingInvite(sessionId)
      const res = await fetch(`/api/study-sessions/invites/${sessionId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (data.success) {
        toast.success(t('invitationDeclinedSuccess'))
        // Remove from pending invites
        setPendingInvites(prev => prev.filter(inv => inv.sessionId !== sessionId))
      } else {
        toast.error(data.error || t('failedToDeclineInvitation'))
      }
    } catch (error) {
      console.error('Error declining invitation:', error)
      toast.error(t('failedToDeclineInvitation'))
    } finally {
      setProcessingInvite(null)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm(t('confirmDeleteSession'))) {
      return
    }

    try {
      setDeletingSession(sessionId)
      const res = await fetch(`/api/study-sessions/${sessionId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (data.success) {
        toast.success(t('sessionDeletedSuccessfully'))
        // Remove from sessions list
        setSessions(prev => prev.filter(session => session.id !== sessionId))
        // Update localStorage
        const updatedSessions = sessions.filter(session => session.id !== sessionId)
        localStorage.setItem('studySessions', JSON.stringify(updatedSessions))
      } else {
        toast.error(data.error || t('failedToDeleteSession'))
      }
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error(t('failedToDeleteSession'))
    } finally {
      setDeletingSession(null)
    }
  }

  // Only show history (completed/cancelled sessions)
  const filteredSessions = sessions.filter(session => {
    return session.status === 'COMPLETED' || session.status === 'CANCELLED'
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* Header */}
      <header className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 p-2 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{t('title')}</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors font-medium"
          >
            {t('newSession')}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Pending Invites Section */}
          {pendingInvites.length > 0 && (
            <div className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  {t('pendingInvitations')}
                </h2>
                <span className="px-2.5 py-1 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold rounded-full">
                  {pendingInvites.length}
                </span>
              </div>
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div key={invite.sessionId} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 flex items-start justify-between gap-4 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <PartnerAvatar
                          avatarUrl={invite.inviter?.avatarUrl || null}
                          name={invite.inviter?.name || 'U'}
                          size="sm"
                          showStatus={false}
                        />
                        <div>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            <span className="font-semibold text-neutral-900 dark:text-white">
                              {invite.inviter?.name || 'Someone'}
                            </span>{' '}
                            {t('invitedYouTo')}
                          </p>
                          <h3 className="font-semibold text-neutral-900 dark:text-white">{invite.title}</h3>
                        </div>
                      </div>
                      {invite.description && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2 ml-13">{invite.description}</p>
                      )}
                      <div className="flex items-center gap-2 ml-13">
                        <span className="px-2 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs rounded-full">
                          {invite.type}
                        </span>
                        {invite.subject && (
                          <span className="px-2 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs rounded-full">
                            {invite.subject}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptInvite(invite.sessionId)}
                        disabled={processingInvite === invite.sessionId}
                        className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50 font-medium"
                      >
                        {processingInvite === invite.sessionId ? t('accepting') : t('accept')}
                      </button>
                      <button
                        onClick={() => handleDeclineInvite(invite.sessionId)}
                        disabled={processingInvite === invite.sessionId}
                        className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm rounded-lg transition-colors disabled:opacity-50 font-medium"
                      >
                        {processingInvite === invite.sessionId ? t('declining') : t('decline')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Header for History */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl mb-6 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t('sessionHistory')}</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('sessionHistoryDesc')}</p>
          </div>

          {/* Sessions List */}
          <div className="grid md:grid-cols-2 gap-6">
            {filteredSessions.length === 0 ? (
              <div className="col-span-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-12 text-center shadow-sm">
                <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                  {t('noHistoryYet')}
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-md mx-auto">
                  {t('noHistoryDesc')}
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
                >
                  {t('startSession')}
                </button>
              </div>
            ) : (
              filteredSessions.map((session) => (
                <div key={session.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors h-full shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">{session.title}</h3>
                      {session.description && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{session.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {session.participantCount} / {session.maxParticipants}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          session.status === 'ACTIVE' ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' :
                          session.status === 'SCHEDULED' ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300' :
                          'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                        }`}>
                          {session.status}
                        </span>
                        {session.subject && (
                          <span className="px-2 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs rounded-full">
                            {session.subject}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewingSessionId(session.id)}
                      className="flex-1 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm rounded-lg transition-colors"
                    >
                      {t('viewDetails')}
                    </button>
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      disabled={deletingSession === session.id}
                      className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingSession === session.id ? t('removing') : t('remove')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Create Session Modal - Simple for now */}
      {showCreateModal && (
        <CreateSessionModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(sessionId) => {
            setShowCreateModal(false)
            // Navigate to waiting lobby
            router.push(`/study-sessions/${sessionId}/lobby`)
          }}
        />
      )}

      {/* Session History Modal */}
      {viewingSessionId && (
        <SessionHistoryModal
          sessionId={viewingSessionId}
          isOpen={!!viewingSessionId}
          onClose={() => setViewingSessionId(null)}
        />
      )}
    </div>
  )
}

// Simple Create Session Modal
function CreateSessionModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: (sessionId: string) => void }) {
  const t = useTranslations('studySessions')
  const tCommon = useTranslations('common')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'SOLO' | 'ONE_ON_ONE' | 'GROUP'>('ONE_ON_ONE')
  const [subject, setSubject] = useState('')
  const [creating, setCreating] = useState(false)

  // Partner invite states
  const [partners, setPartners] = useState<Partner[]>([])
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [selectedInvites, setSelectedInvites] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingInvites, setLoadingInvites] = useState(false)

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

  const handleCreate = async () => {
    if (!title) {
      toast.error(t('pleaseEnterTitle'))
      return
    }

    try {
      setCreating(true)
      const res = await fetch('/api/study-sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          type,
          subject: subject || null,
          inviteUserIds: selectedInvites,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success(t('sessionCreated'))
        onSuccess(data.session.id)
      } else {
        toast.error(data.error || t('failedToCreateSession'))
      }
    } catch (error) {
      console.error('Error creating session:', error)
      toast.error(t('failedToCreateSession'))
    } finally {
      setCreating(false)
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl max-w-md w-full p-6 my-8 shadow-lg dark:shadow-none">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('createStudySession')}</h2>
          <button onClick={onClose} className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('titleRequired')}</label>
            <input
              id="session-title-field"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  document.getElementById('session-desc-field')?.focus()
                }
              }}
              placeholder={t('titlePlaceholder')}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-600 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('description')}</label>
            <textarea
              id="session-desc-field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  document.getElementById('session-type-field')?.focus()
                }
              }}
              placeholder={t('descPlaceholder')}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-600 dark:placeholder:text-slate-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('type')}</label>
            <select
              id="session-type-field"
              value={type}
              onChange={(e) => setType(e.target.value as 'SOLO' | 'ONE_ON_ONE' | 'GROUP')}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
            >
              <option value="SOLO">{t('solo')}</option>
              <option value="ONE_ON_ONE">{t('oneOnOne')}</option>
              <option value="GROUP">{t('group')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('subjectOptional')}</label>
            <input
              id="session-subject-field"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  document.getElementById('session-search-field')?.focus()
                }
              }}
              placeholder={t('subjectPlaceholder')}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-600 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Invite Partners */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t('inviteOptional')}
            </label>

            {/* Search */}
            <input
              id="session-search-field"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (title.trim()) {
                    handleCreate()
                  }
                }
              }}
              placeholder={t('searchPartners')}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-600 dark:placeholder:text-slate-500 mb-3"
            />

            {/* Selected count */}
            {selectedInvites.length > 0 && (
              <p className="text-sm text-blue-400 mb-2">
                {selectedInvites.length} {selectedInvites.length > 1 ? t('partners') : t('partner')} {t('selected')}
              </p>
            )}

            {/* Partners and Group Members List */}
            <div className="max-h-48 overflow-y-auto bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-lg">
              {loadingInvites ? (
                <p className="p-4 text-sm text-gray-600 dark:text-slate-400 text-center">{tCommon('loading')}</p>
              ) : (
                <>
                  {/* Study Partners Section */}
                  {filteredPartners.length > 0 && (
                    <div>
                      <p className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-900 sticky top-0">
                        {t('studyPartners')}
                      </p>
                      {filteredPartners.map((partner) => (
                        <label
                          key={partner.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedInvites.includes(partner.id)}
                            onChange={() => toggleInvite(partner.id)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <PartnerAvatar
                            avatarUrl={partner.avatarUrl}
                            name={partner.name}
                            size="sm"
                            onlineStatus={partner.onlineStatus as 'ONLINE' | 'OFFLINE'}
                            showStatus={true}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{partner.name}</p>
                            <p className="text-xs text-gray-600 dark:text-slate-400">{partner.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Group Members Section */}
                  {filteredGroupMembers.length > 0 && (
                    <div>
                      <p className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-900 sticky top-0">
                        {t('groupMembers')}
                      </p>
                      {filteredGroupMembers.map((member) => (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedInvites.includes(member.id)}
                            onChange={() => toggleInvite(member.id)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <PartnerAvatar
                            avatarUrl={member.avatarUrl}
                            name={member.name}
                            size="sm"
                            showStatus={false}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</p>
                            <p className="text-xs text-gray-600 dark:text-slate-400">{member.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* No results */}
                  {filteredPartners.length === 0 && filteredGroupMembers.length === 0 && (
                    <p className="p-4 text-sm text-gray-600 dark:text-slate-400 text-center">
                      {searchTerm ? t('noMatches') : t('noPartnersAvailable')}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-300 rounded-lg transition"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition disabled:opacity-50"
          >
            {creating ? t('creating') : t('createButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
