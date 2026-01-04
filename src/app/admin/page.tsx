'use client'

// Admin Dashboard - Overview Page
// CEO Control Panel - Key Metrics and Real-time Data
// Uses WebSocket subscriptions for real-time updates instead of polling

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Users,
  UserPlus,
  Activity,
  MessageSquare,
  BookOpen,
  Heart,
  Crown,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  RefreshCw,
  ExternalLink,
  BarChart3,
  Sparkles,
  Brain,
  Eye,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react'
import { useAdminRealtime } from '@/hooks/useAdminRealtime'
import Link from 'next/link'
import Image from 'next/image'
import { AreaChartCard } from '@/components/admin/charts'

// Real-time online users data interface
interface OnlineUsersData {
  count: number
  activeDevices: number
  users: Array<{
    id: string
    name: string
    avatarUrl: string | null
    currentPage: string | null
    lastSeen: string
  }>
  pageBreakdown: Array<{ page: string; count: number }>
  timestamp: string
}

interface DashboardStats {
  users: {
    total: number
    newToday: number
    newThisWeek: number
    newThisMonth: number
    activeToday: number
    premium: number
    deactivated: number
  }
  content: {
    groups: number
    messages: number
    studySessions: number
    matches: number
  }
  moderation: {
    pendingReports: number
  }
}

interface GrowthDataPoint {
  date: string
  users: number
}

interface RecentUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  role: string
  createdAt: string
  lastLoginAt: string | null
  signupMethod: string
}

// AI Partner quick stats for dashboard
interface AIPartnerQuickStats {
  totalSessions: number
  totalMessages: number
  activeSessions: number
  flaggedMessages: number
  error?: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [growthData, setGrowthData] = useState<GrowthDataPoint[]>([])
  const [recentSignups, setRecentSignups] = useState<RecentUser[]>([])
  const [onlineUsersData, setOnlineUsersData] = useState<OnlineUsersData | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // AI Partner quick stats
  const [aiPartnerStats, setAiPartnerStats] = useState<AIPartnerQuickStats | null>(null)
  const [aiPartnerLoading, setAiPartnerLoading] = useState(true)

  // Real-time WebSocket connection for live updates
  // Replaces polling with Supabase Realtime for ~80% reduction in database load
  const {
    isConnected,
    connectionStatus,
    onlineUsers: realtimeOnlineCount,
    pendingReports: realtimePendingReports,
    refresh: refreshRealtime,
    isInitialized,
  } = useAdminRealtime({
    adminId: 'admin-dashboard', // Dashboard-level admin ID
    onNewReport: (report) => {
      // Show notification for new reports
      console.log('[Admin] New report received:', report)
    },
    onNewUser: (user) => {
      // Add new user to recent signups list
      console.log('[Admin] New user signup:', user)
      fetchRecentSignups()
    },
    onAISessionChange: (session) => {
      console.log('[Admin] AI session change:', session)
    },
    fallbackPollingMs: 30000, // 30 second fallback if WebSocket fails
  })

