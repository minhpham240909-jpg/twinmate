'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import {
  TrendingUp,
  Clock,
  MessageSquare,
  Zap,
  BellOff,
  Crown,
  Flame,
  BarChart3,
  Trophy,
  Sparkles,
  RefreshCw,
  ArrowLeft,
  Users,
  Target,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

interface RetentionAnalytics {
  studyDebt: {
    byStatus: Record<string, { count: number; totalMinutes: number; paidMinutes: number }>
    bySource: Record<string, number>
    recentDebts: number
    completedDebtsThisWeek: number
    avgCompletionMinutes: number
  }
  reflections: {
    total: number
    thisMonth: number
    avgSatisfactionRating: number
    usersWithSummaries: number
    usersWithCompletedReflections: number
    completionRate: number
  }
  modes: {
    proModeUsers: number
    silentModeUsers: number
    proModeAdoptionRate: number
    silentModeAdoptionRate: number
  }
  gamificationOptOuts: {
    streakBadges: number
    leaderboards: number
    xpAnimations: number
    achievementPopups: number
    studyCaptainBadge: number
    totalSettingsRecords: number
  }
  studyCaptains: {
    totalBadges: number
    activeCaptains: number
    captainsThisWeek: number
    topCaptains: Array<{
      userId: string
      _count: { id: number }
      user: { id: string; name: string; avatarUrl: string | null } | null
    }>
  }
  gamificationEvents: {
    total: number
    thisWeek: number
  }
  totalUsers: number
}

