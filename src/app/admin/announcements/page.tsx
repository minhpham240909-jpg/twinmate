'use client'

// Admin Announcements Page
// CEO Control Panel - Create and Manage System Announcements

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import {
  Megaphone,
  Plus,
  Edit,
  Trash2,
  Archive,
  Send,
  Clock,
  Eye,
  EyeOff,
  RefreshCw,
  X,
  AlertCircle,
  Bell,
  Users,
  Crown,
  ChevronLeft,
  ChevronRight,
  Search,
  UserPlus,
  Loader2,
} from 'lucide-react'

interface AnnouncementData {
  id: string
  title: string
  content: string
  priority: string
  targetRole: string | null
  targetUserIds: string[]
  status: string
  startsAt: string
  expiresAt: string | null
  createdAt: string
  createdBy: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
  }
  _count: {
    dismissals: number
  }
}

interface SearchUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  tier: 'FREE' | 'PREMIUM'
}

interface Pagination {
  total: number
  pages: number
  currentPage: number
  limit: number
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filters
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  // Create/Edit Modal
  const [editModal, setEditModal] = useState<{
    mode: 'create' | 'edit'
    announcement?: AnnouncementData
  } | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'NORMAL',
    targetRole: '',
    startsAt: '',
    expiresAt: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // User search for specific targeting
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([])
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [userSearchResults, setUserSearchResults] = useState<SearchUser[]>([])
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [showUserSearch, setShowUserSearch] = useState(false)

