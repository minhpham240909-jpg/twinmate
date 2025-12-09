'use client'

/**
 * Admin AI Partner Sessions List Page
 * View all AI Partner sessions with filtering and search
 */

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Bot,
  MessageSquare,
  Clock,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Star,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react'

interface Session {
  id: string
  userId: string
  subject: string | null
  skillLevel: string | null
  studyGoal: string | null
  status: string
  startedAt: string
  endedAt: string | null
  totalDuration: number | null
  durationFormatted: string | null
  messageCount: number
  quizCount: number
  flashcardCount: number
  rating: number | null
  feedback: string | null
  flaggedCount: number
  wasSafetyBlocked: boolean
  createdAt: string
  updatedAt: string
  persona: { id: string; name: string } | null
  user: {
    id: string
    email: string
    name: string | null
    avatarUrl: string | null
  } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

export default function AdminAIPartnerSessionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [sessions, setSessions] = useState<Session[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [flaggedOnly, setFlaggedOnly] = useState(searchParams.get('flagged') === 'true')
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'))

  const fetchSessions = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams()
    params.set('page', page.toString())
    params.set('limit', '20')
    if (status) params.set('status', status)
    if (flaggedOnly) params.set('flagged', 'true')
    if (search) params.set('search', search)

    try {
      const response = await fetch(`/api/admin/ai-partner/sessions?${params}`)
      const result = await response.json()

      if (result.success) {
        setSessions(result.data.sessions)
        setPagination(result.data.pagination)
      } else {
        setError(result.error || 'Failed to fetch sessions')
      }
    } catch (err) {
      setError('Failed to fetch sessions')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [page, status, flaggedOnly, search])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const formatRelativeTime = (dateString: string): string => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Bot className="w-8 h-8 text-blue-500" />
            AI Partner Sessions
          </h1>
          <p className="text-gray-400 mt-1">
            View and manage all AI Study Partner sessions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchSessions()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by subject..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
            <option value="BLOCKED">Blocked</option>
            <option value="EXPIRED">Expired</option>
          </select>

          {/* Flagged Filter */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(e) => {
                setFlaggedOnly(e.target.checked)
                setPage(1)
              }}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-red-500 focus:ring-red-500"
            />
            <span className="text-sm text-gray-300 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Flagged Only
            </span>
          </label>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading sessions...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-4" />
            <p className="text-red-400">{error}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center">
            <Bot className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No sessions found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Messages
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Rating
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Flags
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {sessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {session.user ? (
                          <Link
                            href={`/admin/users/${session.user.id}`}
                            className="flex items-center gap-2 hover:text-blue-400 transition-colors"
                          >
                            {session.user.avatarUrl ? (
                              <Image
                                src={session.user.avatarUrl}
                                alt={session.user.name || 'User'}
                                width={32}
                                height={32}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                                <span className="text-xs font-medium text-white">
                                  {session.user.name?.charAt(0) || session.user.email.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-white">
                                {session.user.name || 'No name'}
                              </p>
                              <p className="text-xs text-gray-400 truncate max-w-[150px]">
                                {session.user.email}
                              </p>
                            </div>
                          </Link>
                        ) : (
                          <span className="text-gray-400">Unknown</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-white">
                          {session.subject || 'General Study'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(session.status)}`}>
                          {session.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-300">
                          <MessageSquare className="w-4 h-4 text-gray-400" />
                          {session.messageCount}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-300">
                          <Clock className="w-4 h-4 text-gray-400" />
                          {session.durationFormatted || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {session.rating ? (
                          <div className="flex items-center gap-1 text-sm text-yellow-400">
                            <Star className="w-4 h-4 fill-current" />
                            {session.rating}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {session.flaggedCount > 0 || session.wasSafetyBlocked ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400">
                            {session.flaggedCount > 0 && `${session.flaggedCount} flagged`}
                            {session.wasSafetyBlocked && ' BLOCKED'}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                        {formatRelativeTime(session.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <Link
                          href={`/admin/ai-partner/sessions/${session.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
                <p className="text-sm text-gray-400">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} sessions
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                  <span className="text-sm text-gray-300">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={!pagination.hasMore}
                    className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
