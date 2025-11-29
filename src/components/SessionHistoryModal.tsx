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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl max-w-3xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700/50">
          <h2 className="text-2xl font-bold text-slate-100">Session History</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-300 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading session history...</p>
          </div>
        ) : session ? (
          <div className="space-y-6">
            {/* Session Info */}
            <div>
              <h3 className="text-xl font-semibold text-slate-100 mb-2">{session.title}</h3>
              {session.description && (
                <p className="text-slate-300 mb-4">{session.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  session.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700/50 text-slate-300'
                }`}>
                  {session.status}
                </span>
                <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium">
                  {session.type}
                </span>
                {session.subject && (
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
                    {session.subject}
                  </span>
                )}
              </div>
            </div>

            {/* Time & Duration */}
            <div className="bg-slate-700/30 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Session Timeline</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Started:</span>
                  <span className="font-medium text-slate-200">{formatDate(session.startedAt)}</span>
                </div>
                {session.endedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ended:</span>
                    <span className="font-medium text-slate-200">{formatDate(session.endedAt)}</span>
                  </div>
                )}
                {session.timer && session.timer.totalStudyTime > 0 && (
                  <>
                    <div className="flex justify-between border-t border-slate-600/50 pt-2 mt-2">
                      <span className="text-slate-400">Total Study Time:</span>
                      <span className="font-semibold text-blue-400">{formatDuration(session.timer.totalStudyTime)}</span>
                    </div>
                    {session.timer.totalBreakTime > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Break Time:</span>
                        <span className="font-medium text-slate-400">{formatDuration(session.timer.totalBreakTime)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Participants */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3">
                Participants ({session.participants.length})
              </h4>
              <div className="space-y-2">
                {session.participants.map((participant) => (
                  <div key={participant.id} className="flex items-center gap-3 p-3 bg-slate-700/30 backdrop-blur-sm rounded-lg border border-slate-600/50">
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
                      <p className="font-medium text-slate-200">{participant.name}</p>
                      <p className="text-xs text-slate-400">
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
                <h4 className="text-sm font-semibold text-slate-300 mb-3">
                  Goals ({session.goals.filter(g => g.isCompleted).length}/{session.goals.length} completed)
                </h4>
                <div className="space-y-2">
                  {session.goals.map((goal) => (
                    <div key={goal.id} className="flex items-start gap-3 p-3 bg-slate-700/30 backdrop-blur-sm rounded-lg border border-slate-600/50">
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        goal.isCompleted ? 'bg-green-500' : 'bg-slate-600'
                      }`}>
                        {goal.isCompleted && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${goal.isCompleted ? 'text-slate-200' : 'text-slate-400'}`}>
                          {goal.title}
                        </p>
                        {goal.description && (
                          <p className="text-sm text-slate-400 mt-1">{goal.description}</p>
                        )}
                        {goal.isCompleted && goal.completedAt && (
                          <p className="text-xs text-green-400 mt-1">
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
            <p className="text-slate-400">Session not found</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-700/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
