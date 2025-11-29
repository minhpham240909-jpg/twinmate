'use client'

// Admin Audit Log Page
// CEO Control Panel - View All Admin Actions

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import {
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  User,
  Shield,
  Ban,
  AlertTriangle,
  Megaphone,
  Eye,
  Globe,
  Activity,
} from 'lucide-react'

interface AuditLog {
  id: string
  adminId: string
  action: string
  targetType: string
  targetId: string
  details: Record<string, any>
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  admin: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
  }
}

interface Pagination {
  total: number
  pages: number
  currentPage: number
  limit: number
}

interface Filters {
  admins: { id: string; name: string }[]
  actions: string[]
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [filters, setFilters] = useState<Filters | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filter state
  const [selectedAdmin, setSelectedAdmin] = useState('')
  const [selectedAction, setSelectedAction] = useState('')
  const [page, setPage] = useState(1)

  // Fetch logs
  const fetchLogs = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(selectedAdmin && { adminId: selectedAdmin }),
        ...(selectedAction && { action: selectedAction }),
      })

      const response = await fetch(`/api/admin/audit?${params}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.data.logs)
        setPagination(data.data.pagination)
        if (!filters) {
          setFilters(data.data.filters)
        }
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [page, selectedAdmin, selectedAction, filters])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // Get action icon and color
  const getActionStyle = (action: string) => {
    const styles: Record<string, { icon: any; color: string; bg: string }> = {
      user_banned: { icon: Ban, color: 'text-red-400', bg: 'bg-red-500/10' },
      user_unbanned: { icon: User, color: 'text-green-400', bg: 'bg-green-500/10' },
      user_warned: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
      user_deactivated: { icon: User, color: 'text-orange-400', bg: 'bg-orange-500/10' },
      user_reactivated: { icon: User, color: 'text-green-400', bg: 'bg-green-500/10' },
      admin_granted: { icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      admin_revoked: { icon: Shield, color: 'text-red-400', bg: 'bg-red-500/10' },
      report_reviewing: { icon: Eye, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      report_resolved: { icon: FileText, color: 'text-green-400', bg: 'bg-green-500/10' },
      report_dismissed: { icon: FileText, color: 'text-gray-400', bg: 'bg-gray-500/10' },
      announcement_created: { icon: Megaphone, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      announcement_updated: { icon: Megaphone, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
      announcement_published: { icon: Megaphone, color: 'text-green-400', bg: 'bg-green-500/10' },
      announcement_archived: { icon: Megaphone, color: 'text-gray-400', bg: 'bg-gray-500/10' },
      announcement_deleted: { icon: Megaphone, color: 'text-red-400', bg: 'bg-red-500/10' },
    }

    return styles[action] || { icon: Activity, color: 'text-gray-400', bg: 'bg-gray-500/10' }
  }

  // Format action name
  const formatAction = (action: string): string => {
    return action
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Skeleton for audit log rows
  const AuditRowSkeleton = () => (
    <div className="p-4 animate-pulse flex items-start gap-4">
      <div className="w-10 h-10 bg-gray-700 rounded-lg" />
      <div className="flex-1">
        <div className="h-4 w-32 bg-gray-700 rounded mb-2" />
        <div className="h-3 w-48 bg-gray-700 rounded" />
      </div>
      <div className="h-4 w-24 bg-gray-700 rounded" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-gray-400 mt-1">
            {pagination?.total || 0} total admin actions recorded
          </p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={selectedAdmin}
            onChange={(e) => { setSelectedAdmin(e.target.value); setPage(1) }}
            className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Admins</option>
            {filters?.admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name}
              </option>
            ))}
          </select>

          <select
            value={selectedAction}
            onChange={(e) => { setSelectedAction(e.target.value); setPage(1) }}
            className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Actions</option>
            {filters?.actions.map((action) => (
              <option key={action} value={action}>
                {formatAction(action)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden relative">
        {/* Subtle loading overlay when refreshing */}
        {isRefreshing && logs.length > 0 && (
          <div className="absolute inset-0 bg-gray-900/30 z-10 flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-300">Updating...</span>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-700">
          {isLoading && logs.length === 0 ? (
            // Show skeletons on first load
            [1, 2, 3, 4, 5, 6].map((i) => <AuditRowSkeleton key={i} />)
          ) : logs.length > 0 ? (
            logs.map((log) => {
              const actionStyle = getActionStyle(log.action)
              const ActionIcon = actionStyle.icon

              return (
                <div key={log.id} className="p-4 hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Action Icon */}
                    <div className={`p-2 rounded-lg ${actionStyle.bg}`}>
                      <ActionIcon className={`w-5 h-5 ${actionStyle.color}`} />
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium ${actionStyle.color}`}>
                          {formatAction(log.action)}
                        </span>
                        <span className="text-gray-500">on</span>
                        <span className="text-white">
                          {log.targetType}: {log.targetId.slice(0, 8)}...
                        </span>
                      </div>

                      {/* Admin Info */}
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        {log.admin.avatarUrl ? (
                          <Image
                            src={log.admin.avatarUrl}
                            alt={log.admin.name || log.admin.email}
                            width={20}
                            height={20}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center">
                            <span className="text-white text-xs">
                              {log.admin.name?.charAt(0) || log.admin.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span>by {log.admin.name || log.admin.email}</span>
                      </div>

                      {/* Details */}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="mt-2 text-sm text-gray-500">
                          {Object.entries(log.details).map(([key, value]) => (
                            <span key={key} className="mr-3">
                              <span className="text-gray-600">{key}:</span>{' '}
                              <span className="text-gray-400">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(log.createdAt)}
                      </p>
                      {log.ipAddress && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {log.ipAddress}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No audit logs found</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              Page {pagination.currentPage} of {pagination.pages}
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
                onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                disabled={page === pagination.pages}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
