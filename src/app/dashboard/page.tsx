'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import NotificationPanel from '@/components/NotificationPanel'
import AvatarDropdown from '@/components/AvatarDropdown'
import PartnerAvatar from '@/components/PartnerAvatar'
import { useUserSync } from '@/hooks/useUserSync'
import { useTranslations } from 'next-intl'
import { useNotificationPermission } from '@/hooks/useNotificationPermission'
import { subscribeToUnreadMessages } from '@/lib/supabase/realtime'
import PushNotificationPrompt from '@/components/PushNotificationPrompt'
import { AIPartnerSuggestionModal } from '@/components/ai-partner'
import DashboardAIWidget from '@/components/ai-partner/DashboardAIWidget'

interface Partner {
  id: string
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
  bio: string | null
  subjects: string[]
  interests: string[]
  matchScore?: number
}

interface Group {
  id: string
  name: string
  description: string | null
  subject: string
  memberCount: number
  ownerName: string
  isMember: boolean
}

// Profile completion check function
// Returns true only if user has filled in the essential profile fields
const isProfileComplete = (profile: any): boolean => {
  if (!profile) return false

  // Check each field with proper null/undefined handling
  const hasBio = Boolean(profile.bio && typeof profile.bio === 'string' && profile.bio.trim().length > 0)
  const hasSubjects = Boolean(Array.isArray(profile.subjects) && profile.subjects.length > 0)
  const hasInterests = Boolean(Array.isArray(profile.interests) && profile.interests.length > 0)
  const hasAge = profile.age !== null && profile.age !== undefined && typeof profile.age === 'number'
  // Check profileRole (user position like 'Student', 'Professional') NOT role (subscription 'FREE'/'PREMIUM')
  const hasRole = Boolean(profile.profileRole && typeof profile.profileRole === 'string' && profile.profileRole.trim().length > 0)

  // All essential fields must be filled
  return hasBio && hasSubjects && hasInterests && hasAge && hasRole
}

