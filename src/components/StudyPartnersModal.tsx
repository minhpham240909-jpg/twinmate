'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Partner {
  matchId: string
  id: string
  name: string
  email: string
  avatarUrl: string | null
  profile: {
    bio: string | null
    subjects: string[]
    interests: string[]
    goals: string[]
    skillLevel: string
    studyStyle: string
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

interface StudyPartnersModalProps {
  isOpen: boolean
  onClose: () => void
  onPartnerRemoved: () => void
}

export default function StudyPartnersModal({ isOpen, onClose, onPartnerRemoved }: StudyPartnersModalProps) {
  const router = useRouter()
  // Load cached partners immediately from localStorage
  const [partners, setPartners] = useState<Partner[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('studyPartners')
      if (cached) {
        try {
          return JSON.parse(cached)
        } catch (e) {
          return []
        }
      }
    }
    return []
  })
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [partnerToRemove, setPartnerToRemove] = useState<Partner | null>(null)
  const [viewingProfile, setViewingProfile] = useState<Partner | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchPartners()
    }
  }, [isOpen])

  const fetchPartners = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/partners/active')
      const data = await response.json()

      if (data.success) {
        setPartners(data.partners)
        // Cache the partners list for instant display on next visit
        localStorage.setItem('studyPartners', JSON.stringify(data.partners))
      }
    } catch (error) {
      console.error('Error fetching partners:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveClick = (partner: Partner) => {
    setPartnerToRemove(partner)
    setShowConfirmModal(true)
  }

  const handleConfirmRemove = async () => {
    if (!partnerToRemove) return

    setRemovingId(partnerToRemove.matchId)
    try {
      const response = await fetch('/api/partners/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: partnerToRemove.matchId })
      })

      if (response.ok) {
        const updatedPartners = partners.filter(p => p.matchId !== partnerToRemove.matchId)
        setPartners(updatedPartners)
        // Update cache to reflect removal
        localStorage.setItem('studyPartners', JSON.stringify(updatedPartners))
        localStorage.setItem('partnersCount', updatedPartners.length.toString())
        onPartnerRemoved()
        setShowConfirmModal(false)
        setPartnerToRemove(null)
      }
    } catch (error) {
      console.error('Error removing partner:', error)
    } finally {
      setRemovingId(null)
    }
  }

  const handleMessage = (partnerId: string) => {
    router.push(`/chat?conversation=${partnerId}&type=partner`)
    onClose()
  }

  const handleViewProfile = (partner: Partner) => {
    setViewingProfile(partner)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Modal Header */}
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Study Partners</h2>
              <p className="text-sm text-gray-500 mt-1">
                {partners.length} {partners.length === 1 ? 'partner' : 'partners'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : partners.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No partners yet</h3>
                <p className="text-gray-600 mb-4">Connect with study partners to start collaborating!</p>
                <button
                  onClick={() => {
                    router.push('/search')
                    onClose()
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Find Study Partners
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {partners.map((partner) => (
                  <div
                    key={partner.id}
                    className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition border border-gray-200"
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {partner.avatarUrl ? (
                          <img
                            src={partner.avatarUrl}
                            alt={partner.name}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                            {partner.name[0].toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">{partner.name}</h3>
                          {partner.profile?.onlineStatus === 'ONLINE' && (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                              Online
                            </span>
                          )}
                        </div>

                        {/* Subjects */}
                        {partner.profile?.subjects && partner.profile.subjects.length > 0 && (
                          <p className="text-sm text-gray-700 mb-1">
                            <span className="font-medium">📚 Subjects:</span> {partner.profile.subjects.join(', ')}
                          </p>
                        )}

                        {/* Skill Level & Study Style */}
                        <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                          {partner.profile?.skillLevel && (
                            <span>💡 {partner.profile.skillLevel}</span>
                          )}
                          {partner.profile?.studyStyle && (
                            <span>📖 {partner.profile.studyStyle}</span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleMessage(partner.id)}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            Message
                          </button>
                          <button
                            onClick={() => handleViewProfile(partner)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Profile
                          </button>
                          <button
                            onClick={() => handleRemoveClick(partner)}
                            disabled={removingId === partner.matchId}
                            className="px-4 py-2 bg-red-100 text-red-600 text-sm rounded-lg hover:bg-red-200 transition flex items-center gap-2 disabled:opacity-50"
                          >
                            {removingId === partner.matchId ? (
                              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && partnerToRemove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Remove Partner?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove <span className="font-semibold">{partnerToRemove.name}</span> as your study partner? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setPartnerToRemove(null)
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                disabled={removingId !== null}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {removingId ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Removing...
                  </>
                ) : (
                  'Remove Partner'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile View Modal - Same as Find Partners */}
      {viewingProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
              <button
                onClick={() => setViewingProfile(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {/* Profile Header */}
              <div className="flex items-start gap-6 mb-6">
                {viewingProfile.avatarUrl ? (
                  <img
                    src={viewingProfile.avatarUrl}
                    alt={viewingProfile.name}
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-3xl">
                    {viewingProfile.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{viewingProfile.name}</h3>
                  <div className="flex gap-2 text-sm text-gray-600">
                    {viewingProfile.profile?.skillLevel && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                        {viewingProfile.profile.skillLevel.charAt(0) + viewingProfile.profile.skillLevel.slice(1).toLowerCase()}
                      </span>
                    )}
                    {viewingProfile.profile?.studyStyle && (
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                        {viewingProfile.profile.studyStyle.charAt(0) + viewingProfile.profile.studyStyle.slice(1).toLowerCase().replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  {viewingProfile.profile?.onlineStatus === 'ONLINE' && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-sm text-green-600">Online</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bio */}
              {viewingProfile.profile?.bio && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">About</h4>
                  <p className="text-gray-700">{viewingProfile.profile.bio}</p>
                </div>
              )}

              {/* About Yourself */}
              {(viewingProfile.profile?.aboutYourself || (viewingProfile.profile?.aboutYourselfItems && viewingProfile.profile.aboutYourselfItems.length > 0)) && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">More About Me</h4>
                  {viewingProfile.profile.aboutYourself && (
                    <p className="text-gray-700 mb-3">{viewingProfile.profile.aboutYourself}</p>
                  )}
                  {viewingProfile.profile.aboutYourselfItems && viewingProfile.profile.aboutYourselfItems.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {viewingProfile.profile.aboutYourselfItems.map((item, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-purple-50 text-purple-700 text-sm rounded-lg">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Subjects */}
              {viewingProfile.profile?.subjects && viewingProfile.profile.subjects.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Subjects</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingProfile.profile.subjects.map((subject, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-lg">
                        {subject}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Interests */}
              {viewingProfile.profile?.interests && viewingProfile.profile.interests.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingProfile.profile.interests.map((interest, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded-lg">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Goals */}
              {viewingProfile.profile?.goals && viewingProfile.profile.goals.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Goals</h4>
                  <ul className="space-y-2">
                    {viewingProfile.profile.goals.map((goal, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700">
                        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {goal}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Availability */}
              {viewingProfile.profile?.availableDays && viewingProfile.profile.availableDays.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Availability</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingProfile.profile.availableDays.map((day, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm rounded-lg">
                        {day}
                      </span>
                    ))}
                  </div>
                  {viewingProfile.profile.availableHours && viewingProfile.profile.availableHours.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {viewingProfile.profile.availableHours.map((hour, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg">
                          {hour}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setViewingProfile(null)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const partnerId = viewingProfile.id
                    setViewingProfile(null)
                    handleMessage(partnerId)
                  }}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
