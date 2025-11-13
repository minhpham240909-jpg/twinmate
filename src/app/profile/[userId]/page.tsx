'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'

type UserProfile = {
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
    onlineStatus?: 'ONLINE' | 'OFFLINE' | null
  }
  profile: {
    bio: string
    age: number | null
    role: string | null
    subjects: string[]
    interests: string[]
    goals: string[]
    skillLevel: string
    studyStyle: string
    availableDays: string[]
    school: string | null
    languages: string | null
    aboutYourself: string | null
    aboutYourselfItems: string[]
    postPrivacy: string
  } | null
  posts: {
    id: string
    content: string
    imageUrls: string[]
    createdAt: string
    _count: {
      likes: number
      comments: number
      reposts: number
    }
  }[]
  connectionStatus: 'none' | 'pending' | 'connected'
  connectionId: string | null
  matchScore: number
  matchDetails: {
    subjects: number
    interests: number
    studyStyle: boolean
  }
}

export default function UserProfilePage() {
  const { user: currentUser, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const userId = params.userId as string
  const t = useTranslations('profile')
  const tCommon = useTranslations('common')

  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendingConnection, setSendingConnection] = useState(false)
  const [activeTab, setActiveTab] = useState<'about' | 'posts'>('about')
  const [showFullProfile, setShowFullProfile] = useState(false)

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/auth/signin')
      return
    }

    if (currentUser && userId) {
      fetchUserProfile()
    }
  }, [currentUser, authLoading, userId])

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`/api/users/${userId}`)

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load profile')
        setLoading(false)
        return
      }

      const data = await response.json()
      setProfileData(data)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError('Failed to load profile')
      setLoading(false)
    }
  }

  const handleSendConnection = async () => {
    if (!userId || !currentUser) return

    setSendingConnection(true)
    try {
      const response = await fetch('/api/connections/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: userId }),
      })

      if (response.ok) {
        await fetchUserProfile()
        alert(t('connectionRequestSent'))
      } else {
        const error = await response.json()
        alert(error.error || t('failedToSendConnectionRequest'))
      }
    } catch (error) {
      console.error('Error sending connection:', error)
      alert(t('failedToSendConnectionRequest'))
    } finally {
      setSendingConnection(false)
    }
  }

  const handleCancelConnection = async () => {
    if (!profileData?.connectionId) return

    setSendingConnection(true)
    try {
      const response = await fetch('/api/connections/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: profileData.connectionId }),
      })

      if (response.ok) {
        await fetchUserProfile()
        alert(t('connectionRequestCancelled'))
      } else {
        const error = await response.json()
        alert(error.error || t('failedToCancelConnection'))
      }
    } catch (error) {
      console.error('Error cancelling connection:', error)
      alert(t('failedToCancelConnection'))
    } finally {
      setSendingConnection(false)
    }
  }

  const handleMessage = () => {
    router.push(`/chat/partners?conversation=${userId}`)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'This user profile could not be found.'}</p>
          <button
            onClick={() => router.back()}
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-lg hover:shadow-xl"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const { user: viewedUser, profile, posts } = profileData
  const isOwnProfile = currentUser?.id === userId

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
          >
            <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Back</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Profile Header Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-6">
          {/* Cover Section */}
          <div className="h-48 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
          </div>

          {/* Profile Info Section */}
          <div className="px-8 pb-8 -mt-20 relative">
            {/* Avatar */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <PartnerAvatar
                  avatarUrl={viewedUser.avatarUrl}
                  name={viewedUser.name}
                  size="xl"
                  onlineStatus={viewedUser.onlineStatus as 'ONLINE' | 'OFFLINE'}
                  showStatus={profileData?.connectionStatus === 'connected'}
                  className="border-4 border-white shadow-2xl ring-4 ring-blue-100"
                />
              </div>
            </div>

            {/* Name and Basic Info */}
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{viewedUser.name}</h1>
              {profile?.role && (
                <p className="text-lg text-gray-600 mb-1">{profile.role}</p>
              )}
              {profile?.school && (
                <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {profile.school}
                </p>
              )}
            </div>

            {/* Quick Stats */}
            {(profile?.age || (profile?.subjects && profile.subjects.length > 0) || (profile?.interests && profile.interests.length > 0)) && (
              <div className="flex flex-wrap items-center justify-center gap-4 mb-6 pb-6 border-b border-gray-200">
                {profile?.age && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl">
                    <span className="text-xl">🎂</span>
                    <span className="text-sm font-medium text-gray-700">{profile.age} years old</span>
                  </div>
                )}
                {profile?.subjects && profile.subjects.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl">
                    <span className="text-xl">📚</span>
                    <span className="text-sm font-medium text-gray-700">{profile.subjects.length} {profile.subjects.length === 1 ? 'subject' : 'subjects'}</span>
                  </div>
                )}
                {profile?.interests && profile.interests.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl">
                    <span className="text-xl">🎯</span>
                    <span className="text-sm font-medium text-gray-700">{profile.interests.length} {profile.interests.length === 1 ? 'interest' : 'interests'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3">
              {isOwnProfile ? (
                <button
                  onClick={() => router.push('/profile/edit')}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  {profileData.connectionStatus === 'connected' ? (
                    <>
                      <button
                        onClick={handleMessage}
                        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        Message
                      </button>
                      <span className="px-6 py-3 bg-green-50 text-green-700 rounded-xl font-semibold border border-green-200">
                        {t('connected')}
                      </span>
                    </>
                  ) : profileData.connectionStatus === 'pending' ? (
                    <>
                      <span className="px-6 py-3 bg-yellow-50 text-yellow-700 rounded-xl font-semibold border border-yellow-200">
                        {t('connectionPending')}
                      </span>
                      <button
                        onClick={handleCancelConnection}
                        disabled={sendingConnection}
                        className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleSendConnection}
                      disabled={sendingConnection}
                      className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50"
                    >
                      {sendingConnection ? 'Connecting...' : tCommon('connect')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('about')}
                className={`flex-1 py-4 text-center font-semibold transition-all relative ${
                  activeTab === 'about'
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('about')}
                {activeTab === 'about' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600"></div>
                )}
              </button>
              <button
                onClick={() => setActiveTab('posts')}
                className={`flex-1 py-4 text-center font-semibold transition-all relative ${
                  activeTab === 'posts'
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('posts')}
                {activeTab === 'posts' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600"></div>
                )}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {activeTab === 'about' ? (
              <div className="space-y-8">
                {/* Bio Section */}
                {profile?.bio && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                      About
                    </h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap pl-3">{profile.bio}</p>
                  </div>
                )}

                {/* About Yourself */}
                {profile?.aboutYourself && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                      More About Me
                    </h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap pl-3">{profile.aboutYourself}</p>
                  </div>
                )}

                {/* About Yourself Items/Tags */}
                {profile?.aboutYourselfItems && profile.aboutYourselfItems.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2 pl-3">
                      {profile.aboutYourselfItems.map((item, index) => (
                        <span key={index} className="px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subjects */}
                {profile?.subjects && profile.subjects.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                      {t('subjects')}
                    </h3>
                    <div className="flex flex-wrap gap-2 pl-3">
                      {profile.subjects.map((subject, index) => (
                        <span key={index} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                          {subject}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interests */}
                {profile?.interests && profile.interests.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                      {t('interests')}
                    </h3>
                    <div className="flex flex-wrap gap-2 pl-3">
                      {profile.interests.map((interest, index) => (
                        <span key={index} className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors">
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Languages */}
                {profile?.languages && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                      {t('languages')}
                    </h3>
                    <p className="text-gray-700 pl-3">{profile.languages}</p>
                  </div>
                )}

                {/* View More Button */}
                {!isOwnProfile && (
                  <div className="pt-6 border-t border-gray-200">
                    <button
                      onClick={() => setShowFullProfile(!showFullProfile)}
                      className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-800 rounded-xl font-semibold transition flex items-center justify-center gap-2 border border-gray-200"
                    >
                      {showFullProfile ? (
                        <>
                          <span>Show Less</span>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </>
                      ) : (
                        <>
                          <span>View Full Profile</span>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Full Profile Details */}
                {showFullProfile && !isOwnProfile && profile && (
                  <div className="pt-6 border-t border-gray-200 space-y-6">
                    {/* Goals */}
                    {profile.goals && profile.goals.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                          Learning Goals
                        </h3>
                        <div className="flex flex-wrap gap-2 pl-3">
                          {profile.goals.map((goal, index) => (
                            <span key={index} className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                              {goal}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skill Level */}
                    {profile.skillLevel && (
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                          Skill Level
                        </h3>
                        <p className="text-gray-700 pl-3">{profile.skillLevel}</p>
                      </div>
                    )}

                    {/* Study Style */}
                    {profile.studyStyle && (
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                          Study Style
                        </h3>
                        <p className="text-gray-700 pl-3">{profile.studyStyle}</p>
                      </div>
                    )}

                    {/* Available Days */}
                    {profile.availableDays && profile.availableDays.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                          Available Days
                        </h3>
                        <div className="flex flex-wrap gap-2 pl-3">
                          {profile.availableDays.map((day, index) => (
                            <span key={index} className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium">
                              {day}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty State */}
                {!profile?.bio && !profile?.aboutYourself && (!profile?.aboutYourselfItems || profile.aboutYourselfItems.length === 0) && (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-gray-500">{t('noAboutInfo')}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {posts && posts.length > 0 ? (
                  posts.map((post) => (
                    <div key={post.id} className="border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                      <p className="text-gray-800 mb-4 whitespace-pre-wrap leading-relaxed">{post.content}</p>

                      {/* Post Images */}
                      {post.imageUrls && post.imageUrls.length > 0 && (
                        <div className={`grid gap-3 mb-4 ${post.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {post.imageUrls.map((url, index) => (
                            <div key={index} className="relative aspect-video rounded-xl overflow-hidden bg-gray-100">
                              <img
                                src={url}
                                alt={`Post image ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Post Stats */}
                      <div className="flex items-center gap-6 text-sm text-gray-500 pt-4 border-t border-gray-100">
                        <span className="flex items-center gap-1">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          {post._count.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {post._count.comments}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {post._count.reposts}
                        </span>
                        <span className="ml-auto text-xs text-gray-400">
                          {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500">{t('noPosts')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
