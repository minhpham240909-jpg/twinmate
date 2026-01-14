'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import NotificationPanel from '@/components/NotificationPanel'
import { useUserSync } from '@/hooks/useUserSync'
import { useTranslations } from 'next-intl'
import { useNotificationPermission } from '@/hooks/useNotificationPermission'
import { subscribeToUnreadMessages } from '@/lib/supabase/realtime'
import PushNotificationPrompt from '@/components/PushNotificationPrompt'
import { AIPartnerSuggestionModal } from '@/components/ai-partner'
import DashboardAIWidget from '@/components/ai-partner/DashboardAIWidget'
import QuickFocusCard from '@/components/QuickFocusCard'
import {
  DashboardTopBar,
  DashboardStatsRow,
  DashboardSearch,
  DashboardPartnersSection,
} from '@/components/dashboard'

// Profile completion check function
const isProfileComplete = (profile: any): boolean => {
  if (!profile) return false

  const hasBio = Boolean(profile.bio && typeof profile.bio === 'string' && profile.bio.trim().length > 0)
  const hasSubjects = Boolean(Array.isArray(profile.subjects) && profile.subjects.length > 0)
  const hasInterests = Boolean(Array.isArray(profile.interests) && profile.interests.length > 0)
  const hasAge = profile.age !== null && profile.age !== undefined && typeof profile.age === 'number'
  const hasRole = Boolean(profile.profileRole && typeof profile.profileRole === 'string' && profile.profileRole.trim().length > 0)

  return hasBio && hasSubjects && hasInterests && hasAge && hasRole
}