export default function DashboardPage() {
  const { user, profile, loading, configError, profileError, signOut } = useAuth()
  const router = useRouter()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('navigation')
  const { requestPermission, hasBeenAsked, isGranted, isSupported } = useNotificationPermission()
  
  // Initialize states from localStorage cache to prevent flickering
  const getInitialCount = (key: string): number => {
    if (typeof window === 'undefined') return 0
    const cached = localStorage.getItem(`dashboard_${key}`)
    return cached ? parseInt(cached, 10) : 0
  }

  // Helper to get cached online partners from localStorage
  const getInitialOnlinePartners = (): Array<{
    id: string
    name: string
    avatarUrl: string | null
    onlineStatus: string
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

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ partners: Partner[]; groups: Group[] }>({ partners: [], groups: [] })
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false) // Only show results after explicit search

  // AI Partner suggestion modal state
  const [showAIPartnerModal, setShowAIPartnerModal] = useState(false)

  // Group IDs for real-time subscription
  const [groupIds, setGroupIds] = useState<string[]>([])

  // Online partners state - initialize from cache
  const [onlinePartners, setOnlinePartners] = useState<Array<{
    id: string
    name: string
    avatarUrl: string | null
    onlineStatus: string
  }>>(() => getInitialOnlinePartners())
  
  // Track if we've ever successfully loaded data (from cache or fetch)
  // This prevents showing spinner on subsequent navigations
  const getHasLoadedOnce = (): boolean => {
    if (typeof window === 'undefined') return false
    // Check if we've loaded data before (explicit flag)
    const hasLoadedFlag = localStorage.getItem('dashboard_hasLoadedOnce') === 'true'
    // Or check if we have any cached data (partners or other dashboard data)
    const hasCachedPartners = getInitialOnlinePartners().length > 0
    const hasCachedCounts = localStorage.getItem('dashboard_partnersCount') !== null
    return hasLoadedFlag || hasCachedPartners || hasCachedCounts
  }
  const hasLoadedOnceRef = useRef<boolean>(getHasLoadedOnce())
  
  // Only show loading on very first visit when there's no cached data at all
  const [loadingOnlinePartners, setLoadingOnlinePartners] = useState(() => {
    // Only show spinner if we have never loaded data before
    return !hasLoadedOnceRef.current
  })

  useUserSync()

  // Note: Admin redirect is now handled server-side in middleware for instant redirect without flash

  // Check profile completion and banner visibility
  const [showCompleteProfileBanner, setShowCompleteProfileBanner] = useState(false)

  useEffect(() => {
    // Only check on client-side
    if (typeof window === 'undefined') return
    
    // Check banner dismissed state early (before profile check)
    const bannerDismissed = localStorage.getItem('profileCompletionBannerDismissed') === 'true'
    
    // If banner was dismissed, don't show it
    if (bannerDismissed) {
      setShowCompleteProfileBanner(false)
      return
    }
    
    // If profile is still loading, show banner by default for new users
    if (!profile) {
      setShowCompleteProfileBanner(true)
      return
    }

    // Debug logging to diagnose production issue
    console.log('[Dashboard] Profile data:', {
      hasProfile: !!profile,
      bio: profile.bio ? 'has bio' : 'no bio',
      subjects: profile.subjects?.length || 0,
      interests: profile.interests?.length || 0,
      age: profile.age,
      profileRole: profile.profileRole,
      role: profile.role,
    })

    const profileComplete = isProfileComplete(profile)

    console.log('[Dashboard] Banner decision:', {
      profileComplete,
      bannerDismissed,
      shouldShowBanner: !profileComplete,
    })

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
        // Use allSettled to allow dashboard to load even if some APIs fail
        // Note: Bell notification count is managed by NotificationPanel component
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

        // Extract values with fallbacks for failed requests
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
        const groupInvitesCount = groupInvites.count || 0
        const communityPostsCount = communityPosts.count || 0
        const unreadMessagesTotal = unreadMessages.total || 0

        // Update state (bell notification count managed by NotificationPanel)
        // Only update if component is still mounted
        if (isMounted) {
          setPartnersCount(partners_count)
          setPendingInvitesCount(pending)
          setConnectionRequestsCount(requests)
          setGroupInvitesCount(groupInvitesCount)
          setNewCommunityPostsCount(communityPostsCount)
          setUnreadMessagesCount(unreadMessagesTotal)

          // Filter and set online partners
          // FIX: Use top-level onlineStatus instead of p.profile?.onlineStatus
          // This ensures partners without profiles still show as online if they are
          const online = activePartners.partners
            ?.filter((p: any) => p.onlineStatus === 'ONLINE')
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              avatarUrl: p.avatarUrl,
              onlineStatus: p.onlineStatus
            })) || []
          setOnlinePartners(online)
          
          // Mark that we've successfully loaded data
          hasLoadedOnceRef.current = true
          setLoadingOnlinePartners(false)

          // Cache to localStorage for next visit
          // Note: Bell notification count (unreadCount) is cached by NotificationPanel component
          if (typeof window !== 'undefined') {
            localStorage.setItem('dashboard_partnersCount', String(partners_count))
            localStorage.setItem('dashboard_pendingInvitesCount', String(pending))
            localStorage.setItem('dashboard_connectionRequestsCount', String(requests))
            localStorage.setItem('dashboard_groupInvitesCount', String(groupInvitesCount))
            localStorage.setItem('dashboard_newCommunityPostsCount', String(communityPostsCount))
            localStorage.setItem('dashboard_unreadMessagesCount', String(unreadMessagesTotal))
            localStorage.setItem('dashboard_onlinePartners', JSON.stringify(online))
            // Mark that we've loaded data at least once
            localStorage.setItem('dashboard_hasLoadedOnce', 'true')
          }
        }
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') return
        
        console.error('Error fetching dashboard data:', error)
        // Only hide loading if we've never loaded before and component is still mounted
        if (isMounted && !hasLoadedOnceRef.current) {
          setLoadingOnlinePartners(false)
        }
      }
    }

    fetchData()
    // Increased interval from 30s to 60s to reduce server load
    const interval = setInterval(fetchData, 60000)
    
    return () => {
      isMounted = false
      abortController.abort()
      clearInterval(interval)
    }
  }, [user, loading])

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

    // Pass groupIds to enable real-time group message updates
    const cleanup = subscribeToUnreadMessages(user.id, refreshUnreadCounts, groupIds.length > 0 ? groupIds : undefined)
    return cleanup
  }, [user, groupIds])

  // Request notification permission on first visit after signup/login
  useEffect(() => {
    if (!user || !isSupported || hasBeenAsked() || isGranted) return

    // Request permission after 3 seconds on dashboard
    const timer = setTimeout(() => {
      requestPermission()
    }, 3000)

    return () => clearTimeout(timer)
  }, [user, isSupported, hasBeenAsked, isGranted, requestPermission])

  // Search functionality
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults({ partners: [], groups: [] })
      return
    }

    setIsSearching(true)
    try {
      // Detect search intent from keywords and remove them from search query
      const queryLower = query.toLowerCase()
      const hasGroupKeyword = queryLower.includes('group')
      const hasPartnerKeyword = queryLower.includes('partner')

      // Clean the search query by removing intent keywords
      let cleanedQuery = query
      if (hasGroupKeyword) {
        cleanedQuery = cleanedQuery.replace(/\bgroups?\b/gi, '').trim()
      }
      if (hasPartnerKeyword) {
        cleanedQuery = cleanedQuery.replace(/\bpartners?\b/gi, '').replace(/\bstudy\s+partner\b/gi, '').trim()
      }

      // If cleaned query is empty after removing keywords, use original query
      if (!cleanedQuery || cleanedQuery.length < 2) {
        cleanedQuery = query
      }

      const [partnersRes, groupsRes] = await Promise.all([
        fetch('/api/partners/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchQuery: cleanedQuery, searchType: 'simple' }),
        }).then(r => r.json()).catch(() => ({ profiles: [] })),
        fetch('/api/groups/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: cleanedQuery,
            subject: cleanedQuery,
            subjectCustomDescription: cleanedQuery
          }),
        }).then(r => r.json()).catch(() => ({ groups: [] }))
      ])

      // Smart filtering based on detected intent
      let partners = partnersRes.profiles || []
      let groups = groupsRes.groups || []

      if (hasGroupKeyword && !hasPartnerKeyword) {
        // User wants groups only
        partners = []
      } else if (hasPartnerKeyword && !hasGroupKeyword) {
        // User wants partners only
        groups = []
      }
      // If both or neither keywords present, show both results

      setSearchResults({
        partners,
        groups
      })
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults({ partners: [], groups: [] })
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Handle explicit search (Enter key or Search button click)
  const handleSearch = useCallback(() => {
    if (searchQuery.trim().length >= 2) {
      setHasSearched(true)
      performSearch(searchQuery)
    }
  }, [searchQuery, performSearch])

  // Reset hasSearched when search query is cleared
  useEffect(() => {
    if (!searchQuery.trim()) {
      setHasSearched(false)
      setSearchResults({ partners: [], groups: [] })
    }
  }, [searchQuery])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  const handleCompleteProfile = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('profileCompletionBannerClicked', 'true')
    }
    router.push('/profile/edit')
  }
  // Helper function to detect which fields match the search query for partners
  const getMatchingFields = (partner: Partner, query: string): string[] => {
    const searchLower = query.toLowerCase().trim()
    const matchingFields: string[] = []

    // Check subjects
    if (partner.subjects?.some(s => s.toLowerCase().includes(searchLower))) {
      matchingFields.push(t('subjects'))
    }

    // Check bio
    if (partner.bio?.toLowerCase().includes(searchLower)) {
      matchingFields.push(t('bio'))
    }

    // Check interests
    if (partner.interests?.some(i => i.toLowerCase().includes(searchLower))) {
      matchingFields.push(t('interests'))
    }

    return matchingFields
  }

  // Helper function to detect which fields match the search query for groups
  const getGroupMatchingFields = (group: Group, query: string): string[] => {
    const searchLower = query.toLowerCase().trim()
    const matchingFields: string[] = []

    // Check subject
    if (group.subject?.toLowerCase().includes(searchLower)) {
      matchingFields.push(t('subject'))
    }

    // Check description
    if (group.description?.toLowerCase().includes(searchLower)) {
      matchingFields.push(t('description'))
    }

    // Check group name
    if (group.name?.toLowerCase().includes(searchLower)) {
      matchingFields.push(t('name'))
    }

    return matchingFields
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

  // Show error if profile failed to load (timeout, network error, etc.)
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

  // Show loading if user exists but profile is still loading (and no error)
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

  // Redirect to signin if no user
  if (!user) {
    return null // Will redirect via useEffect
  }

  // If user exists but profile failed to load, show error with retry option
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
    <div className="flex h-screen bg-white dark:bg-neutral-950 overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-72 bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Clerva" width={40} height={40} className="rounded-xl" />
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Clerva</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-500 text-white rounded-xl transition text-left font-medium shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {tNav('home')}
          </button>

          <button
            onClick={() => router.push('/study-sessions')}
            className="w-full flex items-center gap-3 px-4 py-3 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition text-left font-medium relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {tNav('studyWithPartner')}
            {pendingInvitesCount > 0 && (
              <span className="ml-auto bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 text-xs px-2 py-1 rounded-full font-bold">
                {pendingInvitesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => router.push('/chat')}
            className="w-full flex items-center gap-3 px-4 py-3 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition text-left font-medium relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {tNav('chat')}
            {unreadMessagesCount > 0 && (
              <span className="ml-auto bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 text-xs px-2 py-1 rounded-full font-bold">
                {unreadMessagesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => router.push('/connections')}
            className="w-full flex items-center gap-3 px-4 py-3 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition text-left font-medium relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {t('connectionRequests')}
            {connectionRequestsCount > 0 && (
              <span className="ml-auto bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 text-xs px-2 py-1 rounded-full font-bold">
                {connectionRequestsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => router.push('/search')}
            className="w-full flex items-center gap-3 px-4 py-3 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition text-left font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {tNav('findPartner')}
          </button>

          <button
            onClick={() => router.push('/groups')}
            className="w-full flex items-center gap-3 px-4 py-3 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition text-left font-medium relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {tNav('studyGroups')}
            {groupInvitesCount > 0 && (
              <span className="ml-auto bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 text-xs px-2 py-1 rounded-full font-bold">
                {groupInvitesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => router.push('/community')}
            className="w-full flex items-center gap-3 px-4 py-3 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition text-left font-medium relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {tNav('community')}
            {newCommunityPostsCount > 0 && (
              <span className="ml-auto w-2 h-2 bg-gradient-to-r from-blue-500 to-blue-500 rounded-full"></span>
            )}
          </button>
        </nav>

        {/* User Profile Card - Bottom */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 mt-auto">
          <div className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <AvatarDropdown
                avatarUrl={profile.avatarUrl ?? null}
                name={profile.name}
                onSignOut={signOut}
                isAdmin={profile.isAdmin}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{profile.name}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{profile.role === 'PREMIUM' ? tCommon('premiumAccount') : tCommon('freeAccount')}</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/profile')}
              className="w-full py-2 px-4 bg-gradient-to-r from-blue-500 to-blue-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-600 transition-all shadow-sm"
            >
              {t('viewProfile')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-8 py-6 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{t('welcomeTitle')}</h1>
              <p className="text-neutral-600 dark:text-neutral-400 mt-1">{t('welcomeMessage')}</p>
            </div>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition"
            >
              <svg className="w-6 h-6 text-neutral-700 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-gradient-to-r from-blue-500 to-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Main Content Grid - Professional Layout */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Study Partners Card - Takes 2 columns */}
            <div className="lg:col-span-2">
              <button
                onClick={() => router.push('/dashboard/partners')}
                className="w-full h-full p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-900 dark:text-white shadow-sm hover:shadow-lg hover:scale-[1.01] transition-all duration-300 group cursor-pointer text-left"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2">{t('studyPartners')}</h2>
                    <p className="text-5xl font-black mb-3">{partnersCount}</p>
                    <p className="text-neutral-500 dark:text-neutral-400 text-base leading-relaxed mb-6">Connect with study partners and collaborate on your learning journey</p>
                  </div>
                  <div className="flex items-center gap-2 text-blue-500 dark:text-blue-400">
                    <span className="text-sm font-medium">View all partners</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>

            {/* Online Partners Card - Takes 1 column */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm p-6 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-neutral-900 dark:text-white text-lg">{t('onlinePartners')}</h3>
                    {!loadingOnlinePartners && onlinePartners.length > 0 && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{onlinePartners.length} online</p>
                    )}
                  </div>
                  {!loadingOnlinePartners && onlinePartners.length > 0 && (
                    <span className="px-2.5 py-1 bg-gradient-to-r from-blue-100 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-full">
                      {onlinePartners.length}
                    </span>
                  )}
                </div>

                {/* Loading State */}
                {loadingOnlinePartners ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">{tCommon('loading')}</p>
                  </div>
                ) : onlinePartners.length === 0 ? (
                  /* Empty State */
                  <div className="flex-1 flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 font-medium text-sm">{t('noPartnerOnline')}</p>
                  </div>
                ) : (
                  /* Online Partners List */
                  <div className="flex-1 space-y-2 overflow-y-auto max-h-[400px]">
                    {onlinePartners.map((partner) => (
                      <button
                        key={partner.id}
                        onClick={() => router.push(`/profile/${partner.id}`)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all duration-200 text-left group"
                      >
                        <PartnerAvatar
                          avatarUrl={partner.avatarUrl}
                          name={partner.name}
                          size="md"
                          onlineStatus={partner.onlineStatus as 'ONLINE' | 'OFFLINE'}
                          showStatus={true}
                          className="ring-2 ring-neutral-200 dark:ring-neutral-700 group-hover:ring-neutral-400 dark:group-hover:ring-neutral-500 transition-all"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-neutral-900 dark:text-white truncate group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors text-sm">{partner.name}</p>
                        </div>
                        <svg className="w-4 h-4 text-neutral-400 dark:text-neutral-500 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Partner Widget - Only shows for users who have used AI Partner */}
          <div className="mb-8">
            <DashboardAIWidget />
          </div>

          {/* Search Bar - Full Width */}
          <div className="mb-8">
            <div className="relative group">
              {/* Main search container */}
              <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-4 group-hover:border-neutral-300 dark:group-hover:border-neutral-700 transition-all duration-300">
                <div className="flex items-center gap-4">
                  {/* Search icon */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-neutral-700 dark:text-neutral-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>

                  {/* Search input */}
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSearch()
                      }
                    }}
                    placeholder={t('searchPlaceholder')}
                    className="flex-1 px-2 py-2 text-base border-0 focus:ring-0 focus:outline-none text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 bg-transparent"
                  />

                  {/* Loading spinner */}
                  {isSearching && (
                    <div className="flex-shrink-0 pr-2">
                      <div className="w-6 h-6 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}

                  {/* Clear button (when there's text) */}
                  {searchQuery && !isSearching && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="flex-shrink-0 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}

                  {/* Search button */}
                  {searchQuery.trim().length >= 2 && !isSearching && (
                    <button
                      onClick={handleSearch}
                      className="flex-shrink-0 p-2 bg-gradient-to-r from-blue-500 to-blue-500 hover:from-blue-600 hover:to-blue-600 rounded-lg transition-all"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* No Results Message - Only show after explicit search */}
            {hasSearched && !isSearching && searchResults.partners.length === 0 && searchResults.groups.length === 0 && (
              <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-12 text-center">
                  {/* AI Partner Suggestion - Dynamic personalized message */}
                  <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-700/50 max-w-lg mx-auto">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>

                    {/* Dynamic personalized message based on search query */}
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
                      {searchQuery.trim()} partners aren&apos;t available right now
                    </h3>

                    <p className="text-base text-neutral-600 dark:text-neutral-400 mb-4">
                      But I can be your {searchQuery.trim()} study partner! Let&apos;s learn together.
                    </p>

                    {/* Show search query tag */}
                    <div className="flex flex-wrap justify-center gap-2 mb-4">
                      <span className="px-3 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 text-xs rounded-full">
                        Search: {searchQuery.trim().length > 25 ? searchQuery.trim().slice(0, 25) + '...' : searchQuery.trim()}
                      </span>
                    </div>

                    <button
                      onClick={() => setShowAIPartnerModal(true)}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-600 transition-all shadow-lg flex items-center gap-2 mx-auto"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Start Studying with AI Partner
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Search Results - Only show after explicit search */}
            {hasSearched && (searchResults.partners.length > 0 || searchResults.groups.length > 0) && (
              <div className="mt-6 grid lg:grid-cols-2 gap-6 relative z-10">
                {/* Partners Results */}
                {searchResults.partners.length > 0 && (
                  <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <h3 className="font-bold text-neutral-900 dark:text-white text-lg">{t('partners')}</h3>
                      <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-full">{searchResults.partners.length}</span>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {searchResults.partners.slice(0, 5).map((partner) => {
                        const matchingFields = getMatchingFields(partner, searchQuery)
                        const isAlreadyPartner = (partner as any).isAlreadyPartner

                        return (
                          <button
                            key={partner.id}
                            onClick={() => router.push(`/profile/${partner.user.id}`)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all duration-200 text-left group"
                          >
                            {partner.user.avatarUrl ? (
                              <Image src={partner.user.avatarUrl} alt={partner.user.name} width={48} height={48} className="w-12 h-12 rounded-full ring-2 ring-neutral-200 dark:ring-neutral-700 group-hover:ring-neutral-400 dark:group-hover:ring-neutral-500 transition-all" />
                            ) : (
                              <div className="w-12 h-12 bg-neutral-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-neutral-900 font-semibold text-lg ring-2 ring-neutral-200 dark:ring-neutral-700 group-hover:ring-neutral-400 dark:group-hover:ring-neutral-500 transition-all">
                                {partner.user.name[0]}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="font-semibold text-neutral-900 dark:text-white truncate group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">{partner.user.name}</p>
                                {isAlreadyPartner && (
                                  <span className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold rounded-full whitespace-nowrap">
                                    {t('alreadyPartnered')}
                                  </span>
                                )}
                              </div>
                              {matchingFields.length > 0 ? (
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                  {t('matchesIn')} {matchingFields.join(', ')}
                                </p>
                              ) : partner.subjects.length > 0 ? (
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{partner.subjects.slice(0, 2).join(', ')}</p>
                              ) : null}
                            </div>
                            <svg className="w-5 h-5 text-neutral-400 dark:text-neutral-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Groups Results */}
                {searchResults.groups.length > 0 && (
                  <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-500 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <h3 className="font-bold text-neutral-900 dark:text-white text-lg">{t('groups')}</h3>
                      <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-full">{searchResults.groups.length}</span>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {searchResults.groups.slice(0, 5).map((group) => {
                        const matchingFields = getGroupMatchingFields(group, searchQuery)
                        const isMember = group.isMember

                        return (
                          <button
                            key={group.id}
                            onClick={() => router.push(`/groups/${group.id}`)}
                            className="w-full flex items-start gap-3 p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all duration-200 text-left group"
                          >
                            <div className="w-12 h-12 bg-neutral-800 dark:bg-neutral-200 rounded-xl flex items-center justify-center text-white dark:text-neutral-900 font-bold text-lg flex-shrink-0 group-hover:scale-105 transition-transform">
                              {group.name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="font-semibold text-neutral-900 dark:text-white truncate group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">{group.name}</p>
                                {isMember && (
                                  <span className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold rounded-full whitespace-nowrap">
                                    {t('alreadyInGroup')}
                                  </span>
                                )}
                              </div>
                              {matchingFields.length > 0 ? (
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                  {t('matchesIn')} {matchingFields.join(', ')}
                                </p>
                              ) : (
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{group.subject} • {group.memberCount} {t('members')}</p>
                              )}
                            </div>
                            <svg className="w-5 h-5 text-neutral-400 dark:text-neutral-500 group-hover:translate-x-1 transition-all mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Complete Profile Banner */}
          {showCompleteProfileBanner && (
            <div className="bg-gradient-to-r from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-neutral-900 dark:text-white mb-1">{t('readyToStartJourney')}</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('connectWithPartners')}</p>
                </div>
                <button
                  onClick={handleCompleteProfile}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-600 transition-all shadow-lg whitespace-nowrap"
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

      {/* Push Notification Prompt - Only shows on dashboard */}
      <PushNotificationPrompt delay={3000} />

      {/* AI Partner Suggestion Modal */}
      <AIPartnerSuggestionModal
        isOpen={showAIPartnerModal}
        onClose={() => setShowAIPartnerModal(false)}
        searchCriteria={{}}
        searchQuery={searchQuery}
        noResultsReason="name_not_found"
      />
    </div>
  )
}
