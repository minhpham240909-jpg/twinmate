'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'
import GlowBorder from '@/components/ui/GlowBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'

type UserPost = {
  id: string
  content: string
  imageUrls: string[]
  postUrl?: string | null
  createdAt: string
  _count: {
    likes: number
    comments: number
    reposts: number
  }
}

export default function MyProfilePage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const t = useTranslations('profile')

  const [posts, setPosts] = useState<UserPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [activeTab, setActiveTab] = useState<'about' | 'posts'>('about')
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // Cover photo states
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [showCoverPhotoMenu, setShowCoverPhotoMenu] = useState(false)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const avatarMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin')
      return
    }

    if (user) {
      fetchUserPosts()
      // Load cover photo from user profile
      if ((user as any).coverPhotoUrl) {
        setCoverPhotoUrl((user as any).coverPhotoUrl)
      }
    }
  }, [user, authLoading])

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

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchUserPosts = async () => {
    try {
      const response = await fetch(`/api/posts/user/${user?.id}`)
      if (response.ok) {
        const data = await response.json()
        setPosts(data.posts)
      }
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoadingPosts(false)
    }
  }

  const handleCoverPhotoClick = () => {
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

  const handleAvatarClick = () => {
    setShowAvatarMenu(!showAvatarMenu)
  }

  const handleUploadAvatar = () => {
    avatarInputRef.current?.click()
    setShowAvatarMenu(false)
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
      formDataUpload.append('userId', user?.id || '')

      const response = await fetch('/api/upload/cover-photo', {
        method: 'POST',
        body: formDataUpload,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      setCoverPhotoUrl(data.url)
      window.location.reload()
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
      formDataUpload.append('userId', user?.id || '')

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formDataUpload,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      window.location.reload()
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload avatar')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSharePost = async (postId: string) => {
    const shareUrl = `${window.location.origin}/share/${postId}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this post',
          url: shareUrl,
        })
      } catch (error) {
        console.error('Error sharing:', error)
      }
    } else {
      navigator.clipboard.writeText(shareUrl)
      alert(t('linkCopiedToClipboard'))
    }
  }

  const startEditPost = (post: UserPost) => {
    setEditingPostId(post.id)
    setEditContent(post.content)
    setOpenMenuPostId(null)
  }

  const cancelEdit = () => {
    setEditingPostId(null)
    setEditContent('')
  }

  const handleEditPost = async (postId: string) => {
    if (!editContent.trim()) return

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() }),
      })

      if (response.ok) {
        setPosts(prev =>
          prev.map(post =>
            post.id === postId ? { ...post, content: editContent.trim() } : post
          )
        )
        setEditingPostId(null)
        setEditContent('')
      }
    } catch (error) {
      console.error('Error editing post:', error)
      alert(t('failedToEditPost'))
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm(t('confirmDeletePost'))) return

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setPosts(prev => prev.filter(post => post.id !== postId))
      }
    } catch (error) {
      console.error('Error deleting post:', error)
      alert(t('failedToDeletePostRetry'))
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-white">
      {/* Header Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors -ml-2"
          >
            <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="ml-4">
            <h1 className="text-xl font-bold text-gray-900">{profile?.name || user.email}</h1>
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
        ) : (
          /* Message when no cover photo */
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium">Add a cover photo to personalize your profile</p>
            </div>
          </div>
        )}
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
            <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-[9999]">
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
              <button
                onClick={handleUploadCoverPhoto}
                className="w-full px-4 py-3 text-left text-sm text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload cover photo
              </button>
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
          <div className="inline-block relative" ref={avatarMenuRef}>
            <div className="relative group">
              <button
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
                className="cursor-pointer hover:opacity-90 transition-opacity disabled:cursor-not-allowed"
              >
                <PartnerAvatar
                  avatarUrl={profile?.avatarUrl || null}
                  name={profile?.name || user.email || 'User'}
                  size="xl"
                  onlineStatus={(user as any).onlineStatus as 'ONLINE' | 'OFFLINE'}
                  showStatus={false}
                />
              </button>
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
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

            {/* Avatar Menu */}
            {showAvatarMenu && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-[9999]">
                <button
                  onClick={handleUploadAvatar}
                  className="w-full px-4 py-3 text-left text-sm text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload profile photo
                </button>
                <button
                  onClick={() => {
                    router.push('/profile/edit')
                    setShowAvatarMenu(false)
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit profile
                </button>
              </div>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{profile?.name || user.email || 'User'}</h1>
          <p className="text-gray-500 text-sm mb-3">@{user.email?.split('@')[0]}</p>

          {profile?.bio && (
            <p className="text-gray-900 mb-3 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-3">
            {(profile as any)?.school && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>{(profile as any).school}</span>
              </div>
            )}
            {(profile as any)?.age && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{(profile as any).age} years old</span>
              </div>
            )}
            {(profile as any)?.role && (
              <span>{(profile as any).role}</span>
            )}
          </div>

          {/* Quick Stats */}
          <FadeIn delay={0.2}>
            <div className="flex gap-6 text-sm mb-4">
              {((profile as any)?.subjects && (profile as any).subjects.length > 0) && (
                <GlowBorder color="#3b82f6" intensity="medium" animated={false}  style={{ borderRadius: 8 }}>
                  <div className="px-4 py-2 bg-blue-50 rounded-lg">
                    <Pulse>
                      <span className="font-semibold text-blue-600">{(profile as any).subjects.length}</span>
                    </Pulse>
                    <span className="text-gray-500 ml-1">{(profile as any).subjects.length === 1 ? 'subject' : 'subjects'}</span>
                  </div>
                </GlowBorder>
              )}
              {((profile as any)?.interests && (profile as any).interests.length > 0) && (
                <GlowBorder color="#8b5cf6" intensity="medium" animated={false}  style={{ borderRadius: 8 }}>
                  <div className="px-4 py-2 bg-purple-50 rounded-lg">
                    <Pulse>
                      <span className="font-semibold text-purple-600">{(profile as any).interests.length}</span>
                    </Pulse>
                    <span className="text-gray-500 ml-1">{(profile as any).interests.length === 1 ? 'interest' : 'interests'}</span>
                  </div>
                </GlowBorder>
              )}
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-t border-gray-200 sticky top-14 bg-white z-40">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('about')}
              className={`flex-1 py-4 text-center font-semibold transition-all hover:scale-105 ${
                activeTab === 'about'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('about')}
            </button>
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 py-4 text-center font-semibold transition-all hover:scale-105 ${
                activeTab === 'posts'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('posts')} {posts.length > 0 && (
                <Pulse>
                  <span className="ml-1 text-blue-600">({posts.length})</span>
                </Pulse>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'about' ? (
          <div className="space-y-6">
            {/* Bio */}
            {profile?.bio && (
              <div>
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
              </div>
            )}

            {/* About Yourself */}
            {(profile as any)?.aboutYourself && (
              <div>
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{(profile as any).aboutYourself}</p>
              </div>
            )}

            {/* About Yourself Items/Tags */}
            {(profile as any)?.aboutYourselfItems && (profile as any).aboutYourselfItems.length > 0 && (
              <FadeIn delay={0.1}>
                <div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {(profile as any).aboutYourselfItems.map((item: string, index: number) => (
                      <Bounce key={index} delay={index * 0.05}>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium hover:scale-105 transition-all cursor-default">
                          {item}
                        </span>
                      </Bounce>
                    ))}
                  </div>
                </div>
              </FadeIn>
            )}

            {/* Additional Info */}
            {profile && (((profile as any).subjects?.length > 0) || ((profile as any).interests?.length > 0) || (profile as any).languages) && (
              <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                {/* Subjects */}
                {(profile as any).subjects?.length > 0 && (
                  <FadeIn delay={0.1}>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">{t('subjects')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {(profile as any).subjects.map((subject: string, index: number) => (
                          <Bounce key={index} delay={index * 0.05}>
                            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:scale-105 transition-all cursor-default">
                              {subject}
                            </span>
                          </Bounce>
                        ))}
                      </div>
                    </div>
                  </FadeIn>
                )}

                {/* Interests */}
                {(profile as any).interests?.length > 0 && (
                  <FadeIn delay={0.2}>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">{t('interests')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {(profile as any).interests.map((interest: string, index: number) => (
                          <Bounce key={index} delay={index * 0.05}>
                            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm hover:scale-105 transition-all cursor-default">
                              {interest}
                            </span>
                          </Bounce>
                        ))}
                      </div>
                    </div>
                  </FadeIn>
                )}

                {/* Languages */}
                {(profile as any).languages && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">{t('languages')}</h3>
                    <p className="text-gray-700">{(profile as any).languages}</p>
                  </div>
                )}
              </div>
            )}

            {/* Show message if no about info */}
            {!profile?.bio && !(profile as any)?.aboutYourself && (!(profile as any)?.aboutYourselfItems || (profile as any).aboutYourselfItems.length === 0) && (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">{t('noAboutInfo')}</p>
                <button
                  onClick={() => router.push('/profile/edit')}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {t('addInfoToProfile')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {loadingPosts ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : posts && posts.length > 0 ? (
              posts.map((post, index) => (
                <FadeIn key={post.id} delay={index * 0.05}>
                  <GlowBorder color="#e5e7eb" animated={false}  style={{ borderRadius: 12 }}>
                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  {/* Post Header with Three-Dot Menu */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <PartnerAvatar
                        avatarUrl={profile?.avatarUrl || null}
                        name={profile?.name || user.email || 'User'}
                        size="sm"
                        onlineStatus={(user as any).onlineStatus as 'ONLINE' | 'OFFLINE'}
                        showStatus={false}
                      />
                      <span className="font-medium text-gray-900">{profile?.name || user.email}</span>
                    </div>

                    {/* Three-Dot Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
                        className="p-2 hover:bg-gray-100 rounded-full transition"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                      </button>

                      {openMenuPostId === post.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuPostId(null)}
                          />
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                            {/* Share */}
                            <button
                              onClick={() => {
                                handleSharePost(post.id)
                                setOpenMenuPostId(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                              </svg>
                              Share Post
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => startEditPost(post)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit Post
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => {
                                handleDeletePost(post.id)
                                setOpenMenuPostId(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete Post
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Post Content - Edit Mode or Display */}
                  {editingPostId === post.id ? (
                    <div className="mb-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={4}
                        maxLength={5000}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-gray-500">
                          {editContent.length}/5000
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={cancelEdit}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleEditPost(post.id)}
                            disabled={!editContent.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
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

                      {/* Post Link Preview */}
                      {post.postUrl && (
                        <a
                          href={post.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mb-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                        >
                          <div className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span className="text-sm font-medium break-all">{post.postUrl}</span>
                          </div>
                        </a>
                      )}
                    </>
                  )}

                  {/* Post Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-500 pt-3 border-t border-gray-100">
                    {post._count.likes > 0 ? (
                      <Pulse>
                        <span>❤️ {post._count.likes}</span>
                      </Pulse>
                    ) : (
                      <span>❤️ {post._count.likes}</span>
                    )}
                    {post._count.comments > 0 ? (
                      <Pulse>
                        <span>💬 {post._count.comments}</span>
                      </Pulse>
                    ) : (
                      <span>💬 {post._count.comments}</span>
                    )}
                    {post._count.reposts > 0 ? (
                      <Pulse>
                        <span>🔁 {post._count.reposts}</span>
                      </Pulse>
                    ) : (
                      <span>🔁 {post._count.reposts}</span>
                    )}
                    <span className="ml-auto text-xs">{new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                    </div>
                  </GlowBorder>
                </FadeIn>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">{t('noPosts')}</p>
                <button
                  onClick={() => router.push('/community')}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {t('createFirstPost')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