  // Fetch announcements
  const fetchAnnouncements = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status && { status }),
      })

      const response = await fetch(`/api/admin/announcements?${params}`)
      const data = await response.json()

      if (data.success) {
        setAnnouncements(data.data.announcements)
        setPagination(data.data.pagination)
      }
    } catch (error) {
      console.error('Error fetching announcements:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [page, status])

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  // Search users for targeting
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setUserSearchResults([])
      return
    }

    setIsSearchingUsers(true)
    try {
      const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}&limit=10`)
      const data = await response.json()
      if (data.success) {
        // Filter out already selected users
        const filteredResults = data.users.filter(
          (u: SearchUser) => !selectedUsers.some(s => s.id === u.id)
        )
        setUserSearchResults(filteredResults)
      }
    } catch (error) {
      console.error('Error searching users:', error)
    } finally {
      setIsSearchingUsers(false)
    }
  }, [selectedUsers])

  // Debounced user search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearchQuery) {
        searchUsers(userSearchQuery)
      } else {
        setUserSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [userSearchQuery, searchUsers])

  // Add user to selection
  const addUserToSelection = (user: SearchUser) => {
    setSelectedUsers(prev => [...prev, user])
    setUserSearchQuery('')
    setUserSearchResults([])
  }

  // Remove user from selection
  const removeUserFromSelection = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId))
  }

  // Open create modal
  const openCreateModal = () => {
    setFormData({
      title: '',
      content: '',
      priority: 'NORMAL',
      targetRole: '',
      startsAt: '',
      expiresAt: '',
    })
    setSelectedUsers([])
    setUserSearchQuery('')
    setUserSearchResults([])
    setShowUserSearch(false)
    setEditModal({ mode: 'create' })
  }

  // Open edit modal
  const openEditModal = async (announcement: AnnouncementData) => {
    setFormData({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      targetRole: announcement.targetRole || '',
      startsAt: announcement.startsAt ? new Date(announcement.startsAt).toISOString().slice(0, 16) : '',
      expiresAt: announcement.expiresAt ? new Date(announcement.expiresAt).toISOString().slice(0, 16) : '',
    })

    // Load existing targeted users if any
    if (announcement.targetUserIds && announcement.targetUserIds.length > 0) {
      setShowUserSearch(true)
      // Fetch user details for the IDs
      try {
        const userPromises = announcement.targetUserIds.map(async (userId) => {
          const response = await fetch(`/api/admin/users/search?q=${userId}&limit=1`)
          const data = await response.json()
          return data.users?.[0] || null
        })
        const users = await Promise.all(userPromises)
        setSelectedUsers(users.filter(Boolean))
      } catch (error) {
        console.error('Error loading targeted users:', error)
        setSelectedUsers([])
      }
    } else {
      setSelectedUsers([])
      setShowUserSearch(false)
    }

    setUserSearchQuery('')
    setUserSearchResults([])
    setEditModal({ mode: 'edit', announcement })
  }

  // Handle form submit
  const handleSubmit = async () => {
    if (!formData.title || !formData.content) {
      alert('Title and content are required')
      return
    }

    setIsSubmitting(true)

    try {
      const body: Record<string, any> = {
        action: editModal?.mode === 'create' ? 'create' : 'update',
        title: formData.title,
        content: formData.content,
        priority: formData.priority,
        targetRole: formData.targetRole || null,
        targetUserIds: selectedUsers.map(u => u.id),
        startsAt: formData.startsAt || null,
        expiresAt: formData.expiresAt || null,
      }

      if (editModal?.mode === 'edit' && editModal.announcement) {
        body.id = editModal.announcement.id
      }

      const response = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (data.success) {
        fetchAnnouncements(true)
        setEditModal(null)
        // Show success message with notification count for new announcements
        if (body.action === 'create' && data.notificationsSent !== undefined) {
          alert(`✅ Announcement created and sent to ${data.notificationsSent} users!`)
        }
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

  // Handle action
  const handleAction = async (action: 'publish' | 'archive' | 'delete', id: string) => {
    if (action === 'delete') {
      if (!confirm('Are you sure you want to delete this announcement?')) return
    }

    try {
      const response = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id }),
      })

      const data = await response.json()

      if (data.success) {
        fetchAnnouncements(true)
      } else {
        alert(data.error || 'Action failed')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('An error occurred')
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

  // Get priority badge
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'LOW':
        return { label: 'Low', color: 'bg-gray-500/20 text-gray-400' }
      case 'NORMAL':
        return { label: 'Normal', color: 'bg-blue-500/20 text-blue-400' }
      case 'HIGH':
        return { label: 'High', color: 'bg-orange-500/20 text-orange-400' }
      case 'URGENT':
        return { label: 'Urgent', color: 'bg-red-500/20 text-red-400' }
      default:
        return { label: priority, color: 'bg-gray-500/20 text-gray-400' }
    }
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return { label: 'Draft', color: 'bg-gray-500/20 text-gray-400', icon: EyeOff }
      case 'ACTIVE':
        return { label: 'Active', color: 'bg-green-500/20 text-green-400', icon: Eye }
      case 'SCHEDULED':
        return { label: 'Scheduled', color: 'bg-blue-500/20 text-blue-400', icon: Clock }
      case 'ARCHIVED':
        return { label: 'Archived', color: 'bg-gray-500/20 text-gray-400', icon: Archive }
      default:
        return { label: status, color: 'bg-gray-500/20 text-gray-400', icon: Bell }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Announcements</h1>
          <p className="text-gray-400 mt-1">
            Create and manage system-wide announcements
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAnnouncements(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Announcement
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.length > 0 ? (
          announcements.map((announcement) => {
            const priorityBadge = getPriorityBadge(announcement.priority)
            const statusBadge = getStatusBadge(announcement.status)
            const StatusIcon = statusBadge.icon

            return (
              <div
                key={announcement.id}
                className={`bg-gray-800 rounded-xl border p-6 ${
                  announcement.priority === 'URGENT'
                    ? 'border-red-500/50'
                    : announcement.priority === 'HIGH'
                    ? 'border-orange-500/50'
                    : 'border-gray-700'
                }`}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${
                      announcement.priority === 'URGENT'
                        ? 'bg-red-500/10'
                        : announcement.priority === 'HIGH'
                        ? 'bg-orange-500/10'
                        : 'bg-blue-500/10'
                    }`}>
                      <Megaphone className={`w-6 h-6 ${
                        announcement.priority === 'URGENT'
                          ? 'text-red-400'
                          : announcement.priority === 'HIGH'
                          ? 'text-orange-400'
                          : 'text-blue-400'
                      }`} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-1 rounded ${statusBadge.color}`}>
                          <StatusIcon className="w-3 h-3 inline mr-1" />
                          {statusBadge.label}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${priorityBadge.color}`}>
                          {priorityBadge.label}
                        </span>
                        {announcement.targetRole && (
                          <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400 flex items-center gap-1">
                            {announcement.targetRole === 'PREMIUM' ? (
                              <Crown className="w-3 h-3" />
                            ) : (
                              <Users className="w-3 h-3" />
                            )}
                            {announcement.targetRole} Only
                          </span>
                        )}
                        {announcement.targetUserIds && announcement.targetUserIds.length > 0 && (
                          <span className="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 flex items-center gap-1">
                            <UserPlus className="w-3 h-3" />
                            {announcement.targetUserIds.length} specific user{announcement.targetUserIds.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-medium text-white">{announcement.title}</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Created {formatDate(announcement.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(announcement)}
                      className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {announcement.status === 'DRAFT' && (
                      <button
                        onClick={() => handleAction('publish', announcement.id)}
                        className="p-2 rounded-lg hover:bg-green-600/20 text-green-400 hover:text-green-300 transition-colors"
                        title="Publish"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    {announcement.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleAction('archive', announcement.id)}
                        className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Archive"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleAction('delete', announcement.id)}
                      className="p-2 rounded-lg hover:bg-red-600/20 text-red-400 hover:text-red-300 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Content Preview */}
                <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-3">
                    {announcement.content}
                  </p>
                </div>

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    {announcement.createdBy.avatarUrl ? (
                      <Image
                        src={announcement.createdBy.avatarUrl}
                        alt={announcement.createdBy.name || announcement.createdBy.email}
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center">
                        <span className="text-white text-[10px]">
                          {announcement.createdBy.name?.charAt(0) || announcement.createdBy.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span>By {announcement.createdBy.name || announcement.createdBy.email}</span>
                  </div>
                  {announcement.startsAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Starts: {formatDate(announcement.startsAt)}
                    </span>
                  )}
                  {announcement.expiresAt && (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Expires: {formatDate(announcement.expiresAt)}
                    </span>
                  )}
                  <span>{announcement._count.dismissals} dismissed</span>
                </div>
              </div>
            )
          })
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
            <Megaphone className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No announcements found</p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
            >
              Create First Announcement
            </button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-gray-800 rounded-xl border border-gray-700">
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

      {/* Create/Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">
                {editModal.mode === 'create' ? 'Create Announcement' : 'Edit Announcement'}
              </h2>
              <button
                onClick={() => setEditModal(null)}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Announcement title..."
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Content *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Announcement content..."
                  rows={5}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Priority and Target */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Target Audience
                  </label>
                  <select
                    value={formData.targetRole}
                    onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Users</option>
                    <option value="FREE">Free Users</option>
                    <option value="PREMIUM">Premium Users</option>
                  </select>
                </div>
              </div>

              {/* Specific User Targeting */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Target Specific Users (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowUserSearch(!showUserSearch)}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                      showUserSearch
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    <UserPlus className="w-3 h-3" />
                    {showUserSearch ? 'Hide' : 'Add Users'}
                  </button>
                </div>

                {showUserSearch && (
                  <div className="space-y-3">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="Search by name or email..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      />
                      {isSearchingUsers && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                      )}
                    </div>

                    {/* Search Results Dropdown */}
                    {userSearchResults.length > 0 && (
                      <div className="bg-gray-700 border border-gray-600 rounded-lg max-h-48 overflow-y-auto">
                        {userSearchResults.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => addUserToSelection(user)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-gray-600 transition-colors text-left"
                          >
                            {user.avatarUrl ? (
                              <Image
                                src={user.avatarUrl}
                                alt={user.name}
                                width={32}
                                height={32}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
                                <span className="text-white text-sm">
                                  {user.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{user.name}</p>
                              <p className="text-xs text-gray-400 truncate">{user.email}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              user.tier === 'PREMIUM'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {user.tier}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* No Results */}
                    {userSearchQuery.length >= 2 && !isSearchingUsers && userSearchResults.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-2">
                        No users found matching &quot;{userSearchQuery}&quot;
                      </p>
                    )}

                    {/* Selected Users */}
                    {selectedUsers.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400">
                          Selected Users ({selectedUsers.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedUsers.map((user) => (
                            <div
                              key={user.id}
                              className="flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 rounded-lg px-3 py-1.5"
                            >
                              {user.avatarUrl ? (
                                <Image
                                  src={user.avatarUrl}
                                  alt={user.name}
                                  width={20}
                                  height={20}
                                  className="rounded-full"
                                />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center">
                                  <span className="text-white text-[10px]">
                                    {user.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <span className="text-sm text-white">{user.name}</span>
                              <button
                                type="button"
                                onClick={() => removeUserFromSelection(user.id)}
                                className="p-0.5 hover:bg-red-500/20 rounded transition-colors"
                              >
                                <X className="w-3 h-3 text-gray-400 hover:text-red-400" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-gray-500">
                      These users will receive this announcement in addition to the target audience above.
                    </p>
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startsAt}
                    onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.title || !formData.content}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    {editModal.mode === 'create' ? 'Create' : 'Save Changes'}
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
