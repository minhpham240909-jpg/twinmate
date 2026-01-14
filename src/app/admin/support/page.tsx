'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  RefreshCw,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  User,
  MessageSquare,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type HelpMessageStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
type HelpMessagePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

interface HelpMessage {
  id: string
  name: string
  email: string
  subject: string
  message: string
  category: string | null
  priority: HelpMessagePriority
  status: HelpMessageStatus
  assignedToId: string | null
  resolvedById: string | null
  resolvedAt: string | null
  adminNotes: string | null
  responseCount: number
  lastResponseAt: string | null
  createdAt: string
  updatedAt: string
  userId: string | null
}

interface Counts {
  pending: number
  inProgress: number
  resolved: number
  closed: number
  total: number
}

const statusConfig: Record<HelpMessageStatus, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: RefreshCw },
  RESOLVED: { label: 'Resolved', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  CLOSED: { label: 'Closed', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: XCircle },
}

const priorityConfig: Record<HelpMessagePriority, { label: string; color: string }> = {
  LOW: { label: 'Low', color: 'bg-gray-500/20 text-gray-400' },
  NORMAL: { label: 'Normal', color: 'bg-blue-500/20 text-blue-400' },
  HIGH: { label: 'High', color: 'bg-orange-500/20 text-orange-400' },
  URGENT: { label: 'Urgent', color: 'bg-red-500/20 text-red-400' },
}

