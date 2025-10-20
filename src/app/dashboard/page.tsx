'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import NotificationPanel from '@/components/NotificationPanel'
import StudyPartnersModal from '@/components/StudyPartnersModal'
import { useSessionCleanup } from '@/hooks/useSessionCleanup'
import { useUserSync } from '@/hooks/useUserSync'

export default function DashboardPage() {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)

  // Ensure user is synced to database
  useUserSync()

  // Auto-cleanup inactive study sessions
  useSessionCleanup()
  // Load cached partner count immediately from localStorage
  const [partnersCount, setPartnersCount] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('partnersCount')
      return cached ? parseInt(cached, 10) : 0
    }
    return 0
  })
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0)
  const [showPartnersModal, setShowPartnersModal] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)

  // Fetch notifications count
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/notifications')
        if (response.ok) {
          const data = await response.json()
          setUnreadCount(data.unreadCount || 0)
        }
      } catch (error) {
        console.error('Error fetching notifications:', error)
      }
    }

    if (user && !loading) {
      fetchNotifications()
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [user, loading])

  // Fetch active partners count
  const fetchPartnersCount = async () => {
    try {
      const response = await fetch('/api/partners/count')
      if (response.ok) {
        const data = await response.json()
        const count = data.count || 0
        setPartnersCount(count)
        // Cache the count in localStorage for instant display on next visit
        localStorage.setItem('partnersCount', count.toString())
      }
    } catch (error) {
      console.error('Error fetching partners count:', error)
    }
  }

  useEffect(() => {
    if (user && !loading) {
      fetchPartnersCount()
      // Poll for updated count every 30 seconds
      const interval = setInterval(fetchPartnersCount, 30000)
      return () => clearInterval(interval)
    }
  }, [user, loading])

  // Fetch pending session invites count
  const fetchPendingInvitesCount = async () => {
    try {
      const response = await fetch('/api/study-sessions/pending-invites')
      if (response.ok) {
        const data = await response.json()
        setPendingInvitesCount(data.invites?.length || 0)
      }
    } catch (error) {
      console.error('Error fetching pending invites:', error)
    }
  }

  useEffect(() => {
    if (user && !loading) {
      fetchPendingInvitesCount()
      // Poll for updated count every 30 seconds
      const interval = setInterval(fetchPendingInvitesCount, 30000)
      return () => clearInterval(interval)
    }
  }, [user, loading])


  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showProfileDropdown && !target.closest('#profile-dropdown') && !target.closest('#profile-button')) {
        setShowProfileDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProfileDropdown])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-600">Clerva</h1>
          <div className="flex items-center gap-4">
            {/* Notification Icon */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                id="profile-button"
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-3 hover:bg-gray-100 rounded-lg p-2 transition"
              >
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{profile?.name || user.email}</p>
                  <p className="text-xs text-gray-500">{profile?.role || 'FREE'} Account</p>
                </div>
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt="Profile"
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {profile?.name?.[0] || user.email?.[0].toUpperCase()}
                  </div>
                )}
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showProfileDropdown && (
                <div
                  id="profile-dropdown"
                  className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                >
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-semibold text-gray-900">{profile?.name || user.email}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                    <p className="text-xs text-blue-600 font-medium mt-1">{profile?.role || 'FREE'} Account</p>
                  </div>

                  <button
                    onClick={() => {
                      router.push('/profile')
                      setShowProfileDropdown(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    View Profile
                  </button>

                  <button
                    onClick={() => {
                      signOut()
                      setShowProfileDropdown(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white mb-8">
            <h2 className="text-3xl font-bold mb-2">Welcome to Clerva! 👋</h2>
            <p className="text-blue-100 mb-4">
              You&apos;ve successfully signed in. Your learning journey starts here.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => router.push('/profile')}
                className="px-6 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition"
              >
                Complete Your Profile
              </button>
              <button
                onClick={() => router.push('/search')}
                className="px-6 py-2 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition"
              >
                Find Study Partners
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Study Streak</h3>
                <span className="text-2xl">🔥</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">0 days</p>
            </div>
            <button
              onClick={() => setShowPartnersModal(true)}
              className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-105 cursor-pointer text-left w-full"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Study Partners</h3>
                <span className="text-2xl">👥</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{partnersCount}</p>
              <p className="text-xs text-blue-600 mt-2">Click to view →</p>
            </button>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Study Hours</h3>
                <span className="text-2xl">⏱️</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">0h</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => router.push('/search')}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition text-left"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Find Partners</h4>
                <p className="text-sm text-gray-600">Search for study partners by subject or interest</p>
              </button>

              <button
                onClick={() => router.push('/connections')}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition text-left"
              >
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Connection Requests</h4>
                <p className="text-sm text-gray-600">View and manage your connection requests</p>
              </button>

              <button
                onClick={() => router.push('/groups')}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition text-left"
              >
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Create Study Group</h4>
                <p className="text-sm text-gray-600">Start a new study group for your subject</p>
              </button>

              <button
                onClick={() => router.push('/chat')}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition text-left"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Messages</h4>
                <p className="text-sm text-gray-600">Check your conversations and notifications</p>
              </button>

              <button
                onClick={() => router.push('/study-sessions')}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition text-left relative"
              >
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mb-3">
                  <span className="text-2xl">📚</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  Study with Partner
                  {pendingInvitesCount > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                      {pendingInvitesCount}
                    </span>
                  )}
                </h4>
                <p className="text-sm text-gray-600">Create a study session with your partners</p>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onUnreadCountChange={setUnreadCount}
      />

      {/* Study Partners Modal */}
      <StudyPartnersModal
        isOpen={showPartnersModal}
        onClose={() => setShowPartnersModal(false)}
        onPartnerRemoved={fetchPartnersCount}
      />
    </div>
  )
}