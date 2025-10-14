'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface SessionHistoryModalProps {
  sessionId: string
  isOpen: boolean
  onClose: () => void
}

interface SessionData {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  subject: string | null
  startedAt: string
  endedAt: string | null
  durationMinutes: number | null
  createdBy: {
    id: string
    name: string
    avatarUrl: string | null
  }
  participants: Array<{
    id: string
    userId: string
    name: string
    avatarUrl: string | null
    role: string
    joinedAt: string | null
  }>
  goals: Array<{
    id: string
    title: string
    description: string | null
    isCompleted: boolean
    completedAt: string | null
  }>
  timer: {
    totalStudyTime: number
    totalBreakTime: number
  } | null
}

export default function SessionHistoryModal({ sessionId, isOpen, onClose }: SessionHistoryModalProps) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionData | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const fetchSessionHistory = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/study-sessions/${sessionId}`)
        const data = await res.json()

        if (data.success) {
          setSession(data.session)
        } else {
          toast.error('Failed to load session history')
          onClose()
        }
      } catch (error) {
        console.error('Error fetching session history:', error)
        toast.error('Failed to load session history')
        onClose()
      } finally {
        setLoading(false)
      }
    }

    fetchSessionHistory()
  }, [sessionId, isOpen, onClose])

  if (!isOpen) return null

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Session History</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading session history...</p>
          </div>
        ) : session ? (
          <div className="space-y-6">
            {/* Session Info */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{session.title}</h3>
              {session.description && (
                <p className="text-gray-600 mb-4">{session.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  session.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {session.status}
                </span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  {session.type}
                </span>
                {session.subject && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {session.subject}
                  </span>
                )}
              </div>
            </div>

            {/* Time & Duration */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Session Timeline</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Started:</span>
                  <span className="font-medium text-gray-900">{formatDate(session.startedAt)}</span>
                </div>
                {session.endedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ended:</span>
                    <span className="font-medium text-gray-900">{formatDate(session.endedAt)}</span>
                  </div>
                )}
                {session.timer && session.timer.totalStudyTime > 0 && (
                  <>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="text-gray-600">Total Study Time:</span>
                      <span className="font-semibold text-blue-600">{formatDuration(session.timer.totalStudyTime)}</span>
                    </div>
                    {session.timer.totalBreakTime > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Break Time:</span>
                        <span className="font-medium text-gray-600">{formatDuration(session.timer.totalBreakTime)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Participants */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Participants ({session.participants.length})
              </h4>
              <div className="space-y-2">
                {session.participants.map((participant) => (
                  <div key={participant.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
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
                      <p className="font-medium text-gray-900">{participant.name}</p>
                      <p className="text-xs text-gray-500">
                        {participant.role} • Joined {participant.joinedAt ? formatDate(participant.joinedAt) : 'N/A'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Goals */}
            {session.goals.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Goals ({session.goals.filter(g => g.isCompleted).length}/{session.goals.length} completed)
                </h4>
                <div className="space-y-2">
                  {session.goals.map((goal) => (
                    <div key={goal.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        goal.isCompleted ? 'bg-green-500' : 'bg-gray-300'
                      }`}>
                        {goal.isCompleted && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${goal.isCompleted ? 'text-gray-900' : 'text-gray-600'}`}>
                          {goal.title}
                        </p>
                        {goal.description && (
                          <p className="text-sm text-gray-500 mt-1">{goal.description}</p>
                        )}
                        {goal.isCompleted && goal.completedAt && (
                          <p className="text-xs text-green-600 mt-1">
                            Completed {formatDate(goal.completedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600">Session not found</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
