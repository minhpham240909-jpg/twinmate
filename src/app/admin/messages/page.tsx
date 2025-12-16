'use client'

// Admin Messages Page
// CEO Control Panel - Message Moderation and Monitoring

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  MessageSquare,
  Users,
  Shield,
  AlertTriangle,
  Search,
  RefreshCw,
  Eye,
  Trash2,
  AlertCircle,
  Ban,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

interface Message {
  id: string
  contentId?: string
  type: string
  content: string
  senderId: string
  senderEmail: string | null
  senderName: string | null
  senderAvatar?: string | null
  conversationId: string | null
  conversationType: string | null
  groupName?: string
  sessionTitle?: string
  flagReason?: string
  aiCategories?: Record<string, any>
  aiScore?: number
  status?: string
  reviewedById?: string
  reviewedAt?: string
  actionTaken?: string
  createdAt: string
  isFlagged: boolean
}

interface Stats {
  pendingFlagged: number
  totalFlagged: number
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filters
  const [messageType, setMessageType] = useState('flagged')
  const [searchInput, setSearchInput] = useState('') // What user types (immediate)
  const [searchQuery, setSearchQuery] = useState('') // Debounced value (triggers API)
  const [statusFilter, setStatusFilter] = useState('pending')
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Selected message for detail view
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [isActioning, setIsActioning] = useState(false)

