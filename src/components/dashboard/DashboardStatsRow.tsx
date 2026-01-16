'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Flame, Clock, Calendar, Star, TrendingUp, ChevronRight } from 'lucide-react'
import RewardsShop from '@/components/shop/RewardsShop'

interface UserStats {
  streak: { current: number; longest: number }
  studyTime: {
    today: { value: number; unit: string; display: string }
    thisWeek: { value: number; unit: string; display: string }
    allTime: { value: number; unit: string; display: string }
  }
  sessions: { today: number; thisWeek: number; allTime: number }
  points: number
}

interface DashboardStatsRowProps {
  userStats: UserStats | null
}

// Motivational messages based on streak
const getStreakMessage = (streak: number): string => {
  if (streak === 0) return "Start your streak today!"
  if (streak === 1) return "Great start!"
  if (streak < 7) return "Building momentum!"
  if (streak < 14) return "You're on fire!"
  if (streak < 30) return "Incredible dedication!"
  return "Unstoppable!"
}

export default function DashboardStatsRow({ userStats }: DashboardStatsRowProps) {
  const t = useTranslations('dashboard')
  const [showCelebration, setShowCelebration] = useState(false)
  const [animateStreak, setAnimateStreak] = useState(false)
  const [showShop, setShowShop] = useState(false)

  // Animate streak on mount if user has a streak
  useEffect(() => {
    if (userStats?.streak.current && userStats.streak.current > 0) {
      setAnimateStreak(true)
      const timer = setTimeout(() => setAnimateStreak(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [userStats?.streak.current])

  // Calculate daily goal progress (default 30 min/day goal)
  const dailyGoalMinutes = 30
  const todayMinutes = userStats?.studyTime.today.value || 0
  const todayUnit = userStats?.studyTime.today.unit || 'min'
  const actualTodayMinutes = todayUnit === 'hr' ? todayMinutes * 60 : todayMinutes
  const dailyProgress = Math.min((actualTodayMinutes / dailyGoalMinutes) * 100, 100)

  return (
    <div className="space-y-4">
      {/* Main Stats Grid - Clean 4-column layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Streak Card */}
        <button
          onClick={() => userStats?.streak.current && userStats.streak.current > 0 && setShowCelebration(true)}
          className={`relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left hover:border-neutral-300 dark:hover:border-neutral-700 transition-all ${animateStreak ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center">
              <Flame className="w-5 h-5 text-neutral-900 dark:text-white" />
            </div>
            {userStats?.streak.current && userStats.streak.current >= 7 && (
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                Best: {userStats.streak.longest}
              </span>
            )}
          </div>

          <p className={`text-3xl font-black text-neutral-900 dark:text-white ${animateStreak ? 'animate-pulse' : ''}`}>
            {userStats?.streak.current || 0}
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('studyStreak') || 'day streak'}
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            {getStreakMessage(userStats?.streak.current || 0)}
          </p>
        </button>

        {/* Today's Study Time */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            {/* Progress ring */}
            <div className="w-9 h-9 relative">
              <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" className="text-neutral-200 dark:text-neutral-700" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke="currentColor"
                  className="text-blue-600 dark:text-blue-400"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${dailyProgress * 0.88} 88`}
                />
              </svg>
              {dailyProgress >= 100 && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400">✓</span>
              )}
            </div>
          </div>

          <p className="text-3xl font-black text-neutral-900 dark:text-white">
            {userStats?.studyTime.today.display || '0m'}
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('todayStudy') || 'today'}
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            {userStats?.sessions.today || 0} sessions
          </p>
        </div>

        {/* This Week */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-neutral-900 dark:text-white" />
            </div>
            {userStats?.sessions.thisWeek && userStats.sessions.thisWeek > 0 && (
              <TrendingUp className="w-4 h-4 text-neutral-400" />
            )}
          </div>

          <p className="text-3xl font-black text-neutral-900 dark:text-white">
            {userStats?.studyTime.thisWeek.display || '0m'}
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('thisWeek') || 'this week'}
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            {userStats?.sessions.thisWeek || 0} sessions
          </p>
        </div>

        {/* Points - Opens Shop */}
        <button
          onClick={() => setShowShop(true)}
          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-white" />
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
          </div>

          <p className="text-3xl font-black text-neutral-900 dark:text-white">
            {userStats?.points || 0}
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('totalPoints') || 'points'}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 group-hover:underline">
            Open shop
          </p>
        </button>
      </div>

      {/* Daily Goal Progress Bar - Minimal */}
      {actualTodayMinutes > 0 && actualTodayMinutes < dailyGoalMinutes && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-900 dark:text-white">
              Daily Goal
            </span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {actualTodayMinutes}m / {dailyGoalMinutes}m
            </span>
          </div>
          <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${dailyProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Streak Celebration Modal - Clean design */}
      {showCelebration && userStats?.streak.current && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCelebration(false)}
        >
          <div
            className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Flame className="w-8 h-8 text-neutral-900 dark:text-white" />
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">
              {userStats.streak.current} Day Streak
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6">
              {getStreakMessage(userStats.streak.current)}
            </p>

            {/* Streak visualization */}
            <div className="flex justify-center gap-1.5 mb-6">
              {Array.from({ length: Math.min(userStats.streak.current, 7) }).map((_, i) => (
                <div key={i} className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Flame className="w-4 h-4 text-white" />
                </div>
              ))}
              {userStats.streak.current > 7 && (
                <div className="w-8 h-8 bg-neutral-900 dark:bg-white rounded-lg flex items-center justify-center">
                  <span className="text-white dark:text-neutral-900 text-xs font-bold">
                    +{userStats.streak.current - 7}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowCelebration(false)}
              className="w-full py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
            >
              Keep going
            </button>
          </div>
        </div>
      )}

      {/* Rewards Shop Modal */}
      <RewardsShop isOpen={showShop} onClose={() => setShowShop(false)} />
    </div>
  )
}
