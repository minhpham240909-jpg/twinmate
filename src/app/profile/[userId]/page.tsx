'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'

type UserProfile = {
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
    onlineStatus?: 'ONLINE' | 'OFFLINE' | null
    coverPhotoUrl?: string | null
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendingConnection, setSendingConnection] = useState(false)
  const [activeTab, setActiveTab] = useState<'about' | 'posts'>('about')
  const [showFullProfile, setShowFullProfile] = useState(false)
  const [showCoverPhotoMenu, setShowCoverPhotoMenu] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/auth/signin')
      return
    }

    if (currentUser && userId) {
      fetchUserProfile()
    }
  }, [currentUser, authLoading, userId])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowCoverPhotoMenu(false)
      }
    }

    if (showCoverPhotoMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCoverPhotoMenu])

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
      setCoverPhotoUrl(data.user?.coverPhotoUrl || null)
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

  const handleCoverPhotoClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowCoverPhotoMenu(!showCoverPhotoMenu)
  }

  const handleSeeCoverPhoto = () => {
    if (coverPhotoUrl) {
      window.open(coverPhotoUrl, '_blank')
    }
    setShowCoverPhotoMenu(false)
  }

  const handleUploadCoverPhoto = () => {
    fileInputRef.current?.click()
    setShowCoverPhotoMenu(false)
  }

  const handleCoverPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB')
      return
    }

    setIsUploadingCover(true)

    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('userId', userId)

      const response = await fetch('/api/upload/cover-photo', {
        method: 'POST',
        body: formDataUpload,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      setCoverPhotoUrl(data.url)
      await fetchUserProfile()
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload cover photo')
    } finally {
      setIsUploadingCover(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB')
      return
    }

    setIsUploadingAvatar(true)

    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('userId', userId)

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formDataUpload,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      await fetchUserProfile()
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload avatar')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-200">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'This user profile could not be found.'}</p>
          <button
            onClick={() => router.back()}
            className="inline-block px-6 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition font-semibold"
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
    <div className="min-h-screen bg-white">
      {/* Header Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors -ml-2"
          >
            <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="ml-4">
            <h1 className="text-xl font-bold text-gray-900">{viewedUser.name}</h1>
            <p className="text-sm text-gray-500">{posts.length} {posts.length === 1 ? 'post' : 'posts'}</p>
          </div>
        </div>
      </header>

      {/* Banner with Cover Photo */}
      <div className="relative h-52 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
        {coverPhotoUrl ? (
          <img
            src={coverPhotoUrl}
            alt="Cover photo"
            className="w-full h-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-black/5"></div>
        
        {/* Cover Photo Menu Button */}
        <div className="absolute bottom-4 right-4" ref={menuRef}>
          <button
            onClick={handleCoverPhotoClick}
            className="p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors backdrop-blur-sm"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          
          {/* Cover Photo Menu */}
          {showCoverPhotoMenu && (
            <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-[100]">
              {coverPhotoUrl && (
                <button
                  onClick={handleSeeCoverPhoto}
                  className="w-full px-4 py-3 text-left text-sm text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  See cover photo
                </button>
              )}
              {isOwnProfile && (
                <button
                  onClick={handleUploadCoverPhoto}
                  className="w-full px-4 py-3 text-left text-sm text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload cover photo
                </button>
              )}
            </div>
          )}
        </div>
        
        {isUploadingCover && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleCoverPhotoUpload}
          className="hidden"
        />
      </div>

      {/* Profile Header */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="relative -mt-24 mb-4">
          {/* Profile Picture */}
          <div className="inline-block relative">
            {isOwnProfile ? (
              <div className="relative group">
                <PartnerAvatar
                  avatarUrl={viewedUser.avatarUrl}
                  name={viewedUser.name}
                  size="xl"
                  onlineStatus={viewedUser.onlineStatus as 'ONLINE' | 'OFFLINE'}
                  showStatus={false}
                />
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute bottom-0 right-0 w-10 h-10 bg-black rounded-full flex items-center justify-center shadow-lg border-4 border-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <PartnerAvatar
                avatarUrl={viewedUser.avatarUrl}
                name={viewedUser.name}
                size="xl"
                onlineStatus={viewedUser.onlineStatus as 'ONLINE' | 'OFFLINE'}
                showStatus={profileData?.connectionStatus === 'connected'}
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="absolute right-0 top-4 flex gap-3">
            {isOwnProfile ? (
              <button
                onClick={() => router.push('/profile/edit')}
                className="px-6 py-2.5 bg-black text-white rounded-full font-semibold hover:bg-gray-800 transition-colors text-sm"
              >
                Edit profile
              </button>
            ) : (
              <>
                {profileData.connectionStatus === 'pending' ? (
                  <button
                    onClick={handleCancelConnection}
                    disabled={sendingConnection}
                    className="px-6 py-2.5 bg-gray-200 text-gray-900 rounded-full font-semibold hover:bg-gray-300 transition-colors text-sm disabled:opacity-50"
                  >
                    {sendingConnection ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                ) : !profileData.connectionStatus || profileData.connectionStatus === 'none' ? (
                  <button
                    onClick={handleSendConnection}
                    disabled={sendingConnection}
                    className="px-6 py-2.5 bg-black text-white rounded-full font-semibold hover:bg-gray-800 transition-colors text-sm disabled:opacity-50"
                  >
                    {sendingConnection ? 'Connecting...' : tCommon('connect')}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{viewedUser.name}</h1>
          <p className="text-gray-500 text-sm mb-3">@{viewedUser.email.split('@')[0]}</p>
          
          {profile?.bio && (
            <p className="text-gray-900 mb-3 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-3">
            {profile?.school && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>{profile.school}</span>
              </div>
            )}
            {profile?.age && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{profile.age} years old</span>
              </div>
            )}
            {profile?.role && (
              <span>{profile.role}</span>
            )}
          </div>

          {/* Quick Stats */}
          <div className="flex gap-6 text-sm mb-4">
            {(profile?.subjects && profile.subjects.length > 0) && (
              <div>
                <span className="font-semibold text-gray-900">{profile.subjects.length}</span>
                <span className="text-gray-500 ml-1">{profile.subjects.length === 1 ? 'subject' : 'subjects'}</span>
              </div>
            )}
            {(profile?.interests && profile.interests.length > 0) && (
              <div>
                <span className="font-semibold text-gray-900">{profile.interests.length}</span>
                <span className="text-gray-500 ml-1">{profile.interests.length === 1 ? 'interest' : 'interests'}</span>
              </div>
            )}
            {profileData.matchScore > 0 && (
              <div>
                <span className="font-semibold text-gray-900">{profileData.matchScore}%</span>
                <span className="text-gray-500 ml-1">match</span>
              </div>
            )}
          </div>

          {/* Message Button - Below Profile Info */}
          {!isOwnProfile && profileData.connectionStatus === 'connected' && (
            <div className="mb-4">
              <button
                onClick={handleMessage}
                className="px-6 py-2.5 bg-black text-white rounded-full font-semibold hover:bg-gray-800 transition-colors text-sm flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Message
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('about')}
              className={`px-4 py-4 font-semibold text-sm relative transition-colors ${
                activeTab === 'about'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('about')}
              {activeTab === 'about' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t-full"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-4 py-4 font-semibold text-sm relative transition-colors ${
                activeTab === 'posts'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('posts')}
              {activeTab === 'posts' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t-full"></div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {activeTab === 'about' ? (
          <div className="space-y-6">
            {/* About Yourself */}
            {profile?.aboutYourself && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">More About Me</h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{profile.aboutYourself}</p>
              </div>
            )}

            {/* About Yourself Items/Tags */}
            {profile?.aboutYourselfItems && profile.aboutYourselfItems.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.aboutYourselfItems.map((item, index) => (
                    <span key={index} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Subjects */}
            {profile?.subjects && profile.subjects.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{t('subjects')}</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.subjects.map((subject, index) => (
                    <span key={index} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-100 transition-colors">
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Interests */}
            {profile?.interests && profile.interests.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{t('interests')}</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest, index) => (
                    <span key={index} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium hover:bg-purple-100 transition-colors">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {profile?.languages && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{t('languages')}</h3>
                <p className="text-gray-700">{profile.languages}</p>
              </div>
            )}

            {/* View More Button */}
            {!isOwnProfile && (
              <div className="pt-4">
                <button
                  onClick={() => setShowFullProfile(!showFullProfile)}
                  className="w-full py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium text-sm"
                >
                  {showFullProfile ? 'Show less' : 'Show more'}
                </button>
              </div>
            )}

            {/* Full Profile Details */}
            {showFullProfile && !isOwnProfile && profile && (
              <div className="pt-4 border-t border-gray-200 space-y-6">
                {/* Goals */}
                {profile.goals && profile.goals.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Learning Goals</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.goals.map((goal, index) => (
                        <span key={index} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                          {goal}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skill Level */}
                {profile.skillLevel && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Skill Level</h3>
                    <p className="text-gray-700">{profile.skillLevel}</p>
                  </div>
                )}

                {/* Study Style */}
                {profile.studyStyle && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Study Style</h3>
                    <p className="text-gray-700">{profile.studyStyle}</p>
                  </div>
                )}

                {/* Available Days */}
                {profile.availableDays && profile.availableDays.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Available Days</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.availableDays.map((day, index) => (
                        <span key={index} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
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
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-gray-500">{t('noAboutInfo')}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-0">
            {posts && posts.length > 0 ? (
              posts.map((post) => (
                <div key={post.id} className="border-b border-gray-200 py-6 hover:bg-gray-50 transition-colors cursor-pointer">
                  <p className="text-gray-900 mb-4 whitespace-pre-wrap leading-relaxed">{post.content}</p>

                  {/* Post Images */}
                  {post.imageUrls && post.imageUrls.length > 0 && (
                    <div className={`grid gap-2 mb-4 rounded-2xl overflow-hidden ${post.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {post.imageUrls.map((url, index) => (
                        <div key={index} className="relative aspect-video bg-gray-100">
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
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <span className="flex items-center gap-2 hover:text-red-500 transition-colors cursor-pointer">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      {post._count.likes}
                    </span>
                    <span className="flex items-center gap-2 hover:text-blue-500 transition-colors cursor-pointer">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      {post._count.comments}
                    </span>
                    <span className="flex items-center gap-2 hover:text-green-500 transition-colors cursor-pointer">
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
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  )
}
