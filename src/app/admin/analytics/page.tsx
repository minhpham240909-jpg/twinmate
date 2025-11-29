'use client'

// Admin Analytics Page
// CEO Control Panel - Real-time Analytics and Insights

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart3,
  Users,
  MessageSquare,
  Heart,
  BookOpen,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Calendar,
  Activity,
  Globe,
  Smartphone,
  Monitor,
  Clock,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

interface AnalyticsData {
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

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<AnalyticsData | null>(null)
  const [growthData, setGrowthData] = useState<GrowthDataPoint[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')

  const fetchAnalytics = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)

    try {
      const response = await fetch('/api/admin/dashboard')
      const data = await response.json()

      if (data.success) {
        setStats(data.data.stats)
        setGrowthData(data.data.growthData)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
    // Refresh every 30 seconds for real-time feel
    const interval = setInterval(() => fetchAnalytics(), 30000)
    return () => clearInterval(interval)
  }, [fetchAnalytics])

  // Calculate percentage changes
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  // Get filtered growth data based on time range
  const getFilteredGrowthData = () => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    return growthData.slice(-days)
  }

  // Calculate totals from growth data
  const getTotalFromGrowth = () => {
    return getFilteredGrowthData().reduce((sum, point) => sum + point.users, 0)
  }

  const metricCards = [
    {
      title: 'Total Users',
      value: stats?.users.total || 0,
      icon: Users,
      color: 'blue',
      change: calculateChange(stats?.users.newThisWeek || 0, stats?.users.newThisMonth ? Math.floor(stats.users.newThisMonth / 4) : 0),
    },
    {
      title: 'Active Today',
      value: stats?.users.activeToday || 0,
      icon: Activity,
      color: 'green',
      change: 0,
      suffix: 'online',
    },
    {
      title: 'Messages Sent',
      value: stats?.content.messages || 0,
      icon: MessageSquare,
      color: 'purple',
      change: 0,
    },
    {
      title: 'Study Sessions',
      value: stats?.content.studySessions || 0,
      icon: BookOpen,
      color: 'teal',
      change: 0,
    },
    {
      title: 'Matches Made',
      value: stats?.content.matches || 0,
      icon: Heart,
      color: 'pink',
      change: 0,
    },
    {
      title: 'Groups Created',
      value: stats?.content.groups || 0,
      icon: Globe,
      color: 'indigo',
      change: 0,
    },
  ]

  const colorClasses: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'bg-blue-500' },
    green: { bg: 'bg-green-500/10', text: 'text-green-400', icon: 'bg-green-500' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: 'bg-purple-500' },
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', icon: 'bg-teal-500' },
    pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', icon: 'bg-pink-500' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', icon: 'bg-indigo-500' },
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const filteredData = getFilteredGrowthData()
  const maxValue = Math.max(...filteredData.map((p) => p.users), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Real-time insights and metrics for Clerva
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metricCards.map((metric) => {
          const colors = colorClasses[metric.color]
          return (
            <div
              key={metric.title}
              className={`p-6 rounded-xl ${colors.bg} border border-gray-700`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">{metric.title}</p>
                  <p className={`text-3xl font-bold mt-1 ${colors.text}`}>
                    {formatNumber(metric.value)}
                  </p>
                  {metric.change !== 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      {metric.change > 0 ? (
                        <ArrowUp className="w-4 h-4 text-green-400" />
                      ) : (
                        <ArrowDown className="w-4 h-4 text-red-400" />
                      )}
                      <span className={metric.change > 0 ? 'text-green-400' : 'text-red-400'}>
                        {Math.abs(metric.change)}%
                      </span>
                      <span className="text-xs text-gray-500">vs last period</span>
                    </div>
                  )}
                </div>
                <div className={`p-3 rounded-lg ${colors.icon}`}>
                  <metric.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Growth Chart */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">User Growth</h2>
            <p className="text-sm text-gray-400">
              {getTotalFromGrowth()} new users in the last {timeRange === '7d' ? '7 days' : timeRange === '30d' ? '30 days' : '90 days'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-gray-400">New Users</span>
          </div>
        </div>

        {/* Chart */}
        <div className="h-64 flex items-end gap-1">
          {filteredData.length > 0 ? (
            filteredData.map((point, index) => {
              const height = (point.users / maxValue) * 100
              return (
                <div
                  key={point.date}
                  className="flex-1 flex flex-col items-center gap-1 group relative"
                  title={`${point.date}: ${point.users} new users`}
                >
                  <div
                    className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-400 cursor-pointer"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block">
                    <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                      {point.date}: {point.users} users
                    </div>
                  </div>
                  {/* X-axis labels (show every few days) */}
                  {(timeRange === '7d' || index % (timeRange === '30d' ? 5 : 15) === 0) && (
                    <span className="text-[10px] text-gray-500 mt-1">
                      {new Date(point.date).getDate()}
                    </span>
                  )}
                </div>
              )
            })
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              No data available for this period
            </div>
          )}
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Breakdown */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">User Breakdown</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Free Users</span>
              <span className="text-white font-medium">
                {formatNumber((stats?.users.total || 0) - (stats?.users.premium || 0))}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gray-500 h-2 rounded-full"
                style={{
                  width: `${((stats?.users.total || 0) - (stats?.users.premium || 0)) / (stats?.users.total || 1) * 100}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Premium Users</span>
              <span className="text-yellow-400 font-medium">
                {formatNumber(stats?.users.premium || 0)}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-yellow-500 h-2 rounded-full"
                style={{
                  width: `${(stats?.users.premium || 0) / (stats?.users.total || 1) * 100}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Deactivated</span>
              <span className="text-red-400 font-medium">
                {formatNumber(stats?.users.deactivated || 0)}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full"
                style={{
                  width: `${(stats?.users.deactivated || 0) / (stats?.users.total || 1) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Activity Summary */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Activity Summary</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-gray-700/50 rounded-lg">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-400">New Today</p>
                <p className="text-lg font-semibold text-white">{stats?.users.newToday || 0}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-3 bg-gray-700/50 rounded-lg">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Calendar className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-400">New This Week</p>
                <p className="text-lg font-semibold text-white">{stats?.users.newThisWeek || 0}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-3 bg-gray-700/50 rounded-lg">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-400">New This Month</p>
                <p className="text-lg font-semibold text-white">{stats?.users.newThisMonth || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
