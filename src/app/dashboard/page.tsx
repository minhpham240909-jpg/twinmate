'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import NotificationPanel from '@/components/NotificationPanel'
import AvatarDropdown from '@/components/AvatarDropdown'
import { useSessionCleanup } from '@/hooks/useSessionCleanup'
import { useUserSync } from '@/hooks/useUserSync'
import { useAIAgent } from '@/components/providers/AIAgentProvider'
import { useTranslations } from 'next-intl'

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
  const { openPanel } = useAIAgent()
  
  // Initialize states from localStorage cache to prevent flickering
  const getInitialCount = (key: string): number => {
    if (typeof window === 'undefined') return 0
    const cached = localStorage.getItem(`dashboard_${key}`)
    return cached ? parseInt(cached, 10) : 0
  }

  const [unreadCount, setUnreadCount] = useState(() => getInitialCount('unreadCount'))
  const [showNotifications, setShowNotifications] = useState(false)
  const [partnersCount, setPartnersCount] = useState(() => getInitialCount('partnersCount'))
  const [pendingInvitesCount, setPendingInvitesCount] = useState(() => getInitialCount('pendingInvitesCount'))
  const [connectionRequestsCount, setConnectionRequestsCount] = useState(() => getInitialCount('connectionRequestsCount'))
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ partners: Partner[]; groups: Group[] }>({ partners: [], groups: [] })
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useUserSync()
  useSessionCleanup()

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
        const [notifs, partners, invites, connections] = await Promise.all([
          fetch('/api/notifications').then(r => r.json()),
          fetch('/api/partners/count').then(r => r.json()),
          fetch('/api/study-sessions/pending-invites').then(r => r.json()),
          fetch('/api/connections?type=received').then(r => r.json()).catch(() => ({ receivedCount: 0 }))
        ])

        const unread = notifs.unreadCount || 0
        const partners_count = partners.count || 0
        const pending = invites.invites?.length || 0
        const requests = connections.receivedCount || 0

        // Update state
        setUnreadCount(unread)
        setPartnersCount(partners_count)
        setPendingInvitesCount(pending)
        setConnectionRequestsCount(requests)

        // Cache to localStorage for next visit
        if (typeof window !== 'undefined') {
          localStorage.setItem('dashboard_unreadCount', String(unread))
          localStorage.setItem('dashboard_partnersCount', String(partners_count))
          localStorage.setItem('dashboard_pendingInvitesCount', String(pending))
          localStorage.setItem('dashboard_connectionRequestsCount', String(requests))
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [user, loading])

  // Search functionality
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults({ partners: [], groups: [] })
      return
    }

    setIsSearching(true)
    try {
      const [partnersRes, groupsRes] = await Promise.all([
        fetch('/api/partners/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchQuery: query }),
        }).then(r => r.json()).catch(() => ({ profiles: [] })),
        fetch('/api/groups/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            description: query,
            subject: query,
            subjectCustomDescription: query 
          }),
        }).then(r => r.json()).catch(() => ({ groups: [] }))
      ])

      setSearchResults({
        partners: partnersRes.profiles || [],
        groups: groupsRes.groups || []
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user || !profile) return null

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
            Home
          </button>

          <button
            onClick={() => router.push('/study-sessions')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition text-left font-medium relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Study with Partner
            {pendingInvitesCount > 0 && (
              <span className="ml-auto bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                {pendingInvitesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => router.push('/chat')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition text-left font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Chat
            {unreadCount > 0 && (
              <span className="ml-auto w-2 h-2 bg-red-600 rounded-full"></span>
            )}
          </button>

          <button
            onClick={() => router.push('/connections')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition text-left font-medium relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Connection Requests
            {connectionRequestsCount > 0 && (
              <span className="ml-auto bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                {connectionRequestsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => router.push('/search')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition text-left font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Find Partner
          </button>

          <button
            onClick={() => router.push('/groups')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition text-left font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Study Groups
          </button>

          <button
            onClick={() => router.push('/community')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition text-left font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Community
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
                <p className="text-xs text-gray-600">{profile.role || 'FREE'} Account</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/profile')}
              className="w-full py-2 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
            >
              View Profile
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
              <h1 className="text-3xl font-bold text-gray-900">{t('welcomeTitle')} 👋</h1>
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
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Split Layout: Left = AI Card, Right = 3 Stat Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-10">
            {/* Left Half - AI Agent Featured Card */}
            <button
              onClick={() => openPanel()}
              className="w-full h-full p-8 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 rounded-3xl text-white text-left relative overflow-hidden group hover:shadow-2xl hover:scale-[1.01] transition-all duration-300"
            >
              <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-400 opacity-10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-16 h-16 bg-white/25 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="px-3 py-1 bg-white/30 backdrop-blur-md text-xs font-bold rounded-full shadow-lg">
                    NEW
                  </span>
                </div>
                <h2 className="text-2xl font-bold mb-2">{t('clervaAI')}</h2>
                <p className="text-blue-100 text-base leading-relaxed">{t('clervaAIDesc')}</p>
              </div>
            </button>

            {/* Right Half - Three Stat Cards (Smaller) */}
            <div className="grid grid-rows-3 gap-4">
              {/* Study Partner Card */}
              <button
                onClick={() => router.push('/dashboard/partners')}
                className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group cursor-pointer text-left w-full"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl group-hover:scale-125 transition-all duration-500"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-3xl font-black tracking-tight">{partnersCount}</p>
                      <p className="text-blue-50 text-sm font-medium">Study Partners</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-blue-200 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Streak Card */}
              <button
                onClick={() => {/* TODO: Add streak page */}}
                className="bg-gradient-to-br from-purple-500 via-purple-600 to-pink-600 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group cursor-pointer text-left w-full"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl group-hover:scale-125 transition-all duration-500"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-3xl font-black tracking-tight">{profile.studyStreak || 0}</p>
                      <p className="text-purple-50 text-sm font-medium">Day Streak</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-purple-200 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Study Hours Card */}
              <button
                onClick={() => {/* TODO: Add study hours page */}}
                className="bg-gradient-to-br from-green-500 via-emerald-600 to-teal-600 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group cursor-pointer text-left w-full"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl group-hover:scale-125 transition-all duration-500"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-3xl font-black tracking-tight">{formatStudyHours(profile.totalStudyHours || 0)}</p>
                      <p className="text-green-50 text-sm font-medium">Study Hours</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-green-200 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-10 flex justify-center">
            <div className="w-full max-w-3xl">
              <div className="relative group">
                {/* Animated gradient background on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500"></div>
                
                {/* Main search container */}
                <div className="relative bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-3 group-hover:border-blue-200 group-hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center gap-3">
                    {/* Search icon with gradient background */}
                    <div className="pl-2 pr-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                        <svg
                          className="w-5 h-5 text-white"
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
                      placeholder="Search for partners and groups..."
                      className="flex-1 px-2 py-3 text-base border-0 focus:ring-0 focus:outline-none text-gray-900 placeholder-gray-400 bg-transparent"
                    />
                    
                    {/* Loading spinner */}
                    {isSearching && (
                      <div className="pr-3">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    
                    {/* Clear button (when there's text) */}
                    {searchQuery && !isSearching && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="pr-3 p-1 hover:bg-gray-100 rounded-lg transition-colors"
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
                <div className="mt-6 grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                  {/* Partners Results */}
                  {searchResults.partners.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg">Partners</h3>
                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">{searchResults.partners.length}</span>
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {searchResults.partners.slice(0, 5).map((partner) => (
                          <button
                            key={partner.id}
                            onClick={() => router.push(`/profile/${partner.user.id}`)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 rounded-xl transition-all duration-200 text-left group"
                          >
                            {partner.user.avatarUrl ? (
                              <img src={partner.user.avatarUrl} alt={partner.user.name} className="w-12 h-12 rounded-full ring-2 ring-gray-100 group-hover:ring-blue-200 transition-all" />
                            ) : (
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg ring-2 ring-gray-100 group-hover:ring-blue-200 transition-all">
                                {partner.user.name[0]}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{partner.user.name}</p>
                              {partner.subjects.length > 0 && (
                                <p className="text-xs text-gray-600 truncate mt-0.5">{partner.subjects.slice(0, 2).join(', ')}</p>
                              )}
                            </div>
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ))}
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
                        <h3 className="font-bold text-gray-900 text-lg">Groups</h3>
                        <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">{searchResults.groups.length}</span>
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {searchResults.groups.slice(0, 5).map((group) => (
                          <button
                            key={group.id}
                            onClick={() => router.push('/groups')}
                            className="w-full flex items-start gap-3 p-3 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 rounded-xl transition-all duration-200 text-left group"
                          >
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                              {group.name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{group.name}</p>
                              <p className="text-xs text-gray-600 truncate mt-0.5">{group.subject} • {group.memberCount} members</p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Complete Profile Banner */}
          {showCompleteProfileBanner && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-2xl p-6">
              <div className="flex items-center gap-4">
                <div className="text-4xl">🎯</div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 mb-1">Ready to start your study journey?</h3>
                  <p className="text-sm text-gray-600">Connect with study partners and create your first study session today!</p>
                </div>
                <button
                  onClick={handleCompleteProfile}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition whitespace-nowrap"
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
    </div>
  )
}
