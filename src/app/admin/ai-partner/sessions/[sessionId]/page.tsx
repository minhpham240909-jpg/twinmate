'use client'

/**
 * Admin AI Partner Session Detail Page
 * View complete chat history and session details
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Bot,
  User,
  ArrowLeft,
  MessageSquare,
  Clock,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Star,
  BookOpen,
  Sparkles,
  Pencil,
  DollarSign,
  Shield,
} from 'lucide-react'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  messageType: string
  quizData: unknown | null
  flashcardData: unknown | null
  wasModerated: boolean
  wasFlagged: boolean
  flagCategories: string[]
  moderationResult: unknown | null
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  createdAt: string
}

interface SessionDetail {
  session: {
    id: string
    subject: string | null
    skillLevel: string | null
    studyGoal: string | null
    status: string
    startedAt: string
    endedAt: string | null
    totalDuration: number
    durationFormatted: string
    messageCount: number
    quizCount: number
    flashcardCount: number
    rating: number | null
    feedback: string | null
    flaggedCount: number
    wasSafetyBlocked: boolean
    createdAt: string
    updatedAt: string
  }
  persona: {
    id: string
    name: string
    description: string
    tone: string
  } | null
  user: {
    id: string
    email: string
    name: string | null
    avatarUrl: string | null
    createdAt: string
    profile: {
      school: string | null
      subjects: string[]
      skillLevel: string | null
    } | null
  } | null
  messages: Message[]
  messageStats: {
    total: number
    user: number
    assistant: number
    system: number
    flagged: number
    byType: {
      chat: number
      quiz: number
      flashcard: number
      whiteboard: number
      summary: number
    }
  }
  tokenStats: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    estimatedCostUSD: string
  }
}

export default function AdminAIPartnerSessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [data, setData] = useState<SessionDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/ai-partner/sessions/${sessionId}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || 'Failed to fetch session')
      }
    } catch (err) {
      setError('Failed to fetch session details')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatTime = (dateString: string): string => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-500/20 text-green-400'
      case 'PAUSED':
        return 'bg-amber-500/20 text-amber-400'
      case 'COMPLETED':
        return 'bg-blue-500/20 text-blue-400'
      case 'BLOCKED':
        return 'bg-red-500/20 text-red-400'
      case 'EXPIRED':
        return 'bg-gray-500/20 text-gray-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'QUIZ':
        return <BookOpen className="w-4 h-4 text-purple-400" />
      case 'FLASHCARD':
        return <Sparkles className="w-4 h-4 text-pink-400" />
      case 'WHITEBOARD':
        return <Pencil className="w-4 h-4 text-blue-400" />
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading session details...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error || 'Session not found'}</p>
          <button
            onClick={() => router.push('/admin/ai-partner/sessions')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Back to Sessions
          </button>
        </div>
      </div>
    )
  }

  const { session, user, messages, messageStats, tokenStats, persona } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/ai-partner/sessions')}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Session Details</h1>
            <p className="text-gray-400 text-sm">
              {session.subject || 'General Study'} • {session.durationFormatted}
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Session Alert */}
      {(session.flaggedCount > 0 || session.wasSafetyBlocked) && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <div>
              <h3 className="font-semibold text-red-400">
                {session.wasSafetyBlocked
                  ? 'Session was Safety Blocked'
                  : `${session.flaggedCount} Flagged Message(s)`}
              </h3>
              <p className="text-sm text-gray-400">
                This session contains moderated content that requires review
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Info */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            User Information
          </h3>
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.name || 'User'}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
                    <span className="text-lg font-medium text-white">
                      {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-white">{user.name || 'No name'}</p>
                  <p className="text-sm text-gray-400">{user.email}</p>
                </div>
              </div>
              {user.profile && (
                <div className="space-y-2 text-sm">
                  {user.profile.school && (
                    <p className="text-gray-400">
                      <span className="text-gray-500">School:</span> {user.profile.school}
                    </p>
                  )}
                  {user.profile.skillLevel && (
                    <p className="text-gray-400">
                      <span className="text-gray-500">Skill:</span> {user.profile.skillLevel}
                    </p>
                  )}
                </div>
              )}
              <Link
                href={`/admin/users/${user.id}`}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
              >
                View Full Profile
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <p className="text-gray-500">User not found</p>
          )}
        </div>

        {/* Session Stats */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-400" />
            Session Statistics
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Status</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(session.status)}`}>
                {session.status}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Duration</span>
              <span className="text-white">{session.durationFormatted}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Messages</span>
              <span className="text-white">{session.messageCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Quizzes</span>
              <span className="text-white">{session.quizCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Flashcards</span>
              <span className="text-white">{session.flashcardCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Rating</span>
              {session.rating ? (
                <span className="text-yellow-400 flex items-center gap-1">
                  <Star className="w-4 h-4 fill-current" />
                  {session.rating}/5
                </span>
              ) : (
                <span className="text-gray-500">Not rated</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Started</span>
              <span className="text-white text-sm">{formatDate(session.startedAt)}</span>
            </div>
          </div>
        </div>

        {/* Token Usage */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-yellow-400" />
            Token Usage
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Input Tokens</span>
              <span className="text-white">{tokenStats.promptTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Output Tokens</span>
              <span className="text-white">{tokenStats.completionTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total Tokens</span>
              <span className="text-white">{tokenStats.totalTokens.toLocaleString()}</span>
            </div>
            <div className="pt-3 border-t border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Estimated Cost</span>
                <span className="text-yellow-400 font-semibold">${tokenStats.estimatedCostUSD}</span>
              </div>
            </div>
          </div>
          {persona && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500">Persona Used</p>
              <p className="text-white font-medium">{persona.name}</p>
              <p className="text-xs text-gray-400 capitalize">{persona.tone} tone</p>
            </div>
          )}
        </div>
      </div>

      {/* Message Stats */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-green-400" />
          Message Breakdown
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-400">{messageStats.user}</p>
            <p className="text-xs text-gray-400">User Messages</p>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-purple-400">{messageStats.assistant}</p>
            <p className="text-xs text-gray-400">AI Messages</p>
          </div>
          <div className="p-3 bg-teal-500/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-teal-400">{messageStats.byType.quiz}</p>
            <p className="text-xs text-gray-400">Quiz Messages</p>
          </div>
          <div className="p-3 bg-pink-500/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-pink-400">{messageStats.byType.flashcard}</p>
            <p className="text-xs text-gray-400">Flashcard</p>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-indigo-400">{messageStats.byType.whiteboard}</p>
            <p className="text-xs text-gray-400">Whiteboard</p>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-red-400">{messageStats.flagged}</p>
            <p className="text-xs text-gray-400">Flagged</p>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          Complete Chat History ({messages.length} messages)
        </h3>
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'USER' ? 'flex-row' : 'flex-row-reverse'}`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  msg.role === 'USER'
                    ? 'bg-blue-500'
                    : msg.role === 'SYSTEM'
                    ? 'bg-gray-600'
                    : 'bg-purple-500'
                }`}
              >
                {msg.role === 'USER' ? (
                  <User className="w-4 h-4 text-white" />
                ) : msg.role === 'SYSTEM' ? (
                  <Shield className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              <div
                className={`flex-1 max-w-[80%] ${
                  msg.role === 'USER' ? 'text-left' : 'text-right'
                }`}
              >
                <div
                  className={`inline-block p-4 rounded-xl ${
                    msg.wasFlagged
                      ? 'bg-red-500/10 border border-red-500/30'
                      : msg.role === 'USER'
                      ? 'bg-blue-500/10'
                      : msg.role === 'SYSTEM'
                      ? 'bg-gray-700'
                      : 'bg-gray-700/50'
                  }`}
                >
                  {/* Message Type Badge */}
                  {msg.messageType !== 'CHAT' && (
                    <div className="flex items-center gap-1 mb-2">
                      {getMessageTypeIcon(msg.messageType)}
                      <span className="text-xs text-gray-400">{msg.messageType}</span>
                    </div>
                  )}

                  {/* Flagged Warning */}
                  {msg.wasFlagged && (
                    <div className="flex items-center gap-2 mb-2 text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs font-medium">Flagged Content</span>
                      {msg.flagCategories.length > 0 && (
                        <span className="text-xs">({msg.flagCategories.join(', ')})</span>
                      )}
                    </div>
                  )}

                  {/* Message Content */}
                  <p className="text-white whitespace-pre-wrap text-sm">{msg.content}</p>

                  {/* Timestamp */}
                  <p className="text-xs text-gray-500 mt-2">
                    {formatTime(msg.createdAt)}
                    {msg.totalTokens && (
                      <span className="ml-2">• {msg.totalTokens} tokens</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Feedback */}
      {session.feedback && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            User Feedback
          </h3>
          <div className="flex items-start gap-4">
            {session.rating && (
              <div className="flex items-center gap-1 text-yellow-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-6 h-6 ${
                      star <= session.rating! ? 'fill-current' : 'text-gray-600'
                    }`}
                  />
                ))}
              </div>
            )}
            <p className="text-gray-300 flex-1">{session.feedback}</p>
          </div>
        </div>
      )}
    </div>
  )
}
