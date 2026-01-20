'use client'

/**
 * Dashboard Page - Redesigned for Vision
 *
 * Core principle: ONE primary CTA, remove decision paralysis
 *
 * Layout:
 * 1. Primary CTA: "Continue Studying" or "Start Studying"
 * 2. Social Gravity: "X classmates studying now"
 * 3. Secondary actions: "I'm stuck", Quick Focus, Solo Study
 * 4. Stats (collapsed/subtle)
 *
 * Everything serves the goal: Get user to START studying
 */

import { useAuth } from '@/lib/auth/context'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import NotificationPanel from '@/components/NotificationPanel'
import { useUserSync } from '@/hooks/useUserSync'
import { useDashboardStats, useActiveSession, useDashboardCounts, useOnlinePartners } from '@/hooks/useUserStats'
import { useTranslations } from 'next-intl'
import { useNotificationPermission } from '@/hooks/useNotificationPermission'
import { subscribeToUnreadMessages } from '@/lib/supabase/realtime'
import PushNotificationPrompt from '@/components/PushNotificationPrompt'
import QuickWinModal from '@/components/QuickWinModal'
import {
  DashboardTopBar,
  StartStudyingCTA,
  ClassmatesStudying,
  ImStuckFlow,
  DashboardPartnersSection,
  StudySuggestions,
  GlobalLeaderboard,
  // Progressive Disclosure
  calculateUserTier,
  shouldShowFeature,
  NewUserWelcome,
  UnlockTeasersSection,
  FeatureGate,
} from '@/components/dashboard'
import { Flame, Clock, Star, Zap } from 'lucide-react'

// Types
interface StudyingPartner {
  id: string
  name: string
  avatarUrl: string | null
  subject?: string
  activityType?: string
}

