'use client'

/**
 * Admin User Behavior Analytics Dashboard
 * CEO Control Panel - Monitor User Activity & Behavior
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Activity,
  Users,
  Eye,
  MousePointer,
  Search,
  MessageSquare,
  FileText,
  Clock,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  Calendar,
  BarChart3,
  PieChart,
  ExternalLink,
} from 'lucide-react'
import Image from 'next/image'

interface AnalyticsData {
  summary: {
    totalUsers: number
    newUsersThisPeriod: number
    activeUsersThisPeriod: number
    onlineUsersNow: number // Real-time online users
    totalSessions: number
    totalPageViews: number
    totalMessages: number
    totalPosts: number
    totalConnections: number
    suspiciousActivities: number
  }
  dailyStats: Array<{
    date: string
    sessions: number
    pageViews: number
    messages: number
    posts: number
    uniqueUsers: number
  }>
  topPages: Array<{ path: string; views: number }>
  topFeatures: Array<{ feature: string; usage: number }>
  searchAnalytics: Array<{ type: string; count: number; avgResults: number }>
}

interface SuspiciousActivity {
  id: string
  userId: string
  type: string
  severity: string
  description: string
  metadata: Record<string, unknown>
  isReviewed: boolean
  createdAt: string
  user?: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
}

interface SuspiciousData {
  activities: SuspiciousActivity[]
  statsByType: Array<{ type: string; count: number }>
  statsBySeverity: Array<{ severity: string; count: number }>
  total: number
}

// Collapsible Section Component
function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/30 transition"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-gray-600 dark:text-slate-400" />
          <span className="font-semibold text-gray-900 dark:text-white">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700/50 pt-4">{children}</div>}
    </div>
  )
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'blue',
}: {
  title: string
  value: string | number
  icon: React.ElementType
  trend?: number
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
}) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
  }

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${colors[color]}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-sm text-gray-500 dark:text-slate-400">{title}</div>
    </div>
  )
}

// Simple Bar Chart Component
function SimpleBarChart({
  data,
  dataKey,
  label,
}: {
  data: Array<Record<string, unknown>>
  dataKey: string
  label: string
}) {
  const maxValue = Math.max(...data.map(d => (d[dataKey] as number) || 0), 1)

  return (
    <div className="space-y-2">
      {data.slice(0, 7).map((item, idx) => {
        const value = (item[dataKey] as number) || 0
        const percentage = (value / maxValue) * 100

        return (
          <div key={idx} className="flex items-center gap-3">
            <div className="w-20 text-xs text-gray-500 dark:text-slate-400 truncate">
              {new Date(item.date as string).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <div className="flex-1 h-6 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="w-16 text-sm text-gray-900 dark:text-white text-right">
              {value.toLocaleString()}
            </div>
          </div>
        )
      })}
      <p className="text-xs text-gray-500 dark:text-slate-400 text-center mt-2">{label}</p>
    </div>
  )
}

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

export default function UserBehaviorAnalyticsPage() {
  const router = useRouter()
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d')
  const [activeTab, setActiveTab] = useState<'overview' | 'suspicious'>('overview')
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [suspiciousData, setSuspiciousData] = useState<SuspiciousData | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUsersData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (activeTab === 'overview') {
        const response = await fetch(`/api/admin/analytics?view=overview&period=${period}`)
        const result = await response.json()
        if (result.success) {
          setAnalyticsData(result.data)
        } else {
          setError(result.error)
        }
      } else {
        const response = await fetch(`/api/admin/analytics?view=suspicious&period=${period}`)
        const result = await response.json()
        if (result.success) {
          setSuspiciousData(result.data)
        } else {
          setError(result.error)
        }
      }
    } catch (err) {
      setError('Failed to fetch analytics')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, period])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Fetch real-time online users (separate from main analytics for faster refresh)
  const fetchOnlineUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/analytics/online-users')
      const result = await response.json()
      if (result.success) {
        setOnlineUsers(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch online users:', err)
    }
  }, [])

  // Auto-refresh online users every 15 seconds
  useEffect(() => {
    fetchOnlineUsers() // Initial fetch

    const interval = setInterval(() => {
      fetchOnlineUsers()
    }, 15000) // 15 seconds

    return () => clearInterval(interval)
  }, [fetchOnlineUsers])

  const handleMarkReviewed = async (activityId: string, actionTaken: string) => {
    try {
      const response = await fetch('/api/admin/analytics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, actionTaken }),
      })

      if (response.ok) {
        // Refresh data
        fetchAnalytics()
      }
    } catch (err) {
      console.error('Failed to mark activity as reviewed:', err)
    }
  }

  const formatRelativeTime = (dateString: string) => {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-slate-400">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-slate-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">User Behavior Analytics</h1>
                <p className="text-sm text-gray-500 dark:text-slate-400">Track user activity, page visits, and suspicious behavior</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Period Selector */}
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as '7d' | '30d' | '90d')}
                className="px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-sm border-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
              <button
                onClick={fetchAnalytics}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'overview'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Overview
              </div>
            </button>
            <button
              onClick={() => setActiveTab('suspicious')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'suspicious'
                  ? 'bg-red-500 text-white'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Suspicious Activity
                {suspiciousData && suspiciousData.total > 0 && (
                  <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
                    {suspiciousData.total}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && analyticsData && (
          <>
            {/* Real-Time Online Users - Prominent Display */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    <span className="text-green-100 text-sm font-medium">LIVE</span>
                  </div>
                  <div className="text-5xl font-bold mb-1">
                    {onlineUsers?.count ?? analyticsData.summary.onlineUsersNow ?? 0}
                  </div>
                  <div className="text-green-100">Users Online Right Now</div>
                  {onlineUsers && (
                    <div className="text-green-200 text-xs mt-2">
                      {onlineUsers.activeDevices} active device{onlineUsers.activeDevices !== 1 ? 's' : ''} •
                      Updated {new Date(onlineUsers.timestamp).toLocaleTimeString()}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <Activity className="w-16 h-16 text-white/30" />
                  {onlineUsers && onlineUsers.users.length > 0 && (
                    <div className="mt-4">
                      <div className="text-xs text-green-200 mb-2">Currently Active:</div>
                      <div className="flex -space-x-2">
                        {onlineUsers.users.slice(0, 5).map((user) => (
                          <div
                            key={user.id}
                            className="w-8 h-8 rounded-full bg-white/20 border-2 border-green-500 flex items-center justify-center overflow-hidden"
                            title={user.name}
                          >
                            {user.avatarUrl ? (
                              <Image src={user.avatarUrl} alt={user.name} width={32} height={32} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-medium">{user.name.charAt(0)}</span>
                            )}
                          </div>
                        ))}
                        {onlineUsers.users.length > 5 && (
                          <div className="w-8 h-8 rounded-full bg-white/30 border-2 border-green-500 flex items-center justify-center text-xs font-medium">
                            +{onlineUsers.users.length - 5}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard
                title="Total Users"
                value={analyticsData.summary.totalUsers.toLocaleString()}
                icon={Users}
                color="blue"
              />
              <StatCard
                title="New Users"
                value={analyticsData.summary.newUsersThisPeriod.toLocaleString()}
                icon={TrendingUp}
                color="green"
              />
              <StatCard
                title={`Active (${period})`}
                value={analyticsData.summary.activeUsersThisPeriod.toLocaleString()}
                icon={Activity}
                color="purple"
              />
              <StatCard
                title="Total Sessions"
                value={analyticsData.summary.totalSessions.toLocaleString()}
                icon={Clock}
                color="orange"
              />
              <StatCard
                title="Suspicious"
                value={analyticsData.summary.suspiciousActivities}
                icon={AlertTriangle}
                color="red"
              />
            </div>

            {/* Real-Time Activity Breakdown */}
            {onlineUsers && onlineUsers.pageBreakdown.length > 0 && (
              <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Where Users Are Right Now</h3>
                  <span className="text-xs text-gray-500 dark:text-slate-400">(Live)</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {onlineUsers.pageBreakdown.map((item, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                      <div className="text-lg font-bold text-gray-900 dark:text-white">{item.count}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400 truncate" title={item.page}>
                        {item.page.replace('/[id]', '').replace(/^\//, '') || 'Home'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Daily Sessions" icon={Calendar}>
                <SimpleBarChart
                  data={analyticsData.dailyStats}
                  dataKey="sessions"
                  label="Sessions per day"
                />
              </Section>

              <Section title="Daily Page Views" icon={Eye}>
                <SimpleBarChart
                  data={analyticsData.dailyStats}
                  dataKey="pageViews"
                  label="Page views per day"
                />
              </Section>
            </div>

            {/* Top Pages & Features */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Top Pages" icon={Eye}>
                <div className="space-y-2">
                  {analyticsData.topPages.map((page, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                      <span className="text-sm text-gray-900 dark:text-white truncate">{page.path}</span>
                      <span className="text-sm font-medium text-blue-500">{page.views.toLocaleString()}</span>
                    </div>
                  ))}
                  {analyticsData.topPages.length === 0 && (
                    <p className="text-gray-500 dark:text-slate-400 text-sm">No page data available</p>
                  )}
                </div>
              </Section>

              <Section title="Top Features Used" icon={MousePointer}>
                <div className="space-y-2">
                  {analyticsData.topFeatures.map((feature, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                      <span className="text-sm text-gray-900 dark:text-white truncate">{feature.feature}</span>
                      <span className="text-sm font-medium text-purple-500">{feature.usage.toLocaleString()}</span>
                    </div>
                  ))}
                  {analyticsData.topFeatures.length === 0 && (
                    <p className="text-gray-500 dark:text-slate-400 text-sm">No feature data available</p>
                  )}
                </div>
              </Section>
            </div>

            {/* Search & Engagement Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Section title="Search Analytics" icon={Search}>
                <div className="space-y-2">
                  {analyticsData.searchAnalytics.map((search, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900 dark:text-white capitalize">{search.type}</span>
                        <span className="text-sm text-blue-500">{search.count} searches</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Avg results: {search.avgResults}</p>
                    </div>
                  ))}
                  {analyticsData.searchAnalytics.length === 0 && (
                    <p className="text-gray-500 dark:text-slate-400 text-sm">No search data available</p>
                  )}
                </div>
              </Section>

              <Section title="Messages" icon={MessageSquare}>
                <div className="text-center py-4">
                  <div className="text-4xl font-bold text-gray-900 dark:text-white">
                    {analyticsData.summary.totalMessages.toLocaleString()}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Total messages sent</p>
                </div>
              </Section>

              <Section title="Posts" icon={FileText}>
                <div className="text-center py-4">
                  <div className="text-4xl font-bold text-gray-900 dark:text-white">
                    {analyticsData.summary.totalPosts.toLocaleString()}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Total posts created</p>
                </div>
              </Section>
            </div>
          </>
        )}

        {/* Suspicious Activity Tab */}
        {activeTab === 'suspicious' && suspiciousData && (
          <>
            {/* Stats by Severity */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((severity) => {
                const stat = suspiciousData.statsBySeverity.find(s => s.severity === severity)
                const colors: Record<string, 'red' | 'orange' | 'blue' | 'green'> = {
                  CRITICAL: 'red',
                  HIGH: 'orange',
                  MEDIUM: 'blue',
                  LOW: 'green'
                }
                return (
                  <StatCard
                    key={severity}
                    title={severity}
                    value={stat?.count || 0}
                    icon={AlertTriangle}
                    color={colors[severity]}
                  />
                )
              })}
            </div>

            {/* Activity Types */}
            <Section title="Activity by Type" icon={PieChart}>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {suspiciousData.statsByType.map((stat, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg text-center">
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{stat.count}</div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 capitalize">
                      {stat.type.toLowerCase().replace(/_/g, ' ')}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Activity List */}
            <Section title="Recent Suspicious Activity" icon={AlertTriangle} defaultOpen={true}>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {suspiciousData.activities.map((activity) => (
                  <div
                    key={activity.id}
                    className={`p-4 rounded-lg border ${
                      activity.severity === 'CRITICAL'
                        ? 'bg-red-500/10 border-red-500/30'
                        : activity.severity === 'HIGH'
                        ? 'bg-orange-500/10 border-orange-500/30'
                        : activity.severity === 'MEDIUM'
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-gray-50 dark:bg-slate-700/30 border-gray-200 dark:border-slate-700'
                    } ${activity.isReviewed ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {activity.user?.avatarUrl ? (
                          <Image
                            src={activity.user.avatarUrl}
                            alt={activity.user.name}
                            width={36}
                            height={36}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <span className="text-sm font-bold text-white">
                              {activity.user?.name?.charAt(0) || '?'}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {activity.user?.name || 'Unknown User'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {activity.user?.email || activity.userId}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          activity.severity === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-400'
                            : activity.severity === 'HIGH'
                            ? 'bg-orange-500/20 text-orange-400'
                            : activity.severity === 'MEDIUM'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {activity.severity}
                        </span>
                        <span className="text-xs text-gray-400">{formatRelativeTime(activity.createdAt)}</span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full capitalize">
                        {activity.type.toLowerCase().replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 dark:text-slate-300 mb-3">{activity.description}</p>

                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 p-2 rounded mb-3 font-mono">
                        {JSON.stringify(activity.metadata, null, 2)}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/admin/users/${activity.userId}`)}
                        className="px-3 py-1.5 bg-blue-500/20 text-blue-400 text-sm rounded-lg hover:bg-blue-500/30 transition flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View User
                      </button>
                      {!activity.isReviewed && (
                        <>
                          <button
                            onClick={() => handleMarkReviewed(activity.id, 'dismissed')}
                            className="px-3 py-1.5 bg-gray-500/20 text-gray-400 text-sm rounded-lg hover:bg-gray-500/30 transition"
                          >
                            Dismiss
                          </button>
                          <button
                            onClick={() => handleMarkReviewed(activity.id, 'warned')}
                            className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 text-sm rounded-lg hover:bg-yellow-500/30 transition"
                          >
                            Warn User
                          </button>
                          <button
                            onClick={() => handleMarkReviewed(activity.id, 'banned')}
                            className="px-3 py-1.5 bg-red-500/20 text-red-400 text-sm rounded-lg hover:bg-red-500/30 transition"
                          >
                            Ban User
                          </button>
                        </>
                      )}
                      {activity.isReviewed && (
                        <span className="text-xs text-green-500">Reviewed</span>
                      )}
                    </div>
                  </div>
                ))}

                {suspiciousData.activities.length === 0 && (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-slate-400">No suspicious activity detected</p>
                  </div>
                )}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
