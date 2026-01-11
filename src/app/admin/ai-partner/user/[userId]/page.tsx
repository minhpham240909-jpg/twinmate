'use client'

/**
 * Admin AI Partner User History Page
 * View all AI Partner sessions and messages for a specific user
 */

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  Star,
  AlertTriangle,
  Loader2,
  User,
  Sparkles,
  Brain,
  BookOpen,
  Flag,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface AISession {
  id: string
  subject: string | null
  skillLevel: string | null
  studyGoal: string | null
  status: string
  startedAt: string
  endedAt: string | null
  totalDuration: number | null
  messageCount: number
  quizCount: number
  flashcardCount: number
  rating: number | null
  feedback: string | null
  flaggedCount: number
  wasSafetyBlocked: boolean
  createdAt: string
}

interface AIMessage {
  id: string
  role: string
  content: string
  messageType: string
  wasFlagged: boolean
  flagCategories: string[]
  createdAt: string
}

interface UserAIData {
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
  stats: {
    totalSessions: number
    completedSessions?: number
    totalMessages: number
    totalDuration: number
    totalDurationFormatted: string
    averageRating: number | null
    totalFlaggedMessages: number // API returns totalFlaggedMessages, not totalFlagged
    totalQuizzes: number
    totalFlashcards: number
    flaggedSessionCount?: number
    safetyBlockedCount?: number
  }
  sessions: AISession[]
  flaggedMessages: AIMessage[]
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0m'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SessionCard({
  session,
  onViewSession
}: {
  session: AISession
  onViewSession: (id: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-700/30 transition"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            session.status === 'ACTIVE' ? 'bg-green-500/20' :
            session.status === 'PAUSED' ? 'bg-amber-500/20' :
            session.status === 'BLOCKED' ? 'bg-red-500/20' :
            'bg-blue-500/20'
          }`}>
            <Image src="/logo.png" alt="Session" width={20} height={20} className={`object-contain ${
              session.status === 'COMPLETED' || session.status === 'BLOCKED' ? 'opacity-50' : ''
            }`} />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">
                {session.subject || 'General Study'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                session.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                session.status === 'PAUSED' ? 'bg-amber-500/20 text-amber-400' :
                session.status === 'BLOCKED' ? 'bg-red-500/20 text-red-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>
                {session.status}
              </span>
              {session.flaggedCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 flex items-center gap-1">
                  <Flag className="w-3 h-3" />
                  {session.flaggedCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {session.messageCount} msgs
              </span>
              {session.quizCount > 0 && (
                <span className="flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  {session.quizCount}
                </span>
              )}
              {session.flashcardCount > 0 && (
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {session.flashcardCount}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(session.totalDuration)}
              </span>
              {session.rating && (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Star className="w-3 h-3 fill-current" />
                  {session.rating}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{formatDate(session.createdAt)}</span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {session.skillLevel && (
              <div>
                <span className="text-slate-400 text-xs">Skill Level</span>
                <p className="text-white capitalize">{session.skillLevel.toLowerCase()}</p>
              </div>
            )}
            {session.studyGoal && (
              <div className="col-span-2">
                <span className="text-slate-400 text-xs">Study Goal</span>
                <p className="text-white">{session.studyGoal}</p>
              </div>
            )}
            {session.endedAt && (
              <div>
                <span className="text-slate-400 text-xs">Ended At</span>
                <p className="text-white">{formatDate(session.endedAt)}</p>
              </div>
            )}
          </div>

          {session.feedback && (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <span className="text-slate-400 text-xs">User Feedback</span>
              <p className="text-white text-sm mt-1">{session.feedback}</p>
            </div>
          )}

          {session.wasSafetyBlocked && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm">Session was blocked due to safety violation</span>
            </div>
          )}

          <button
            onClick={() => onViewSession(session.id)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition text-sm font-medium"
          >
            View Full Session & Messages
          </button>
        </div>
      )}
    </div>
  )
}

export default function AdminAIPartnerUserPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = use(params)
  const router = useRouter()

  const [data, setData] = useState<UserAIData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/admin/ai-partner/user/${userId}`)
        const result = await res.json()

        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error || 'Failed to load data')
        }
      } catch (err) {
        console.error('Failed to fetch user AI data:', err)
        setError('Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [userId])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading user AI history...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error || 'User not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-800 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex items-center gap-3">
              {data.user.avatarUrl ? (
                <img
                  src={data.user.avatarUrl}
                  alt={data.user.name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-500 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <h1 className="font-semibold text-white">{data.user.name}</h1>
                <p className="text-xs text-slate-400">{data.user.email}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">AI Partner History</span>
            <Image src="/logo.png" alt="AI Partner" width={20} height={20} className="object-contain" />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs">Sessions</span>
            </div>
            <p className="text-2xl font-bold text-white">{data.stats.totalSessions}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs">Messages</span>
            </div>
            <p className="text-2xl font-bold text-white">{data.stats.totalMessages}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs">Total Time</span>
            </div>
            <p className="text-2xl font-bold text-white">{data.stats.totalDurationFormatted}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Star className="w-4 h-4" />
              <span className="text-xs">Avg Rating</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">
              {data.stats.averageRating?.toFixed(1) || 'N/A'}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Brain className="w-4 h-4" />
              <span className="text-xs">Quizzes</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{data.stats.totalQuizzes}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <BookOpen className="w-4 h-4" />
              <span className="text-xs">Flashcards</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{data.stats.totalFlashcards}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 col-span-2">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Flag className="w-4 h-4" />
              <span className="text-xs">Flagged Messages</span>
            </div>
            <p className={`text-2xl font-bold ${data.stats.totalFlaggedMessages > 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {data.stats.totalFlaggedMessages}
            </p>
          </div>
        </div>

        {/* Flagged Messages Alert */}
        {data.flaggedMessages.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h2 className="font-semibold text-red-400">
                Flagged Messages ({data.flaggedMessages.length})
              </h2>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {data.flaggedMessages.map((msg) => (
                <div key={msg.id} className="p-3 bg-red-500/5 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-red-400">
                      {msg.role === 'USER' ? 'User message' : 'AI response'}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(msg.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-300 line-clamp-2">{msg.content}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {msg.flagCategories.map((cat, idx) => (
                      <span key={idx} className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sessions List */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            All Sessions ({data.sessions.length})
          </h2>

          {data.sessions.length > 0 ? (
            <div className="space-y-3">
              {data.sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onViewSession={(id) => router.push(`/admin/ai-partner/sessions/${id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
              <div className="w-12 h-12 mx-auto mb-3 opacity-50">
                <Image src="/logo.png" alt="No sessions" width={48} height={48} className="object-contain" />
              </div>
              <p className="text-slate-400">No AI Partner sessions found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
