'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type UserProfile = {
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
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
        alert('Connection request sent!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to send connection request')
      }
    } catch (error) {
      console.error('Error sending connection:', error)
      alert('Failed to send connection request')
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
        alert('Connection request cancelled')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to cancel connection')
      }
    } catch (error) {
      console.error('Error cancelling connection:', error)
      alert('Failed to cancel connection')
    } finally {
      setSendingConnection(false)
    }
  }

  const handleMessage = () => {
    router.push(`/chat?userId=${userId}`)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'This user profile could not be found.'}</p>
          <button
            onClick={() => router.back()}
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
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
    <div className="min-h-screen bg-gray-50">
      {/* Header with Back Button */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Profile Header */}
          <div className="text-center pt-12 pb-6 px-6">
            {/* Profile Photo */}
            {viewedUser.avatarUrl ? (
              <img
                src={viewedUser.avatarUrl}
                alt={viewedUser.name}
                className="w-32 h-32 rounded-full mx-auto mb-6 object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-32 h-32 rounded-full mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-4xl font-bold border-4 border-white shadow-lg">
                {viewedUser.name[0]?.toUpperCase()}
              </div>
            )}

            {/* Name */}
            <h1 className="text-3xl font-bold text-gray-900 mb-6">{viewedUser.name}</h1>

            {/* Edit Profile / Connect Button */}
            {isOwnProfile ? (
              <button
                onClick={() => router.push('/profile/edit')}
                className="px-8 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition shadow-md"
              >
                Edit profile
              </button>
            ) : (
              <div className="flex items-center justify-center gap-3">
                {profileData.connectionStatus === 'connected' ? (
                  <>
                    <span className="px-6 py-3 bg-green-100 text-green-700 rounded-full font-semibold">
                      ✓ Connected
                    </span>
                    <button
                      onClick={handleMessage}
                      className="px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition"
                    >
                      Message
                    </button>
                  </>
                ) : profileData.connectionStatus === 'pending' ? (
                  <>
                    <span className="px-6 py-3 bg-yellow-100 text-yellow-700 rounded-full font-semibold">
                      Connection Pending
                    </span>
                    <button
                      onClick={handleCancelConnection}
                      disabled={sendingConnection}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-full font-semibold hover:bg-gray-300 transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleSendConnection}
                    disabled={sendingConnection}
                    className="px-8 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition disabled:opacity-50 shadow-md"
                  >
                    {sendingConnection ? 'Sending...' : 'Connect'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Info Cards with Icons */}
          <div className="px-6 pb-6 space-y-4">
            {/* Age */}
            {profile?.age && (
              <div className="flex items-center text-gray-700">
                <span className="text-2xl mr-4">🎂</span>
                <span className="text-lg">{profile.age}</span>
              </div>
            )}

            {/* Role */}
            {profile?.role && (
              <div className="flex items-center text-gray-700">
                <span className="text-2xl mr-4">💼</span>
                <span className="text-lg">{profile.role}</span>
              </div>
            )}

            {/* School/Location */}
            {profile?.school && (
              <div className="flex items-center text-gray-700">
                <span className="text-2xl mr-4">🏛️</span>
                <span className="text-lg">{profile.school}</span>
              </div>
            )}

            {/* Email */}
            <div className="flex items-center text-gray-700">
              <span className="text-2xl mr-4">✉️</span>
              <span className="text-lg">{viewedUser.email}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-t border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('about')}
                className={`flex-1 py-4 text-center font-semibold transition ${
                  activeTab === 'about'
                    ? 'text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                About
              </button>
              <button
                onClick={() => setActiveTab('posts')}
                className={`flex-1 py-4 text-center font-semibold transition ${
                  activeTab === 'posts'
                    ? 'text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Posts
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="px-6 py-6">
            {activeTab === 'about' ? (
              <div className="space-y-6">
                {/* Bio */}
                {profile?.bio && (
                  <div>
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                  </div>
                )}

                {/* About Yourself */}
                {profile?.aboutYourself && (
                  <div>
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{profile.aboutYourself}</p>
                  </div>
                )}

                {/* About Yourself Items/Tags */}
                {profile?.aboutYourselfItems && profile.aboutYourselfItems.length > 0 && (
                  <div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {profile.aboutYourselfItems.map((item, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                {profile && (profile.subjects.length > 0 || profile.interests.length > 0 || profile.languages) && (
                  <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                    {/* Subjects */}
                    {profile.subjects.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Subjects</h3>
                        <div className="flex flex-wrap gap-2">
                          {profile.subjects.map((subject, index) => (
                            <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                              {subject}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interests */}
                    {profile.interests.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Interests</h3>
                        <div className="flex flex-wrap gap-2">
                          {profile.interests.map((interest, index) => (
                            <span key={index} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Languages */}
                    {profile.languages && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Languages</h3>
                        <p className="text-gray-700">{profile.languages}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* View More Button */}
                {!isOwnProfile && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => setShowFullProfile(!showFullProfile)}
                      className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-semibold transition flex items-center justify-center gap-2"
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

                {/* Full Profile Details (shown when View More is clicked) */}
                {showFullProfile && !isOwnProfile && profile && (
                  <div className="mt-6 pt-6 border-t border-gray-200 space-y-6">
                    {/* Goals */}
                    {profile.goals && profile.goals.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Learning Goals</h3>
                        <div className="flex flex-wrap gap-2">
                          {profile.goals.map((goal, index) => (
                            <span key={index} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                              {goal}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skill Level */}
                    {profile.skillLevel && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Skill Level</h3>
                        <p className="text-gray-700">{profile.skillLevel}</p>
                      </div>
                    )}

                    {/* Study Style */}
                    {profile.studyStyle && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Study Style</h3>
                        <p className="text-gray-700">{profile.studyStyle}</p>
                      </div>
                    )}

                    {/* Available Days */}
                    {profile.availableDays && profile.availableDays.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Available Days</h3>
                        <div className="flex flex-wrap gap-2">
                          {profile.availableDays.map((day, index) => (
                            <span key={index} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                              {day}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Post Privacy */}
                    {profile.postPrivacy && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Post Privacy</h3>
                        <p className="text-gray-700">
                          {profile.postPrivacy === 'PUBLIC' ? 'Posts are public' : 'Posts visible to partners only'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Show message if no about info */}
                {!profile?.bio && !profile?.aboutYourself && (!profile?.aboutYourselfItems || profile.aboutYourselfItems.length === 0) && (
                  <p className="text-gray-500 text-center py-8">No about information available</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {posts && posts.length > 0 ? (
                  posts.map((post) => (
                    <div key={post.id} className="border border-gray-200 rounded-lg p-4">
                      <p className="text-gray-800 mb-3 whitespace-pre-wrap leading-relaxed">{post.content}</p>

                      {/* Post Images */}
                      {post.imageUrls && post.imageUrls.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {post.imageUrls.map((url, index) => (
                            <img
                              key={index}
                              src={url}
                              alt={`Post image ${index + 1}`}
                              className="w-full h-48 object-cover rounded-lg"
                            />
                          ))}
                        </div>
                      )}

                      {/* Post Stats */}
                      <div className="flex items-center gap-4 text-sm text-gray-500 pt-3 border-t border-gray-100">
                        <span>❤️ {post._count.likes}</span>
                        <span>💬 {post._count.comments}</span>
                        <span>🔁 {post._count.reposts}</span>
                        <span className="ml-auto text-xs">{new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">No posts yet</p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
