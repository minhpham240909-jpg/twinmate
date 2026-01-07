'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'

interface Partner {
  matchId: string
  id: string
  name: string
  email: string
  avatarUrl: string | null
  onlineStatus: string
  profile: {
    bio: string | null
    subjects: string[]
    interests: string[]
    goals: string[]
    skillLevel: string | null
    studyStyle: string | null
    onlineStatus: string
    location: string | null
    timezone: string | null
    availableDays: string[]
    availableHours: string[]
    aboutYourself: string | null
    aboutYourselfItems: string[]
  } | null
  connectedAt: Date
}

// Cache key for instant display
const CACHE_KEY_PARTNERS = 'active_partners_v1'

// Helper to get cached partners from localStorage for instant display
const getCachedPartners = (): Partner[] => {
  if (typeof window === 'undefined') return []
  try {
    const cached = localStorage.getItem(CACHE_KEY_PARTNERS)
    if (!cached) return []
    return JSON.parse(cached)
  } catch {
    return []
  }
}

export default function PartnersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const t = useTranslations('partners')
  // Initialize with cached data for instant display
  const [partners, setPartners] = useState<Partner[]>(() => getCachedPartners())
  // Only show loading if no cached data
  const [isLoading, setIsLoading] = useState(() => getCachedPartners().length === 0)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return

    const fetchPartners = async () => {
      try {
        const response = await fetch('/api/partners/active')
        if (!response.ok) throw new Error('Failed to fetch partners')
        const data = await response.json()
        const fetchedPartners = data.partners || []
        setPartners(fetchedPartners)

        // Cache partners to localStorage for instant display next time
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(CACHE_KEY_PARTNERS, JSON.stringify(fetchedPartners))
          } catch (cacheError) {
            console.error('Error caching partners:', cacheError)
          }
        }
      } catch (error) {
        console.error('Error fetching partners:', error)
        toast.error(t('failedToLoadPartners'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchPartners()
  }, [user])

  const handleRemovePartner = async (matchId: string) => {
    if (!confirm(t('confirmRemove'))) return

    try {
      const response = await fetch('/api/partners/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      })

      if (!response.ok) throw new Error('Failed to remove partner')

      toast.success(t('removed'))
      const updatedPartners = partners.filter(p => p.matchId !== matchId)
      setPartners(updatedPartners)

      // Update cache after removal
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(CACHE_KEY_PARTNERS, JSON.stringify(updatedPartners))
        } catch (cacheError) {
          console.error('Error updating cache:', cacheError)
        }
      }
    } catch (error) {
      console.error('Error removing partner:', error)
      toast.error(t('removeFailed'))
    }
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* Header */}
      <header className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition"
              >
                <svg className="w-6 h-6 text-neutral-600 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{t('title')}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {partners.length > 0 && (
                <Pulse>
                  <span className="px-4 py-2 bg-gradient-to-r from-blue-100 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl font-semibold border border-blue-200 dark:border-blue-700/50">
                    {partners.length} {partners.length === 1 ? t('partner') : t('partners')}
                  </span>
                </Pulse>
              )}
              <Bounce>
                <button
                  onClick={() => router.push('/search')}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-600 hover:shadow-lg transition-all shadow-md"
                >
                  {t('findPartners')}
                </button>
              </Bounce>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-8 py-10">
        {partners.length === 0 ? (
          <Bounce>
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-12 text-center shadow-sm">
              <Bounce delay={0.1}>
                <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-200 dark:border-blue-700/50">
                  <Pulse>
                    <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </Pulse>
                </div>
              </Bounce>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">{t('noPartnersYet')}</h2>
              <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-md mx-auto">
                {t('noPartnersDesc')}
              </p>
              <Bounce delay={0.2}>
                <button
                  onClick={() => router.push('/search')}
                  className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-600 hover:shadow-lg transition-all shadow-md"
                >
                  {t('findStudyPartners')}
                </button>
              </Bounce>
            </div>
          </Bounce>
        ) : (
          <FadeIn delay={0.1}>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {partners.map((partner, index) => (
                <FadeIn key={partner.id} delay={index * 0.05}>
                  <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-neutral-200 dark:border-neutral-800">
                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                  <Bounce delay={index * 0.1}>
                    <Pulse>
                      <PartnerAvatar
                        avatarUrl={partner.avatarUrl}
                        name={partner.name}
                        size="lg"
                        onlineStatus={partner.onlineStatus as 'ONLINE' | 'OFFLINE'}
                        showStatus={true}
                        className="ring-2 ring-blue-100"
                      />
                    </Pulse>
                  </Bounce>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{partner.name}</h3>
                  </div>
                </div>

                {/* Bio */}
                {partner.profile?.bio && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 line-clamp-2">{partner.profile.bio}</p>
                )}

                {/* Subjects */}
                {partner.profile && partner.profile.subjects.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase mb-2">{t('subjects')}</p>
                    <div className="flex flex-wrap gap-2">
                      {partner.profile.subjects.slice(0, 3).map((subject: string, idx: number) => (
                        <span key={idx} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium">
                          {subject}
                        </span>
                      ))}
                      {partner.profile.subjects.length > 3 && (
                        <span className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg text-xs font-medium">
                          +{partner.profile.subjects.length - 3} {t('more')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Interests */}
                {partner.profile && partner.profile.interests.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase mb-2">{t('interests')}</p>
                    <div className="flex flex-wrap gap-2">
                      {partner.profile.interests.slice(0, 3).map((interest: string, idx: number) => (
                        <span key={idx} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium">
                          {interest}
                        </span>
                      ))}
                      {partner.profile.interests.length > 3 && (
                        <span className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg text-xs font-medium">
                          +{partner.profile.interests.length - 3} {t('more')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <button
                    onClick={() => router.push(`/profile/${partner.id}`)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-600 transition-all text-sm"
                  >
                    {t('viewProfile')}
                  </button>
                  <button
                    onClick={() => router.push(`/chat/partners?conversation=${partner.id}`)}
                    className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleRemovePartner(partner.matchId)}
                    className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-all text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                    </div>
                </FadeIn>
              ))}
            </div>
          </FadeIn>
        )}
      </main>
    </div>
  )
}