export default function DashboardPage() {
  const { user, profile, loading, configError, profileError, signOut, refreshUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const lastPathnameRef = useRef(pathname)
  const tCommon = useTranslations('common')
  const { requestPermission, hasBeenAsked, isGranted, isSupported } = useNotificationPermission()

  // Notification state
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)

  // Dashboard counts - using React Query for caching (replaces 5 separate API calls with 1)
  const { data: countsData, refetch: refetchCounts } = useDashboardCounts()
  const pendingInvitesCount = countsData?.counts?.pendingInvites || 0
  const connectionRequestsCount = countsData?.counts?.connectionRequests || 0
  const groupInvitesCount = countsData?.counts?.groupInvites || 0
  const newCommunityPostsCount = countsData?.counts?.newCommunityPosts || 0
  const unreadMessagesCount = countsData?.counts?.unreadMessages?.total || 0

  // Session state - using React Query for caching (prevents flickering on navigation)
  const { activeSession, lastSession, refetch: refetchSessionData } = useActiveSession()

  // Social gravity state
  const [studyingPartners, setStudyingPartners] = useState<StudyingPartner[]>([])
  const [totalStudying, setTotalStudying] = useState(0)

  // Stats - using React Query for caching (prevents disappearing on navigation)
  const { stats: dashboardStats, refetch: refetchStats } = useDashboardStats()

  // Partner data - using React Query for caching and automatic polling
  const { onlinePartners, partnersCount, isLoading: loadingPartners } = useOnlinePartners()

  // Transform dashboardStats to match DashboardStatsRow expected format
  const userStats = dashboardStats ? {
    streak: { current: dashboardStats.streak, longest: dashboardStats.streak },
    studyTime: {
      today: { value: dashboardStats.todayMinutes, unit: dashboardStats.todayMinutes >= 60 ? 'hr' : 'min', display: dashboardStats.todayFormatted },
      thisWeek: { value: dashboardStats.weekMinutes, unit: dashboardStats.weekMinutes >= 60 ? 'hr' : 'min', display: dashboardStats.weekFormatted },
      allTime: { value: dashboardStats.allTimeMinutes, unit: dashboardStats.allTimeMinutes >= 60 ? 'hr' : 'min', display: `${Math.floor(dashboardStats.allTimeMinutes / 60)}h` },
    },
    sessions: { today: dashboardStats.todaySessions, thisWeek: dashboardStats.weekSessions, allTime: dashboardStats.allTimeSessions },
    points: dashboardStats.points,
  } : null

  // Quick Win modal state
  const [showQuickWin, setShowQuickWin] = useState(false)
  const [quickWinType, setQuickWinType] = useState<'first_session' | 'streak_started' | 'streak_milestone'>('first_session')

  // Group IDs for real-time
  const [groupIds, setGroupIds] = useState<string[]>([])

  useUserSync()

  // Refetch session data on visibility change, focus, and storage changes
  useEffect(() => {
    if (!user || loading) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetchSessionData()
      }
    }

    const handleFocus = () => {
      refetchSessionData()
    }

    // Listen for storage changes (when session is cleared in another component)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'solo_study_active_session' && e.newValue === null) {
        refetchSessionData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [user, loading, refetchSessionData])

  // Refresh session data when navigating back to dashboard from another page
  useEffect(() => {
    if (pathname === '/dashboard' && lastPathnameRef.current !== '/dashboard') {
      refetchSessionData()
    }
    lastPathnameRef.current = pathname
  }, [pathname, refetchSessionData])

  // Fetch social gravity data (classmates studying)
  useEffect(() => {
    if (!user || loading) return

    const abortController = new AbortController()

    const fetchPresenceData = async () => {
      try {
        const response = await fetch('/api/presence/classmates', {
          signal: abortController.signal,
        })
        if (response.ok) {
          const data = await response.json()
          setStudyingPartners(data.studyingPartners || [])
          setTotalStudying(data.totalStudying || 0)
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Error fetching presence data:', error)
      }
    }

    fetchPresenceData()
    const interval = setInterval(fetchPresenceData, 15000) // Refresh every 15s

    return () => {
      abortController.abort()
      clearInterval(interval)
    }
  }, [user, loading])

  // Refetch stats and counts when page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetchStats()
        refetchCounts()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refetchStats, refetchCounts])

  // Fetch group IDs for real-time
  useEffect(() => {
    if (!user) return

    const abortController = new AbortController()

    const fetchGroupIds = async () => {
      try {
        const response = await fetch('/api/groups/my-groups', { signal: abortController.signal })
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.groups) {
            setGroupIds(data.groups.map((g: { id: string }) => g.id))
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
      }
    }

    fetchGroupIds()

    return () => {
      abortController.abort()
    }
  }, [user])

  // Real-time message subscription - refetch counts when new messages arrive
  useEffect(() => {
    if (!user) return

    const cleanup = subscribeToUnreadMessages(user.id, () => refetchCounts(), groupIds.length > 0 ? groupIds : undefined)

    return () => {
      cleanup()
    }
  }, [user, groupIds, refetchCounts])

  // Request notification permission
  useEffect(() => {
    if (!user || !isSupported || hasBeenAsked() || isGranted) return

    const timer = setTimeout(() => {
      requestPermission()
    }, 5000)

    return () => clearTimeout(timer)
  }, [user, isSupported, hasBeenAsked, isGranted, requestPermission])

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      const urlParams = new URLSearchParams(window.location.search)
      const isFromAuthCallback = urlParams.get('auth_callback') === 'true'

      if (!isFromAuthCallback) {
        router.push('/auth')
      }
    }
  }, [user, loading, router])

  // Check for quick win (first session, streak milestone)
  useEffect(() => {
    if (!userStats || typeof window === 'undefined') return

    const hasShownFirstWin = localStorage.getItem('clerva_first_win_shown') === 'true'
    const lastStreakMilestoneShown = parseInt(localStorage.getItem('clerva_streak_milestone') || '0', 10)

    // First session ever
    if (userStats.sessions.allTime === 1 && !hasShownFirstWin) {
      setQuickWinType('first_session')
      setShowQuickWin(true)
      localStorage.setItem('clerva_first_win_shown', 'true')
      return
    }

    // Streak milestones (7, 14, 30, 60, 100)
    const milestones = [7, 14, 30, 60, 100]
    const currentStreak = userStats.streak.current
    for (const milestone of milestones) {
      if (currentStreak >= milestone && lastStreakMilestoneShown < milestone) {
        setQuickWinType('streak_milestone')
        setShowQuickWin(true)
        localStorage.setItem('clerva_streak_milestone', String(milestone))
        break
      }
    }
  }, [userStats])

  // Error states
  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-center max-w-lg p-8">
          <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">Configuration Required</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            Please ensure all required environment variables are set.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="w-16 h-16 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (user && profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-center max-w-md p-8">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Connection Error</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">{profileError}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => refreshUser()}
              className="px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl font-semibold"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-xl font-semibold"
            >
              {tCommon('refreshPage')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="w-16 h-16 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Top Bar */}
      <DashboardTopBar
        profileName={profile.name}
        profileAvatarUrl={profile.avatarUrl ?? null}
        profileRole={profile.role === 'PREMIUM' ? tCommon('premiumAccount') : tCommon('freeAccount')}
        isAdmin={profile.isAdmin ?? false}
        onSignOut={signOut}
        unreadCount={unreadCount}
        unreadMessagesCount={unreadMessagesCount}
        pendingInvitesCount={pendingInvitesCount}
        connectionRequestsCount={connectionRequestsCount}
        groupInvitesCount={groupInvitesCount}
        newCommunityPostsCount={newCommunityPostsCount}
        onNotificationsClick={() => setShowNotifications(!showNotifications)}
        onChatClick={() => router.push('/chat')}
      />

      {/* Main Content - Progressive Disclosure Based on User Tier */}
      <main className="px-4 sm:px-6 lg:px-8 py-4 max-w-4xl mx-auto">
        {(() => {
          // Calculate user tier for progressive disclosure
          const totalSessions = userStats?.sessions.allTime || 0
          const userTier = calculateUserTier(totalSessions)
          const isNewUser = userTier === 'new_user'

          return (
            <div className="space-y-4">
              {/* NEW USER WELCOME - Only shown for users with < 3 sessions */}
              {isNewUser && (
                <NewUserWelcome
                  userName={profile.name}
                  sessionsCompleted={totalSessions}
                />
              )}

              {/* ROW 1: Main CTA + Quick Stats side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* PRIMARY CTA: Start/Continue Studying - ALWAYS VISIBLE */}
                <div className={isNewUser ? 'lg:col-span-3' : 'lg:col-span-2'}>
                  <StartStudyingCTA
                    userName={profile.name}
                    activeSession={activeSession}
                    lastSession={lastSession}
                    onEndSession={() => refetchSessionData()}
                  />
                </div>

                {/* Quick Stats Card - Hidden for new users (< 5 sessions) */}
                <FeatureGate feature="quick_stats" sessionsCompleted={totalSessions}>
                  {userStats && (
                    <div className="lg:col-span-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
                      <div className="grid grid-cols-3 gap-2 h-full">
                        {/* Streak */}
                        <div className="text-center flex flex-col justify-center">
                          <div className="w-9 h-9 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center mx-auto mb-1.5">
                            <Flame className="w-4 h-4 text-neutral-900 dark:text-white" />
                          </div>
                          <p className="text-xl font-black text-neutral-900 dark:text-white">{userStats.streak.current}</p>
                          <p className="text-[10px] text-neutral-500">streak</p>
                        </div>
                        {/* Today */}
                        <div className="text-center flex flex-col justify-center border-x border-neutral-200 dark:border-neutral-700">
                          <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-1.5">
                            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <p className="text-xl font-black text-neutral-900 dark:text-white">{userStats.studyTime.today.display}</p>
                          <p className="text-[10px] text-neutral-500">today</p>
                        </div>
                        {/* Points */}
                        <div className="text-center flex flex-col justify-center">
                          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-1.5">
                            <Star className="w-4 h-4 text-white" />
                          </div>
                          <p className="text-xl font-black text-neutral-900 dark:text-white">{userStats.points}</p>
                          <p className="text-[10px] text-neutral-500">points</p>
                        </div>
                      </div>
                    </div>
                  )}
                </FeatureGate>
              </div>

              {/* AI Study Suggestions - Always show but limited for new users */}
              <StudySuggestions maxSuggestions={isNewUser ? 1 : undefined} />

              {/* UNLOCK TEASERS - Shows what's coming next */}
              {isNewUser && (
                <UnlockTeasersSection sessionsCompleted={totalSessions} />
              )}

              {/* ROW 2: Quick Actions + Classmates - Hidden for new users */}
              <FeatureGate feature="quick_actions" sessionsCompleted={totalSessions}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-2">
                    <ImStuckFlow />
                    <button
                      onClick={() => router.push('/focus/quick-session')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl transition-colors"
                    >
                      <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium text-sm text-neutral-900 dark:text-white">Quick Session</span>
                    </button>
                  </div>

                  {/* Partners Studying */}
                  <FeatureGate feature="classmates" sessionsCompleted={totalSessions}>
                    <ClassmatesStudying
                      studyingPartners={studyingPartners}
                      totalStudying={totalStudying}
                    />
                  </FeatureGate>
                </div>
              </FeatureGate>

              {/* ROW 3: Partners + Weekly Stats - Hidden for new users */}
              <FeatureGate feature="partners" sessionsCompleted={totalSessions}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Partners Section */}
                  <div className="lg:col-span-2">
                    <DashboardPartnersSection
                      partnersCount={partnersCount}
                      onlinePartners={onlinePartners.map(p => ({
                        id: p.id,
                        name: p.name,
                        avatarUrl: p.avatarUrl,
                        onlineStatus: p.onlineStatus,
                        activityType: p.activityType,
                        activityDetails: p.activityDetails,
                        streak: p.streak,
                      }))}
                      loadingOnlinePartners={loadingPartners}
                    />
                  </div>

                  {/* Weekly Stats */}
                  <FeatureGate feature="weekly_stats" sessionsCompleted={totalSessions}>
                    {userStats && (
                      <div className="lg:col-span-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
                        <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">This Week</h3>
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-neutral-600 dark:text-neutral-400">Study time</span>
                            <span className="text-base font-bold text-neutral-900 dark:text-white">{userStats.studyTime.thisWeek.display}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-neutral-600 dark:text-neutral-400">Sessions</span>
                            <span className="text-base font-bold text-neutral-900 dark:text-white">{userStats.sessions.thisWeek}</span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700">
                            <span className="text-sm text-neutral-600 dark:text-neutral-400">All time</span>
                            <span className="text-base font-bold text-neutral-900 dark:text-white">{userStats.studyTime.allTime.display}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </FeatureGate>
                </div>
              </FeatureGate>

              {/* ROW 4: Global Leaderboard - Progressive disclosure with locked state */}
              <GlobalLeaderboard
                isLocked={!shouldShowFeature('leaderboard', totalSessions)}
              />
            </div>
          )
        })()}
      </main>

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onUnreadCountChange={setUnreadCount}
      />

      {/* Push Notification Prompt */}
      <PushNotificationPrompt delay={5000} />

      {/* Quick Win Modal */}
      <QuickWinModal
        isOpen={showQuickWin}
        onClose={() => setShowQuickWin(false)}
        winType={quickWinType}
        streakCount={userStats?.streak.current || 1}
        sessionCount={userStats?.sessions.allTime || 1}
        studyMinutes={userStats?.studyTime.allTime.value || 0}
      />
    </div>
  )
}
