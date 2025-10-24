'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type UserProfile = {
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
  profile: {
    bio: string
    subjects: string[]
    interests: string[]
    goals: string[]
    skillLevel: string
    studyStyle: string
    availableDays: string[]
    school: string
    languages: string
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
        // Refresh profile to update connection status
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

  const { user: viewedUser, profile, posts, connectionStatus, matchScore, matchDetails } = profileData

  // Check if viewing own profile
  const isOwnProfile = currentUser?.id === userId

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            {isOwnProfile && (
              <Link
                href="/profile"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
              >
                Edit Profile
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Profile Header Card */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            {viewedUser.avatarUrl ? (
              <img
                src={viewedUser.avatarUrl}
                alt={viewedUser.name}
                className="w-24 h-24 rounded-full"
              />
            ) : (
              <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {viewedUser.name[0]}
              </div>
            )}

            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{viewedUser.name}</h1>
              {profile?.bio && (
                <p className="text-gray-600 mb-4">{profile.bio}</p>
              )}

              {/* Match Score (only for other users) */}
              {!isOwnProfile && matchScore > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          matchScore >= 70 ? 'bg-green-500' :
                          matchScore >= 40 ? 'bg-yellow-500' :
                          'bg-gray-400'
                        }`}
                        style={{ width: `${matchScore}%` }}
                      ></div>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{matchScore}%</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>✓ {matchDetails.subjects} common subjects</span>
                    <span>✓ {matchDetails.interests} common interests</span>
                    {matchDetails.studyStyle && <span>✓ Similar study style</span>}
                  </div>
                </div>
              )}

              {/* Connection Actions (only for other users) */}
              {!isOwnProfile && (
                <div className="flex items-center gap-3">
                  {connectionStatus === 'connected' && (
                    <>
                      <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-semibold">
                        ✓ Connected
                      </span>
                      <button
                        onClick={handleMessage}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                      >
                        Message
                      </button>
                    </>
                  )}

                  {connectionStatus === 'pending' && (
                    <>
                      <span className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg font-semibold">
                        Connection Pending
                      </span>
                      <button
                        onClick={handleCancelConnection}
                        disabled={sendingConnection}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold disabled:opacity-50"
                      >
                        Cancel Request
                      </button>
                    </>
                  )}

                  {connectionStatus === 'none' && (
                    <button
                      onClick={handleSendConnection}
                      disabled={sendingConnection}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50"
                    >
                      {sendingConnection ? 'Sending...' : 'Connect'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Details Grid */}
        {profile && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Subjects */}
            {profile.subjects && profile.subjects.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Subjects</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.subjects.map((subject, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Interests */}
            {profile.interests && profile.interests.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest, index) => (
                    <span key={index} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Study Info */}
            {(profile.skillLevel || profile.studyStyle) && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Study Preferences</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  {profile.skillLevel && (
                    <p><strong>Skill Level:</strong> {profile.skillLevel}</p>
                  )}
                  {profile.studyStyle && (
                    <p><strong>Study Style:</strong> {profile.studyStyle}</p>
                  )}
                </div>
              </div>
            )}

            {/* Additional Info */}
            {(profile.school || profile.languages) && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Additional Info</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  {profile.school && (
                    <p><strong>School:</strong> {profile.school}</p>
                  )}
                  {profile.languages && (
                    <p><strong>Languages:</strong> {profile.languages}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* User's Posts */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Posts</h3>
          {posts && posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-800 mb-3 whitespace-pre-wrap">{post.content}</p>

                  {/* Post Images */}
                  {post.imageUrls && post.imageUrls.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {post.imageUrls.map((url, index) => (
                        <img
                          key={index}
                          src={url}
                          alt={`Post image ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  )}

                  {/* Post Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>❤️ {post._count.likes}</span>
                    <span>💬 {post._count.comments}</span>
                    <span>🔁 {post._count.reposts}</span>
                    <span className="ml-auto">{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No posts yet</p>
          )}
        </div>
      </main>
    </div>
  )
}
