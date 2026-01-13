'use client'

/**
 * QuickFocusCard - 5-Minute Focus Challenge
 *
 * Simple, frictionless entry to focused study:
 * - One button: "Start"
 * - AI analyzes profile → gives ONE tiny task
 * - Silent focus room with live student count
 * - No interruptions during session
 * - Reward moment at the end
 * - Invite partners to join during session
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Zap, ChevronRight, Play, RefreshCw, Loader2, UserPlus, X, Search, Users } from 'lucide-react'
import Image from 'next/image'

interface ActiveSession {
  id: string
  durationMinutes: number
  startedAt: string
  timeRemaining: number
}

interface FocusStats {
  liveUsersCount: number
  todayCompletedCount: number
  userStreak: number
  userTodaySessions: number
  userTotalSessions: number
  userPercentile: number
  activeSession: ActiveSession | null
}

interface Partner {
  id: string
  name: string
  avatarUrl: string | null
  onlineStatus: string
  activityType: string | null
}

interface QuickFocusCardProps {
  className?: string
}

export default function QuickFocusCard({ className = '' }: QuickFocusCardProps) {
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [stats, setStats] = useState<FocusStats | null>(null)
  const [, setIsLoadingStats] = useState(true)

  // Invitation UI state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Partner[]>([])
  const [selectedPartners, setSelectedPartners] = useState<Partner[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSendingInvites, setIsSendingInvites] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch live stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/focus/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch focus stats:', error)
    } finally {
      setIsLoadingStats(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  // Continue existing session
  const handleContinueSession = () => {
    if (stats?.activeSession) {
      router.push(`/focus/${stats.activeSession.id}`)
    }
  }

  // Abandon old session and start fresh
  const handleStartFresh = async () => {
    if (isStarting) return
    setIsStarting(true)

    try {
      if (stats?.activeSession) {
        await fetch(`/api/focus/${stats.activeSession.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ABANDONED', actualMinutes: 0 }),
        })
      }
      await startNewSession()
    } catch (error) {
      console.error('Error starting focus session:', error)
      setIsStarting(false)
    }
  }

  // Start new focus session with profile-based AI task
  const startNewSession = async () => {
    try {
      // Create session - API will analyze profile and generate task
      const response = await fetch('/api/focus/start-smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: 5 }),
      })

      if (!response.ok) {
        // Fallback to regular focus if smart start fails
        const fallbackResponse = await fetch('/api/focus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ durationMinutes: 5, mode: 'solo' }),
        })
        if (!fallbackResponse.ok) throw new Error('Failed to start session')
        const data = await fallbackResponse.json()
        router.push(`/focus/${data.session.id}`)
        return
      }

      const data = await response.json()
      router.push(`/focus/${data.session.id}`)
    } catch (error) {
      console.error('Error starting focus session:', error)
      setIsStarting(false)
    }
  }

  // Start focus session
  const handleStartFocus = async () => {
    if (isStarting) return
    setIsStarting(true)
    await startNewSession()
  }

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Search partners with debouncing
  const searchPartners = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch('/api/partners/search-for-focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 10 }),
      })

      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.partners || [])
      }
    } catch (error) {
      console.error('Error searching partners:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounced search handler
  const handleSearchChange = (query: string) => {
    setSearchQuery(query)

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      searchPartners(query)
    }, 300) // 300ms debounce
  }

  // Toggle partner selection
  const togglePartnerSelection = (partner: Partner) => {
    setSelectedPartners(prev => {
      const isSelected = prev.some(p => p.id === partner.id)
      if (isSelected) {
        return prev.filter(p => p.id !== partner.id)
      } else {
        // Max 10 partners
        if (prev.length >= 10) {
          return prev
        }
        return [...prev, partner]
      }
    })
  }

  // Send invitations
  const sendInvitations = async () => {
    if (!stats?.activeSession || selectedPartners.length === 0) return

    setIsSendingInvites(true)
    try {
      const response = await fetch(`/api/focus/${stats.activeSession.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerIds: selectedPartners.map(p => p.id),
        }),
      })

      if (response.ok) {
        // Success - close modal and reset state
        setShowInviteModal(false)
        setSelectedPartners([])
        setSearchQuery('')
        setSearchResults([])
      } else {
        const error = await response.json()
        console.error('Error sending invitations:', error)
      }
    } catch (error) {
      console.error('Error sending invitations:', error)
    } finally {
      setIsSendingInvites(false)
    }
  }

  // Open invite modal (only when active session exists)
  const handleOpenInviteModal = () => {
    if (stats?.activeSession) {
      setShowInviteModal(true)
    }
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Main Card */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-blue-600/20 relative">
        {/* Subtle background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-400/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-400/10 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Quick Focus
                </h2>
                <p className="text-white/70 text-sm">
                  5 minutes. One task. Let&apos;s go.
                </p>
              </div>
            </div>

            {/* Streak Badge */}
            {stats && stats.userStreak > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-400/90 text-amber-900 rounded-full px-3 py-1.5">
                <Flame className="w-4 h-4" />
                <span className="text-sm font-bold">Day {stats.userStreak}</span>
              </div>
            )}
          </div>

          {/* Live students count */}
          {stats && stats.liveUsersCount > 0 && (
            <div className="mb-6 flex items-center justify-center gap-2 text-white/80 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span>{stats.liveUsersCount} students focusing right now</span>
            </div>
          )}

          {/* Action Buttons */}
          {stats?.activeSession ? (
            <div className="space-y-3">
              <button
                onClick={handleContinueSession}
                className="w-full py-4 sm:py-5 bg-white hover:bg-blue-50 rounded-2xl font-bold text-lg sm:text-xl text-blue-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3"
              >
                <Play className="w-6 h-6 text-blue-600 fill-blue-600" />
                <span>Continue</span>
                <span className="text-blue-500 font-mono text-base">
                  {formatTimeRemaining(stats.activeSession.timeRemaining)}
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleOpenInviteModal}
                  className="py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium text-white/90 transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>Invite</span>
                </button>

                <button
                  onClick={handleStartFresh}
                  disabled={isStarting}
                  className="py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium text-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Starting...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      <span>New</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleStartFocus}
              disabled={isStarting}
              className="w-full py-5 sm:py-6 bg-white hover:bg-blue-50 disabled:bg-white/80 rounded-2xl font-bold text-xl sm:text-2xl text-blue-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <Zap className="w-7 h-7 text-blue-600" />
                  <span>Start</span>
                  <ChevronRight className="w-6 h-6 text-blue-500" />
                </>
              )}
            </button>
          )}

          {/* Stats Row */}
          {stats && stats.userTodaySessions > 0 && (
            <div className="mt-5 text-center text-white/60 text-sm">
              <span className="font-semibold text-white/90">{stats.userTodaySessions}</span>
              {' '}session{stats.userTodaySessions === 1 ? '' : 's'} today
            </div>
          )}
        </div>
      </div>

      {/* Invite Partners Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    Invite Partners
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Max {10 - selectedPartners.length} more
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search partners by name..."
                  className="w-full pl-10 pr-4 py-3 bg-neutral-100 dark:bg-neutral-800 border-0 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 animate-spin" />
                )}
              </div>
            </div>

            {/* Selected Partners */}
            {selectedPartners.length > 0 && (
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
                  SELECTED ({selectedPartners.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedPartners.map(partner => (
                    <button
                      key={partner.id}
                      onClick={() => togglePartnerSelection(partner)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      {partner.avatarUrl ? (
                        <Image
                          src={partner.avatarUrl}
                          alt={partner.name}
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-5 h-5 bg-blue-600 dark:bg-blue-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {partner.name[0]}
                        </div>
                      )}
                      <span className="text-sm font-medium">{partner.name}</span>
                      <X className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto p-4">
              {searchQuery.trim().length < 2 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                    Type at least 2 characters to search
                  </p>
                </div>
              ) : searchResults.length === 0 && !isSearching ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                    No partners found
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map(partner => {
                    const isSelected = selectedPartners.some(p => p.id === partner.id)
                    return (
                      <button
                        key={partner.id}
                        onClick={() => togglePartnerSelection(partner)}
                        disabled={!isSelected && selectedPartners.length >= 10}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500'
                            : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-2 border-transparent'
                        } ${!isSelected && selectedPartners.length >= 10 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {partner.avatarUrl ? (
                          <Image
                            src={partner.avatarUrl}
                            alt={partner.name}
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                            {partner.name[0]}
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <p className="font-semibold text-neutral-900 dark:text-white">
                            {partner.name}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {partner.onlineStatus === 'ONLINE' ? (
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full" />
                                Online
                              </span>
                            ) : (
                              'Offline'
                            )}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onClick={sendInvitations}
                disabled={selectedPartners.length === 0 || isSendingInvites}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-neutral-300 disabled:to-neutral-300 dark:disabled:from-neutral-700 dark:disabled:to-neutral-700 text-white rounded-xl font-semibold transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSendingInvites ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>
                      Send {selectedPartners.length > 0 ? `${selectedPartners.length} ` : ''}
                      Invitation{selectedPartners.length === 1 ? '' : 's'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