  const fetchMessages = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        type: messageType,
        page: page.toString(),
        limit: '20',
      })

      if (searchQuery) params.set('search', searchQuery)
      if (messageType === 'flagged' && statusFilter) {
        params.set('status', statusFilter)
      }

      const response = await fetch(`/api/admin/messages?${params}`)
      const data = await response.json()

      if (data.success) {
        setMessages(data.data.messages)
        setStats(data.data.stats)
        setTotalPages(data.data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [messageType, searchQuery, statusFilter, page])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [messageType, searchQuery, statusFilter])

  // Debounce search input - wait 500ms after user stops typing
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new timer - only update searchQuery after 500ms of no typing
    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 500)

    // Cleanup on unmount or when searchInput changes
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchInput])

  // Handle search on Enter key press (immediate search)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Clear debounce timer and search immediately
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      setSearchQuery(searchInput)
    }
  }

  const handleModerateAction = async (action: string, notes?: string) => {
    if (!selectedMessage || !selectedMessage.id) return

    setIsActioning(true)
    try {
      const response = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flaggedId: selectedMessage.id,
          action,
          notes,
        }),
      })

      const data = await response.json()
      if (data.success) {
        // Refresh messages
        fetchMessages(true)
        setSelectedMessage(null)
      } else {
        alert('Failed to moderate: ' + data.error)
      }
    } catch (error) {
      console.error('Moderation error:', error)
      alert('Failed to moderate message')
    } finally {
      setIsActioning(false)
    }
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'DIRECT_MESSAGE':
        return 'bg-blue-500/20 text-blue-400'
      case 'GROUP_MESSAGE':
        return 'bg-purple-500/20 text-purple-400'
      case 'SESSION_MESSAGE':
        return 'bg-green-500/20 text-green-400'
      case 'POST':
        return 'bg-orange-500/20 text-orange-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-500/20 text-yellow-400'
      case 'APPROVED':
        return 'bg-green-500/20 text-green-400'
      case 'REMOVED':
        return 'bg-red-500/20 text-red-400'
      case 'WARNING':
        return 'bg-orange-500/20 text-orange-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  const getFlagReasonLabel = (reason: string) => {
    switch (reason) {
      case 'AI_DETECTED':
        return 'AI Detected'
      case 'KEYWORD_MATCH':
        return 'Keyword Match'
      case 'USER_REPORTED':
        return 'User Reported'
      case 'MANUAL_REVIEW':
        return 'Manual Review'
      default:
        return reason
    }
  }

  const getAICategoryLabel = (categories: Record<string, any>) => {
    if (!categories) return ''
    const flagged = Object.entries(categories)
      .filter(([key, value]) => value === true && key !== 'keyword_match')
      .map(([key]) => key.replace(/[/_]/g, ' '))
    return flagged.join(', ')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Message Moderation</h1>
          <p className="text-gray-400 mt-1">
            Monitor and moderate all platform messages
          </p>
        </div>
        <button
          onClick={() => fetchMessages(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{stats?.pendingFlagged || 0}</p>
              <p className="text-sm text-gray-400">Pending Review</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500 rounded-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{stats?.totalFlagged || 0}</p>
              <p className="text-sm text-gray-400">Total Flagged</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-400">{messages.length}</p>
              <p className="text-sm text-gray-400">Showing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Message Type Filter */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            {[
              { key: 'flagged', label: 'Flagged', icon: AlertTriangle },
              { key: 'all', label: 'All', icon: MessageSquare },
              { key: 'dm', label: 'DMs', icon: Users },
              { key: 'group', label: 'Groups', icon: Users },
              { key: 'session', label: 'Sessions', icon: MessageSquare },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMessageType(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  messageType === key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Status Filter (only for flagged) */}
          {messageType === 'flagged' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="removed">Removed</option>
              <option value="warning">Warning</option>
            </select>
          )}

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search messages, users... (press Enter to search)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500"
            />
            {searchInput !== searchQuery && searchInput && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {messages.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No messages found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {messages.map((message) => (
              <div
                key={message.id}
                className="p-4 hover:bg-gray-700/50 transition-colors cursor-pointer"
                onClick={() => setSelectedMessage(message)}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {message.senderAvatar ? (
                      <Image
                        src={message.senderAvatar}
                        alt={message.senderName || 'User'}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {message.senderName?.charAt(0) || message.senderEmail?.charAt(0) || '?'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">
                        {message.senderName || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-500">{message.senderEmail}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(message.type)}`}>
                        {message.type.replace('_', ' ')}
                      </span>
                      {message.isFlagged && message.status && (
                        <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(message.status)}`}>
                          {message.status}
                        </span>
                      )}
                    </div>

                    <p className="text-gray-300 text-sm line-clamp-2">{message.content}</p>

                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(message.createdAt)}
                      </span>
                      {message.conversationType && (
                        <span>
                          {message.conversationType === 'group' && message.groupName
                            ? `Group: ${message.groupName}`
                            : message.conversationType === 'session' && message.sessionTitle
                            ? `Session: ${message.sessionTitle}`
                            : `Partner Chat`}
                        </span>
                      )}
                      {message.flagReason && (
                        <span className="text-yellow-400">
                          {getFlagReasonLabel(message.flagReason)}
                        </span>
                      )}
                      {message.aiScore && (
                        <span className="text-red-400">
                          Score: {(message.aiScore * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex-shrink-0">
                    <Eye className="w-5 h-5 text-gray-500" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-700">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white disabled:opacity-50"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Message Details</h3>
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {/* Sender Info */}
              <Link
                href={`/admin/users/${selectedMessage.senderId}`}
                className="flex items-center gap-4 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors group"
              >
                {selectedMessage.senderAvatar ? (
                  <Image
                    src={selectedMessage.senderAvatar}
                    alt={selectedMessage.senderName || 'User'}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
                    <span className="text-white font-medium text-lg">
                      {selectedMessage.senderName?.charAt(0) || '?'}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-white group-hover:text-blue-400 transition-colors">{selectedMessage.senderName || 'Unknown'}</p>
                  <p className="text-sm text-gray-400">{selectedMessage.senderEmail}</p>
                  <p className="text-xs text-gray-500">ID: {selectedMessage.senderId}</p>
                </div>
                <Eye className="w-5 h-5 text-gray-500 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>

              {/* Message Content */}
              <div className="p-4 bg-gray-900 rounded-lg">
                <p className="text-gray-300 whitespace-pre-wrap">{selectedMessage.content}</p>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <p className="text-gray-400">Type</p>
                  <p className="text-white">{selectedMessage.type.replace('_', ' ')}</p>
                </div>
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <p className="text-gray-400">Sent At</p>
                  <p className="text-white">{formatDate(selectedMessage.createdAt)}</p>
                </div>
                {selectedMessage.conversationType && (
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <p className="text-gray-400">Conversation</p>
                    <p className="text-white">
                      {selectedMessage.groupName ||
                        selectedMessage.sessionTitle ||
                        `Partner (${selectedMessage.conversationId?.slice(0, 8)}...)`}
                    </p>
                  </div>
                )}
                {selectedMessage.flagReason && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-400">Flag Reason</p>
                    <p className="text-white">{getFlagReasonLabel(selectedMessage.flagReason)}</p>
                  </div>
                )}
              </div>

              {/* AI Detection Details */}
              {selectedMessage.aiCategories && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <h4 className="font-medium text-red-400 mb-2">AI Detection Details</h4>
                  <p className="text-sm text-gray-300">
                    Categories: {getAICategoryLabel(selectedMessage.aiCategories) || 'None'}
                  </p>
                  {selectedMessage.aiScore && (
                    <p className="text-sm text-gray-300 mt-1">
                      Confidence: {(selectedMessage.aiScore * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons (only for flagged pending messages) */}
              {selectedMessage.isFlagged && selectedMessage.status === 'PENDING' && (
                <div className="flex gap-3 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => handleModerateAction('approve')}
                    disabled={isActioning}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleModerateAction('warn', 'Content flagged for review')}
                    disabled={isActioning}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                  >
                    <AlertCircle className="w-5 h-5" />
                    Warn User
                  </button>
                  <button
                    onClick={() => handleModerateAction('remove', 'Content removed for violation')}
                    disabled={isActioning}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-5 h-5" />
                    Remove
                  </button>
                  <button
                    onClick={() => handleModerateAction('ban', 'User banned for severe violation')}
                    disabled={isActioning}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 hover:bg-black rounded-lg text-red-400 font-medium transition-colors disabled:opacity-50 border border-red-500/50"
                  >
                    <Ban className="w-5 h-5" />
                    Ban
                  </button>
                </div>
              )}

              {/* Status for already moderated */}
              {selectedMessage.isFlagged && selectedMessage.status !== 'PENDING' && (
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-400">
                    Status: <span className={getStatusColor(selectedMessage.status || '')}>{selectedMessage.status}</span>
                  </p>
                  {selectedMessage.actionTaken && (
                    <p className="text-sm text-gray-400 mt-1">
                      Action Taken: {selectedMessage.actionTaken}
                    </p>
                  )}
                  {selectedMessage.reviewedAt && (
                    <p className="text-sm text-gray-400 mt-1">
                      Reviewed: {formatDate(selectedMessage.reviewedAt)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
