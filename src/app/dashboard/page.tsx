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
import GlowBorder from '@/components/ui/GlowBorder'
import Pulse from '@/components/ui/Pulse'
import Bounce from '@/components/ui/Bounce'
import FadeIn from '@/components/ui/FadeIn'

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
const isProfileComplete = (profile: any): boolean => {
  if (!profile) return false
  
  const hasBio = profile.bio && profile.bio.trim().length > 0
  const hasSubjects = profile.subjects && profile.subjects.length > 0
  const hasInterests = profile.interests && profile.interests.length > 0
  const hasAge = profile.age !== null && profile.age !== undefined
  const hasRole = profile.role && profile.role.trim().length > 0
  
  return hasBio && hasSubjects && hasInterests && hasAge && hasRole
}

export default function DashboardPage() {
  const { user, profile, loading, signOut } = useAuth()
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

  // Group IDs for real-time subscription
  const [groupIds, setGroupIds] = useState<string[]>([])
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  // Check profile completion and banner visibility
  const [showCompleteProfileBanner, setShowCompleteProfileBanner] = useState(false)

  useEffect(() => {
    if (!profile || typeof window === 'undefined') return
    
    const profileComplete = isProfileComplete(profile)
    const bannerDismissed = localStorage.getItem('profileCompletionBannerDismissed') === 'true'
    
    setShowCompleteProfileBanner(!profileComplete && !bannerDismissed)
  }, [profile])

  // Fetch data and cache to localStorage
  useEffect(() => {
    if (!user || loading) return

    const fetchData = async () => {
      try {
        // Use allSettled to allow dashboard to load even if some APIs fail
        // Note: Bell notification count is managed by NotificationPanel component
        const results = await Promise.allSettled([
          fetch('/api/partners/count').then(r => r.json()),
          fetch('/api/study-sessions/pending-invites').then(r => r.json()),
          fetch('/api/connections?type=received').then(r => r.json()),
          fetch('/api/partners/active').then(r => r.json()),
          fetch('/api/groups/invites/pending').then(r => r.ok ? r.json() : { count: 0 }),
          fetch('/api/community/new-posts-count').then(r => r.ok ? r.json() : { count: 0 }),
          fetch('/api/messages/unread-counts').then(r => r.ok ? r.json() : { total: 0 })
        ])

        // Extract values with fallbacks for failed requests
        const partners = results[0].status === 'fulfilled' ? results[0].value : { count: 0 }
        const invites = results[1].status === 'fulfilled' ? results[1].value : { invites: [] }
        const connections = results[2].status === 'fulfilled' ? results[2].value : { receivedCount: 0 }
        const activePartners = results[3].status === 'fulfilled' ? results[3].value : { partners: [] }
        const groupInvites = results[4].status === 'fulfilled' ? results[4].value : { count: 0 }
        const communityPosts = results[5].status === 'fulfilled' ? results[5].value : { count: 0 }
        const unreadMessages = results[6].status === 'fulfilled' ? results[6].value : { total: 0 }

        const partners_count = partners.count || 0
        const pending = invites.invites?.length || 0
        const requests = connections.receivedCount || 0
        const groupInvitesCount = groupInvites.count || 0
        const communityPostsCount = communityPosts.count || 0
        const unreadMessagesTotal = unreadMessages.total || 0

        // Update state (bell notification count managed by NotificationPanel)
        setPartnersCount(partners_count)
        setPendingInvitesCount(pending)
        setConnectionRequestsCount(requests)
        setGroupInvitesCount(groupInvitesCount)
        setNewCommunityPostsCount(communityPostsCount)
        setUnreadMessagesCount(unreadMessagesTotal)

        // Filter and set online partners
        const online = activePartners.partners
          ?.filter((p: any) => p.profile?.onlineStatus === 'ONLINE')
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            avatarUrl: p.avatarUrl,
            onlineStatus: p.profile.onlineStatus
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
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        // Only hide loading if we've never loaded before
        // If we have cached data, keep showing it even if fetch fails
        if (!hasLoadedOnceRef.current) {
          setLoadingOnlinePartners(false)
        }
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
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

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery)
      }, 300)
    } else {
      setSearchResults({ partners: [], groups: [] })
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, performSearch])

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

  const formatStudyHours = (hours: number): string => {
    if (hours < 1) return `${Math.round(hours * 60)}m`
    return `${Math.round(hours)}h`
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Show loading if user exists but profile is still loading
  if (user && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loadingProfile')}</p>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{tCommon('failedToLoad')}</h2>
          <p className="text-gray-600 mb-6">{tCommon('pleaseTryRefreshing')}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
          >
            {tCommon('refreshPage')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Clerva</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl transition text-left font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {tNav('home')}
          </button>

          <button
            onClick={() => router.push('/study-sessions')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition text-left font-medium relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {tNav('studyWithPartner')}
            {pendingInvitesCount > 0 && (
              <Pulse>
                <span className="ml-auto bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                  {pendingInvitesCount}
                </span>
              </Pulse>
            )}
          </button>

          <button
            onClick={() => router.push('/chat')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition text-left font-medium relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {tNav('chat')}
            {unreadMessagesCount > 0 && (
              <Pulse>
                <span className="ml-auto bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                  {unreadMessagesCount}
                </span>
              </Pulse>
            )}
          </button>

          <button
            onClick={() => router.push('/connections')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition text-left font-medium relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {t('connectionRequests')}
            {connectionRequestsCount > 0 && (
              <Pulse>
                <span className="ml-auto bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                  {connectionRequestsCount}
                </span>
              </Pulse>
            )}
          </button>

          <button
            onClick={() => router.push('/search')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition text-left font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {tNav('findPartner')}
          </button>

          <button
            onClick={() => router.push('/groups')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition text-left font-medium relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {tNav('studyGroups')}
            {groupInvitesCount > 0 && (
              <Pulse>
                <span className="ml-auto bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                  {groupInvitesCount}
                </span>
              </Pulse>
            )}
          </button>

          <button
            onClick={() => router.push('/community')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition text-left font-medium relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {tNav('community')}
            {newCommunityPostsCount > 0 && (
              <span className="ml-auto w-2 h-2 bg-blue-600 rounded-full"></span>
            )}
          </button>
        </nav>

        {/* User Profile Card - Bottom */}
        <div className="p-4 border-t border-gray-200 mt-auto">
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <AvatarDropdown
                avatarUrl={profile.avatarUrl ?? null}
                name={profile.name}
                onSignOut={signOut}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{profile.name}</p>
                <p className="text-xs text-gray-600">{profile.role === 'PREMIUM' ? tCommon('premiumAccount') : tCommon('freeAccount')}</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/profile')}
              className="w-full py-2 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
            >
              {t('viewProfile')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-6 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900"><span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{t('welcomeTitle')}</span> 👋</h1>
              <p className="text-gray-600 mt-1">{t('welcomeMessage')}</p>
            </div>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-3 hover:bg-gray-100 rounded-xl transition"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <Pulse>
                  <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                </Pulse>
              )}
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Main Content Grid - Professional Layout */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Study Partners Card - Takes 2 columns */}
            <div className="lg:col-span-2">
              <GlowBorder
                color="#3b82f6"
                intensity="medium"
                animated={false}
                style={{ borderRadius: 16 }}
              >
                <button
                  onClick={() => router.push('/dashboard/partners')}
                  className="w-full h-full p-8 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl text-white shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 relative overflow-hidden group cursor-pointer text-left"
                >
                <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400 opacity-10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-16 h-16 bg-white/25 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2">{t('studyPartners')}</h2>
                    <p className="text-5xl font-black mb-3">{partnersCount}</p>
                    <p className="text-blue-100 text-base leading-relaxed mb-6">Connect with study partners and collaborate on your learning journey</p>
                  </div>
                  <div className="flex items-center gap-2 text-blue-200">
                    <span className="text-sm font-medium">View all partners</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                </button>
              </GlowBorder>
            </div>

            {/* Online Partners Card - Takes 1 column */}
            <div className="lg:col-span-1">
              <GlowBorder
                color="#10b981"
                intensity="medium"
                animated={false}
                style={{ borderRadius: 16 }}
              >
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">{t('onlinePartners')}</h3>
                    {!loadingOnlinePartners && onlinePartners.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">{onlinePartners.length} {onlinePartners.length === 1 ? 'online' : 'online'}</p>
                    )}
                  </div>
                  {!loadingOnlinePartners && onlinePartners.length > 0 && (
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                      {onlinePartners.length}
                    </span>
                  )}
                </div>

                {/* Loading State */}
                {loadingOnlinePartners ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-sm text-gray-600">{tCommon('loading')}</p>
                  </div>
                ) : onlinePartners.length === 0 ? (
                  /* Empty State */
                  <div className="flex-1 flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium text-sm">{t('noPartnerOnline')}</p>
                  </div>
                ) : (
                  /* Online Partners List */
                  <div className="flex-1 space-y-2 overflow-y-auto max-h-[400px]">
                    {onlinePartners.map((partner) => (
                      <button
                        key={partner.id}
                        onClick={() => router.push(`/profile/${partner.id}`)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 rounded-xl transition-all duration-200 text-left group"
                      >
                        <PartnerAvatar
                          avatarUrl={partner.avatarUrl}
                          name={partner.name}
                          size="md"
                          onlineStatus={partner.onlineStatus as 'ONLINE' | 'OFFLINE'}
                          showStatus={true}
                          className="ring-2 ring-gray-100 group-hover:ring-green-200 transition-all"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate group-hover:text-green-600 transition-colors text-sm">{partner.name}</p>
                        </div>
                        <svg className="w-4 h-4 text-gray-400 group-hover:text-green-500 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
                </div>
              </GlowBorder>
            </div>
          </div>

          {/* Search Bar - Full Width */}
          <div className="mb-8">
            <div className="relative group">
              {/* Animated gradient background on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500"></div>
              
              {/* Main search container */}
              <div className="relative bg-white rounded-2xl shadow-lg border border-gray-100 p-4 group-hover:border-blue-200 group-hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-4">
                  {/* Search icon with gradient background */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Search input */}
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="flex-1 px-2 py-2 text-base border-0 focus:ring-0 focus:outline-none text-gray-900 placeholder-gray-400 bg-transparent"
                  />
                  
                  {/* Loading spinner */}
                  {isSearching && (
                    <div className="flex-shrink-0 pr-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  
                  {/* Clear button (when there's text) */}
                  {searchQuery && !isSearching && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* No Results Message */}
            {searchQuery.trim().length >= 2 && !isSearching && searchResults.partners.length === 0 && searchResults.groups.length === 0 && (
              <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{tCommon('noResults')}</h3>
                  <p className="text-gray-600 max-w-md mx-auto">{tCommon('noMatchingResults')}</p>
                </div>
              </div>
            )}

            {/* Search Results */}
            {(searchResults.partners.length > 0 || searchResults.groups.length > 0) && (
              <FadeIn delay={0.1} direction="up">
                <div className="mt-6 grid lg:grid-cols-2 gap-6 relative z-10">
                  {/* Partners Results */}
                  {searchResults.partners.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg">{t('partners')}</h3>
                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">{searchResults.partners.length}</span>
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {searchResults.partners.slice(0, 5).map((partner) => {
                          const matchingFields = getMatchingFields(partner, searchQuery)
                          const isAlreadyPartner = (partner as any).isAlreadyPartner

                          return (
                            <button
                              key={partner.id}
                              onClick={() => router.push(`/profile/${partner.user.id}`)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 rounded-xl transition-all duration-200 text-left group"
                            >
                              {partner.user.avatarUrl ? (
                                <Image src={partner.user.avatarUrl} alt={partner.user.name} width={48} height={48} className="w-12 h-12 rounded-full ring-2 ring-gray-100 group-hover:ring-blue-200 transition-all" />
                              ) : (
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg ring-2 ring-gray-100 group-hover:ring-blue-200 transition-all">
                                  {partner.user.name[0]}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{partner.user.name}</p>
                                  {isAlreadyPartner && (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full whitespace-nowrap">
                                      {t('alreadyPartnered')}
                                    </span>
                                  )}
                                </div>
                                {matchingFields.length > 0 ? (
                                  <p className="text-xs text-blue-600 truncate">
                                    {t('matchesIn')} {matchingFields.join(', ')}
                                  </p>
                                ) : partner.subjects.length > 0 ? (
                                  <p className="text-xs text-gray-600 truncate">{partner.subjects.slice(0, 2).join(', ')}</p>
                                ) : null}
                              </div>
                              <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Groups Results */}
                  {searchResults.groups.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg">{t('groups')}</h3>
                        <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">{searchResults.groups.length}</span>
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {searchResults.groups.slice(0, 5).map((group) => {
                          const matchingFields = getGroupMatchingFields(group, searchQuery)
                          const isMember = group.isMember

                          return (
                            <button
                              key={group.id}
                              onClick={() => router.push(`/groups/${group.id}`)}
                              className="w-full flex items-start gap-3 p-3 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 rounded-xl transition-all duration-200 text-left group"
                            >
                              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                                {group.name[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{group.name}</p>
                                  {isMember && (
                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full whitespace-nowrap">
                                      {t('alreadyInGroup')}
                                    </span>
                                  )}
                                </div>
                                {matchingFields.length > 0 ? (
                                  <p className="text-xs text-indigo-600 truncate">
                                    {t('matchesIn')} {matchingFields.join(', ')}
                                  </p>
                                ) : (
                                  <p className="text-xs text-gray-600 truncate">{group.subject} • {group.memberCount} {t('members')}</p>
                                )}
                              </div>
                              <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </FadeIn>
              )}
          </div>

          {/* Complete Profile Banner */}
          {showCompleteProfileBanner && (
            <Bounce delay={0.2}>
              <GlowBorder
                color="#10b981"
                intensity="medium"
                animated={false}
                
                style={{ borderRadius: 16 }}
              >
                <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-2xl p-6">
              <div className="flex items-center gap-4">
                <div className="text-4xl">🎯</div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 mb-1">{t('readyToStartJourney')}</h3>
                  <p className="text-sm text-gray-600">{t('connectWithPartners')}</p>
                </div>
                <button
                  onClick={handleCompleteProfile}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition whitespace-nowrap"
                >
                  {t('completeProfile')}
                </button>
              </div>
              </div>
              </GlowBorder>
            </Bounce>
          )}
        </div>
      </main>

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onUnreadCountChange={setUnreadCount}
      />
    </div>
  )
}