export default function AdminSupportPage() {
  const [messages, setMessages] = useState<HelpMessage[]>([])
  const [counts, setCounts] = useState<Counts>({ pending: 0, inProgress: 0, resolved: 0, closed: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<HelpMessageStatus | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<HelpMessagePriority | ''>('')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Selected message for detail view
  const [selectedMessage, setSelectedMessage] = useState<HelpMessage | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Action states
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (statusFilter) params.set('status', statusFilter)
      if (priorityFilter) params.set('priority', priorityFilter)
      if (searchQuery) params.set('search', searchQuery)

      const response = await fetch(`/api/admin/help?${params}`)
      if (!response.ok) throw new Error('Failed to fetch messages')

      const data = await response.json()
      setMessages(data.messages)
      setCounts(data.counts)
      setTotalPages(data.pagination.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, priorityFilter, searchQuery])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const handleStatusChange = async (messageId: string, newStatus: HelpMessageStatus) => {
    setUpdating(true)
    try {
      const response = await fetch('/api/admin/help', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: messageId, status: newStatus }),
      })
      if (!response.ok) throw new Error('Failed to update status')
      await fetchMessages()
      if (selectedMessage?.id === messageId) {
        setSelectedMessage(prev => prev ? { ...prev, status: newStatus } : null)
      }
    } catch (err) {
      console.error('Error updating status:', err)
    } finally {
      setUpdating(false)
    }
  }

  const handlePriorityChange = async (messageId: string, newPriority: HelpMessagePriority) => {
    setUpdating(true)
    try {
      const response = await fetch('/api/admin/help', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: messageId, priority: newPriority }),
      })
      if (!response.ok) throw new Error('Failed to update priority')
      await fetchMessages()
      if (selectedMessage?.id === messageId) {
        setSelectedMessage(prev => prev ? { ...prev, priority: newPriority } : null)
      }
    } catch (err) {
      console.error('Error updating priority:', err)
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return

    setDeleting(messageId)
    try {
      const response = await fetch(`/api/admin/help?id=${messageId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete message')
      await fetchMessages()
      if (selectedMessage?.id === messageId) {
        setShowDetailModal(false)
        setSelectedMessage(null)
      }
    } catch (err) {
      console.error('Error deleting message:', err)
    } finally {
      setDeleting(null)
    }
  }

  const openDetail = (message: HelpMessage) => {
    setSelectedMessage(message)
    setShowDetailModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Support Tickets</h1>
          <p className="text-gray-400 mt-1">Manage user help requests and support messages</p>
        </div>
        <button
          onClick={fetchMessages}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-2xl font-bold text-white">{counts.total}</div>
          <div className="text-sm text-gray-400">Total</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-yellow-500/30">
          <div className="text-2xl font-bold text-yellow-400">{counts.pending}</div>
          <div className="text-sm text-gray-400">Pending</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-blue-500/30">
          <div className="text-2xl font-bold text-blue-400">{counts.inProgress}</div>
          <div className="text-sm text-gray-400">In Progress</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-green-500/30">
          <div className="text-2xl font-bold text-green-400">{counts.resolved}</div>
          <div className="text-sm text-gray-400">Resolved</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-600">
          <div className="text-2xl font-bold text-gray-400">{counts.closed}</div>
          <div className="text-sm text-gray-400">Closed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as HelpMessageStatus | ''); setPage(1) }}
            className="appearance-none pl-9 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Priority Filter */}
        <div className="relative">
          <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value as HelpMessagePriority | ''); setPage(1) }}
            className="appearance-none pl-9 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
          >
            <option value="">All Priority</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
          <button onClick={fetchMessages} className="ml-auto text-red-400 hover:text-red-300 underline">
            Retry
          </button>
        </div>
      )}

      {/* Messages Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
            <p>No support tickets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {messages.map((msg) => {
                  const StatusIcon = statusConfig[msg.status].icon
                  return (
                    <tr
                      key={msg.id}
                      className="hover:bg-gray-700/50 cursor-pointer transition-colors"
                      onClick={() => openDetail(msg)}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-400" />
                          </div>
                          <div>
                            <div className="font-medium text-white">{msg.name}</div>
                            <div className="text-sm text-gray-400">{msg.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-white font-medium truncate max-w-xs">{msg.subject}</div>
                        {msg.category && (
                          <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                            {msg.category}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig[msg.status].color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig[msg.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityConfig[msg.priority].color}`}>
                          {priorityConfig[msg.priority].label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-400">
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={`mailto:${msg.email}?subject=Re: ${msg.subject}`}
                            className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                            title="Reply via Email"
                          >
                            <Mail className="w-4 h-4 text-gray-400" />
                          </a>
                          <button
                            onClick={() => handleDelete(msg.id)}
                            disabled={deleting === msg.id}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className={`w-4 h-4 text-red-400 ${deleting === msg.id ? 'animate-pulse' : ''}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
            <div className="text-sm text-gray-400">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gray-800 px-6 py-4 border-b border-gray-700 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedMessage.subject}</h2>
                <p className="text-sm text-gray-400 mt-1">
                  From {selectedMessage.name} ({selectedMessage.email})
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-6">
              {/* Status and Priority Controls */}
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                  <select
                    value={selectedMessage.status}
                    onChange={(e) => handleStatusChange(selectedMessage.id, e.target.value as HelpMessageStatus)}
                    disabled={updating}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Priority</label>
                  <select
                    value={selectedMessage.priority}
                    onChange={(e) => handlePriorityChange(selectedMessage.id, e.target.value as HelpMessagePriority)}
                    disabled={updating}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Message Content */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Message</label>
                <div className="bg-gray-900 rounded-lg p-4 text-gray-300 whitespace-pre-wrap">
                  {selectedMessage.message}
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Category:</span>
                  <span className="text-white ml-2">{selectedMessage.category || 'None'}</span>
                </div>
                <div>
                  <span className="text-gray-400">User ID:</span>
                  <span className="text-white ml-2">{selectedMessage.userId || 'Not logged in'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Created:</span>
                  <span className="text-white ml-2">
                    {new Date(selectedMessage.createdAt).toLocaleString()}
                  </span>
                </div>
                {selectedMessage.resolvedAt && (
                  <div>
                    <span className="text-gray-400">Resolved:</span>
                    <span className="text-white ml-2">
                      {new Date(selectedMessage.resolvedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
                <a
                  href={`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject}`}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Reply via Email
                  <ExternalLink className="w-3 h-3" />
                </a>
                {selectedMessage.userId && (
                  <a
                    href={`/admin/users/${selectedMessage.userId}`}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                  >
                    <User className="w-4 h-4" />
                    View User
                  </a>
                )}
                <button
                  onClick={() => handleDelete(selectedMessage.id)}
                  disabled={deleting === selectedMessage.id}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-red-400 transition-colors disabled:opacity-50 ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
