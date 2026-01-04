'use client'

// Admin Settings Page
// CEO Control Panel - Admin Panel Settings

import { useState, useEffect, useCallback } from 'react'
import {
  Settings,
  Database,
  ExternalLink,
  Key,
  Server,
  RefreshCw,
  AlertTriangle,
  Shield,
  UserPlus,
  UserMinus,
  Crown,
  Search,
  X,
  Check,
  Loader2,
} from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface AdminUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  isAdmin: boolean
  isSuperAdmin: boolean
  adminGrantedAt: string | null
  twoFactorEnabled: boolean
  lastLoginAt: string | null
  grantedBy: {
    id: string
    name: string | null
    email: string
  } | null
}

interface SearchUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  isAdmin: boolean
}

export default function AdminSettingsPage() {
  const [isClearing, setIsClearing] = useState(false)
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Add admin modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isGranting, setIsGranting] = useState<string | null>(null)
  const [isRevoking, setIsRevoking] = useState<string | null>(null)

  // Fetch admin users
  const fetchAdmins = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/admins')
      const data = await response.json()
      if (data.success) {
        setAdmins(data.data.admins)
        setIsSuperAdmin(data.data.isSuperAdmin)
        setCurrentUserId(data.data.currentUserId)
      }
    } catch (error) {
      console.error('Error fetching admins:', error)
    } finally {
      setIsLoadingAdmins(false)
    }
  }, [])

  useEffect(() => {
    fetchAdmins()
  }, [fetchAdmins])

  // Search users
  const searchUsers = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      if (data.success) {
        // Filter out users who are already admins
        // API returns data.users (not data.data)
        const users = data.users || []
        const nonAdmins = users.filter((u: SearchUser) => !u.isAdmin)
        setSearchResults(nonAdmins)
      }
    } catch (error) {
      console.error('Error searching users:', error)
    } finally {
      setIsSearching(false)
    }
  }

  // Grant admin access
  const grantAdmin = async (userId: string) => {
    setIsGranting(userId)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'grant_admin', userId }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Admin access granted')
        setShowAddModal(false)
        setSearchQuery('')
        setSearchResults([])
        fetchAdmins()
      } else {
        toast.error(data.error || 'Failed to grant admin access')
      }
    } catch (error) {
      toast.error('Failed to grant admin access')
    } finally {
      setIsGranting(null)
    }
  }

  // Revoke admin access
  const revokeAdmin = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to revoke admin access from ${userName}?`)) {
      return
    }

    setIsRevoking(userId)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke_admin', userId }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Admin access revoked')
        fetchAdmins()
      } else {
        toast.error(data.error || 'Failed to revoke admin access')
      }
    } catch (error) {
      toast.error('Failed to revoke admin access')
    } finally {
      setIsRevoking(null)
    }
  }

  // External service links
  const externalServices = [
    {
      name: 'Supabase Dashboard',
      description: 'Database management, auth settings, storage',
      icon: Database,
      url: 'https://app.supabase.com',
      color: 'bg-green-500',
    },
    {
      name: 'PostHog Analytics',
      description: 'User behavior analytics, session recordings',
      icon: Server,
      url: 'https://app.posthog.com',
      color: 'bg-blue-500',
    },
    {
      name: 'Vercel Dashboard',
      description: 'Deployments, environment variables, logs',
      icon: Server,
      url: 'https://vercel.com/dashboard',
      color: 'bg-gray-500',
    },
    {
      name: 'Stripe Dashboard',
      description: 'Payments, subscriptions, invoices',
      icon: Key,
      url: 'https://dashboard.stripe.com',
      color: 'bg-blue-500',
    },
    {
      name: 'Sentry Dashboard',
      description: 'Error tracking, performance monitoring',
      icon: AlertTriangle,
      url: 'https://sentry.io',
      color: 'bg-red-500',
    },
    {
      name: 'Upstash Console',
      description: 'Redis cache management, rate limiting',
      icon: Database,
      url: 'https://console.upstash.com',
      color: 'bg-teal-500',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Settings</h1>
        <p className="text-gray-400 mt-1">
          Manage platform settings and admin access
        </p>
      </div>

      {/* Admin Management */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Admin Users</h2>
              <p className="text-sm text-gray-400">Manage who has admin access</p>
            </div>
          </div>
          {isSuperAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add Admin
            </button>
          )}
        </div>

        {/* Admin List */}
        {isLoadingAdmins ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center gap-4 p-4 bg-gray-700/50 rounded-lg"
              >
                {admin.avatarUrl ? (
                  <Image
                    src={admin.avatarUrl}
                    alt={admin.name || admin.email}
                    width={44}
                    height={44}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gray-600 flex items-center justify-center">
                    <span className="text-white font-medium text-lg">
                      {admin.name?.charAt(0) || admin.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white truncate">
                      {admin.name || 'No name'}
                    </p>
                    {admin.isSuperAdmin && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                        <Crown className="w-3 h-3" />
                        Super Admin
                      </span>
                    )}
                    {admin.id === currentUserId && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 truncate">{admin.email}</p>
                  {admin.grantedBy && (
                    <p className="text-xs text-gray-500 mt-1">
                      Granted by {admin.grantedBy.name || admin.grantedBy.email}
                      {admin.adminGrantedAt && (
                        <> on {new Date(admin.adminGrantedAt).toLocaleDateString()}</>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {admin.twoFactorEnabled && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                      <Check className="w-3 h-3" />
                      2FA
                    </span>
                  )}
                  {isSuperAdmin && !admin.isSuperAdmin && admin.id !== currentUserId && (
                    <button
                      onClick={() => revokeAdmin(admin.id, admin.name || admin.email)}
                      disabled={isRevoking === admin.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isRevoking === admin.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserMinus className="w-4 h-4" />
                      )}
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isSuperAdmin && (
          <p className="text-sm text-gray-500 mt-4">
            Only the super admin can add or remove admin users.
          </p>
        )}
      </div>

      {/* External Services */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <ExternalLink className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">External Services</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {externalServices.map((service) => (
            <a
              key={service.name}
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors group"
            >
              <div className={`p-3 rounded-lg ${service.color}`}>
                <service.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white group-hover:text-blue-400 transition-colors">
                  {service.name}
                </p>
                <p className="text-sm text-gray-400">{service.description}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
            </a>
          ))}
        </div>
      </div>

      {/* Environment Info */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Server className="w-5 h-5 text-green-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Environment</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-gray-700/50 rounded-lg">
            <p className="text-gray-400">Environment</p>
            <p className="text-white font-medium">
              {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
            </p>
          </div>
          <div className="p-3 bg-gray-700/50 rounded-lg">
            <p className="text-gray-400">Version</p>
            <p className="text-white font-medium">2.0.0</p>
          </div>
          <div className="p-3 bg-gray-700/50 rounded-lg">
            <p className="text-gray-400">Framework</p>
            <p className="text-white font-medium">Next.js 15</p>
          </div>
          <div className="p-3 bg-gray-700/50 rounded-lg">
            <p className="text-gray-400">Database</p>
            <p className="text-white font-medium">Supabase (PostgreSQL)</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Settings className="w-5 h-5 text-orange-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
        </div>

        <div className="space-y-3">
          <button
            onClick={async () => {
              setIsClearing(true)
              try {
                const response = await fetch('/api/admin/cache/clear', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                })
                const result = await response.json()
                if (result.success) {
                  toast.success(result.message)
                } else {
                  toast.error(result.error || result.message)
                }
              } catch {
                toast.error('Failed to clear caches - network error')
              } finally {
                setIsClearing(false)
              }
            }}
            disabled={isClearing}
            className="flex items-center gap-3 w-full p-4 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 ${isClearing ? 'animate-spin' : ''}`} />
            <div className="flex-1 text-left">
              <p className="font-medium text-white">Clear Platform Caches</p>
              <p className="text-sm text-gray-400">Clear all Redis and server-side caches</p>
            </div>
          </button>

          <a
            href="/api/health"
            target="_blank"
            className="flex items-center gap-3 w-full p-4 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Server className="w-5 h-5 text-gray-400" />
            <div className="flex-1 text-left">
              <p className="font-medium text-white">Check API Health</p>
              <p className="text-sm text-gray-400">View API status endpoint</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-500" />
          </a>
        </div>
      </div>

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Add Admin User</h3>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  searchUsers(e.target.value)
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
              )}
            </div>

            {/* Search Results */}
            <div className="max-h-64 overflow-y-auto space-y-2">
              {searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg"
                  >
                    {user.avatarUrl ? (
                      <Image
                        src={user.avatarUrl}
                        alt={user.name || user.email}
                        width={36}
                        height={36}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-600 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">
                        {user.name || 'No name'}
                      </p>
                      <p className="text-sm text-gray-400 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => grantAdmin(user.id)}
                      disabled={isGranting === user.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isGranting === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      Grant
                    </button>
                  </div>
                ))
              ) : searchQuery.length >= 2 && !isSearching ? (
                <p className="text-center text-gray-400 py-4">No users found</p>
              ) : searchQuery.length > 0 && searchQuery.length < 2 ? (
                <p className="text-center text-gray-400 py-4">Type at least 2 characters to search</p>
              ) : null}
            </div>

            <p className="text-xs text-gray-500 mt-4">
              Note: Only the super admin can grant admin access. Admin users can view and moderate content.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
