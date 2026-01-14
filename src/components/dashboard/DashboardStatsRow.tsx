'use client'

import { useTranslations } from 'next-intl'

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

export default function DashboardStatsRow({ userStats }: DashboardStatsRowProps) {
  const t = useTranslations('dashboard')

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {/* Streak Card */}
      <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.5 2.75a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5zM7.47 4.22a.75.75 0 00-1.06 1.06l1.77 1.77a.75.75 0 001.06-1.06L7.47 4.22zM17.59 5.28a.75.75 0 10-1.06-1.06l-1.77 1.77a.75.75 0 001.06 1.06l1.77-1.77zM12 8a4 4 0 00-4 4c0 1.22.55 2.32 1.41 3.06.26.22.59.44.59.94v1.5a2.5 2.5 0 005 0V16c0-.5.33-.72.59-.94A4 4 0 0012 8zm-1.5 9.5V16h3v1.5a1 1 0 11-2 0 1 1 0 01-1 0z"/>
          </svg>
          <span className="text-xs sm:text-sm font-medium opacity-90">{t('studyStreak') || 'Study Streak'}</span>
        </div>
        <p className="text-3xl sm:text-4xl font-black">{userStats?.streak.current || 0}</p>
        <p className="text-xs opacity-80 mt-1">
          {userStats?.streak.current === 1 ? 'day' : 'days'} • Best: {userStats?.streak.longest || 0}
        </p>
      </div>

      {/* Today's Study Time */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs sm:text-sm font-medium opacity-90">{t('todayStudy') || 'Today'}</span>
        </div>
        <p className="text-3xl sm:text-4xl font-black">{userStats?.studyTime.today.display || '0m'}</p>
        <p className="text-xs opacity-80 mt-1">{userStats?.sessions.today || 0} sessions</p>
      </div>

      {/* This Week */}
      <div className="bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs sm:text-sm font-medium opacity-90">{t('thisWeek') || 'This Week'}</span>
        </div>
        <p className="text-3xl sm:text-4xl font-black">{userStats?.studyTime.thisWeek.display || '0m'}</p>
        <p className="text-xs opacity-80 mt-1">{userStats?.sessions.thisWeek || 0} sessions</p>
      </div>

      {/* Total Points */}
      <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <span className="text-xs sm:text-sm font-medium opacity-90">{t('totalPoints') || 'Points'}</span>
        </div>
        <p className="text-3xl sm:text-4xl font-black">{userStats?.points || 0}</p>
        <p className="text-xs opacity-80 mt-1">{t('allTime') || 'all time'}</p>
      </div>
    </div>
  )
}
