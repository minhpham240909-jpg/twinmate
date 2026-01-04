'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'
import GlowBorder from '@/components/ui/GlowBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'
import ReportModal from '@/components/ReportModal'
import { sanitizeBio, sanitizeText } from '@/lib/sanitize'

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
    skillLevelCustomDescription: string | null
    studyStyle: string
    studyStyleCustomDescription: string | null
    availableDays: string[]
    availableHours: string[]
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
    subjects: {
      count: number
      items: string[]
      score: number
    }
    interests: {
      count: number
      items: string[]
      score: number
    }
    goals: {
      count: number
      items: string[]
    }
    skillLevel: {
      matches: boolean
      value: string | null
    }
    studyStyle: {
      matches: boolean
      value: string | null
    }
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
  const avatarMenuRef = useRef<HTMLDivElement>(null)

  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendingConnection, setSendingConnection] = useState(false)
  const [activeTab, setActiveTab] = useState<'about' | 'posts'>('about')
  const [showFullProfile, setShowFullProfile] = useState(false)
  const [showCoverPhotoMenu, setShowCoverPhotoMenu] = useState(false)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null)
  const [showMatchDetails, setShowMatchDetails] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/auth/signin')
      return
    }

    if (currentUser && userId) {
      fetchUserProfile()
    }
  }, [currentUser, authLoading, userId])

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowCoverPhotoMenu(false)
      }
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
        setShowAvatarMenu(false)
      }
    }

    if (showCoverPhotoMenu || showAvatarMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCoverPhotoMenu, showAvatarMenu])

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
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-slate-400">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl dark:shadow-none p-8 text-center border border-gray-200 dark:border-white/10">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Profile Not Found</h1>
          <p className="text-gray-600 dark:text-slate-400 mb-6">{error || 'This user profile could not be found.'}</p>
          <button
            onClick={() => router.back()}
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-full hover:shadow-lg transition font-semibold"
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
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors -ml-2"
          >
            <svg className="w-5 h-5 text-gray-900 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="ml-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{viewedUser.name}</h1>
            <p className="text-sm text-gray-600 dark:text-slate-400">{posts.length} {posts.length === 1 ? 'post' : 'posts'}</p>
          </div>
        </div>
      </header>

      {/* Banner with Cover Photo */}
      <div className="relative h-52 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-500">
        {coverPhotoUrl ? (
          <img
            src={coverPhotoUrl}
            alt="Cover photo"
            className="w-full h-full object-cover"
          />
        ) : isOwnProfile ? (
          /* Message when no cover photo - only for own profile */
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium">Add a cover photo to personalize your profile</p>
            </div>
          </div>
        ) : null}
        <div className="absolute inset-0 bg-black/5"></div>

        {/* Cover Photo Menu Button - Only show if there's a cover photo OR it's own profile */}
        {(coverPhotoUrl || isOwnProfile) && (
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
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-slate-900/95 backdrop-blur-xl rounded-lg shadow-xl dark:shadow-none border border-gray-200 dark:border-white/10 overflow-hidden z-[9999]">
                {coverPhotoUrl && (
                  <button
                    onClick={handleSeeCoverPhoto}
                    className="w-full px-4 py-3 text-left text-sm text-gray-900 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
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
                    className="w-full px-4 py-3 text-left text-sm text-gray-900 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
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
        )}
        
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
          <div className="inline-block relative" ref={avatarMenuRef}>
            <div
              className={`relative ${isOwnProfile || viewedUser.avatarUrl ? 'cursor-pointer' : ''}`}
              onClick={() => {
                if (isOwnProfile || viewedUser.avatarUrl) {
                  setShowAvatarMenu(!showAvatarMenu)
                }
              }}
            >
              <PartnerAvatar
                avatarUrl={viewedUser.avatarUrl}
                name={viewedUser.name}
                size="xl"
                onlineStatus={viewedUser.onlineStatus as 'ONLINE' | 'OFFLINE'}
                showStatus={!isOwnProfile && profileData?.connectionStatus === 'connected'}
              />
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            {/* Avatar Menu */}
            {showAvatarMenu && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-900/95 backdrop-blur-xl rounded-lg shadow-xl dark:shadow-none border border-gray-200 dark:border-white/10 overflow-hidden z-[9999]">
                {viewedUser.avatarUrl && (
                  <button
                    onClick={() => {
                      window.open(viewedUser.avatarUrl!, '_blank')
                      setShowAvatarMenu(false)
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-900 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    See profile photo
                  </button>
                )}
                {isOwnProfile && (
                  <button
                    onClick={() => {
                      avatarInputRef.current?.click()
                      setShowAvatarMenu(false)
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-900 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload new photo
                  </button>
                )}
              </div>
            )}

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          {/* Action Buttons - Edit Profile for own profile */}
          {isOwnProfile && (
            <Bounce delay={0.1}>
              <div className="absolute right-0 top-4 flex gap-3">
                <button
                  onClick={() => router.push('/profile/edit')}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-full font-semibold hover:shadow-lg hover:scale-105 transition-all text-sm shadow-lg"
                >
                  Edit profile
                </button>
              </div>
            </Bounce>
          )}
        </div>

        {/* User Info */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{sanitizeText(viewedUser.name)}</h1>
          <p className="text-gray-600 dark:text-slate-400 text-sm mb-3">@{sanitizeText(viewedUser.email?.split('@')[0] || viewedUser.name?.toLowerCase().replace(/\s+/g, '') || 'user')}</p>

          {profile?.bio && (
            <p className="text-gray-700 dark:text-slate-300 mb-3 whitespace-pre-wrap leading-relaxed">{sanitizeBio(profile.bio)}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-slate-400 mb-3">
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
            {/* Location - only shown if user allowed visibility */}
            {((profile as any)?.location_city || (profile as any)?.location_state || (profile as any)?.location_country) && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>
                  {[(profile as any).location_city, (profile as any).location_state, (profile as any).location_country]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <FadeIn delay={0.2}>
            <div className="flex gap-6 text-sm mb-4">
              {(profile?.subjects && profile.subjects.length > 0) && (
                <GlowBorder color="#3b82f6" intensity="medium" animated={false}  style={{ borderRadius: 8 }}>
                  <div className="px-4 py-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                    <Pulse>
                      <span className="font-semibold text-blue-400">{profile.subjects.length}</span>
                    </Pulse>
                    <span className="text-gray-600 dark:text-slate-400 ml-1">{profile.subjects.length === 1 ? 'subject' : 'subjects'}</span>
                  </div>
                </GlowBorder>
              )}
              {(profile?.interests && profile.interests.length > 0) && (
                <GlowBorder color="#8b5cf6" intensity="medium" animated={false}  style={{ borderRadius: 8 }}>
                  <div className="px-4 py-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                    <Pulse>
                      <span className="font-semibold text-blue-400">{profile.interests.length}</span>
                    </Pulse>
                    <span className="text-gray-600 dark:text-slate-400 ml-1">{profile.interests.length === 1 ? 'interest' : 'interests'}</span>
                  </div>
                </GlowBorder>
              )}
              {profileData.matchScore > 0 && (
                <GlowBorder color="#10b981" intensity="medium" animated={false}  style={{ borderRadius: 8 }}>
                  <div className="px-4 py-2 bg-green-500/20 rounded-lg border border-green-500/30">
                    <Pulse>
                      <span className="font-semibold text-green-400">{profileData.matchScore}%</span>
                    </Pulse>
                    <span className="text-gray-600 dark:text-slate-400 ml-1">match</span>
                  </div>
                </GlowBorder>
              )}
            </div>
          </FadeIn>

          {/* Match Details - Expandable Section */}
          {!isOwnProfile && profileData.matchScore > 0 && (
            <FadeIn delay={0.3}>
              <div className="mb-4">
                <button
                  onClick={() => setShowMatchDetails(!showMatchDetails)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-500/20 to-blue-500/20 hover:from-green-500/30 hover:to-blue-500/30 rounded-xl transition-all duration-200 group border border-green-500/30"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">Match Details</span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-600 dark:text-slate-400 transition-transform duration-200 ${showMatchDetails ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expandable Content */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    showMatchDetails ? 'max-h-[1000px] opacity-100 mt-3' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="bg-white dark:bg-white/5 backdrop-blur-xl rounded-xl border border-gray-200 dark:border-white/10 shadow-sm dark:shadow-none">
                    <div className="p-5 space-y-4">
                      {/* Subjects Match */}
                      {profileData.matchDetails.subjects.count > 0 && (
                        <div className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-white/10 last:border-0 last:pb-0">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {profileData.matchDetails.subjects.count} Shared Subject{profileData.matchDetails.subjects.count !== 1 ? 's' : ''}
                              </span>
                              <span className="text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-1 rounded-full border border-blue-500/30">
                                +{profileData.matchDetails.subjects.score} pts
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {profileData.matchDetails.subjects.items.map((subject, idx) => (
                                <span key={idx} className="text-xs px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-full font-medium border border-blue-500/30">
                                  {subject}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Interests Match */}
                      {profileData.matchDetails.interests.count > 0 && (
                        <div className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-white/10 last:border-0 last:pb-0">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {profileData.matchDetails.interests.count} Shared Interest{profileData.matchDetails.interests.count !== 1 ? 's' : ''}
                              </span>
                              <span className="text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-1 rounded-full border border-blue-500/30">
                                +{profileData.matchDetails.interests.score} pts
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {profileData.matchDetails.interests.items.map((interest, idx) => (
                                <span key={idx} className="text-xs px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-full font-medium border border-blue-500/30">
                                  {interest}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Goals Match */}
                      {profileData.matchDetails.goals.count > 0 && (
                        <div className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-white/10 last:border-0 last:pb-0">
                          <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {profileData.matchDetails.goals.count} Shared Goal{profileData.matchDetails.goals.count !== 1 ? 's' : ''}
                              </span>
                              <span className="text-xs text-gray-600 dark:text-slate-400 italic">Informational</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {profileData.matchDetails.goals.items.map((goal, idx) => (
                                <span key={idx} className="text-xs px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full font-medium border border-amber-500/30">
                                  {goal}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Skill Level Match */}
                      {profileData.matchDetails.skillLevel.matches && (
                        <div className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-white/10 last:border-0 last:pb-0">
                          <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">Same Skill Level</span>
                              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-full border border-emerald-500/30">
                                +10 pts
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-slate-400">
                              Both at <span className="font-semibold text-emerald-400">{profileData.matchDetails.skillLevel.value}</span> level
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Study Style Match */}
                      {profileData.matchDetails.studyStyle.matches && (
                        <div className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-white/10 last:border-0 last:pb-0">
                          <div className="w-6 h-6 bg-blue-1000 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">Same Study Style</span>
                              <span className="text-xs font-bold text-blue-500 bg-blue-1000/20 px-2 py-1 rounded-full border border-blue-1000/30">
                                +10 pts
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-slate-400">
                              Both prefer <span className="font-semibold text-blue-500">{profileData.matchDetails.studyStyle.value}</span> style
                            </p>
                          </div>
                        </div>
                      )}

                      {/* No matches found */}
                      {profileData.matchDetails.subjects.count === 0 &&
                        profileData.matchDetails.interests.count === 0 &&
                        profileData.matchDetails.goals.count === 0 &&
                        !profileData.matchDetails.skillLevel.matches &&
                        !profileData.matchDetails.studyStyle.matches && (
                        <div className="text-center py-4">
                          <p className="text-sm text-gray-600 dark:text-slate-400">No specific matches found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          )}

          {/* Connect/Message Buttons - Below Profile Info */}
          {!isOwnProfile && (
            <Bounce delay={0.3}>
              <div className="mb-4 flex gap-3">
                {profileData.connectionStatus === 'pending' ? (
                  <button
                    onClick={handleCancelConnection}
                    disabled={sendingConnection}
                    className="px-6 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-full font-semibold hover:bg-gray-200 dark:hover:bg-slate-700 hover:scale-105 transition-all text-sm disabled:opacity-50 shadow-md border border-gray-200 dark:border-white/10"
                  >
                    {sendingConnection ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                ) : profileData.connectionStatus === 'connected' ? (
                  <GlowBorder color="#3b82f6" intensity="medium" animated={false}  style={{ borderRadius: 9999 }}>
                    <button
                      onClick={handleMessage}
                      className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-full font-semibold hover:shadow-lg hover:scale-105 transition-all text-sm flex items-center gap-2 shadow-lg"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      Message
                    </button>
                  </GlowBorder>
                ) : (
                  <Bounce>
                    <button
                      onClick={handleSendConnection}
                      disabled={sendingConnection}
                      className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-full font-semibold hover:shadow-lg hover:scale-105 transition-all text-sm disabled:opacity-50 shadow-lg"
                    >
                      {sendingConnection ? 'Connecting...' : tCommon('connect')}
                    </button>
                  </Bounce>
                )}
                {/* Report User Button */}
                <button
                  onClick={() => setShowReportModal(true)}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-full font-medium hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 hover:scale-105 transition-all text-sm border border-gray-200 dark:border-white/10"
                  title={t('reportUser') || 'Report User'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                </button>
              </div>
            </Bounce>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-white/10">
          <div className="flex">
            <button
              onClick={() => setActiveTab('about')}
              className={`px-4 py-4 font-semibold text-sm relative transition-all hover:scale-105 ${
                activeTab === 'about'
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-300'
              }`}
            >
              {t('about')}
              {activeTab === 'about' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t-full"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-4 py-4 font-semibold text-sm relative transition-all hover:scale-105 ${
                activeTab === 'posts'
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-300'
              }`}
            >
              {t('posts')} {posts.length > 0 && (
                <Pulse>
                  <span className="ml-1 text-blue-400">({posts.length})</span>
                </Pulse>
              )}
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
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">More About Me</h3>
                <p className="text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{profile.aboutYourself}</p>
              </div>
            )}

            {/* About Yourself Items/Tags */}
            {profile?.aboutYourselfItems && profile.aboutYourselfItems.length > 0 && (
              <FadeIn delay={0.1}>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.aboutYourselfItems.map((item, index) => (
                      <Bounce key={index} delay={index * 0.05}>
                        <span className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-full text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700 hover:scale-105 transition-all cursor-default border border-gray-200 dark:border-white/10">
                          {item}
                        </span>
                      </Bounce>
                    ))}
                  </div>
                </div>
              </FadeIn>
            )}

            {/* Subjects */}
            {profile?.subjects && profile.subjects.length > 0 && (
              <FadeIn delay={0.1}>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{t('subjects')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.subjects.map((subject, index) => (
                      <Bounce key={index} delay={index * 0.05}>
                        <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium hover:bg-blue-500/30 hover:scale-105 transition-all cursor-default border border-blue-500/30">
                          {subject}
                        </span>
                      </Bounce>
                    ))}
                  </div>
                </div>
              </FadeIn>
            )}

            {/* Interests */}
            {profile?.interests && profile.interests.length > 0 && (
              <FadeIn delay={0.2}>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{t('interests')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.map((interest, index) => (
                      <Bounce key={index} delay={index * 0.05}>
                        <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium hover:bg-blue-500/30 hover:scale-105 transition-all cursor-default border border-blue-500/30">
                          {interest}
                        </span>
                      </Bounce>
                    ))}
                  </div>
                </div>
              </FadeIn>
            )}

            {/* Languages */}
            {profile?.languages && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{t('languages')}</h3>
                <p className="text-gray-700 dark:text-slate-300">{profile.languages}</p>
              </div>
            )}

            {/* View More Button */}
            {!isOwnProfile && (
              <div className="pt-4">
                <button
                  onClick={() => setShowFullProfile(!showFullProfile)}
                  className="w-full py-3 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800/50 rounded-lg transition-colors font-medium text-sm border border-gray-200 dark:border-white/10"
                >
                  {showFullProfile ? 'Show less' : 'Show more'}
                </button>
              </div>
            )}

            {/* Full Profile Details */}
            {showFullProfile && !isOwnProfile && profile && (
              <div className="pt-4 border-t border-gray-200 dark:border-white/10 space-y-6">
                {/* Goals */}
                {profile.goals && profile.goals.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Learning Goals</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.goals.map((goal, index) => (
                        <span key={index} className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm font-medium border border-green-500/30">
                          {goal}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skill Level - Show custom description if available, otherwise show level */}
                {(profile.skillLevelCustomDescription || profile.skillLevel) && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Skill Level</h3>
                    <p className="text-gray-700 dark:text-slate-300">
                      {profile.skillLevelCustomDescription || profile.skillLevel}
                    </p>
                  </div>
                )}

                {/* Study Style - Show custom description if available, otherwise show style */}
                {(profile.studyStyleCustomDescription || profile.studyStyle) && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Study Style</h3>
                    <p className="text-gray-700 dark:text-slate-300">
                      {profile.studyStyleCustomDescription || profile.studyStyle}
                    </p>
                  </div>
                )}

                {/* Available Hours */}
                {profile.availableHours && profile.availableHours.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Available Hours</h3>
                    <p className="text-gray-700 dark:text-slate-300">{profile.availableHours.join(', ')}</p>
                  </div>
                )}

                {/* Available Days */}
                {profile.availableDays && profile.availableDays.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Available Days</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.availableDays.map((day, index) => (
                        <span key={index} className="px-3 py-1.5 bg-blue-1000/20 text-blue-500 rounded-full text-sm font-medium border border-blue-1000/30">
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
                <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200 dark:border-white/10">
                  <svg className="w-8 h-8 text-gray-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-gray-600 dark:text-slate-400">{t('noAboutInfo')}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-0">
            {posts && posts.length > 0 ? (
              posts.map((post, index) => (
                <FadeIn key={post.id} delay={index * 0.05}>
                  <GlowBorder color="#e5e7eb" animated={false}  style={{ borderRadius: 12 }}>
                    <div className="border-b border-gray-200 dark:border-white/10 py-6 px-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer rounded-lg">
                  <p className="text-gray-700 dark:text-slate-300 mb-4 whitespace-pre-wrap leading-relaxed">{post.content}</p>

                  {/* Post Images */}
                  {post.imageUrls && post.imageUrls.length > 0 && (
                    <div className={`grid gap-2 mb-4 rounded-2xl overflow-hidden ${post.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {post.imageUrls.map((url, index) => (
                        <div key={index} className="relative aspect-video bg-gray-100 dark:bg-slate-800">
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
                  <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-slate-400">
                    {post._count.likes > 0 ? (
                      <Pulse>
                        <span className="flex items-center gap-2 hover:text-red-500 hover:scale-110 transition-all cursor-pointer">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          {post._count.likes}
                        </span>
                      </Pulse>
                    ) : (
                      <span className="flex items-center gap-2 hover:text-red-500 hover:scale-110 transition-all cursor-pointer">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {post._count.likes}
                      </span>
                    )}
                    {post._count.comments > 0 ? (
                      <Pulse>
                        <span className="flex items-center gap-2 hover:text-blue-500 hover:scale-110 transition-all cursor-pointer">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {post._count.comments}
                        </span>
                      </Pulse>
                    ) : (
                      <span className="flex items-center gap-2 hover:text-blue-500 hover:scale-110 transition-all cursor-pointer">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {post._count.comments}
                      </span>
                    )}
                    {post._count.reposts > 0 ? (
                      <Pulse>
                        <span className="flex items-center gap-2 hover:text-green-500 hover:scale-110 transition-all cursor-pointer">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {post._count.reposts}
                        </span>
                      </Pulse>
                    ) : (
                      <span className="flex items-center gap-2 hover:text-green-500 hover:scale-110 transition-all cursor-pointer">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {post._count.reposts}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-slate-500">
                      {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                    </div>
                  </GlowBorder>
                </FadeIn>
              ))
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200 dark:border-white/10">
                  <svg className="w-8 h-8 text-gray-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 dark:text-slate-400">{t('noPosts')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Report Modal */}
      {!isOwnProfile && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          contentType="user"
          contentId={userId}
          contentPreview={viewedUser.name}
        />
      )}
    </div>
  )
}