  // Fetch dashboard stats (cached on server, uses indexes)
  const fetchDashboardData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)

    try {
      const response = await fetch('/api/admin/dashboard')
      const data = await response.json()

      if (data.success) {
        setStats(data.data.stats)
        setGrowthData(data.data.growthData)
        setRecentSignups(data.data.recentSignups)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  // Fetch recent signups only (for real-time new user updates)
  const fetchRecentSignups = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/dashboard?recentSignupsOnly=true')
      const data = await response.json()
      if (data.success && data.data.recentSignups) {
        setRecentSignups(data.data.recentSignups)
      }
    } catch (error) {
      console.error('Error fetching recent signups:', error)
    }
  }, [])

  // Fetch online users details (for avatar display, etc.)
  const fetchOnlineUsersDetails = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/analytics/online-users')
      const result = await response.json()
      if (result.success) {
        setOnlineUsersData(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch online users:', err)
    }
  }, [])

  // Fetch AI Partner quick stats for dashboard overview
  const fetchAIPartnerStats = useCallback(async () => {
    setAiPartnerLoading(true)
    try {
      const response = await fetch('/api/admin/ai-partner/analytics')
      const result = await response.json()
      if (result.success && result.data) {
        setAiPartnerStats({
          totalSessions: result.data.overview?.totalSessions || 0,
          totalMessages: result.data.overview?.totalMessages || 0,
          activeSessions: result.data.overview?.activeSessions || 0,
          flaggedMessages: result.data.moderation?.flaggedMessages || 0,
        })
      } else {
        setAiPartnerStats({
          totalSessions: 0,
          totalMessages: 0,
          activeSessions: 0,
          flaggedMessages: 0,
          error: result.error || 'Failed to load',
        })
      }
    } catch (err) {
      console.error('Failed to fetch AI Partner stats:', err)
      setAiPartnerStats({
        totalSessions: 0,
        totalMessages: 0,
        activeSessions: 0,
        flaggedMessages: 0,
        error: 'Failed to fetch AI Partner sessions',
      })
    } finally {
      setAiPartnerLoading(false)
    }
  }, [])

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData()
    fetchOnlineUsersDetails()
    fetchAIPartnerStats()
  }, [fetchDashboardData, fetchOnlineUsersDetails, fetchAIPartnerStats])

  // Refresh online users details when realtime count changes significantly
  useEffect(() => {
    if (realtimeOnlineCount > 0) {
      fetchOnlineUsersDetails()
    }
  }, [realtimeOnlineCount, fetchOnlineUsersDetails])

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await Promise.all([
      fetchDashboardData(false),
      fetchOnlineUsersDetails(),
      fetchAIPartnerStats(),
      refreshRealtime(),
    ])
    setIsRefreshing(false)
    setLastUpdated(new Date())
  }, [fetchDashboardData, fetchOnlineUsersDetails, fetchAIPartnerStats, refreshRealtime])

  // Merge realtime data with fetched data
  const onlineUsers = useMemo(() => {
    if (!onlineUsersData) return null
    return {
      ...onlineUsersData,
      // Use realtime count if available and higher than cached
      count: realtimeOnlineCount > 0 ? Math.max(realtimeOnlineCount, onlineUsersData.count) : onlineUsersData.count,
    }
  }, [onlineUsersData, realtimeOnlineCount])

  // Use realtime pending reports if available
  const pendingReportsCount = realtimePendingReports > 0
    ? realtimePendingReports
    : (stats?.moderation.pendingReports || 0)

  // Format number with K/M suffix
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Calculate growth percentage
  const calculateGrowth = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.users.total || 0,
      icon: Users,
      color: 'blue',
      link: '/admin/users',
    },
    {
      title: 'New Today',
      value: stats?.users.newToday || 0,
      icon: UserPlus,
      color: 'green',
      trend: stats ? calculateGrowth(stats.users.newToday, Math.floor(stats.users.newThisWeek / 7)) : 0,
    },
    {
      title: 'Active Today',
      value: stats?.users.activeToday || 0,
      icon: Activity,
      color: 'purple',
    },
    {
      title: 'Premium Users',
      value: stats?.users.premium || 0,
      icon: Crown,
      color: 'yellow',
    },
    {
      title: 'Total Messages',
      value: stats?.content.messages || 0,
      icon: MessageSquare,
      color: 'indigo',
    },
    {
      title: 'Study Sessions',
      value: stats?.content.studySessions || 0,
      icon: BookOpen,
      color: 'teal',
    },
    {
      title: 'Matches Made',
      value: stats?.content.matches || 0,
      icon: Heart,
      color: 'pink',
    },
    {
      title: 'Pending Reports',
      value: pendingReportsCount,
      icon: AlertTriangle,
      color: pendingReportsCount > 0 ? 'red' : 'gray',
      link: '/admin/reports',
      urgent: pendingReportsCount > 0,
    },
  ]

  const colorClasses: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'bg-blue-500' },
    green: { bg: 'bg-green-500/10', text: 'text-green-400', icon: 'bg-green-500' },
    purple: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'bg-blue-500' },
    yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: 'bg-yellow-500' },
    indigo: { bg: 'bg-blue-1000/10', text: 'text-blue-500', icon: 'bg-blue-1000' },
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', icon: 'bg-teal-500' },
    pink: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'bg-blue-500' },
    red: { bg: 'bg-red-500/10', text: 'text-red-400', icon: 'bg-red-500' },
    gray: { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: 'bg-gray-500' },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-gray-400 mt-1">
            Welcome to the CEO Control Panel. Here&apos;s what&apos;s happening with Clerva.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Real-time connection status indicator */}
          <div className="flex items-center gap-2">
            {!isInitialized ? (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-700 rounded-full">
                <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                <span className="text-xs text-gray-400">Connecting...</span>
              </div>
            ) : isConnected ? (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 rounded-full">
                <Wifi className="w-3 h-3 text-green-400" />
                <span className="text-xs text-green-400">Live</span>
              </div>
            ) : connectionStatus === 'reconnecting' ? (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-500/20 rounded-full">
                <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
                <span className="text-xs text-yellow-400">Reconnecting...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 rounded-full">
                <WifiOff className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-400">Offline</span>
              </div>
            )}
          </div>
          {lastUpdated && (
            <span className="text-sm text-gray-500 hidden sm:inline">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const colors = colorClasses[stat.color]
          const cardClassName = `relative p-6 rounded-xl ${colors.bg} border border-gray-700 ${
            stat.link ? 'hover:border-gray-600 transition-colors cursor-pointer' : ''
          } ${stat.urgent ? 'ring-2 ring-red-500 animate-pulse' : ''}`

          const cardContent = (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">{stat.title}</p>
                  <p className={`text-3xl font-bold mt-1 ${colors.text}`}>
                    {formatNumber(stat.value)}
                  </p>
                  {stat.trend !== undefined && (
                    <div className="flex items-center gap-1 mt-2">
                      {stat.trend >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                      <span
                        className={`text-sm ${
                          stat.trend >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {stat.trend >= 0 ? '+' : ''}
                        {stat.trend}%
                      </span>
                      <span className="text-xs text-gray-500">vs avg</span>
                    </div>
                  )}
                </div>
                <div className={`p-3 rounded-lg ${colors.icon}`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
              {stat.link && (
                <ExternalLink className="absolute top-3 right-3 w-4 h-4 text-gray-500" />
              )}
            </>
          )

          return stat.link ? (
            <Link key={stat.title} href={stat.link} className={cardClassName}>
              {cardContent}
            </Link>
          ) : (
            <div key={stat.title} className={cardClassName}>
              {cardContent}
            </div>
          )
        })}
      </div>

      {/* Real-Time Online Users - Prominent Display */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-white/50'}`} />
              <span className="text-green-100 text-sm font-medium">
                {isConnected ? 'LIVE' : 'CACHED'}
              </span>
              {isConnected && (
                <span className="text-green-200 text-xs ml-1">(Real-time)</span>
              )}
            </div>
            <div className="text-5xl font-bold mb-1">
              {onlineUsers?.count ?? 0}
            </div>
            <div className="text-green-100">Users Online Right Now</div>
            {onlineUsers && (
              <div className="text-green-200 text-xs mt-2">
                {onlineUsers.activeDevices} active device{onlineUsers.activeDevices !== 1 ? 's' : ''} •
                Updated {new Date(onlineUsers.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>
          <div className="flex flex-col items-start sm:items-end gap-3">
            <Activity className="w-16 h-16 text-white/30 hidden sm:block" />
            {onlineUsers && onlineUsers.users.length > 0 && (
              <div>
                <div className="text-xs text-green-200 mb-2">Currently Active:</div>
                <div className="flex -space-x-2">
                  {onlineUsers.users.slice(0, 5).map((user) => (
                    <Link
                      key={user.id}
                      href={`/admin/users/${user.id}`}
                      className="w-8 h-8 rounded-full bg-white/20 border-2 border-green-500 flex items-center justify-center overflow-hidden hover:scale-110 transition-transform"
                      title={user.name}
                    >
                      {user.avatarUrl ? (
                        <Image src={user.avatarUrl} alt={user.name} width={32} height={32} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-medium">{user.name.charAt(0)}</span>
                      )}
                    </Link>
                  ))}
                  {onlineUsers.users.length > 5 && (
                    <div className="w-8 h-8 rounded-full bg-white/30 border-2 border-green-500 flex items-center justify-center text-xs font-medium">
                      +{onlineUsers.users.length - 5}
                    </div>
                  )}
                </div>
              </div>
            )}
            <Link
              href="/admin/analytics/user-behavior"
              className="flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors text-sm"
            >
              <Eye className="w-4 h-4" />
              View Details
            </Link>
          </div>
        </div>

        {/* Page Breakdown - Where users are right now */}
        {onlineUsers && onlineUsers.pageBreakdown.length > 0 && (
          <div className="relative z-10 mt-4 pt-4 border-t border-white/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-sm text-green-100 font-medium">Where Users Are Right Now</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {onlineUsers.pageBreakdown.slice(0, 5).map((item, idx) => (
                <div key={idx} className="p-2 bg-white/10 rounded-lg">
                  <div className="text-lg font-bold">{item.count}</div>
                  <div className="text-xs text-green-200 truncate" title={item.page}>
                    {item.page.replace('/[id]', '').replace(/^\//, '') || 'Home'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Growth Chart and Recent Signups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <BarChart3 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">User Growth</h2>
                <p className="text-xs text-gray-400">Last 30 days</p>
              </div>
            </div>
            <Link
              href="/admin/analytics"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              View Analytics
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* Recharts Area Chart - Same quality as Analytics page */}
          <div className="mb-4">
            {growthData.length > 0 ? (
              <AreaChartCard
                title=""
                data={growthData.map(p => ({
                  date: p.date,
                  label: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  value: p.users
                }))}
                color="#3b82f6"
                height={180}
                showHeader={false}
                gradientId="overviewGrowth"
              />
            ) : (
              <div className="h-[180px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-700">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {stats?.users.newThisWeek || 0}
              </p>
              <p className="text-xs text-gray-400">This Week</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {stats?.users.newThisMonth || 0}
              </p>
              <p className="text-xs text-gray-400">This Month</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {stats?.users.deactivated || 0}
              </p>
              <p className="text-xs text-gray-400">Deactivated</p>
            </div>
          </div>
        </div>

        {/* Recent Signups */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Recent Signups</h2>
            <Link
              href="/admin/users?sortBy=createdAt&sortOrder=desc"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              View All
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {recentSignups.length > 0 ? (
              recentSignups.slice(0, 5).map((user) => (
                <Link
                  key={user.id}
                  href={`/admin/users?search=${encodeURIComponent(user.email)}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700/50 transition-colors"
                >
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {user.name || 'No name'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(user.createdAt)}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        user.signupMethod === 'google'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {user.signupMethod}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">No recent signups</div>
            )}
          </div>
        </div>
      </div>

      {/* AI Partner Quick Stats */}
      <div className="bg-gradient-to-br from-blue-900/30 to-blue-900/30 rounded-xl border border-blue-500/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg overflow-hidden">
              <Image src="/logo.png" alt="AI Partner" width={24} height={24} className="object-contain" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">AI Study Partner</h2>
              <p className="text-xs text-gray-400">Real-time AI analytics</p>
            </div>
          </div>
          <Link
            href="/admin/ai-partner"
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm font-medium"
          >
            <Sparkles className="w-4 h-4" />
            View Full Analytics
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            href="/admin/ai-partner"
            className="p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {aiPartnerLoading ? (
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            ) : aiPartnerStats?.error ? (
              <p className="text-sm text-red-400">{aiPartnerStats.error}</p>
            ) : (
              <p className="text-2xl font-bold text-blue-400">{formatNumber(aiPartnerStats?.totalSessions || 0)}</p>
            )}
            <p className="text-xs text-gray-400">Total Sessions</p>
          </Link>
          <Link
            href="/admin/ai-partner"
            className="p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {aiPartnerLoading ? (
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            ) : aiPartnerStats?.error ? (
              <p className="text-sm text-red-400">{aiPartnerStats.error}</p>
            ) : (
              <p className="text-2xl font-bold text-blue-400">{formatNumber(aiPartnerStats?.totalMessages || 0)}</p>
            )}
            <p className="text-xs text-gray-400">AI Messages</p>
          </Link>
          <Link
            href="/admin/ai-partner/sessions?status=ACTIVE"
            className="p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {aiPartnerLoading ? (
              <Loader2 className="w-6 h-6 text-green-400 animate-spin" />
            ) : aiPartnerStats?.error ? (
              <p className="text-sm text-red-400">{aiPartnerStats.error}</p>
            ) : (
              <p className="text-2xl font-bold text-green-400">{aiPartnerStats?.activeSessions || 0}</p>
            )}
            <p className="text-xs text-gray-400">Active Now</p>
          </Link>
          <Link
            href="/admin/ai-partner/sessions?flagged=true"
            className="p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {aiPartnerLoading ? (
              <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
            ) : aiPartnerStats?.error ? (
              <p className="text-sm text-red-400">{aiPartnerStats.error}</p>
            ) : (
              <p className="text-2xl font-bold text-red-400">{aiPartnerStats?.flaggedMessages || 0}</p>
            )}
            <p className="text-xs text-gray-400">Flagged</p>
          </Link>
        </div>
        {aiPartnerStats?.error && (
          <p className="text-xs text-red-400 mt-3 text-center">
            {aiPartnerStats.error}
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            href="/admin/users"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
          >
            <Users className="w-8 h-8 text-blue-400" />
            <span className="text-sm text-gray-300">Manage Users</span>
          </Link>
          <Link
            href="/admin/reports"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
          >
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <span className="text-sm text-gray-300">View Reports</span>
          </Link>
          <Link
            href="/admin/announcements"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
          >
            <MessageSquare className="w-8 h-8 text-green-400" />
            <span className="text-sm text-gray-300">Send Announcement</span>
          </Link>
          <Link
            href="/admin/ai-partner"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
          >
            <div className="w-8 h-8">
              <Image src="/logo.png" alt="AI Partner" width={32} height={32} className="object-contain" />
            </div>
            <span className="text-sm text-gray-300">AI Partner</span>
          </Link>
          <Link
            href="/admin/ai-memory"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
          >
            <Brain className="w-8 h-8 text-blue-400" />
            <span className="text-sm text-gray-300">AI Memory</span>
          </Link>
          <Link
            href="/admin/ai-monitoring"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
          >
            <Activity className="w-8 h-8 text-green-400" />
            <span className="text-sm text-gray-300">AI Monitoring</span>
          </Link>
        </div>

        {/* PostHog Link */}
        <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between">
          <span className="text-sm text-gray-400">Advanced user behavior analytics</span>
          <a
            href="https://app.posthog.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition-colors"
          >
            Open PostHog
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  )
}
