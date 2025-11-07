'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'

interface Partner {
  id: string
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
  bio: string | null
  subjects: string[]
  interests: string[]
  goals: string[]
  availableDays: string[]
  availableHours: string[]
  onlineStatus: string
}

export default function PartnersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [partners, setPartners] = useState<Partner[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return

    const fetchPartners = async () => {
      try {
        const response = await fetch('/api/partners/active')
        if (!response.ok) throw new Error('Failed to fetch partners')
        const data = await response.json()
        setPartners(data.partners || [])
      } catch (error) {
        console.error('Error fetching partners:', error)
        toast.error('Failed to load study partners')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPartners()
  }, [user])

  const handleRemovePartner = async (partnerId: string) => {
    if (!confirm('Are you sure you want to remove this study partner?')) return

    try {
      const response = await fetch('/api/partners/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId }),
      })

      if (!response.ok) throw new Error('Failed to remove partner')

      toast.success('Study partner removed')
      setPartners(partners.filter(p => p.id !== partnerId))
    } catch (error) {
      console.error('Error removing partner:', error)
      toast.error('Failed to remove partner')
    }
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-xl transition"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Study Partners</h1>
                <p className="text-gray-600 mt-1">Manage your active study partnerships</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl font-semibold">
                {partners.length} {partners.length === 1 ? 'Partner' : 'Partners'}
              </span>
              <button
                onClick={() => router.push('/search')}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
              >
                Find Partners
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-8 py-10">
        {partners.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-lg">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">No Study Partners Yet</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Start building your study network! Find partners who share your interests and goals.
            </p>
            <button
              onClick={() => router.push('/search')}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
            >
              Find Study Partners
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100"
              >
                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                  {partner.user.avatarUrl ? (
                    <img
                      src={partner.user.avatarUrl}
                      alt={partner.user.name}
                      className="w-16 h-16 rounded-full ring-2 ring-blue-100"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl ring-2 ring-blue-100">
                      {partner.user.name[0]}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{partner.user.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${
                        partner.onlineStatus === 'ONLINE' ? 'bg-green-500' :
                        partner.onlineStatus === 'BUSY' ? 'bg-yellow-500' :
                        'bg-gray-400'
                      }`}></div>
                      <span className="text-xs text-gray-600 capitalize">
                        {partner.onlineStatus.toLowerCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bio */}
                {partner.bio && (
                  <p className="text-sm text-gray-700 mb-4 line-clamp-2">{partner.bio}</p>
                )}

                {/* Subjects */}
                {partner.subjects.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Subjects</p>
                    <div className="flex flex-wrap gap-2">
                      {partner.subjects.slice(0, 3).map((subject, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium"
                        >
                          {subject}
                        </span>
                      ))}
                      {partner.subjects.length > 3 && (
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                          +{partner.subjects.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Interests */}
                {partner.interests.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Interests</p>
                    <div className="flex flex-wrap gap-2">
                      {partner.interests.slice(0, 3).map((interest, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium"
                        >
                          {interest}
                        </span>
                      ))}
                      {partner.interests.length > 3 && (
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                          +{partner.interests.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => router.push(`/profile/${partner.user.id}`)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm"
                  >
                    View Profile
                  </button>
                  <button
                    onClick={() => router.push(`/chat?userId=${partner.user.id}`)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleRemovePartner(partner.id)}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
