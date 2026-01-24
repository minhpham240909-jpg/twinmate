'use client'

/**
 * Admin Feedback Page
 *
 * View and manage user feedback with:
 * - Star ratings display
 * - Screenshot viewing
 * - Status management (pending, reviewed, resolved, archived)
 * - Filtering and pagination
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  RefreshCw,
  Star,
  Clock,
  CheckCircle,
  Archive,
  Eye,
  ChevronDown,
  User,
  MessageSquare,
  Image as ImageIcon,
  X,
  Loader2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type FeedbackStatus = 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'ARCHIVED'

interface FeedbackUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface Feedback {
  id: string
  rating: number
  message: string
  screenshots: string[]
  status: FeedbackStatus
  adminNotes: string | null
  createdAt: string
  reviewedAt: string | null
  user: FeedbackUser
  reviewedBy: FeedbackUser | null
}

interface Statistics {
  byStatus: Record<string, number>
  byRating: Record<string, number>
  averageRating: number
  total: number
}

const statusConfig: Record<FeedbackStatus, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  REVIEWED: { label: 'Reviewed', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Eye },
  RESOLVED: { label: 'Resolved', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  ARCHIVED: { label: 'Archived', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Archive },
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | ''>('')
  const [ratingFilter, setRatingFilter] = useState<string>('')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Selected feedback for detail view
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showImageModal, setShowImageModal] = useState<string | null>(null)

  // Action states
  const [updating, setUpdating] = useState(false)

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (statusFilter) params.set('status', statusFilter)
      if (ratingFilter) params.set('rating', ratingFilter)

      const response = await fetch(`/api/admin/feedback?${params}`)
      if (!response.ok) throw new Error('Failed to fetch feedback')

      const data = await response.json()
      setFeedback(data.data.feedback)
      setStatistics(data.data.statistics)
      setTotalPages(data.data.pagination.pages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, ratingFilter])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback])

  const handleAction = async (feedbackId: string, action: string, adminNotes?: string) => {
    setUpdating(true)
    try {
      const response = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId, action, adminNotes }),
      })

      if (!response.ok) throw new Error('Failed to update feedback')

      await fetchFeedback()
      setShowDetailModal(false)
    } catch (err) {
      console.error('Error updating feedback:', err)
    } finally {
      setUpdating(false)
    }
  }

  const renderStars = (rating: number, size: 'sm' | 'lg' = 'sm') => {
    const sizeClass = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-600'
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Feedback</h1>
          <p className="text-neutral-400 mt-1">
            Review and manage feedback from users
          </p>
        </div>
        <button
          onClick={fetchFeedback}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <p className="text-neutral-400 text-sm">Total Feedback</p>
            <p className="text-2xl font-bold text-white">{statistics.total}</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <p className="text-neutral-400 text-sm">Average Rating</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-white">
                {statistics.averageRating.toFixed(1)}
              </p>
              {renderStars(Math.round(statistics.averageRating))}
            </div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <p className="text-neutral-400 text-sm">Pending</p>
            <p className="text-2xl font-bold text-yellow-400">
              {statistics.byStatus.PENDING || 0}
            </p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <p className="text-neutral-400 text-sm">Reviewed</p>
            <p className="text-2xl font-bold text-blue-400">
              {statistics.byStatus.REVIEWED || 0}
            </p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <p className="text-neutral-400 text-sm">Resolved</p>
            <p className="text-2xl font-bold text-green-400">
              {statistics.byStatus.RESOLVED || 0}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as FeedbackStatus | '')
              setPage(1)
            }}
            className="appearance-none bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2 pr-10 text-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="RESOLVED">Resolved</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        </div>

        {/* Rating Filter */}
        <div className="relative">
          <select
            value={ratingFilter}
            onChange={(e) => {
              setRatingFilter(e.target.value)
              setPage(1)
            }}
            className="appearance-none bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2 pr-10 text-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}

      {/* Feedback List */}
      {!loading && feedback.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">User</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Rating</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Message</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Date</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-neutral-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {feedback.map((item) => {
                const status = statusConfig[item.status]
                const StatusIcon = status.icon
                return (
                  <tr key={item.id} className="border-b border-neutral-800 hover:bg-neutral-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.user.avatarUrl ? (
                          <img
                            src={item.user.avatarUrl}
                            alt={item.user.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-neutral-700 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-neutral-400" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-white">{item.user.name}</p>
                          <p className="text-xs text-neutral-500">{item.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {renderStars(item.rating)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-neutral-300 truncate max-w-xs">
                        {item.message}
                      </p>
                      {item.screenshots.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-neutral-500">
                          <ImageIcon className="w-3 h-3" />
                          {item.screenshots.length} image(s)
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-400">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedFeedback(item)
                          setShowDetailModal(true)
                        }}
                        className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded-lg transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && feedback.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-400">No feedback found</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Previous
          </button>
          <span className="text-neutral-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <h2 className="text-lg font-semibold text-white">Feedback Details</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-4">
                {selectedFeedback.user.avatarUrl ? (
                  <img
                    src={selectedFeedback.user.avatarUrl}
                    alt={selectedFeedback.user.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-neutral-400" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-white">{selectedFeedback.user.name}</p>
                  <p className="text-sm text-neutral-400">{selectedFeedback.user.email}</p>
                </div>
              </div>

              {/* Rating */}
              <div>
                <p className="text-sm text-neutral-400 mb-2">Rating</p>
                {renderStars(selectedFeedback.rating, 'lg')}
              </div>

              {/* Message */}
              <div>
                <p className="text-sm text-neutral-400 mb-2">Message</p>
                <p className="text-white whitespace-pre-wrap">{selectedFeedback.message}</p>
              </div>

              {/* Screenshots */}
              {selectedFeedback.screenshots.length > 0 && (
                <div>
                  <p className="text-sm text-neutral-400 mb-2">Screenshots</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedFeedback.screenshots.map((url, index) => (
                      <button
                        key={index}
                        onClick={() => setShowImageModal(url)}
                        className="relative group"
                      >
                        <img
                          src={url}
                          alt={`Screenshot ${index + 1}`}
                          className="w-24 h-24 object-cover rounded-lg border border-neutral-700"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <p className="text-sm text-neutral-400 mb-2">Status</p>
                <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border ${statusConfig[selectedFeedback.status].color}`}>
                  {statusConfig[selectedFeedback.status].label}
                </span>
              </div>

              {/* Date */}
              <div>
                <p className="text-sm text-neutral-400 mb-1">Submitted</p>
                <p className="text-white">
                  {new Date(selectedFeedback.createdAt).toLocaleString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-neutral-800">
                {selectedFeedback.status === 'PENDING' && (
                  <button
                    onClick={() => handleAction(selectedFeedback.id, 'review')}
                    disabled={updating}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    Mark as Reviewed
                  </button>
                )}
                {(selectedFeedback.status === 'PENDING' || selectedFeedback.status === 'REVIEWED') && (
                  <button
                    onClick={() => handleAction(selectedFeedback.id, 'resolve')}
                    disabled={updating}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Resolve
                  </button>
                )}
                {selectedFeedback.status !== 'ARCHIVED' && (
                  <button
                    onClick={() => handleAction(selectedFeedback.id, 'archive')}
                    disabled={updating}
                    className="flex-1 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                    Archive
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowImageModal(null)}
        >
          <button
            onClick={() => setShowImageModal(null)}
            className="absolute top-4 right-4 p-2 bg-neutral-800 hover:bg-neutral-700 rounded-full"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={showImageModal}
            alt="Screenshot preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
