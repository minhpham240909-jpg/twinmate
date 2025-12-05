'use client'

// Admin Dashboard - Overview Page
// CEO Control Panel - Key Metrics and Real-time Data

import { useEffect, useState, useCallback } from 'react'
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
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { AreaChartCard } from '@/components/admin/charts'

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

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [growthData, setGrowthData] = useState<GrowthDataPoint[]>([])
  const [recentSignups, setRecentSignups] = useState<RecentUser[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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

  useEffect(() => {
    fetchDashboardData()

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchDashboardData()
    }, 60000)

    return () => clearInterval(interval)
  }, [fetchDashboardData])

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
      value: stats?.moderation.pendingReports || 0,
      icon: AlertTriangle,
      color: stats?.moderation.pendingReports && stats.moderation.pendingReports > 0 ? 'red' : 'gray',
      link: '/admin/reports',
      urgent: (stats?.moderation.pendingReports || 0) > 0,
    },
  ]

  const colorClasses: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'bg-blue-500' },
    green: { bg: 'bg-green-500/10', text: 'text-green-400', icon: 'bg-green-500' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: 'bg-purple-500' },
    yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: 'bg-yellow-500' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', icon: 'bg-indigo-500' },
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', icon: 'bg-teal-500' },
    pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', icon: 'bg-pink-500' },
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
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchDashboardData(true)}
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
            href="/admin/analytics"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
          >
            <TrendingUp className="w-8 h-8 text-purple-400" />
            <span className="text-sm text-gray-300">View Analytics</span>
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
