'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { X, UserCheck, ArrowRight, Loader2, Pause } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface AvailablePartner {
  id: string
  userId: string
  name: string
  avatarUrl: string | null
  subjects: string[]
  skillLevel: string | null
  matchedCriteria?: string[] // Which criteria matched (e.g., ['subjects', 'location'])
}

interface SearchCriteriaSummary {
  subjects?: string[]
  skillLevel?: string
  studyStyle?: string
  locationCity?: string
  locationCountry?: string
  school?: string
  interests?: string[]
  goals?: string[]
  role?: string[]
}

interface PartnerAvailableNotificationProps {
  sessionId: string
  checkInterval?: number // milliseconds, default 60 seconds
  onSwitchToPartner?: (partner: AvailablePartner) => void
  onSessionPaused?: () => void
}

export default function PartnerAvailableNotification({
  sessionId,
  checkInterval = 60000,
  onSwitchToPartner,
  onSessionPaused,
}: PartnerAvailableNotificationProps) {
  const router = useRouter()
  const [availablePartners, setAvailablePartners] = useState<AvailablePartner[]>([])
  const [showNotification, setShowNotification] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isPausing, setIsPausing] = useState(false)
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteriaSummary | null>(null)

  const checkAvailability = useCallback(async () => {
    if (dismissed) return

    try {
      const response = await fetch(`/api/ai-partner/check-availability?sessionId=${sessionId}`)
      if (!response.ok) return

      const data = await response.json()
      if (data.available && data.partners.length > 0) {
        setAvailablePartners(data.partners)
        setShowNotification(true)
        // Store the search criteria from the API response for View All
        if (data.searchCriteria) {
          setSearchCriteria(data.searchCriteria)
        }
      }
    } catch (error) {
      console.error('Failed to check partner availability:', error)
    }
  }, [sessionId, dismissed])

  useEffect(() => {
    // Check immediately on mount
    checkAvailability()

    // Then check periodically
    const interval = setInterval(checkAvailability, checkInterval)

    return () => clearInterval(interval)
  }, [checkAvailability, checkInterval])

  const handleDismiss = () => {
    setShowNotification(false)
    setDismissed(true)
  }

  // Pause session before switching to real partner
  const pauseSession = async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/ai-partner/session/${sessionId}/pause`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to pause session')
      }

      return true
    } catch (error) {
      console.error('Failed to pause session:', error)
      return false
    }
  }

  const handleSwitchToPartner = async (partner: AvailablePartner) => {
    setIsPausing(true)

    // Pause the AI session first
    const paused = await pauseSession()

    if (paused) {
      toast.success('AI session paused. You can resume anytime!', {
        icon: '⏸️',
        duration: 3000,
      })

      if (onSessionPaused) {
        onSessionPaused()
      }

      if (onSwitchToPartner) {
        onSwitchToPartner(partner)
      } else {
        // Default: navigate to partner profile
        router.push(`/profile/${partner.userId}`)
      }
    } else {
      toast.error('Failed to pause session. Try again.')
    }

    setIsPausing(false)
    setShowNotification(false)
  }

  const handleViewAll = async () => {
    setIsPausing(true)

    // Pause the AI session first
    const paused = await pauseSession()

    if (paused) {
      toast.success('AI session paused. You can resume anytime!', {
        icon: '⏸️',
        duration: 3000,
      })

      if (onSessionPaused) {
        onSessionPaused()
      }

      // Build URL params from search criteria to pre-fill the search page
      const params = new URLSearchParams()
      if (searchCriteria) {
        if (searchCriteria.subjects?.length) {
          params.set('subjects', searchCriteria.subjects.join(','))
        }
        if (searchCriteria.skillLevel) {
          params.set('skillLevel', searchCriteria.skillLevel)
        }
        if (searchCriteria.studyStyle) {
          params.set('studyStyle', searchCriteria.studyStyle)
        }
        if (searchCriteria.locationCity) {
          params.set('locationCity', searchCriteria.locationCity)
        }
        if (searchCriteria.locationCountry) {
          params.set('locationCountry', searchCriteria.locationCountry)
        }
        if (searchCriteria.school) {
          params.set('school', searchCriteria.school)
        }
        if (searchCriteria.interests?.length) {
          params.set('interests', searchCriteria.interests.join(','))
        }
        if (searchCriteria.goals?.length) {
          params.set('goals', searchCriteria.goals.join(','))
        }
        if (searchCriteria.role?.length) {
          params.set('role', searchCriteria.role.join(','))
        }
      }

      // Add flag to indicate coming from AI partner notification
      params.set('fromAIPartner', 'true')

      const queryString = params.toString()
      router.push(`/search${queryString ? `?${queryString}` : ''}`)
    } else {
      toast.error('Failed to pause session. Try again.')
    }

    setIsPausing(false)
    setShowNotification(false)
  }

  return (
    <AnimatePresence>
      {showNotification && availablePartners.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-4 right-4 z-50 max-w-sm w-full"
        >
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-xl rounded-2xl border border-green-500/30 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-green-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Partner Available!</p>
                  <p className="text-xs text-slate-400">
                    {availablePartners.length} matching {availablePartners.length === 1 ? 'partner' : 'partners'} online
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                disabled={isPausing}
                className="p-1 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info about pausing */}
            <div className="px-3 py-2 bg-blue-500/10 border-b border-blue-500/20">
              <p className="text-xs text-blue-300 flex items-center gap-1">
                <Pause className="w-3 h-3" />
                Switching will pause your AI session. You can resume anytime.
              </p>
            </div>

            {/* Partners List */}
            <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
              {availablePartners.slice(0, 3).map((partner) => (
                <button
                  key={partner.id}
                  onClick={() => handleSwitchToPartner(partner)}
                  disabled={isPausing}
                  className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group disabled:opacity-50"
                >
                  {partner.avatarUrl ? (
                    <Image
                      src={partner.avatarUrl}
                      alt={partner.name}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full ring-2 ring-green-500/30"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-semibold">
                      {partner.name[0]}
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-white">{partner.name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {partner.subjects.slice(0, 2).join(', ')}
                      {partner.skillLevel && ` • ${partner.skillLevel}`}
                    </p>
                    {partner.matchedCriteria && partner.matchedCriteria.length > 0 && (
                      <p className="text-xs text-green-400 mt-0.5">
                        Matches: {partner.matchedCriteria.join(', ')}
                      </p>
                    )}
                  </div>
                  {isPausing ? (
                    <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-green-400 transition-colors" />
                  )}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-green-500/20 flex gap-2">
              <button
                onClick={handleDismiss}
                disabled={isPausing}
                className="flex-1 px-3 py-2 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50"
              >
                Keep AI Partner
              </button>
              <button
                onClick={handleViewAll}
                disabled={isPausing}
                className="flex-1 px-3 py-2 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isPausing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Pausing...
                  </>
                ) : (
                  'View All'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
