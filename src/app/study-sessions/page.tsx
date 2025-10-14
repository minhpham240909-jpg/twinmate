'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import SessionHistoryModal from '@/components/SessionHistoryModal'

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
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Invitation accepted! Redirecting to session...')
        // Remove from pending invites
        setPendingInvites(prev => prev.filter(inv => inv.sessionId !== sessionId))
        // Auto-redirect to session room
        router.push(`/study-sessions/${sessionId}`)
      } else {
        toast.error(data.error || 'Failed to accept invitation')
      }
    } catch (error) {
      console.error('Error accepting invitation:', error)
      toast.error('Failed to accept invitation')
    } finally {
      setProcessingInvite(null)
    }
  }

  const handleDeclineInvite = async (sessionId: string) => {
    try {
      setProcessingInvite(sessionId)
      const res = await fetch(`/api/study-sessions/invites/${sessionId}/decline`, {
        method: 'POST',
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Invitation declined')
        // Remove from pending invites
        setPendingInvites(prev => prev.filter(inv => inv.sessionId !== sessionId))
      } else {
        toast.error(data.error || 'Failed to decline invitation')
      }
    } catch (error) {
      console.error('Error declining invitation:', error)
      toast.error('Failed to decline invitation')
    } finally {
      setProcessingInvite(null)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to permanently delete this session from your history?')) {
      return
    }

    try {
      setDeletingSession(sessionId)
      const res = await fetch(`/api/study-sessions/${sessionId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Session deleted successfully')
        // Remove from sessions list
        setSessions(prev => prev.filter(session => session.id !== sessionId))
        // Update localStorage
        const updatedSessions = sessions.filter(session => session.id !== sessionId)
        localStorage.setItem('studySessions', JSON.stringify(updatedSessions))
      } else {
        toast.error(data.error || 'Failed to delete session')
      }
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error('Failed to delete session')
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

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
            <h1 className="text-2xl font-bold text-blue-600">Study Sessions</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + New Session
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Pending Invites Section */}
          {pendingInvites.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Pending Invitations ({pendingInvites.length})
              </h2>
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.sessionId}
                    className="bg-white rounded-lg p-4 flex items-start justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {invite.inviter?.avatarUrl ? (
                          <img
                            src={invite.inviter.avatarUrl}
                            alt={invite.inviter.name}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                            {invite.inviter?.name?.[0] || 'U'}
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold text-gray-900">
                              {invite.inviter?.name || 'Someone'}
                            </span>{' '}
                            invited you to
                          </p>
                          <h3 className="font-semibold text-gray-900">{invite.title}</h3>
                        </div>
                      </div>
                      {invite.description && (
                        <p className="text-sm text-gray-600 mb-2 ml-13">{invite.description}</p>
                      )}
                      <div className="flex items-center gap-2 ml-13">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                          {invite.type}
                        </span>
                        {invite.subject && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {invite.subject}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptInvite(invite.sessionId)}
                        disabled={processingInvite === invite.sessionId}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {processingInvite === invite.sessionId ? 'Accepting...' : 'Accept'}
                      </button>
                      <button
                        onClick={() => handleDeclineInvite(invite.sessionId)}
                        disabled={processingInvite === invite.sessionId}
                        className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                      >
                        {processingInvite === invite.sessionId ? 'Declining...' : 'Decline'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Header for History */}
          <div className="bg-white rounded-xl shadow-sm mb-6 p-6">
            <h2 className="text-xl font-bold text-gray-900">Study Session History</h2>
            <p className="text-sm text-gray-600 mt-1">View your completed and cancelled study sessions</p>
          </div>

          {/* Sessions List */}
          <div className="grid md:grid-cols-2 gap-6">
            {filteredSessions.length === 0 ? (
              <div className="col-span-2 bg-white rounded-xl shadow-sm p-12 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Study History Yet
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Complete your first study session to see your history here!
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Start a Study Session
                </button>
              </div>
            ) : (
              filteredSessions.map((session) => (
                <div key={session.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{session.title}</h3>
                      {session.description && (
                        <p className="text-sm text-gray-600 mb-3">{session.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {session.participantCount} / {session.maxParticipants}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          session.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                          session.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {session.status}
                        </span>
                        {session.subject && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                            {session.subject}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewingSessionId(session.id)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      disabled={deletingSession === session.id}
                      className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingSession === session.id ? 'Removing...' : 'Remove'}
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
            // Navigate directly to session room
            router.push(`/study-sessions/${sessionId}`)
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
      toast.error('Please enter a title')
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
        toast.success('Session created!')
        onSuccess(data.session.id)
      } else {
        toast.error(data.error || 'Failed to create session')
      }
    } catch (error) {
      console.error('Error creating session:', error)
      toast.error('Failed to create session')
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
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-md w-full p-6 my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Create Study Session</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Math Study Group"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will you study?"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'SOLO' | 'ONE_ON_ONE' | 'GROUP')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="SOLO">Solo</option>
              <option value="ONE_ON_ONE">1-on-1</option>
              <option value="GROUP">Group</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject (optional)</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Mathematics"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Invite Partners */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invite Partners (optional)
            </label>

            {/* Search */}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search partners..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
            />

            {/* Selected count */}
            {selectedInvites.length > 0 && (
              <p className="text-sm text-blue-600 mb-2">
                {selectedInvites.length} partner{selectedInvites.length > 1 ? 's' : ''} selected
              </p>
            )}

            {/* Partners and Group Members List */}
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
              {loadingInvites ? (
                <p className="p-4 text-sm text-gray-500 text-center">Loading...</p>
              ) : (
                <>
                  {/* Study Partners Section */}
                  {filteredPartners.length > 0 && (
                    <div>
                      <p className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                        STUDY PARTNERS
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
                        GROUP MEMBERS
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
                      {searchTerm ? 'No matches found' : 'No partners or group members available'}
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
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