export default function AdminRetentionPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [analytics, setAnalytics] = useState<RetentionAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/retention')
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data.analytics)
        setError(null)
      } else if (response.status === 403) {
        setError('Admin access required')
      } else {
        setError('Failed to fetch analytics')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && user) {
      fetchAnalytics()
    }
  }, [authLoading, user, fetchAnalytics])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg"
          >
            Back to Admin
          </button>
        </div>
      </div>
    )
  }

  if (!analytics) return null

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${Math.round(mins)}m`
    const hours = Math.floor(mins / 60)
    const minutes = Math.round(mins % 60)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  const getOptOutRate = (count: number) => {
    if (analytics.gamificationOptOuts.totalSettingsRecords === 0) return 0
    return Math.round((count / analytics.gamificationOptOuts.totalSettingsRecords) * 100)
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Retention Analytics</h1>
              <p className="text-sm text-neutral-500">Study Debt, Reflections, Gamification</p>
            </div>
          </div>
          <button
            onClick={fetchAnalytics}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Study Debt Section */}
        <section>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Study Debt Analytics
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Queued"
              value={analytics.studyDebt.byStatus['QUEUED']?.count || 0}
              subValue={formatMinutes(analytics.studyDebt.byStatus['QUEUED']?.totalMinutes || 0)}
              icon={<Clock className="w-5 h-5 text-blue-500" />}
            />
            <StatCard
              label="In Progress"
              value={analytics.studyDebt.byStatus['IN_PROGRESS']?.count || 0}
              subValue={formatMinutes(analytics.studyDebt.byStatus['IN_PROGRESS']?.paidMinutes || 0) + ' paid'}
              icon={<TrendingUp className="w-5 h-5 text-yellow-500" />}
            />
            <StatCard
              label="Completed This Week"
              value={analytics.studyDebt.completedDebtsThisWeek}
              icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
            />
            <StatCard
              label="Avg Completion"
              value={formatMinutes(analytics.studyDebt.avgCompletionMinutes)}
              icon={<Target className="w-5 h-5 text-purple-500" />}
            />
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-3">Debt Sources</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(analytics.studyDebt.bySource).map(([source, count]) => (
                <div key={source} className="text-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <p className="text-lg font-bold text-neutral-900 dark:text-white">{count}</p>
                  <p className="text-xs text-neutral-500">{source.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Weekly Reflections Section */}
        <section>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            Weekly Reflections
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Reflections"
              value={analytics.reflections.total}
              icon={<MessageSquare className="w-5 h-5 text-blue-500" />}
            />
            <StatCard
              label="This Month"
              value={analytics.reflections.thisMonth}
              icon={<TrendingUp className="w-5 h-5 text-green-500" />}
            />
            <StatCard
              label="Completion Rate"
              value={`${analytics.reflections.completionRate}%`}
              subValue={`${analytics.reflections.usersWithCompletedReflections}/${analytics.reflections.usersWithSummaries} users`}
              icon={<Target className="w-5 h-5 text-purple-500" />}
            />
            <StatCard
              label="Avg Satisfaction"
              value={analytics.reflections.avgSatisfactionRating.toFixed(1)}
              subValue="out of 5"
              icon={<Sparkles className="w-5 h-5 text-yellow-500" />}
            />
          </div>
        </section>

        {/* Pro/Silent Mode Section */}
        <section>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-neutral-900 dark:text-white" />
            Pro & Silent Mode Adoption
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Pro Mode Users"
              value={analytics.modes.proModeUsers}
              subValue={`${analytics.modes.proModeAdoptionRate}% adoption`}
              icon={<Zap className="w-5 h-5" />}
              bgColor="bg-neutral-900 dark:bg-neutral-800"
              textColor="text-white"
            />
            <StatCard
              label="Silent Mode Users"
              value={analytics.modes.silentModeUsers}
              subValue={`${analytics.modes.silentModeAdoptionRate}% adoption`}
              icon={<BellOff className="w-5 h-5 text-neutral-400" />}
            />
            <StatCard
              label="Total Users"
              value={analytics.totalUsers}
              icon={<Users className="w-5 h-5 text-blue-500" />}
            />
            <StatCard
              label="Settings Records"
              value={analytics.gamificationOptOuts.totalSettingsRecords}
              icon={<BarChart3 className="w-5 h-5 text-neutral-500" />}
            />
          </div>
        </section>

        {/* Gamification Opt-Outs Section */}
        <section>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            Gamification Opt-Outs
          </h2>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              <OptOutRow
                icon={<Flame className="w-5 h-5 text-orange-500" />}
                label="Streak Badges"
                count={analytics.gamificationOptOuts.streakBadges}
                rate={getOptOutRate(analytics.gamificationOptOuts.streakBadges)}
              />
              <OptOutRow
                icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
                label="Leaderboards"
                count={analytics.gamificationOptOuts.leaderboards}
                rate={getOptOutRate(analytics.gamificationOptOuts.leaderboards)}
              />
              <OptOutRow
                icon={<Sparkles className="w-5 h-5 text-purple-500" />}
                label="XP Animations"
                count={analytics.gamificationOptOuts.xpAnimations}
                rate={getOptOutRate(analytics.gamificationOptOuts.xpAnimations)}
              />
              <OptOutRow
                icon={<Trophy className="w-5 h-5 text-yellow-500" />}
                label="Achievement Popups"
                count={analytics.gamificationOptOuts.achievementPopups}
                rate={getOptOutRate(analytics.gamificationOptOuts.achievementPopups)}
              />
              <OptOutRow
                icon={<Crown className="w-5 h-5 text-amber-500" />}
                label="Study Captain Badge"
                count={analytics.gamificationOptOuts.studyCaptainBadge}
                rate={getOptOutRate(analytics.gamificationOptOuts.studyCaptainBadge)}
              />
            </div>
          </div>
        </section>

        {/* Study Captains Section */}
        <section>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            Study Captain Badges
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <StatCard
              label="Total Badges Awarded"
              value={analytics.studyCaptains.totalBadges}
              icon={<Crown className="w-5 h-5 text-amber-500" />}
            />
            <StatCard
              label="Active Captains"
              value={analytics.studyCaptains.activeCaptains}
              icon={<Users className="w-5 h-5 text-green-500" />}
            />
            <StatCard
              label="Awarded This Week"
              value={analytics.studyCaptains.captainsThisWeek}
              icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
            />
          </div>

          {analytics.studyCaptains.topCaptains.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-3">Top Captains (Most Badges)</h3>
              <div className="space-y-2">
                {analytics.studyCaptains.topCaptains.slice(0, 5).map((captain, i) => (
                  <div key={captain.userId} className="flex items-center gap-3 p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <span className="w-6 h-6 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-sm font-bold text-amber-700 dark:text-amber-400">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {captain.user?.name || 'Unknown User'}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-amber-600">{captain._count.id} badges</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  subValue,
  icon,
  bgColor = 'bg-white dark:bg-neutral-900',
  textColor = 'text-neutral-900 dark:text-white',
}: {
  label: string
  value: number | string
  subValue?: string
  icon: React.ReactNode
  bgColor?: string
  textColor?: string
}) {
  return (
    <div className={`${bgColor} border border-neutral-200 dark:border-neutral-800 rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-neutral-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
      {subValue && <p className="text-xs text-neutral-500 mt-1">{subValue}</p>}
    </div>
  )
}

function OptOutRow({
  icon,
  label,
  count,
  rate,
}: {
  icon: React.ReactNode
  label: string
  count: number
  rate: number
}) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center">
          {icon}
        </div>
        <span className="font-medium text-neutral-900 dark:text-white">{label}</span>
      </div>
      <div className="text-right">
        <p className="font-bold text-neutral-900 dark:text-white">{count} users</p>
        <p className="text-xs text-neutral-500">{rate}% opt-out rate</p>
      </div>
    </div>
  )
}
