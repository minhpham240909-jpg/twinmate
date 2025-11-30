'use client'

// Admin Reports Page - Content Moderation & Feedback
// CEO Control Panel - Handle User Reports and Feedback

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  X,
  User,
  Flag,
  Ban,
  FileText,
  MessageCircleHeart,
  Star,
  Archive,
  Search,
} from 'lucide-react'
import InvestigationPanel from '@/components/admin/InvestigationPanel'

type TabType = 'reports' | 'feedback'

interface Reporter {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface ReportData {
  id: string
  type: string
  description: string | null
  contentId: string | null
  contentType: string | null
  status: string
  resolution: string | null
  createdAt: string
  handledAt: string | null
  reporter: Reporter
  reportedUser: Reporter | null
  handledBy: {
    id: string
    name: string | null
    email: string
  } | null
}

interface Pagination {
  total: number
  pages: number
  currentPage: number
  limit: number
}

interface FeedbackUser {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface FeedbackData {
  id: string
  rating: number
  message: string
  screenshots: string[]
  status: string
  adminNotes: string | null
  createdAt: string
  reviewedAt: string | null
  user: FeedbackUser
  reviewedBy: {
    id: string
    name: string | null
    email: string
  } | null
}

interface FeedbackStats {
  byStatus: Record<string, number>
  byRating: Record<string, number>
  averageRating: number
  total: number
}

export default function AdminReportsPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('reports')

  // Reports state
  const [reports, setReports] = useState<ReportData[]>([])
  const [reportsPagination, setReportsPagination] = useState<Pagination | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Feedback state
  const [feedback, setFeedback] = useState<FeedbackData[]>([])
  const [feedbackPagination, setFeedbackPagination] = useState<Pagination | null>(null)
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null)

