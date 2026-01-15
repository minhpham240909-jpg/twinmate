'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Flame, Clock, Calendar, Star, TrendingUp, Zap, ShoppingBag } from 'lucide-react'
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
  if (streak === 1) return "Great start! Keep it going!"
  if (streak < 7) return "Building momentum!"
  if (streak < 14) return "You're on fire! 🔥"
  if (streak < 30) return "Incredible dedication!"
  if (streak < 100) return "Unstoppable! 💪"
  return "Legendary streak! 🏆"
}

// Get streak fire intensity
const getStreakIntensity = (streak: number): string => {
  if (streak === 0) return 'opacity-40'
  if (streak < 3) return 'opacity-60'
  if (streak < 7) return 'opacity-80'
  return 'opacity-100 animate-pulse'
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
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Streak Card - Enhanced with fire animation */}
        <div
          className={`relative overflow-hidden bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-4 sm:p-5 text-white shadow-lg cursor-pointer hover:scale-[1.02] transition-transform ${animateStreak ? 'ring-4 ring-orange-300 ring-opacity-50' : ''}`}
          onClick={() => userStats?.streak.current && userStats.streak.current > 0 && setShowCelebration(true)}
        >
          {/* Fire particles background effect */}
          {userStats?.streak.current && userStats.streak.current >= 7 && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-4 left-1/4 w-2 h-2 bg-yellow-300 rounded-full animate-ping opacity-60" />
              <div className="absolute -top-2 right-1/3 w-1.5 h-1.5 bg-orange-300 rounded-full animate-ping opacity-40 delay-300" />
              <div className="absolute top-2 right-1/4 w-1 h-1 bg-yellow-200 rounded-full animate-ping opacity-50 delay-700" />
            </div>
          )}

          <div className="flex items-center gap-2 mb-2">
            <Flame className={`w-5 h-5 sm:w-6 sm:h-6 ${getStreakIntensity(userStats?.streak.current || 0)}`} />
            <span className="text-xs sm:text-sm font-medium opacity-90">{t('studyStreak') || 'Study Streak'}</span>
          </div>

          <p className={`text-3xl sm:text-4xl font-black ${animateStreak ? 'animate-bounce' : ''}`}>
            {userStats?.streak.current || 0}
          </p>

          <p className="text-xs opacity-90 mt-1 font-medium">
            {getStreakMessage(userStats?.streak.current || 0)}
          </p>

          {userStats?.streak.current && userStats.streak.current > 0 && userStats.streak.longest > userStats.streak.current && (
            <p className="text-xs opacity-70 mt-0.5">
              Best: {userStats.streak.longest} days
            </p>
          )}
        </div>

        {/* Today's Study Time - With Progress Ring */}
        <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-xs sm:text-sm font-medium opacity-90">{t('todayStudy') || 'Today'}</span>
            </div>
            {/* Mini progress indicator */}
            <div className="w-8 h-8 relative">
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                <circle
                  cx="16" cy="16" r="12"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${dailyProgress * 0.754} 75.4`}
                />
              </svg>
              {dailyProgress >= 100 && (
                <span className="absolute inset-0 flex items-center justify-center text-xs">✓</span>
              )}
            </div>
          </div>

          <p className="text-3xl sm:text-4xl font-black">{userStats?.studyTime.today.display || '0m'}</p>

          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs opacity-80">{userStats?.sessions.today || 0} sessions</p>
            {actualTodayMinutes > 0 && (
              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">
                {Math.round(dailyProgress)}% of goal
              </span>
            )}
          </div>
        </div>

        {/* This Week */}
        <div className="bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium opacity-90">{t('thisWeek') || 'This Week'}</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black">{userStats?.studyTime.thisWeek.display || '0m'}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs opacity-80">{userStats?.sessions.thisWeek || 0} sessions</p>
            {userStats?.sessions.thisWeek && userStats.sessions.thisWeek > 0 && (
              <TrendingUp className="w-3 h-3 opacity-80" />
            )}
          </div>
        </div>

        {/* Total Points - With level indicator and shop button */}
        <div
          className="relative bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl p-4 sm:p-5 text-white shadow-lg overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
          onClick={() => setShowShop(true)}
        >
          {/* Level badge */}
          {userStats?.points && userStats.points >= 100 && (
            <div className="absolute top-2 right-2">
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                Lvl {Math.floor((userStats.points || 0) / 100) + 1}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium opacity-90">{t('totalPoints') || 'Points'}</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black">{userStats?.points || 0}</p>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 opacity-80" />
              <p className="text-xs opacity-80">{t('allTime') || 'all time'}</p>
            </div>
            <div className="flex items-center gap-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
              <ShoppingBag className="w-3 h-3" />
              <span>Shop</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Goal Progress Bar (shown when user has activity) */}
      {actualTodayMinutes > 0 && actualTodayMinutes < dailyGoalMinutes && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Daily Goal Progress
            </span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {actualTodayMinutes}m / {dailyGoalMinutes}m
            </span>
          </div>
          <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${dailyProgress}%` }}
            />
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
            {dailyGoalMinutes - actualTodayMinutes} more minutes to reach your daily goal! 💪
          </p>
        </div>
      )}

      {/* Celebration Modal for Streak */}
      {showCelebration && userStats?.streak.current && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCelebration(false)}
        >
          <div
            className="bg-white dark:bg-neutral-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-6xl mb-4">🔥</div>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
              {userStats.streak.current} Day Streak!
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              {getStreakMessage(userStats.streak.current)}
            </p>
            <div className="flex justify-center gap-2 mb-4">
              {Array.from({ length: Math.min(userStats.streak.current, 7) }).map((_, i) => (
                <div key={i} className="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center">
                  <Flame className="w-4 h-4 text-white" />
                </div>
              ))}
              {userStats.streak.current > 7 && (
                <span className="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  +{userStats.streak.current - 7}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowCelebration(false)}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 transition-all"
            >
              Keep it going! 🚀
            </button>
          </div>
        </div>
      )}

      {/* Rewards Shop Modal */}
      <RewardsShop isOpen={showShop} onClose={() => setShowShop(false)} />
    </div>
  )
}
