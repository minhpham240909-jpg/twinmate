'use client'

// Admin Users Management Page
// CEO Control Panel - Full User Management with Search, Filter, and Actions

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Ban,
  AlertTriangle,
  Shield,
  ShieldOff,
  UserX,
  UserCheck,
  Calendar,
  Clock,
  Crown,
  X,
  Check,
  RefreshCw,
  Eye,
} from 'lucide-react'

interface UserData {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  role: string
  isAdmin: boolean
  emailVerified: boolean
  createdAt: string
  lastLoginAt: string | null
  deactivatedAt: string | null
  deactivationReason: string | null
  twoFactorEnabled: boolean
  signupMethod: string
  ban: {
    type: string
    expiresAt: string | null
  } | null
  _count: {
    sentMessages: number
    posts: number
    groupMemberships: number
    studySessions: number
  }
}

interface Pagination {
  total: number
  pages: number
  currentPage: number
  limit: number
}

type ActionType = 'ban' | 'unban' | 'warn' | 'deactivate' | 'reactivate' | 'grant_admin' | 'revoke_admin'

export default function AdminUsersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // State
  const [users, setUsers] = useState<UserData[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [role, setRole] = useState(searchParams.get('role') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt')
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc')
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'))

  // Action modal state
  const [actionModal, setActionModal] = useState<{
    user: UserData
    action: ActionType
  } | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [banDuration, setBanDuration] = useState<number | null>(null)
  const [warningSeverity, setWarningSeverity] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Fetch users
  const fetchUsers = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(role && { role }),
        ...(status && { status }),
        sortBy,
        sortOrder,
      })

      const response = await fetch(`/api/admin/users?${params}`)
      const data = await response.json()

      if (data.success) {
        setUsers(data.data.users)
        setPagination(data.data.pagination)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [page, search, role, status, sortBy, sortOrder])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (role) params.set('role', role)
    if (status) params.set('status', status)
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy)
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder)
    if (page > 1) params.set('page', page.toString())

    const queryString = params.toString()
    router.replace(`/admin/users${queryString ? `?${queryString}` : ''}`, { scroll: false })
  }, [search, role, status, sortBy, sortOrder, page, router])

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchUsers()
  }

  // Handle action
  const handleAction = async () => {
    if (!actionModal) return

    setIsSubmitting(true)

    try {
      const body: Record<string, any> = {
        action: actionModal.action,
        userId: actionModal.user.id,
        reason: actionReason,
      }

      if (actionModal.action === 'ban' && banDuration) {
        body.duration = banDuration
      }

      if (actionModal.action === 'warn') {
        body.severity = warningSeverity
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh users list
        fetchUsers(true)
        // Close modal
        setActionModal(null)
        setActionReason('')
        setBanDuration(null)
        setWarningSeverity(1)
      } else {
        alert(data.error || 'Action failed')
      }
    } catch (error) {
      console.error('Error performing action:', error)
      alert('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Format date
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Get user status badge
  const getUserStatus = (user: UserData) => {
    if (user.ban) {
      return {
        label: user.ban.type === 'PERMANENT' ? 'Banned' : 'Temp Ban',
        color: 'bg-red-500/20 text-red-400',
      }
    }
    if (user.deactivatedAt) {
      return { label: 'Deactivated', color: 'bg-gray-500/20 text-gray-400' }
    }
    return { label: 'Active', color: 'bg-green-500/20 text-green-400' }
  }

  // Get action options for user
  const getActionOptions = (user: UserData): { action: ActionType; label: string; icon: any; color: string }[] => {
    const actions: { action: ActionType; label: string; icon: any; color: string }[] = []

    if (user.ban) {
      actions.push({ action: 'unban', label: 'Remove Ban', icon: UserCheck, color: 'text-green-400' })
    } else {
      actions.push({ action: 'ban', label: 'Ban User', icon: Ban, color: 'text-red-400' })
    }

    actions.push({ action: 'warn', label: 'Issue Warning', icon: AlertTriangle, color: 'text-yellow-400' })

    if (user.deactivatedAt) {
      actions.push({ action: 'reactivate', label: 'Reactivate', icon: UserCheck, color: 'text-green-400' })
    } else {
      actions.push({ action: 'deactivate', label: 'Deactivate', icon: UserX, color: 'text-orange-400' })
    }

    if (user.isAdmin) {
      actions.push({ action: 'revoke_admin', label: 'Revoke Admin', icon: ShieldOff, color: 'text-red-400' })
    } else {
      actions.push({ action: 'grant_admin', label: 'Grant Admin', icon: Shield, color: 'text-blue-400' })
    }

    return actions
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-gray-400 mt-1">
            {pagination?.total || 0} total users
          </p>
        </div>
        <button
          onClick={() => fetchUsers(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email or name..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={role}
              onChange={(e) => { setRole(e.target.value); setPage(1) }}
              className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Roles</option>
              <option value="FREE">Free</option>
              <option value="PREMIUM">Premium</option>
            </select>

            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="deactivated">Deactivated</option>
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-')
                setSortBy(newSortBy)
                setSortOrder(newSortOrder)
                setPage(1)
              }}
              className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="lastLoginAt-desc">Recently Active</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
            </select>

            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-300">User</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-300">Status</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-300">Role</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-300">Activity</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-300">Joined</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {users.length > 0 ? (
                users.map((user) => {
                  const userStatus = getUserStatus(user)
                  return (
                    <tr key={user.id} className="hover:bg-gray-700/30 transition-colors">
                      {/* User Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.avatarUrl ? (
                            <Image
                              src={user.avatarUrl}
                              alt={user.name || user.email}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                              <span className="text-white font-medium">
                                {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white">
                                {user.name || 'No name'}
                              </p>
                              {user.isAdmin && (
                                <span title="Admin">
                                  <Shield className="w-4 h-4 text-blue-400" />
                                </span>
                              )}
                              {user.twoFactorEnabled && (
                                <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                                  2FA
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">{user.email}</p>
                            <p className="text-xs text-gray-500">
                              via {user.signupMethod}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded ${userStatus.color}`}>
                          {userStatus.label}
                        </span>
                        {user.ban?.expiresAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            Until {formatDate(user.ban.expiresAt)}
                          </p>
                        )}
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          {user.role === 'PREMIUM' && (
                            <Crown className="w-4 h-4 text-yellow-400" />
                          )}
                          <span className={`text-sm ${
                            user.role === 'PREMIUM' ? 'text-yellow-400' : 'text-gray-400'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                      </td>

                      {/* Activity */}
                      <td className="px-6 py-4">
                        <div className="text-xs text-gray-400 space-y-0.5">
                          <p>{user._count.sentMessages} messages</p>
                          <p>{user._count.groupMemberships} groups</p>
                          <p>{user._count.studySessions} sessions</p>
                        </div>
                      </td>

                      {/* Joined */}
                      <td className="px-6 py-4">
                        <div className="text-xs text-gray-400">
                          <p className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(user.createdAt)}
                          </p>
                          <p className="flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" />
                            Last: {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                          </p>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === user.id ? null : user.id)}
                            className="p-2 rounded-lg hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>

                          {/* Dropdown Menu */}
                          {openDropdown === user.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setOpenDropdown(null)}
                              />
                              <div className="absolute right-0 mt-2 w-48 bg-gray-700 rounded-lg shadow-lg border border-gray-600 z-20">
                                <div className="py-1">
                                  {/* View Details - Primary action */}
                                  <button
                                    onClick={() => {
                                      router.push(`/admin/users/${user.id}`)
                                      setOpenDropdown(null)
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-600 transition-colors text-blue-400"
                                  >
                                    <Eye className="w-4 h-4" />
                                    View Details
                                  </button>
                                  <div className="border-t border-gray-600 my-1" />
                                  {/* Action options */}
                                  {getActionOptions(user).map((option) => (
                                    <button
                                      key={option.action}
                                      onClick={() => {
                                        setActionModal({ user, action: option.action })
                                        setOpenDropdown(null)
                                      }}
                                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-600 transition-colors ${option.color}`}
                                    >
                                      <option.icon className="w-4 h-4" />
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No users found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              Showing {(pagination.currentPage - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.limit, pagination.total)} of{' '}
              {pagination.total} users
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-400">
                Page {pagination.currentPage} of {pagination.pages}
              </span>
              <button
                onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                disabled={page === pagination.pages}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                {actionModal.action === 'ban' && 'Ban User'}
                {actionModal.action === 'unban' && 'Remove Ban'}
                {actionModal.action === 'warn' && 'Issue Warning'}
                {actionModal.action === 'deactivate' && 'Deactivate User'}
                {actionModal.action === 'reactivate' && 'Reactivate User'}
                {actionModal.action === 'grant_admin' && 'Grant Admin Access'}
                {actionModal.action === 'revoke_admin' && 'Revoke Admin Access'}
              </h2>
              <button
                onClick={() => setActionModal(null)}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg mb-4">
              {actionModal.user.avatarUrl ? (
                <Image
                  src={actionModal.user.avatarUrl}
                  alt={actionModal.user.name || actionModal.user.email}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                  <span className="text-white font-medium">
                    {actionModal.user.name?.charAt(0) || actionModal.user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-white">
                  {actionModal.user.name || 'No name'}
                </p>
                <p className="text-xs text-gray-400">{actionModal.user.email}</p>
              </div>
            </div>

            {/* Ban Duration (for ban action) */}
            {actionModal.action === 'ban' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Ban Duration
                </label>
                <select
                  value={banDuration || ''}
                  onChange={(e) => setBanDuration(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Permanent</option>
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                </select>
              </div>
            )}

            {/* Warning Severity (for warn action) */}
            {actionModal.action === 'warn' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Warning Severity
                </label>
                <select
                  value={warningSeverity}
                  onChange={(e) => setWarningSeverity(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value={1}>Low (1)</option>
                  <option value={2}>Medium (2)</option>
                  <option value={3}>High (3)</option>
                  <option value={4}>Severe (4)</option>
                  <option value={5}>Critical (5)</option>
                </select>
              </div>
            )}

            {/* Reason */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reason {actionModal.action !== 'grant_admin' && actionModal.action !== 'revoke_admin' && '(required)'}
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Enter the reason for this action..."
                rows={3}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Warning Message */}
            {(actionModal.action === 'grant_admin' || actionModal.action === 'ban') && (
              <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {actionModal.action === 'grant_admin'
                    ? 'This will give the user full admin access to the control panel.'
                    : 'This will prevent the user from accessing the platform.'}
                </p>
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
                onClick={handleAction}
                disabled={isSubmitting || (
                  !actionReason &&
                  actionModal.action !== 'grant_admin' &&
                  actionModal.action !== 'revoke_admin'
                )}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  actionModal.action === 'ban' || actionModal.action === 'revoke_admin' || actionModal.action === 'deactivate'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirm
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