  // Filters - Reports
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)

  // Filters - Feedback
  const [feedbackStatus, setFeedbackStatus] = useState('')
  const [feedbackRating, setFeedbackRating] = useState('')
  const [feedbackPage, setFeedbackPage] = useState(1)

  // Modal state - Reports
  const [actionModal, setActionModal] = useState<{
    report: ReportData
    action: 'resolve' | 'dismiss'
  } | null>(null)
  const [resolution, setResolution] = useState('')
  const [banUser, setBanUser] = useState(false)
  const [banDuration, setBanDuration] = useState<number | null>(null)
  const [banReason, setBanReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal state - Feedback
  const [feedbackModal, setFeedbackModal] = useState<{
    feedback: FeedbackData
    action: 'review' | 'resolve' | 'archive'
  } | null>(null)
  const [adminNotes, setAdminNotes] = useState('')

  // Investigation panel state
  const [investigationReport, setInvestigationReport] = useState<ReportData | null>(null)

  // Fetch reports
  const fetchReports = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status && { status }),
        ...(type && { type }),
      })

      const response = await fetch(`/api/admin/reports?${params}`)
      const data = await response.json()

      if (data.success) {
        setReports(data.data.reports)
        setReportsPagination(data.data.pagination)
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [page, status, type])

  // Fetch feedback
  const fetchFeedback = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        page: feedbackPage.toString(),
        limit: '20',
        ...(feedbackStatus && { status: feedbackStatus }),
        ...(feedbackRating && { rating: feedbackRating }),
      })

      const response = await fetch(`/api/admin/feedback?${params}`)
      const data = await response.json()

      if (data.success) {
        setFeedback(data.data.feedback)
        setFeedbackPagination(data.data.pagination)
        setFeedbackStats(data.data.statistics)
      }
    } catch (error) {
      console.error('Error fetching feedback:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [feedbackPage, feedbackStatus, feedbackRating])

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports()
    } else {
      fetchFeedback()
    }
  }, [activeTab, fetchReports, fetchFeedback])

  // Handle action
  const handleAction = async (action: 'review' | 'resolve' | 'dismiss', reportId: string) => {
    if (action === 'review') {
      try {
        const response = await fetch('/api/admin/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'review', reportId }),
        })

        if ((await response.json()).success) {
          fetchReports(true)
        }
      } catch (error) {
        console.error('Error:', error)
      }
      return
    }

    // For resolve/dismiss, show modal
    const report = reports.find((r) => r.id === reportId)
    if (report) {
      setActionModal({ report, action })
    }
  }

  // Submit action
  const submitAction = async () => {
    if (!actionModal) return

    setIsSubmitting(true)

    try {
      const body: Record<string, any> = {
        action: actionModal.action,
        reportId: actionModal.report.id,
        resolution,
      }

      if (actionModal.action === 'resolve' && banUser) {
        body.banUser = true
        body.banDuration = banDuration
        body.banReason = banReason
      }

      const response = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (data.success) {
        fetchReports(true)
        setActionModal(null)
        setResolution('')
        setBanUser(false)
        setBanDuration(null)
        setBanReason('')
      } else {
        alert(data.error || 'Action failed')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle feedback action
  const handleFeedbackAction = async (action: 'review' | 'resolve' | 'archive', feedbackId: string) => {
    const fb = feedback.find((f) => f.id === feedbackId)
    if (fb) {
      setFeedbackModal({ feedback: fb, action })
      setAdminNotes(fb.adminNotes || '')
    }
  }

  // Submit feedback action
  const submitFeedbackAction = async () => {
    if (!feedbackModal) return

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: feedbackModal.action,
          feedbackId: feedbackModal.feedback.id,
          adminNotes,
        }),
      })

      const data = await response.json()

      if (data.success) {
        fetchFeedback(true)
        setFeedbackModal(null)
        setAdminNotes('')
      } else {
        alert(data.error || 'Action failed')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock }
      case 'REVIEWING':
        return { label: 'Reviewing', color: 'bg-blue-500/20 text-blue-400', icon: Eye }
      case 'RESOLVED':
        return { label: 'Resolved', color: 'bg-green-500/20 text-green-400', icon: CheckCircle }
      case 'DISMISSED':
        return { label: 'Dismissed', color: 'bg-gray-500/20 text-gray-400', icon: XCircle }
      default:
        return { label: status, color: 'bg-gray-500/20 text-gray-400', icon: Flag }
    }
  }

  // Get type badge
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'SPAM':
        return { label: 'Spam', color: 'bg-orange-500/20 text-orange-400' }
      case 'HARASSMENT':
        return { label: 'Harassment', color: 'bg-red-500/20 text-red-400' }
      case 'INAPPROPRIATE':
        return { label: 'Inappropriate', color: 'bg-pink-500/20 text-pink-400' }
      case 'HATE_SPEECH':
        return { label: 'Hate Speech', color: 'bg-red-500/20 text-red-400' }
      case 'VIOLENCE':
        return { label: 'Violence', color: 'bg-red-500/20 text-red-400' }
      case 'SCAM':
        return { label: 'Scam', color: 'bg-yellow-500/20 text-yellow-400' }
      case 'OTHER':
        return { label: 'Other', color: 'bg-gray-500/20 text-gray-400' }
      default:
        return { label: type, color: 'bg-gray-500/20 text-gray-400' }
    }
  }

  // Get feedback status badge
  const getFeedbackStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock }
      case 'REVIEWED':
        return { label: 'Reviewed', color: 'bg-blue-500/20 text-blue-400', icon: Eye }
      case 'RESOLVED':
        return { label: 'Resolved', color: 'bg-green-500/20 text-green-400', icon: CheckCircle }
      case 'ARCHIVED':
        return { label: 'Archived', color: 'bg-gray-500/20 text-gray-400', icon: Archive }
      default:
        return { label: status, color: 'bg-gray-500/20 text-gray-400', icon: MessageCircleHeart }
    }
  }

  // Render star rating
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'
            }`}
          />
        ))}
      </div>
    )
  }

  const pendingReportsCount = reports.filter((r) => r.status === 'PENDING').length
  const pendingFeedbackCount = feedback.filter((f) => f.status === 'PENDING').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Moderation & Feedback</h1>
          <p className="text-gray-400 mt-1">
            Manage user reports and feedback
          </p>
        </div>
        <button
          onClick={() => activeTab === 'reports' ? fetchReports(true) : fetchFeedback(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'reports'
              ? 'text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <Flag className="w-4 h-4" />
            Reports
            {pendingReportsCount > 0 && (
              <span className="px-2 py-0.5 text-xs bg-red-500 rounded-full">{pendingReportsCount}</span>
            )}
          </span>
          {activeTab === 'reports' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'feedback'
              ? 'text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <MessageCircleHeart className="w-4 h-4" />
            Feedback
            {pendingFeedbackCount > 0 && (
              <span className="px-2 py-0.5 text-xs bg-yellow-500 text-black rounded-full">{pendingFeedbackCount}</span>
            )}
          </span>
          {activeTab === 'feedback' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
      </div>

      {/* Statistics Bar for Feedback */}
      {activeTab === 'feedback' && feedbackStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <p className="text-sm text-gray-400">Total Feedback</p>
            <p className="text-2xl font-bold text-white">{feedbackStats.total}</p>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <p className="text-sm text-gray-400">Average Rating</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-yellow-400">{feedbackStats.averageRating.toFixed(1)}</p>
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <p className="text-sm text-gray-400">Pending</p>
            <p className="text-2xl font-bold text-yellow-400">{feedbackStats.byStatus.PENDING || 0}</p>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <p className="text-sm text-gray-400">Resolved</p>
            <p className="text-2xl font-bold text-green-400">{feedbackStats.byStatus.RESOLVED || 0}</p>
          </div>
        </div>
      )}

      {/* Filters - Reports Tab */}
      {activeTab === 'reports' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex flex-wrap gap-4">
            <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="REVIEWING">Reviewing</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>

          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1) }}
            className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Types</option>
            <option value="SPAM">Spam</option>
            <option value="HARASSMENT">Harassment</option>
            <option value="INAPPROPRIATE">Inappropriate</option>
            <option value="HATE_SPEECH">Hate Speech</option>
            <option value="VIOLENCE">Violence</option>
            <option value="SCAM">Scam</option>
            <option value="OTHER">Other</option>
          </select>
          </div>
        </div>
      )}

      {/* Filters - Feedback Tab */}
      {activeTab === 'feedback' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex flex-wrap gap-4">
            <select
              value={feedbackStatus}
              onChange={(e) => { setFeedbackStatus(e.target.value); setFeedbackPage(1) }}
              className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="RESOLVED">Resolved</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <select
              value={feedbackRating}
              onChange={(e) => { setFeedbackRating(e.target.value); setFeedbackPage(1) }}
              className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </div>
      )}

      {/* Reports List */}
      {activeTab === 'reports' && (
        <>
      <div className="space-y-4">
        {reports.length > 0 ? (
          reports.map((report) => {
            const statusBadge = getStatusBadge(report.status)
            const typeBadge = getTypeBadge(report.type)
            const StatusIcon = statusBadge.icon

            return (
              <div
                key={report.id}
                className={`bg-gray-800 rounded-xl border p-6 ${
                  report.status === 'PENDING'
                    ? 'border-yellow-500/50'
                    : 'border-gray-700'
                }`}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-red-500/10">
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-1 rounded ${statusBadge.color}`}>
                          <StatusIcon className="w-3 h-3 inline mr-1" />
                          {statusBadge.label}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${typeBadge.color}`}>
                          {typeBadge.label}
                        </span>
                      </div>
                      <h3 className="text-lg font-medium text-white">{report.description || report.type}</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Reported {formatDate(report.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  {report.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setInvestigationReport(report)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm transition-colors flex items-center gap-1"
                      >
                        <Search className="w-3.5 h-3.5" />
                        Investigate
                      </button>
                      <button
                        onClick={() => handleAction('review', report.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
                      >
                        Review
                      </button>
                      <button
                        onClick={() => handleAction('resolve', report.id)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm transition-colors"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => handleAction('dismiss', report.id)}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {report.status === 'REVIEWING' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setInvestigationReport(report)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm transition-colors flex items-center gap-1"
                      >
                        <Search className="w-3.5 h-3.5" />
                        Investigate
                      </button>
                      <button
                        onClick={() => handleAction('resolve', report.id)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm transition-colors"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => handleAction('dismiss', report.id)}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>

                {/* Description */}
                {report.description && (
                  <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-300">{report.description}</p>
                  </div>
                )}

                {/* People Involved */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Reporter */}
                  <div className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                    <User className="w-4 h-4 text-gray-500" />
                    <div className="flex items-center gap-2">
                      {report.reporter.avatarUrl ? (
                        <Image
                          src={report.reporter.avatarUrl}
                          alt={report.reporter.name || report.reporter.email}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                          <span className="text-white text-xs">
                            {report.reporter.name?.charAt(0) || report.reporter.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-400">Reported by</p>
                        <p className="text-sm text-white">{report.reporter.name || report.reporter.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Reported User */}
                  {report.reportedUser && (
                    <div className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                      <Flag className="w-4 h-4 text-red-400" />
                      <div className="flex items-center gap-2">
                        {report.reportedUser.avatarUrl ? (
                          <Image
                            src={report.reportedUser.avatarUrl}
                            alt={report.reportedUser.name || report.reportedUser.email}
                            width={32}
                            height={32}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                            <span className="text-white text-xs">
                              {report.reportedUser.name?.charAt(0) || report.reportedUser.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-400">Reported user</p>
                          <p className="text-sm text-white">{report.reportedUser.name || report.reportedUser.email}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Resolution */}
                {report.resolution && (
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-xs text-green-400 mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Resolution
                    </p>
                    <p className="text-sm text-gray-300">{report.resolution}</p>
                    {report.handledBy && (
                      <p className="text-xs text-gray-500 mt-2">
                        Handled by {report.handledBy.name || report.handledBy.email}
                        {report.handledAt && ` on ${formatDate(report.handledAt)}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No reports found</p>
          </div>
        )}
      </div>

      {/* Pagination - Reports */}
      {reportsPagination && reportsPagination.pages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-gray-800 rounded-xl border border-gray-700">
          <p className="text-sm text-gray-400">
            Page {reportsPagination.currentPage} of {reportsPagination.pages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setPage(Math.min(reportsPagination.pages, page + 1))}
              disabled={page === reportsPagination.pages}
              className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      </>
      )}

      {/* Feedback List */}
      {activeTab === 'feedback' && (
        <>
        <div className="space-y-4">
          {feedback.length > 0 ? (
            feedback.map((fb) => {
              const statusBadge = getFeedbackStatusBadge(fb.status)
              const StatusIcon = statusBadge.icon

              return (
                <div
                  key={fb.id}
                  className={`bg-gray-800 rounded-xl border p-6 ${
                    fb.status === 'PENDING'
                      ? 'border-yellow-500/50'
                      : 'border-gray-700'
                  }`}
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-emerald-500/10">
                        <MessageCircleHeart className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-1 rounded ${statusBadge.color}`}>
                            <StatusIcon className="w-3 h-3 inline mr-1" />
                            {statusBadge.label}
                          </span>
                          {renderStars(fb.rating)}
                        </div>
                        <p className="text-sm text-gray-400 mt-1">
                          Submitted {formatDate(fb.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    {fb.status === 'PENDING' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleFeedbackAction('review', fb.id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => handleFeedbackAction('resolve', fb.id)}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm transition-colors"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => handleFeedbackAction('archive', fb.id)}
                          className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm transition-colors"
                        >
                          Archive
                        </button>
                      </div>
                    )}

                    {fb.status === 'REVIEWED' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleFeedbackAction('resolve', fb.id)}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm transition-colors"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => handleFeedbackAction('archive', fb.id)}
                          className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm transition-colors"
                        >
                          Archive
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Message */}
                  <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{fb.message}</p>
                  </div>

                  {/* Images */}
                  {fb.screenshots && fb.screenshots.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-400 mb-2">Images ({fb.screenshots.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {fb.screenshots.map((url, index) => (
                          <a
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-20 h-20 rounded-lg overflow-hidden border border-gray-600 hover:border-gray-500 transition-colors"
                          >
                            <img
                              src={url}
                              alt={`Image ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User Info */}
                  <div className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                    <User className="w-4 h-4 text-gray-500" />
                    <div className="flex items-center gap-2">
                      {fb.user.avatarUrl ? (
                        <Image
                          src={fb.user.avatarUrl}
                          alt={fb.user.name || fb.user.email}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                          <span className="text-white text-xs">
                            {fb.user.name?.charAt(0) || fb.user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-400">Submitted by</p>
                        <p className="text-sm text-white">{fb.user.name || fb.user.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Admin Notes */}
                  {fb.adminNotes && (
                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-xs text-blue-400 mb-1 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Admin Notes
                      </p>
                      <p className="text-sm text-gray-300">{fb.adminNotes}</p>
                      {fb.reviewedBy && (
                        <p className="text-xs text-gray-500 mt-2">
                          By {fb.reviewedBy.name || fb.reviewedBy.email}
                          {fb.reviewedAt && ` on ${formatDate(fb.reviewedAt)}`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
              <MessageCircleHeart className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No feedback found</p>
            </div>
          )}
        </div>

        {/* Pagination - Feedback */}
        {feedbackPagination && feedbackPagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-gray-800 rounded-xl border border-gray-700">
            <p className="text-sm text-gray-400">
              Page {feedbackPagination.currentPage} of {feedbackPagination.pages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFeedbackPage(Math.max(1, feedbackPage - 1))}
                disabled={feedbackPage === 1}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setFeedbackPage(Math.min(feedbackPagination.pages, feedbackPage + 1))}
                disabled={feedbackPage === feedbackPagination.pages}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {/* Action Modal - Reports */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                {actionModal.action === 'resolve' ? 'Resolve Report' : 'Dismiss Report'}
              </h2>
              <button
                onClick={() => setActionModal(null)}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resolution Notes */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Resolution Notes
              </label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Enter resolution notes..."
                rows={3}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Ban User Option (for resolve) */}
            {actionModal.action === 'resolve' && actionModal.report.reportedUser && (
              <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={banUser}
                    onChange={(e) => setBanUser(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-sm text-white flex items-center gap-2">
                    <Ban className="w-4 h-4 text-red-400" />
                    Ban reported user
                  </span>
                </label>

                {banUser && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Ban Duration</label>
                      <select
                        value={banDuration || ''}
                        onChange={(e) => setBanDuration(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
                      >
                        <option value="">Permanent</option>
                        <option value="1">1 day</option>
                        <option value="7">7 days</option>
                        <option value="30">30 days</option>
                        <option value="90">90 days</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Ban Reason</label>
                      <input
                        type="text"
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        placeholder="Reason for ban..."
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setActionModal(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 ${
                  actionModal.action === 'resolve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {actionModal.action === 'resolve' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {actionModal.action === 'resolve' ? 'Resolve' : 'Dismiss'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal - Feedback */}
      {feedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                {feedbackModal.action === 'review' ? 'Review Feedback' :
                 feedbackModal.action === 'resolve' ? 'Resolve Feedback' : 'Archive Feedback'}
              </h2>
              <button
                onClick={() => setFeedbackModal(null)}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Feedback Preview */}
            <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {renderStars(feedbackModal.feedback.rating)}
              </div>
              <p className="text-sm text-gray-300 line-clamp-3">{feedbackModal.feedback.message}</p>
            </div>

            {/* Admin Notes */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Admin Notes
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes about this feedback..."
                rows={3}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setFeedbackModal(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitFeedbackAction}
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 ${
                  feedbackModal.action === 'resolve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : feedbackModal.action === 'review'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-600 hover:bg-gray-500'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {feedbackModal.action === 'resolve' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : feedbackModal.action === 'review' ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <Archive className="w-4 h-4" />
                    )}
                    {feedbackModal.action === 'resolve' ? 'Resolve' :
                     feedbackModal.action === 'review' ? 'Mark as Reviewed' : 'Archive'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Investigation Panel */}
      {investigationReport && (
        <InvestigationPanel
          reportId={investigationReport.id}
          reportType={investigationReport.type}
          onClose={() => setInvestigationReport(null)}
          onAction={(action) => {
            // Handle actions from investigation panel
            if (action === 'dismiss') {
              setActionModal({ report: investigationReport, action: 'dismiss' })
            } else if (action === 'resolve') {
              setActionModal({ report: investigationReport, action: 'resolve' })
            } else if (action === 'warn' || action === 'ban') {
              // For warn/ban, set up the resolve modal with ban options pre-selected
              setActionModal({ report: investigationReport, action: 'resolve' })
              if (action === 'ban') {
                setBanUser(true)
              }
            }
            setInvestigationReport(null)
          }}
        />
      )}
    </div>
  )
}
