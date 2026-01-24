'use client'

/**
 * Progress Page
 *
 * Quiet reinforcement, confidence-building
 * Shows: weekly summary, streak, weak areas, strong areas
 * No addictive gamification, no social comparison
 * Just subtle reinforcement
 */

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState, useRef } from 'react'
import { useDashboardStats } from '@/hooks/useUserStats'
import { useMilestones } from '@/hooks/useMilestones'
import BottomNav from '@/components/BottomNav'
import GuestEmptyState from '@/components/GuestEmptyState'
import { RARITY_COLORS } from '@/lib/milestones'
import {
  Flame,
  Clock,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Loader2,
  ChevronRight,
  BarChart3,
  Award,
  Shield,
} from 'lucide-react'

interface DailyActivity {
  day: string // Mon, Tue, etc.
  sessions: number
  date: Date
}

interface ProgressData {
  helpSessions: number
  minutesSaved: number
  strongTopics: string[]
  weakTopics: string[]
  conceptsLearned: number
  weeklyActivity: DailyActivity[]
}

export default function ProgressPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const { stats } = useDashboardStats()
  const { milestoneData } = useMilestones()
  const [progressData, setProgressData] = useState<ProgressData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check if user is a guest (not logged in)
  const isGuest = !loading && !user

  // For guests, stop loading immediately
  useEffect(() => {
    if (isGuest) {
      setIsLoading(false)
    }
  }, [isGuest])

  // Load progress data - only once when user is available
  // Using useRef to ensure we only generate data once
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    async function loadProgress() {
      if (!user || hasLoadedRef.current) return
      hasLoadedRef.current = true

      try {
        // Generate weekly activity data with deterministic values
        // Use day of week as seed for consistent display
        const today = new Date()
        const weeklyActivity: DailyActivity[] = []
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

        // Deterministic session counts based on day index
        // This creates a realistic-looking pattern without randomness
        const sessionPattern = [1, 3, 0, 3, 2, 5, 0] // Fixed pattern for the week

        for (let i = 6; i >= 0; i--) {
          const date = new Date(today)
          date.setDate(date.getDate() - i)
          const dayIndex = date.getDay()
          weeklyActivity.push({
            day: dayNames[dayIndex],
            // Use deterministic pattern instead of random
            sessions: sessionPattern[dayIndex],
            date,
          })
        }

        // Calculate stats-based values
        const points = stats?.points || 0
        const helpSessions = points ? Math.floor(points / 10) : 0

        // For now, use mock data - will connect to real API later
        // This structure allows easy backend integration
        setProgressData({
          helpSessions,
          minutesSaved: helpSessions * 4,
          strongTopics: ['Basic Algebra', 'Biology Cells'],
          weakTopics: ['Free-body diagrams', 'Calculus derivatives'],
          conceptsLearned: helpSessions,
          weeklyActivity,
        })
      } catch (error) {
        console.error('Error loading progress:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (!loading && user) {
      loadProgress()
    }
  }, [user, loading]) // Removed stats from dependency - only load once

  // Loading state
  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  // Guest state - show empty state with sign up prompt
  if (isGuest) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 pb-20">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border-b border-neutral-200 dark:border-neutral-800">
          <div className="max-w-lg mx-auto px-4 py-4">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
              Your Progress
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Track your learning journey
            </p>
          </div>
        </header>

        {/* Guest Empty State */}
        <GuestEmptyState pageType="progress" />

        {/* Bottom Navigation */}
        <BottomNav />
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
            Your Progress
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            This week&apos;s learning journey
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Weekly Activity Chart */}
        {progressData?.weeklyActivity && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-medium text-neutral-900 dark:text-white">
                Weekly Activity
              </h2>
            </div>

            {/* Bar Chart */}
            <div className="flex items-end justify-between gap-2 h-32 mb-2">
              {progressData.weeklyActivity.map((day, index) => {
                const maxSessions = Math.max(...progressData.weeklyActivity.map(d => d.sessions), 1)
                const heightPercent = (day.sessions / maxSessions) * 100
                const isToday = index === progressData.weeklyActivity.length - 1

                return (
                  <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                    {/* Session count */}
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {day.sessions > 0 ? day.sessions : ''}
                    </span>

                    {/* Bar */}
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        isToday
                          ? 'bg-gradient-to-t from-blue-500 to-blue-400'
                          : day.sessions > 0
                          ? 'bg-blue-200 dark:bg-blue-800'
                          : 'bg-neutral-100 dark:bg-neutral-800'
                      }`}
                      style={{
                        height: `${Math.max(heightPercent, day.sessions > 0 ? 15 : 5)}%`,
                        minHeight: day.sessions > 0 ? '12px' : '4px',
                      }}
                    />

                    {/* Day label */}
                    <span
                      className={`text-xs ${
                        isToday
                          ? 'font-semibold text-blue-600 dark:text-blue-400'
                          : 'text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      {day.day}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            <div className="flex items-center justify-center gap-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <div className="text-center">
                <p className="text-lg font-bold text-neutral-900 dark:text-white">
                  {progressData.weeklyActivity.reduce((sum, d) => sum + d.sessions, 0)}
                </p>
                <p className="text-xs text-neutral-500">total sessions</p>
              </div>
              <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-700" />
              <div className="text-center">
                <p className="text-lg font-bold text-neutral-900 dark:text-white">
                  {progressData.weeklyActivity.filter(d => d.sessions > 0).length}
                </p>
                <p className="text-xs text-neutral-500">active days</p>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Summary Card */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
          <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-4">
            This Week
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {progressData?.helpSessions || 0}
                </p>
                <p className="text-xs text-neutral-500">help sessions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {progressData?.minutesSaved || 0}
                </p>
                <p className="text-xs text-neutral-500">minutes saved</p>
              </div>
            </div>
          </div>
        </div>

        {/* Streak Card */}
        {stats && stats.streak > 0 && (
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Current streak</p>
                <p className="text-3xl font-bold mt-1">{stats.streak} days</p>
              </div>
              <Flame className="w-12 h-12 opacity-80" />
            </div>
            <p className="text-sm opacity-80 mt-3">
              {stats.streak >= 7
                ? "Amazing consistency! You've built a habit."
                : stats.streak >= 3
                ? 'Building momentum. Keep it going!'
                : "Great start! Let's keep the streak alive."}
            </p>
          </div>
        )}

        {/* XP Level Progress */}
        {milestoneData?.xpProgress && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-medium text-neutral-900 dark:text-white">
                  Level {milestoneData.xpProgress.currentLevel}
                </h2>
                <p className="text-xs text-neutral-500">
                  {milestoneData.xpProgress.totalXp} XP total
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {milestoneData.xpProgress.xpNeeded} XP
                </p>
                <p className="text-xs text-neutral-500">to next level</p>
              </div>
            </div>
            <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                style={{ width: `${milestoneData.xpProgress.progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Earned Milestones */}
        {milestoneData?.earnedMilestones && milestoneData.earnedMilestones.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <h2 className="text-sm font-medium text-neutral-900 dark:text-white">
                Milestones Earned
              </h2>
              <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium rounded-full">
                {milestoneData.earnedMilestones.length}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {milestoneData.earnedMilestones.slice(0, 6).map((milestone) => {
                const colors = RARITY_COLORS[milestone.definition.rarity]
                return (
                  <div
                    key={milestone.id}
                    className={`flex flex-col items-center p-3 rounded-xl border ${colors.bg} ${colors.border}`}
                  >
                    <span className="text-2xl mb-1">{milestone.definition.icon}</span>
                    <span className={`text-xs font-medium text-center ${colors.text}`}>
                      {milestone.definition.name}
                    </span>
                  </div>
                )
              })}
            </div>
            {milestoneData.earnedMilestones.length > 6 && (
              <p className="text-center text-xs text-neutral-500 mt-3">
                +{milestoneData.earnedMilestones.length - 6} more
              </p>
            )}
          </div>
        )}

        {/* Next Milestones */}
        {milestoneData?.nextMilestones && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
            <h2 className="text-sm font-medium text-neutral-900 dark:text-white mb-4">
              Next Milestones
            </h2>
            <div className="space-y-3">
              {milestoneData.nextMilestones.streak && (
                <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <span className="text-xl">{milestoneData.nextMilestones.streak.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      {milestoneData.nextMilestones.streak.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {milestoneData.nextMilestones.streak.requirement - milestoneData.stats.streak} days to go
                    </p>
                  </div>
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    +{milestoneData.nextMilestones.streak.xpBonus} XP
                  </span>
                </div>
              )}
              {milestoneData.nextMilestones.xp && (
                <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <span className="text-xl">{milestoneData.nextMilestones.xp.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      {milestoneData.nextMilestones.xp.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {milestoneData.nextMilestones.xp.requirement - milestoneData.stats.totalXp} XP to go
                    </p>
                  </div>
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    +{milestoneData.nextMilestones.xp.xpBonus} XP
                  </span>
                </div>
              )}
              {milestoneData.nextMilestones.sessions && (
                <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <span className="text-xl">{milestoneData.nextMilestones.sessions.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      {milestoneData.nextMilestones.sessions.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {milestoneData.nextMilestones.sessions.requirement - milestoneData.stats.totalSessions} sessions to go
                    </p>
                  </div>
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    +{milestoneData.nextMilestones.sessions.xpBonus} XP
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Streak Shields */}
        {milestoneData && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-neutral-900 dark:text-white">
                    Streak Shields
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Protects your streak if you miss a day
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {milestoneData.streakShields}
                </p>
                <p className="text-xs text-neutral-500">available</p>
              </div>
            </div>
          </div>
        )}

        {/* Strong Topics */}
        {progressData?.strongTopics && progressData.strongTopics.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h2 className="text-sm font-medium text-neutral-900 dark:text-white">
                Stronger in
              </h2>
            </div>
            <div className="space-y-2">
              {progressData.strongTopics.map((topic, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
                >
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    {topic}
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weak Topics */}
        {progressData?.weakTopics && progressData.weakTopics.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-medium text-neutral-900 dark:text-white">
                Needs work
              </h2>
            </div>
            <div className="space-y-2">
              {progressData.weakTopics.map((topic, index) => (
                <button
                  key={index}
                  onClick={() => router.push('/dashboard')}
                  className="w-full flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    {topic}
                  </span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Practice
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Concepts Learned */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
          <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">
            Total concepts explored
          </h2>
          <p className="text-4xl font-bold text-neutral-900 dark:text-white">
            {progressData?.conceptsLearned || 0}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            Keep learning, keep growing
          </p>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
