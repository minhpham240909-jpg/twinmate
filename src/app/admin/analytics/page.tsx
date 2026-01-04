'use client'

// Admin Analytics Page - CEO Dashboard with Real Charts
// Using Recharts for professional data visualization

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  MessageSquare,
  Heart,
  BookOpen,
  RefreshCw,
  Activity,
  Crown,
  Eye,
  ArrowRight,
  AlertTriangle,
  Search,
  MousePointer,
  Clock,
  UserPlus,
  Globe,
} from 'lucide-react'
import {
  AreaChartCard,
  BarChartCard,
  PieChartCard,
  StatCard,
} from '@/components/admin/charts'

interface TimeSeriesPoint {
  date: string
  label: string
  value: number
}

interface BreakdownItem {
  name: string
  value: number
  fill?: string
  members?: number
}

interface AnalyticsData {
  overview: {
    totalUsers: number
    newUsersThisMonth: number
    newUsersThisWeek: number
    activeToday: number
    premiumUsers: number
    deactivatedUsers: number
    totalMessages: number
    totalSessions: number
    totalMatches: number
    totalGroups: number
    pendingReports: number
    userGrowthPercent: number
  }
  timeSeries: {
    userGrowth: TimeSeriesPoint[]
    messages: TimeSeriesPoint[]
    sessions: TimeSeriesPoint[]
    activeUsers: TimeSeriesPoint[]
    matches: TimeSeriesPoint[]
  }
  breakdowns: {
    usersByRole: BreakdownItem[]
    signupMethods: BreakdownItem[]
    topGroups: BreakdownItem[]
  }
  activity: {
    hourly: Array<{ hour: number; label: string; value: number }>
  }
}

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const response = await fetch(`/api/admin/analytics?view=charts&period=${timeRange}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to fetch analytics')
      }
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError('Failed to load analytics data')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchAnalytics()
    // Auto-refresh every 2 minutes
    const interval = setInterval(() => fetchAnalytics(), 120000)
    return () => clearInterval(interval)
  }, [fetchAnalytics])

  if (isLoading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white text-lg mb-2">Failed to load analytics</p>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => fetchAnalytics()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const overview = data?.overview
  const timeSeries = data?.timeSeries
  const breakdowns = data?.breakdowns
  const activity = data?.activity

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={overview?.totalUsers || 0}
          icon={Users}
          color="blue"
          change={overview?.userGrowthPercent}
          changeLabel="vs last month"
        />
        <StatCard
          title="Active Today"
          value={overview?.activeToday || 0}
          icon={Activity}
          color="green"
          suffix="online"
        />
        <StatCard
          title="Premium Users"
          value={overview?.premiumUsers || 0}
          icon={Crown}
          color="yellow"
        />
        <StatCard
          title="New This Week"
          value={overview?.newUsersThisWeek || 0}
          icon={UserPlus}
          color="purple"
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Area Chart */}
        {timeSeries?.userGrowth && (
          <AreaChartCard
            title="User Growth"
            subtitle={`New signups over the last ${timeRange === '7d' ? '7 days' : timeRange === '30d' ? '30 days' : '90 days'}`}
            data={timeSeries.userGrowth}
            color="#3b82f6"
            gradientId="userGrowth"
            height={280}
          />
        )}

        {/* Messages Area Chart */}
        {timeSeries?.messages && (
          <AreaChartCard
            title="Messages Sent"
            subtitle="Daily message activity"
            data={timeSeries.messages}
            color="#8b5cf6"
            gradientId="messages"
            height={280}
          />
        )}
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Breakdown Pie Chart */}
        {breakdowns?.usersByRole && (
          <PieChartCard
            title="User Breakdown"
            subtitle="Free vs Premium users"
            data={breakdowns.usersByRole}
            height={250}
            innerRadius={50}
            outerRadius={85}
          />
        )}

        {/* Signup Methods Pie Chart */}
        {breakdowns?.signupMethods && (
          <PieChartCard
            title="Signup Methods"
            subtitle="How users joined"
            data={breakdowns.signupMethods}
            height={250}
            innerRadius={50}
            outerRadius={85}
          />
        )}

        {/* Top Groups Bar Chart */}
        {breakdowns?.topGroups && breakdowns.topGroups.length > 0 && (
          <BarChartCard
            title="Top Groups"
            subtitle="By member count"
            data={breakdowns.topGroups}
            dataKey="members"
            height={250}
            horizontal
          />
        )}
      </div>

      {/* Activity Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Study Sessions Chart */}
        {timeSeries?.sessions && (
          <AreaChartCard
            title="Study Sessions"
            subtitle="Daily session activity"
            data={timeSeries.sessions}
            color="#10b981"
            gradientId="sessions"
            height={250}
          />
        )}

        {/* Hourly Activity Bar Chart */}
        {activity?.hourly && (
          <BarChartCard
            title="Hourly Activity"
            subtitle="Message activity in last 24 hours"
            data={activity.hourly.map(h => ({ name: h.label, value: h.value }))}
            height={250}
            color="#06b6d4"
          />
        )}
      </div>

      {/* More Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Messages"
          value={overview?.totalMessages || 0}
          icon={MessageSquare}
          color="indigo"
        />
        <StatCard
          title="Study Sessions"
          value={overview?.totalSessions || 0}
          icon={BookOpen}
          color="teal"
        />
        <StatCard
          title="Matches Made"
          value={overview?.totalMatches || 0}
          icon={Heart}
          color="pink"
        />
        <StatCard
          title="Groups Created"
          value={overview?.totalGroups || 0}
          icon={Globe}
          color="purple"
        />
      </div>

      {/* Active Users & Matches Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Users Chart */}
        {timeSeries?.activeUsers && (
          <AreaChartCard
            title="Daily Active Users"
            subtitle="Users who logged in each day"
            data={timeSeries.activeUsers}
            color="#f59e0b"
            gradientId="activeUsers"
            height={250}
          />
        )}

        {/* Matches Chart */}
        {timeSeries?.matches && (
          <AreaChartCard
            title="New Matches"
            subtitle="Accepted connections over time"
            data={timeSeries.matches}
            color="#ec4899"
            gradientId="matches"
            height={250}
          />
        )}
      </div>

      {/* User Behavior Analytics Link */}
      <div className="bg-gradient-to-r from-blue-500/10 to-blue-500/10 rounded-xl border border-blue-500/30 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-500 rounded-xl">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">User Behavior Analytics</h2>
              <p className="text-gray-400 text-sm">
                Track page visits, feature usage, search queries, and detect suspicious activity
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/admin/analytics/user-behavior')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            View Details
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <MousePointer className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-sm text-gray-400">Page Visits</p>
              <p className="text-white font-medium">Track all pages</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <Search className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-sm text-gray-400">Search Queries</p>
              <p className="text-white font-medium">Monitor searches</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <Clock className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm text-gray-400">Time Spent</p>
              <p className="text-white font-medium">Session duration</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-sm text-gray-400">Suspicious</p>
              <p className="text-white font-medium">Detect spam</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Reports Alert */}
      {overview?.pendingReports && overview.pendingReports > 0 && (
        <div
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 cursor-pointer hover:bg-red-500/20 transition"
          onClick={() => router.push('/admin/reports')}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <div>
              <p className="text-white font-medium">
                {overview.pendingReports} Pending Report{overview.pendingReports > 1 ? 's' : ''}
              </p>
              <p className="text-gray-400 text-sm">Click to review user reports</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