export default function DashboardPage() {
  const { user, profile, loading, configError, profileError, signOut } = useAuth()
  const router = useRouter()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const { requestPermission, hasBeenAsked, isGranted, isSupported } = useNotificationPermission()
  
  // Initialize states from localStorage cache to prevent flickering
  const getInitialCount = (key: string): number => {
    if (typeof window === 'undefined') return 0
    const cached = localStorage.getItem(`dashboard_${key}`)
    return cached ? parseInt(cached, 10) : 0
  }

  const getInitialOnlinePartners = (): Array<{
    id: string
    name: string
    avatarUrl: string | null
    onlineStatus: string
    activityType?: string
    activityDetails?: Record<string, unknown> | null
  }> => {
    if (typeof window === 'undefined') return []
    const cached = localStorage.getItem('dashboard_onlinePartners')
    if (!cached) return []
    try {
      return JSON.parse(cached)
    } catch {
      return []
    }
  }

  // Bell notification count managed by NotificationPanel (critical notifications only)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [partnersCount, setPartnersCount] = useState(() => getInitialCount('partnersCount'))
  const [pendingInvitesCount, setPendingInvitesCount] = useState(() => getInitialCount('pendingInvitesCount'))
  const [connectionRequestsCount, setConnectionRequestsCount] = useState(() => getInitialCount('connectionRequestsCount'))
  const [groupInvitesCount, setGroupInvitesCount] = useState(() => getInitialCount('groupInvitesCount'))
  const [newCommunityPostsCount, setNewCommunityPostsCount] = useState(() => getInitialCount('newCommunityPostsCount'))
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(() => getInitialCount('unreadMessagesCount'))

  // AI Partner suggestion modal state
  const [showAIPartnerModal, setShowAIPartnerModal] = useState(false)
  const [searchQueryForModal, setSearchQueryForModal] = useState('')

  // Group IDs for real-time subscription
  const [groupIds, setGroupIds] = useState<string[]>([])

  // Online partners state - initialize from cache
  const [onlinePartners, setOnlinePartners] = useState<Array<{
    id: string
    name: string
    avatarUrl: string | null
    onlineStatus: string
    activityType?: string
    activityDetails?: Record<string, unknown> | null
  }>>(() => getInitialOnlinePartners())

  // User stats state (streak, study time)
  const [userStats, setUserStats] = useState<{
    streak: { current: number; longest: number }
    studyTime: {
      today: { value: number; unit: string; display: string }
      thisWeek: { value: number; unit: string; display: string }
      allTime: { value: number; unit: string; display: string }
    }
    sessions: { today: number; thisWeek: number; allTime: number }
    points: number
  } | null>(null)
  
  const getHasLoadedOnce = (): boolean => {
    if (typeof window === 'undefined') return false
    const hasLoadedFlag = localStorage.getItem('dashboard_hasLoadedOnce') === 'true'
    const hasCachedPartners = getInitialOnlinePartners().length > 0
    const hasCachedCounts = localStorage.getItem('dashboard_partnersCount') !== null
    return hasLoadedFlag || hasCachedPartners || hasCachedCounts
  }
  const hasLoadedOnceRef = useRef<boolean>(getHasLoadedOnce())
  
  const [loadingOnlinePartners, setLoadingOnlinePartners] = useState(() => {
    return !hasLoadedOnceRef.current
  })

  useUserSync()

  // Check profile completion and banner visibility
  const [showCompleteProfileBanner, setShowCompleteProfileBanner] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const bannerDismissed = localStorage.getItem('profileCompletionBannerDismissed') === 'true'
    
    if (bannerDismissed) {
      setShowCompleteProfileBanner(false)
      return
    }
    
    if (!profile) {
      setShowCompleteProfileBanner(true)
      return
    }

    const profileComplete = isProfileComplete(profile)
    setShowCompleteProfileBanner(!profileComplete)
  }, [profile])

  // Fetch data and cache to localStorage
  useEffect(() => {
    if (!user || loading) return

    const abortController = new AbortController()
    let isMounted = true

    const fetchData = async () => {
      if (!isMounted) return

      try {
        const results = await Promise.allSettled([
          fetch('/api/partners/count', { signal: abortController.signal }).then(r => r.json()),
          fetch('/api/study-sessions/pending-invites', { signal: abortController.signal }).then(r => r.json()),
          fetch('/api/connections?type=received', { signal: abortController.signal }).then(r => r.json()),
          fetch('/api/partners/active', { signal: abortController.signal }).then(r => r.json()),
          fetch('/api/groups/invites/pending', { signal: abortController.signal }).then(r => r.ok ? r.json() : { count: 0 }),
          fetch('/api/community/new-posts-count', { signal: abortController.signal }).then(r => r.ok ? r.json() : { count: 0 }),
          fetch('/api/messages/unread-counts', { signal: abortController.signal }).then(r => r.ok ? r.json() : { total: 0 })
        ])

        if (!isMounted) return

        const partners = results[0].status === 'fulfilled' ? results[0].value : { count: 0 }
        const invites = results[1].status === 'fulfilled' ? results[1].value : { invites: [] }
        const connections = results[2].status === 'fulfilled' ? results[2].value : { receivedCount: 0 }
        const activePartners = results[3].status === 'fulfilled' ? results[3].value : { partners: [] }
        const groupInvites = results[4].status === 'fulfilled' ? results[4].value : { count: 0 }
        const communityPosts = results[5].status === 'fulfilled' ? results[5].value : { count: 0 }
        const unreadMessages = results[6].status === 'fulfilled' ? results[6].value : { total: 0 }

        if (!isMounted) return

        const partners_count = partners.count || 0
        const pending = invites.invites?.length || 0
        const requests = connections.receivedCount || 0
        const groupInvitesCountVal = groupInvites.count || 0
        const communityPostsCount = communityPosts.count || 0
        const unreadMessagesTotal = unreadMessages.total || 0

        if (isMounted) {
          setPartnersCount(partners_count)
          setPendingInvitesCount(pending)
          setConnectionRequestsCount(requests)
          setGroupInvitesCount(groupInvitesCountVal)
          setNewCommunityPostsCount(communityPostsCount)
          setUnreadMessagesCount(unreadMessagesTotal)

          const online = activePartners.partners
            ?.filter((p: any) => p.onlineStatus === 'ONLINE')
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              avatarUrl: p.avatarUrl,
              onlineStatus: p.onlineStatus,
              activityType: p.activityType || 'browsing',
              activityDetails: p.activityDetails || null
            })) || []
          setOnlinePartners(online)
          
          hasLoadedOnceRef.current = true
          setLoadingOnlinePartners(false)

          if (typeof window !== 'undefined') {
            localStorage.setItem('dashboard_partnersCount', String(partners_count))
            localStorage.setItem('dashboard_pendingInvitesCount', String(pending))
            localStorage.setItem('dashboard_connectionRequestsCount', String(requests))
            localStorage.setItem('dashboard_groupInvitesCount', String(groupInvitesCountVal))
            localStorage.setItem('dashboard_newCommunityPostsCount', String(communityPostsCount))
            localStorage.setItem('dashboard_unreadMessagesCount', String(unreadMessagesTotal))
            localStorage.setItem('dashboard_onlinePartners', JSON.stringify(online))
            localStorage.setItem('dashboard_hasLoadedOnce', 'true')
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        
        console.error('Error fetching dashboard data:', error)
        if (isMounted && !hasLoadedOnceRef.current) {
          setLoadingOnlinePartners(false)
        }
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 60000)
    
    return () => {
      isMounted = false
      abortController.abort()
      clearInterval(interval)
    }
  }, [user, loading])

  // Refresh online partners function for event-based updates
  const refreshOnlinePartners = useCallback(async () => {
    if (!user) return
    
    try {
      const response = await fetch('/api/partners/active')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.partners) {
          const online = data.partners
            ?.filter((p: { onlineStatus: string }) => p.onlineStatus === 'ONLINE')
            .map((p: { id: string; name: string; avatarUrl: string | null; onlineStatus: string; activityType?: string; activityDetails?: Record<string, unknown> | null }) => ({
              id: p.id,
              name: p.name,
              avatarUrl: p.avatarUrl,
              onlineStatus: p.onlineStatus,
              activityType: p.activityType || 'browsing',
              activityDetails: p.activityDetails || null
            })) || []
          setOnlinePartners(online)
          
          if (typeof window !== 'undefined') {
            localStorage.setItem('dashboard_onlinePartners', JSON.stringify(online))
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing online partners:', error)
    }
  }, [user])

  // Listen for session/call end events to refresh online partners immediately
  useEffect(() => {
    if (!user) return

    const handleSessionEnd = () => {
      setTimeout(() => {
        refreshOnlinePartners()
      }, 1000)
    }

    window.addEventListener('ai-partner-session-ended', handleSessionEnd)
    window.addEventListener('study-session-ended', handleSessionEnd)
    window.addEventListener('call-ended', handleSessionEnd)

    return () => {
      window.removeEventListener('ai-partner-session-ended', handleSessionEnd)
      window.removeEventListener('study-session-ended', handleSessionEnd)
      window.removeEventListener('call-ended', handleSessionEnd)
    }
  }, [user, refreshOnlinePartners])

  // More frequent polling for online partners (30 seconds)
  useEffect(() => {
    if (!user) return

    const onlinePartnersInterval = setInterval(() => {
      refreshOnlinePartners()
    }, 30000)

    return () => {
      clearInterval(onlinePartnersInterval)
    }
  }, [user, refreshOnlinePartners])

  // Refresh online partners when user returns to page
  useEffect(() => {
    if (!user) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshOnlinePartners()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, refreshOnlinePartners])

  // Fetch user's group IDs for real-time subscription
  useEffect(() => {
    if (!user) return

    const fetchGroupIds = async () => {
      try {
        const response = await fetch('/api/groups/my-groups')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.groups) {
            const ids = data.groups.map((g: { id: string }) => g.id)
            setGroupIds(ids)
          }
        }
      } catch (error) {
        console.error('Error fetching group IDs:', error)
      }
    }

    fetchGroupIds()
  }, [user])

  // Fetch user stats (streak, study time) for dashboard display
  useEffect(() => {
    if (!user) return

    const fetchUserStats = async () => {
      try {
        const response = await fetch('/api/user/stats')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.stats) {
            setUserStats(data.stats)
          }
        }
      } catch (error) {
        console.error('Error fetching user stats:', error)
      }
    }

    fetchUserStats()
    const interval = setInterval(fetchUserStats, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [user])

  // Real-time subscription for unread message updates
  useEffect(() => {
    if (!user) return

    const refreshUnreadCounts = async () => {
      try {
        const response = await fetch('/api/messages/unread-counts')
        if (response.ok) {
          const data = await response.json()
          const total = data.total || 0
          setUnreadMessagesCount(total)
          if (typeof window !== 'undefined') {
            localStorage.setItem('dashboard_unreadMessagesCount', String(total))
          }
        }
      } catch (error) {
        console.error('Error refreshing unread counts:', error)
      }
    }

    const cleanup = subscribeToUnreadMessages(user.id, refreshUnreadCounts, groupIds.length > 0 ? groupIds : undefined)
    return cleanup
  }, [user, groupIds])

  // Request notification permission on first visit after signup/login
  useEffect(() => {
    if (!user || !isSupported || hasBeenAsked() || isGranted) return

    const timer = setTimeout(() => {
      requestPermission()
    }, 3000)

    return () => clearTimeout(timer)
  }, [user, isSupported, hasBeenAsked, isGranted, requestPermission])

  useEffect(() => {
    if (!loading && !user) {
      const urlParams = new URLSearchParams(window.location.search)
      const isFromAuthCallback = urlParams.get('auth_callback') === 'true'

      if (isFromAuthCallback) {
        console.log('[Dashboard] From auth callback, waiting for auth sync...')
        return
      }

      router.push('/auth')
    }
  }, [user, loading, router])

  const handleCompleteProfile = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('profileCompletionBannerClicked', 'true')
    }
    router.push('/profile/edit')
  }

  // Show configuration error if Supabase is not set up
  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-center max-w-lg p-8">
          <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">Configuration Required</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            The app is not properly configured. Please ensure all required environment variables are set in your Vercel dashboard.
          </p>
          <div className="bg-neutral-900 dark:bg-neutral-800 rounded-xl p-4 text-left mb-6">
            <p className="text-sm text-neutral-400 mb-2">Required variables:</p>
            <ul className="text-sm text-neutral-300 space-y-1 font-mono">
              <li>• NEXT_PUBLIC_SUPABASE_URL</li>
              <li>• NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
              <li>• DATABASE_URL</li>
            </ul>
          </div>
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
          >
            Open Vercel Dashboard
          </a>
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
          <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Connection Error</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">{profileError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
          >
            {tCommon('refreshPage')}
          </button>
        </div>
      </div>
    )
  }

  if (user && !profile && !profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">{t('loadingProfile')}</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">{tCommon('failedToLoad')}</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">{tCommon('pleaseTryRefreshing')}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
          >
            {tCommon('refreshPage')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Top Bar with Menu */}
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

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        <div className="space-y-6">
          {/* Quick Focus - Primary CTA */}
          <QuickFocusCard />

          {/* Stats Row */}
          <DashboardStatsRow userStats={userStats} />

          {/* Partners Section */}
          <DashboardPartnersSection
            partnersCount={partnersCount}
            onlinePartners={onlinePartners}
            loadingOnlinePartners={loadingOnlinePartners}
          />

          {/* AI Partner Widget */}
          <DashboardAIWidget />

          {/* Search */}
          <DashboardSearch 
            onShowAIPartnerModal={() => setShowAIPartnerModal(true)} 
          />

          {/* Complete Profile Banner */}
          {showCompleteProfileBanner && (
            <div className="bg-gradient-to-r from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-2xl p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-neutral-900 dark:text-white mb-1">{t('readyToStartJourney')}</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('connectWithPartners')}</p>
                </div>
                <button
                  onClick={handleCompleteProfile}
                  className="w-full sm:w-auto px-5 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg whitespace-nowrap text-sm sm:text-base"
                >
                  {t('completeProfile')}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onUnreadCountChange={setUnreadCount}
      />

      {/* Push Notification Prompt */}
      <PushNotificationPrompt delay={3000} />

      {/* AI Partner Suggestion Modal */}
      <AIPartnerSuggestionModal
        isOpen={showAIPartnerModal}
        onClose={() => setShowAIPartnerModal(false)}
        searchCriteria={{}}
        searchQuery={searchQueryForModal}
        noResultsReason="name_not_found"
      />
    </div>
  )
}
