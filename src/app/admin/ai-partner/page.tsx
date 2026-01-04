'use client'

/**
 * Admin AI Partner Analytics Page
 * CEO Control Panel - Real-time AI Partner Statistics & Moderation
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  MessageSquare,
  Users,
  Clock,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  Star,
  DollarSign,
  Shield,
  Activity,
  BookOpen,
  ImageIcon,
  Upload,
} from 'lucide-react'
import { AreaChartCard, PieChartCard } from '@/components/admin/charts'
import ExpandableList from '@/components/admin/ExpandableList'

interface AIPartnerAnalytics {
  overview: {
    totalSessions: number
    totalMessages: number
    totalUniqueUsers: number
    activeSessions: number
    pausedSessions: number
    // Focus time is the Pomodoro timer time - only counted when user clicks Start Timer
    averageFocusTime: number // Average focus time per session (in seconds)
    totalFocusTime: number // Total focus time across all sessions (in seconds)
    sessionsWithTimer: number // Number of sessions where timer was actually used
    averageMessagesPerSession: number
  }
  timePeriods: {
    sessionsToday: number
    sessionsThisWeek: number
    sessionsThisMonth: number
  }
  statusBreakdown: {
    active: number
    paused: number
    completed: number
    blocked: number
  }
  messageStats: {
    total: number
    userMessages: number
    aiMessages: number
    averagePerSession: number
  }
  moderation: {
    flaggedMessages: number
    flaggedSessions: number
    safetyBlockedSessions: number
    flaggedPercentage: string
    recentFlagged: Array<{
      id: string
      content: string
      role: string
      flagCategories: string[]
      createdAt: string
      session: { id: string; userId: string; subject: string | null }
    }>
  }
  features: {
    totalQuizzes: number
    totalFlashcards: number
    whiteboardAnalyses: number
    generatedImages: number
    uploadedImages: number
    totalImages: number
  }
  imageGeneration: {
    totalGenerated: number
    totalUploaded: number
    recentImages: Array<{
      id: string
      imageUrl: string | null
      prompt: string | null
      createdAt: string
      sessionId: string
      userId: string
      subject: string | null
    }>
  }
  tokens: {
    totalPromptTokens: number
    totalCompletionTokens: number
    totalTokens: number
    estimatedCostUSD: string
  }
  ratings: {
    totalRated: number
    averageRating: number | null
    ratingPercentage: string
    recentFeedback: Array<{
      id: string
      userId: string
      userName: string
      userEmail: string
      userImage: string | null
      subject: string | null
      rating: number | null
      feedback: string | null
      endedAt: string | null
      totalDuration: number | null
      messageCount: number
    }>
  }
  charts: {
    dailyGrowth: Array<{ date: string; sessions: number; messages: number; users: number }>
    subjectDistribution: Array<{ subject: string; count: number }>
  }
  activeUsers: Array<{
    id: string
    userId: string
    subject: string | null
    messageCount: number
    startedAt: string
  }>
  lastUpdated: string
}

export default function AdminAIPartnerPage() {
  const [data, setData] = useState<AIPartnerAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/ai-partner/analytics')
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || 'Failed to fetch data')
      }
    } catch (err) {
      setError('Failed to fetch AI Partner analytics')
      console.error(err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchData(), 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const formatRelativeTime = (dateString: string): string => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading AI Partner analytics...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error || 'Failed to load data'}</p>
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const statCards: Array<{
    title: string
    value: string | number
    subtitle?: string
    icon: typeof Sparkles
    color: string
    isText?: boolean
    urgent?: boolean
  }> = [
    {
      title: 'Total Sessions',
      value: data.overview.totalSessions,
      icon: Sparkles,
      color: 'blue',
    },
    {
      title: 'Total Messages',
      value: data.overview.totalMessages,
      icon: MessageSquare,
      color: 'purple',
    },
    {
      title: 'Unique Users',
      value: data.overview.totalUniqueUsers,
      icon: Users,
      color: 'green',
    },
    {
      title: 'Active Now',
      value: data.overview.activeSessions,
      icon: Activity,
      color: 'emerald',
      urgent: data.overview.activeSessions > 0,
    },
    {
      title: 'Avg Focus Time',
      value: data.overview.averageFocusTime > 0 ? formatDuration(data.overview.averageFocusTime) : 'N/A',
      subtitle: `${data.overview.sessionsWithTimer} sessions used timer`,
      icon: Clock,
      color: 'indigo',
      isText: true,
    },
    {
      title: 'Quizzes Generated',
      value: data.features.totalQuizzes,
      icon: BookOpen,
      color: 'teal',
    },
    {
      title: 'Flashcards Made',
      value: data.features.totalFlashcards,
      icon: Sparkles,
      color: 'pink',
    },
    {
      title: 'Images Generated',
      value: data.features.generatedImages,
      icon: ImageIcon,
      color: 'cyan',
    },
    {
      title: 'Images Uploaded',
      value: data.features.uploadedImages,
      icon: Upload,
      color: 'orange',
    },
    {
      title: 'Flagged Messages',
      value: data.moderation.flaggedMessages,
      icon: AlertTriangle,
      color: data.moderation.flaggedMessages > 0 ? 'red' : 'gray',
      urgent: data.moderation.flaggedMessages > 0,
    },
  ]

  const colorClasses: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'bg-blue-500' },
    purple: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'bg-blue-500' },
    green: { bg: 'bg-green-500/10', text: 'text-green-400', icon: 'bg-green-500' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'bg-emerald-500' },
    indigo: { bg: 'bg-blue-1000/10', text: 'text-blue-500', icon: 'bg-blue-1000' },
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', icon: 'bg-teal-500' },
    pink: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'bg-blue-500' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', icon: 'bg-cyan-500' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', icon: 'bg-orange-500' },
    red: { bg: 'bg-red-500/10', text: 'text-red-400', icon: 'bg-red-500' },
    gray: { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: 'bg-gray-500' },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Image src="/logo.png" alt="AI Partner" width={32} height={32} className="object-contain" />
            AI Partner Analytics
          </h1>
          <p className="text-gray-400 mt-1">
            Real-time statistics and moderation for AI Study Partner
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data.lastUpdated && (
            <span className="text-sm text-gray-500">
              Updated: {new Date(data.lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Moderation Alert Banner */}
      {data.moderation.flaggedMessages > 0 && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-400">
                {data.moderation.flaggedMessages} Flagged Message(s) Require Review
              </h3>
              <p className="text-sm text-gray-400">
                {data.moderation.flaggedSessions} session(s) contain flagged content •{' '}
                {data.moderation.safetyBlockedSessions} session(s) were safety-blocked
              </p>
            </div>
            <Link
              href="#flagged"
              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm font-medium"
            >
              Review Now
            </Link>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const colors = colorClasses[stat.color]
          return (
            <div
              key={stat.title}
              className={`relative p-6 rounded-xl ${colors.bg} border border-gray-700 ${
                stat.urgent ? 'ring-2 ring-current animate-pulse' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">{stat.title}</p>
                  <p className={`text-3xl font-bold mt-1 ${colors.text}`}>
                    {stat.isText ? stat.value : typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                  </p>
                  {stat.subtitle && (
                    <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
                  )}
                </div>
                <div className={`p-3 rounded-lg ${colors.icon}`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Time Period Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-white">Total Focus Time</h3>
          </div>
          <p className="text-3xl font-bold text-blue-500">
            {data.overview.totalFocusTime > 0 ? formatDuration(data.overview.totalFocusTime) : '0m'}
          </p>
          <p className="text-sm text-gray-400">tracked via Pomodoro timer</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-white">Today</h3>
          </div>
          <p className="text-3xl font-bold text-green-400">{data.timePeriods.sessionsToday}</p>
          <p className="text-sm text-gray-400">sessions started</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">This Week</h3>
          </div>
          <p className="text-3xl font-bold text-blue-400">{data.timePeriods.sessionsThisWeek}</p>
          <p className="text-sm text-gray-400">sessions started</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">This Month</h3>
          </div>
          <p className="text-3xl font-bold text-blue-400">{data.timePeriods.sessionsThisMonth}</p>
          <p className="text-sm text-gray-400">sessions started</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Growth Chart */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Daily Activity (Last 30 Days)</h3>
          {data.charts.dailyGrowth.length > 0 ? (
            <AreaChartCard
              title=""
              data={data.charts.dailyGrowth.map(d => ({
                date: d.date,
                label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                value: d.sessions,
              }))}
              color="#3b82f6"
              height={200}
              showHeader={false}
              gradientId="aiGrowth"
            />
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* Subject Distribution */}
        {data.charts.subjectDistribution.length > 0 ? (
          <PieChartCard
            title="Popular Subjects"
            data={data.charts.subjectDistribution.map(s => ({
              name: s.subject,
              value: s.count,
            }))}
            height={200}
          />
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Popular Subjects</h3>
            <div className="h-48 flex items-center justify-center text-gray-500">
              No subjects tracked yet
            </div>
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Sessions */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              Active Sessions ({data.activeUsers.length})
            </h3>
            <Link
              href="/admin/ai-partner/sessions?status=ACTIVE"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              View All
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          {data.activeUsers.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {data.activeUsers.map(session => (
                <Link
                  key={session.id}
                  href={`/admin/users/${session.userId}`}
                  className="block p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">
                      {session.subject || 'General Study'}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {session.messageCount} messages • Started {formatRelativeTime(session.startedAt)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No active sessions right now
            </div>
          )}
        </div>

        {/* Token Usage & Cost */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Token Usage & Cost</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-400">Input Tokens</p>
              <p className="text-xl font-bold text-white">
                {(data.tokens.totalPromptTokens / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="p-3 bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-400">Output Tokens</p>
              <p className="text-xl font-bold text-white">
                {(data.tokens.totalCompletionTokens / 1000).toFixed(1)}K
              </p>
            </div>
          </div>
          <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
            <p className="text-sm text-yellow-400">Estimated Total Cost</p>
            <p className="text-3xl font-bold text-yellow-400">
              ${data.tokens.estimatedCostUSD}
            </p>
            <p className="text-xs text-gray-400 mt-1">Based on GPT-4o-mini pricing</p>
          </div>
        </div>
      </div>

      {/* Ratings */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">User Satisfaction</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-700/50 rounded-lg text-center">
            <p className="text-4xl font-bold text-yellow-400 flex items-center justify-center gap-2">
              {data.ratings.averageRating ? (
                <>
                  <Star className="w-8 h-8 fill-current" />
                  {data.ratings.averageRating}
                </>
              ) : (
                'N/A'
              )}
            </p>
            <p className="text-sm text-gray-400 mt-1">Average Rating</p>
          </div>
          <div className="p-4 bg-gray-700/50 rounded-lg text-center">
            <p className="text-4xl font-bold text-white">{data.ratings.totalRated}</p>
            <p className="text-sm text-gray-400 mt-1">Sessions Rated</p>
          </div>
          <div className="p-4 bg-gray-700/50 rounded-lg text-center">
            <p className="text-4xl font-bold text-white">{data.ratings.ratingPercentage}%</p>
            <p className="text-sm text-gray-400 mt-1">Rating Rate</p>
          </div>
        </div>
      </div>

      {/* User Feedback Section */}
      <div id="feedback" className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            Recent User Feedback ({data.ratings.recentFeedback.length})
          </h3>
          <span className="text-sm text-gray-400">
            From AI Partner sessions
          </span>
        </div>
        <ExpandableList
          items={data.ratings.recentFeedback}
          title="User Feedback"
          icon={<MessageSquare className="w-5 h-5" />}
          previewLimit={10}
          searchKeys={['userName', 'userEmail', 'subject', 'feedback']}
          searchPlaceholder="Search by name, email, subject, or feedback..."
          emptyMessage="No feedback yet"
          emptyIcon={<MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />}
          modalTitle="All User Feedback"
          renderPreviewItem={(feedback) => (
            <div className="p-4 bg-gray-700/30 border border-gray-600/50 rounded-lg hover:bg-gray-700/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {feedback.userImage ? (
                    <img
                      src={feedback.userImage}
                      alt={feedback.userName}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{feedback.userName}</p>
                    <p className="text-xs text-gray-400 truncate">{feedback.userEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {feedback.rating && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded-lg">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= feedback.rating!
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {feedback.feedback && (
                <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-gray-300 text-sm whitespace-pre-wrap line-clamp-2">{feedback.feedback}</p>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {feedback.subject || 'General'}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {feedback.messageCount} messages
                  </span>
                </div>
                {feedback.endedAt && (
                  <span>{formatRelativeTime(feedback.endedAt)}</span>
                )}
              </div>
            </div>
          )}
          renderFullItem={(feedback) => (
            <div className="p-4 bg-gray-700/30 border border-gray-600/50 rounded-lg hover:bg-gray-700/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {feedback.userImage ? (
                    <img
                      src={feedback.userImage}
                      alt={feedback.userName}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{feedback.userName}</p>
                    <p className="text-xs text-gray-400 truncate">{feedback.userEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {feedback.rating && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded-lg">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= feedback.rating!
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {feedback.feedback && (
                <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{feedback.feedback}</p>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {feedback.subject || 'General'}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {feedback.messageCount} messages
                  </span>
                  {feedback.totalDuration && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(feedback.totalDuration)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {feedback.endedAt && (
                    <span>{formatRelativeTime(feedback.endedAt)}</span>
                  )}
                  <Link
                    href={`/admin/users/${feedback.userId}`}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    View User
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        />
      </div>

      {/* Recent Generated Images Section */}
      <div id="images" className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-cyan-400" />
            Recent Generated Images ({data.imageGeneration.totalGenerated})
          </h3>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <ImageIcon className="w-4 h-4 text-cyan-400" />
              {data.imageGeneration.totalGenerated} generated
            </span>
            <span className="flex items-center gap-1">
              <Upload className="w-4 h-4 text-orange-400" />
              {data.imageGeneration.totalUploaded} uploaded
            </span>
          </div>
        </div>
        <ExpandableList
          items={data.imageGeneration.recentImages}
          title="Generated Images"
          icon={<ImageIcon className="w-5 h-5" />}
          previewLimit={10}
          searchKeys={['prompt', 'subject', 'userId']}
          searchPlaceholder="Search by prompt, subject, or user ID..."
          emptyMessage="No generated images yet"
          emptyIcon={<ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />}
          modalTitle="All Generated Images"
          modalGridCols={4}
          renderPreviewItem={(img, index) => (
            index < 5 ? (
              <div className="inline-block w-[calc(20%-0.8rem)] mr-4 mb-4">
                <div className="group relative bg-gray-700/30 rounded-lg overflow-hidden border border-gray-600/50 hover:border-cyan-500/50 transition-colors">
                  {img.imageUrl ? (
                    <div className="aspect-square relative">
                      <img
                        src={img.imageUrl}
                        alt={img.prompt || 'Generated image'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                        <p className="text-xs text-white line-clamp-2 mb-1">
                          {img.prompt || 'No prompt'}
                        </p>
                        <span className="text-xs text-gray-400">{img.subject || 'General'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-square flex items-center justify-center bg-gray-700/50">
                      <ImageIcon className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                </div>
              </div>
            ) : null
          )}
          renderFullItem={(img) => (
            <div className="group relative bg-gray-700/30 rounded-lg overflow-hidden border border-gray-600/50 hover:border-cyan-500/50 transition-colors">
              {img.imageUrl ? (
                <div className="aspect-square relative">
                  <img
                    src={img.imageUrl}
                    alt={img.prompt || 'Generated image'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    <p className="text-xs text-white line-clamp-3 mb-1">
                      {img.prompt || 'No prompt'}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{img.subject || 'General'}</span>
                      <span>{formatRelativeTime(img.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="aspect-square flex items-center justify-center bg-gray-700/50">
                  <ImageIcon className="w-8 h-8 text-gray-500" />
                </div>
              )}
              <div className="p-2 border-t border-gray-600/50">
                <Link
                  href={`/admin/users/${img.userId}`}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  View User
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        />
      </div>

      {/* Flagged Messages Section */}
      <div id="flagged" className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" />
            Flagged Content ({data.moderation.flaggedMessages})
          </h3>
          <span className="text-sm text-gray-400">
            {data.moderation.flaggedPercentage}% of all messages flagged
          </span>
        </div>
        <ExpandableList
          items={data.moderation.recentFlagged}
          title="Flagged Content"
          icon={<Shield className="w-5 h-5" />}
          previewLimit={10}
          searchKeys={['content', 'role', 'flagCategories']}
          searchPlaceholder="Search flagged content..."
          emptyMessage="No flagged content"
          emptyIcon={<Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />}
          modalTitle="All Flagged Content"
          renderPreviewItem={(msg) => (
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    msg.role === 'USER' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {msg.role === 'USER' ? 'User' : 'AI'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {msg.session.subject || 'General'} session
                  </span>
                </div>
                <span className="text-xs text-gray-400">{formatRelativeTime(msg.createdAt)}</span>
              </div>
              <p className="text-gray-300 text-sm mb-2 line-clamp-2">{msg.content}</p>
              <div className="flex flex-wrap gap-1">
                {msg.flagCategories.slice(0, 3).map((cat, idx) => (
                  <span key={idx} className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                    {cat}
                  </span>
                ))}
                {msg.flagCategories.length > 3 && (
                  <span className="text-xs px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded">
                    +{msg.flagCategories.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
          renderFullItem={(msg) => (
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    msg.role === 'USER' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {msg.role === 'USER' ? 'User' : 'AI'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {msg.session.subject || 'General'} session
                  </span>
                </div>
                <span className="text-xs text-gray-400">{formatRelativeTime(msg.createdAt)}</span>
              </div>
              <p className="text-gray-300 text-sm mb-2">{msg.content}</p>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {msg.flagCategories.map((cat, idx) => (
                    <span key={idx} className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                      {cat}
                    </span>
                  ))}
                </div>
                <Link
                  href={`/admin/users/${msg.session.userId}`}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  View User
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            href="/admin/ai-partner/sessions"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
          >
            <MessageSquare className="w-8 h-8 text-blue-400" />
            <span className="text-sm text-gray-300">All Sessions</span>
          </Link>
          <Link
            href="/admin/ai-partner/sessions?flagged=true"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
          >
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <span className="text-sm text-gray-300">Flagged Sessions</span>
          </Link>
          <Link
            href="/admin/users"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
          >
            <Users className="w-8 h-8 text-green-400" />
            <span className="text-sm text-gray-300">User Management</span>
          </Link>
          <Link
            href="/admin/analytics"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
          >
            <TrendingUp className="w-8 h-8 text-blue-400" />
            <span className="text-sm text-gray-300">Full Analytics</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
