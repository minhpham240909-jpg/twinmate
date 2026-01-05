'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

type Comment = {
  id: string
  content: string
  createdAt: string
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
}

type Liker = {
  id: string
  user: {
    id: string
    name: string
    avatarUrl: string | null
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

  // Comments states
  const [showComments, setShowComments] = useState<string | null>(null)
  const [comments, setComments] = useState<{ [key: string]: Comment[] }>({})
  const [loadingComments, setLoadingComments] = useState<{ [key: string]: boolean }>({})
  const [newComment, setNewComment] = useState('')

  // Likers modal states
  const [likersModal, setLikersModal] = useState<{ isOpen: boolean; postId: string } | null>(null)
  const [likers, setLikers] = useState<Liker[]>([])
  const [isLoadingLikers, setIsLoadingLikers] = useState(false)

  // Avatar states
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const avatarMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth')
      return
    }

    if (user) {
      fetchUserPosts()
    }
  }, [user, authLoading])

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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

  const handleAvatarClick = () => {
    setShowAvatarMenu(!showAvatarMenu)
  }

  const handleUploadAvatar = () => {
    avatarInputRef.current?.click()
    setShowAvatarMenu(false)
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

  // Fetch comments for a post
  const fetchComments = async (postId: string) => {
    setLoadingComments(prev => ({ ...prev, [postId]: true }))
    try {
      const response = await fetch(`/api/posts/${postId}/comments`)
      if (response.ok) {
        const data = await response.json()
        setComments(prev => ({ ...prev, [postId]: data.comments }))
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setLoadingComments(prev => ({ ...prev, [postId]: false }))
    }
  }

  // Toggle comments section
  const toggleComments = (postId: string) => {
    if (showComments === postId) {
      setShowComments(null)
    } else {
      setShowComments(postId)
      if (!comments[postId]) {
        fetchComments(postId)
      }
    }
  }

  // Add a comment
  const handleComment = async (postId: string) => {
    if (!newComment.trim()) return

    const commentContent = newComment
    setNewComment('')

    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentContent }),
      })

      if (response.ok) {
        // Update comment count
        setPosts(prev =>
          prev.map(post =>
            post.id === postId
              ? { ...post, _count: { ...post._count, comments: post._count.comments + 1 } }
              : post
          )
        )
        // Refresh comments list
        await fetchComments(postId)
      } else {
        setNewComment(commentContent)
        alert('Failed to add comment')
      }
    } catch (error) {
      console.error('Error commenting:', error)
      setNewComment(commentContent)
      alert('Failed to add comment')
    }
  }

  // Fetch likers for a post
  const fetchLikers = async (postId: string) => {
    setIsLoadingLikers(true)
    setLikers([])
    setLikersModal({ isOpen: true, postId })
    try {
      const response = await fetch(`/api/posts/${postId}/like?limit=50`)
      if (response.ok) {
        const data = await response.json()
        setLikers(data.likers || [])
      }
    } catch (error) {
      console.error('Error fetching likers:', error)
    } finally {
      setIsLoadingLikers(false)
    }
  }

  // Close likers modal
  const closeLikersModal = () => {
    setLikersModal(null)
    setLikers([])
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* Header Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors -ml-2"
          >
            <svg className="w-5 h-5 text-neutral-900 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="ml-4">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{profile?.name || user.email}</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{posts.length} {posts.length === 1 ? 'post' : 'posts'}</p>
          </div>
        </div>
      </header>

      {/* Banner */}
      <div className="relative h-52 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-500">
        <div className="absolute inset-0 bg-black/5"></div>
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
              <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden z-[9999]">
                <button
                  onClick={handleUploadAvatar}
                  className="w-full px-4 py-3 text-left text-sm text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
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
                  className="w-full px-4 py-3 text-left text-sm text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
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
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">{profile?.name || user.email || 'User'}</h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-3">@{user.email?.split('@')[0]}</p>

          {profile?.bio && (
            <p className="text-neutral-700 dark:text-neutral-300 mb-3 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400 mb-3">
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
            {/* Location */}
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
              {((profile as any)?.subjects && (profile as any).subjects.length > 0) && (
                <GlowBorder color="#3b82f6" intensity="medium" animated={false}  style={{ borderRadius: 8 }}>
                  <div className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                    <Pulse>
                      <span className="font-semibold text-blue-400">{(profile as any).subjects.length}</span>
                    </Pulse>
                    <span className="text-gray-700 dark:text-slate-300 ml-1">{(profile as any).subjects.length === 1 ? 'subject' : 'subjects'}</span>
                  </div>
                </GlowBorder>
              )}
              {((profile as any)?.interests && (profile as any).interests.length > 0) && (
                <GlowBorder color="#8b5cf6" intensity="medium" animated={false}  style={{ borderRadius: 8 }}>
                  <div className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                    <Pulse>
                      <span className="font-semibold text-blue-400">{(profile as any).interests.length}</span>
                    </Pulse>
                    <span className="text-gray-700 dark:text-slate-300 ml-1">{(profile as any).interests.length === 1 ? 'interest' : 'interests'}</span>
                  </div>
                </GlowBorder>
              )}
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-t border-gray-200 dark:border-white/10 sticky top-14 bg-gray-50 dark:bg-slate-900 z-40">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('about')}
              className={`flex-1 py-4 text-center font-semibold transition-all hover:scale-105 ${
                activeTab === 'about'
                  ? 'text-gray-900 dark:text-white border-b-2 border-blue-500'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-300'
              }`}
            >
              {t('about')}
            </button>
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 py-4 text-center font-semibold transition-all hover:scale-105 ${
                activeTab === 'posts'
                  ? 'text-gray-900 dark:text-white border-b-2 border-blue-500'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-300'
              }`}
            >
              {t('posts')} {posts.length > 0 && (
                <Pulse>
                  <span className="ml-1 text-blue-400">({posts.length})</span>
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
                <p className="text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
              </div>
            )}

            {/* About Yourself */}
            {(profile as any)?.aboutYourself && (
              <div>
                <p className="text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{(profile as any).aboutYourself}</p>
              </div>
            )}

            {/* About Yourself Items/Tags */}
            {(profile as any)?.aboutYourselfItems && (profile as any).aboutYourselfItems.length > 0 && (
              <FadeIn delay={0.1}>
                <div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {(profile as any).aboutYourselfItems.map((item: string, index: number) => (
                      <Bounce key={index} delay={index * 0.05}>
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-sm font-medium hover:scale-105 transition-all cursor-default">
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
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/10 space-y-4">
                {/* Subjects */}
                {(profile as any).subjects?.length > 0 && (
                  <FadeIn delay={0.1}>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('subjects')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {(profile as any).subjects.map((subject: string, index: number) => (
                          <Bounce key={index} delay={index * 0.05}>
                            <span className="px-3 py-1 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-white/10 rounded-full text-sm hover:scale-105 transition-all cursor-default">
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
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('interests')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {(profile as any).interests.map((interest: string, index: number) => (
                          <Bounce key={index} delay={index * 0.05}>
                            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-sm hover:scale-105 transition-all cursor-default">
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
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('languages')}</h3>
                    <p className="text-gray-700 dark:text-slate-300">{(profile as any).languages}</p>
                  </div>
                )}

                {/* Goals */}
                {(profile as any).goals?.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Learning Goals</h3>
                    <div className="flex flex-wrap gap-2">
                      {(profile as any).goals.map((goal: string, index: number) => (
                        <span key={index} className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-sm">
                          {goal}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skill Level - Show custom description if available */}
                {((profile as any).skillLevelCustomDescription || (profile as any).skillLevel) && (
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Skill Level</h3>
                    <p className="text-gray-700 dark:text-slate-300">
                      {(profile as any).skillLevelCustomDescription || (profile as any).skillLevel}
                    </p>
                  </div>
                )}

                {/* Study Style - Show custom description if available */}
                {((profile as any).studyStyleCustomDescription || (profile as any).studyStyle) && (
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Study Style</h3>
                    <p className="text-gray-700 dark:text-slate-300">
                      {(profile as any).studyStyleCustomDescription || (profile as any).studyStyle}
                    </p>
                  </div>
                )}

                {/* Available Days */}
                {(profile as any).availableDays?.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Available Days</h3>
                    <div className="flex flex-wrap gap-2">
                      {(profile as any).availableDays.map((day: string, index: number) => (
                        <span key={index} className="px-3 py-1 bg-blue-1000/20 text-blue-500 border border-blue-1000/30 rounded-full text-sm">
                          {day}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Hours */}
                {(profile as any).availableHours?.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Available Hours</h3>
                    <p className="text-gray-700 dark:text-slate-300">{(profile as any).availableHours.join(', ')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Show message if no about info */}
            {!profile?.bio && !(profile as any)?.aboutYourself && (!(profile as any)?.aboutYourselfItems || (profile as any).aboutYourselfItems.length === 0) && (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-slate-400 mb-4">{t('noAboutInfo')}</p>
                <button
                  onClick={() => router.push('/profile/edit')}
                  className="text-blue-500 dark:text-blue-400 hover:underline font-medium"
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
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : posts && posts.length > 0 ? (
              posts.map((post, index) => (
                <FadeIn key={post.id} delay={index * 0.05}>
                  <GlowBorder color="#3b82f6" animated={false}  style={{ borderRadius: 12 }}>
                    <div className="border border-gray-200 dark:border-white/10 rounded-lg p-4 bg-white dark:bg-white/5 shadow-lg dark:shadow-none backdrop-blur-xl">
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
                      <span className="font-medium text-gray-900 dark:text-white">{profile?.name || user.email}</span>
                    </div>

                    {/* Three-Dot Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition"
                      >
                        <svg className="w-5 h-5 text-gray-600 dark:text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                      </button>

                      {openMenuPostId === post.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuPostId(null)}
                          />
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-none border border-gray-200 dark:border-white/10 py-1 z-20">
                            {/* Share */}
                            <button
                              onClick={() => {
                                handleSharePost(post.id)
                                setOpenMenuPostId(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                              </svg>
                              Share Post
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => startEditPost(post)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
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
                              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
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
                        className="w-full p-3 border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={4}
                        maxLength={5000}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-gray-600 dark:text-slate-400">
                          {editContent.length}/5000
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={cancelEdit}
                            className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleEditPost(post.id)}
                            disabled={!editContent.trim()}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-gray-700 dark:text-slate-300 mb-3 whitespace-pre-wrap leading-relaxed">{post.content}</p>

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
                          className="block mb-3 p-3 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition"
                        >
                          <div className="flex items-center gap-2 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span className="text-sm font-medium break-all">{post.postUrl}</span>
                          </div>
                        </a>
                      )}
                    </>
                  )}

                  {/* Post Stats - Interactive */}
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-400 pt-3 border-t border-gray-200 dark:border-white/10">
                    {/* Likes - Clickable to see who liked */}
                    <button
                      onClick={() => post._count.likes > 0 && fetchLikers(post.id)}
                      className={`flex items-center gap-1 ${post._count.likes > 0 ? 'hover:text-red-500 cursor-pointer' : 'cursor-default'}`}
                      disabled={post._count.likes === 0}
                    >
                      <svg className="w-5 h-5" fill={post._count.likes > 0 ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      {post._count.likes > 0 ? (
                        <Pulse><span>{post._count.likes}</span></Pulse>
                      ) : (
                        <span>{post._count.likes}</span>
                      )}
                    </button>

                    {/* Comments - Clickable to toggle comments */}
                    <button
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-1 hover:text-blue-500 cursor-pointer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      {post._count.comments > 0 ? (
                        <Pulse><span>{post._count.comments}</span></Pulse>
                      ) : (
                        <span>{post._count.comments}</span>
                      )}
                    </button>

                    <span className="ml-auto text-xs">{new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>

                  {/* Comments Section */}
                  {showComments === post.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
                      {/* Loading state */}
                      {loadingComments[post.id] && (
                        <div className="flex justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        </div>
                      )}

                      {/* Comments list */}
                      {!loadingComments[post.id] && (
                        <div className="space-y-3 mb-4">
                          {comments[post.id]?.length === 0 && (
                            <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-2">
                              No comments yet. Be the first to comment!
                            </p>
                          )}
                          {comments[post.id]?.map((comment) => (
                            <div key={comment.id} className="flex gap-3">
                              <Link href={`/profile/${comment.user.id}`}>
                                <div className="cursor-pointer hover:opacity-80 transition">
                                  <PartnerAvatar
                                    avatarUrl={comment.user.avatarUrl}
                                    name={comment.user.name}
                                    size="sm"
                                  />
                                </div>
                              </Link>
                              <div className="flex-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-3">
                                <Link href={`/profile/${comment.user.id}`}>
                                  <p className="font-semibold text-sm text-gray-900 dark:text-white hover:text-blue-500 cursor-pointer transition inline-block">
                                    {comment.user.name}
                                  </p>
                                </Link>
                                <p className="text-gray-600 dark:text-gray-300 text-sm">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comment input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Write a comment..."
                          className="flex-1 px-4 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleComment(post.id)
                            }
                          }}
                        />
                        <button
                          onClick={() => handleComment(post.id)}
                          disabled={!newComment.trim()}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-neutral-700 transition-all"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  )}
                    </div>
                  </GlowBorder>
                </FadeIn>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-slate-400 mb-4">{t('noPosts')}</p>
                <button
                  onClick={() => router.push('/community')}
                  className="text-blue-500 dark:text-blue-400 hover:underline font-medium"
                >
                  {t('createFirstPost')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Likers Modal */}
      {likersModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={closeLikersModal}>
          <div
            className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Liked by</h3>
              <button
                onClick={closeLikersModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[60vh]">
              {isLoadingLikers ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : likers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No likes yet
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {likers.map((liker) => (
                    <Link
                      key={liker.id}
                      href={`/profile/${liker.user.id}`}
                      onClick={closeLikersModal}
                      className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <PartnerAvatar
                        avatarUrl={liker.user.avatarUrl}
                        name={liker.user.name}
                        size="sm"
                      />
                      <span className="font-medium text-gray-900 dark:text-white">{liker.user.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
