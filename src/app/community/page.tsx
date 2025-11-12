'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'
import { motion } from 'framer-motion'

type Post = {
  id: string
  content: string
  imageUrls: string[]
  postUrl?: string | null
  createdAt: string
  user: {
    id: string
    name: string
    avatarUrl: string | null
    onlineStatus?: 'ONLINE' | 'OFFLINE' | null
  }
  _count: {
    likes: number
    comments: number
    reposts: number
  }
  isLikedByUser?: boolean
  connectionStatus?: 'none' | 'pending' | 'connected'
}

type Comment = {
  id: string
  content: string
  createdAt: string
  user: {
    id: string
    name: string
    avatarUrl: string | null
    onlineStatus?: 'ONLINE' | 'OFFLINE' | null
  }
}

export default function CommunityPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const t = useTranslations('community')
  const tCommon = useTranslations('common')

  // Helper to get cached posts from localStorage for instant display
  const getCachedPosts = (): Post[] => {
    if (typeof window === 'undefined') return []
    try {
      const cached = localStorage.getItem('community_posts')
      return cached ? JSON.parse(cached) : []
    } catch (error) {
      console.error('Error loading cached posts:', error)
      return []
    }
  }

  // Helper to get cached popular posts
  const getCachedPopularPosts = (): Post[] => {
    if (typeof window === 'undefined') return []
    try {
      const cached = localStorage.getItem('community_popular_posts')
      return cached ? JSON.parse(cached) : []
    } catch (error) {
      console.error('Error loading cached popular posts:', error)
      return []
    }
  }

  // Initialize with cached data for instant display - NO LOADING DELAY!
  const [posts, setPosts] = useState<Post[]>(() => getCachedPosts())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Post[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [newPostsCount, setNewPostsCount] = useState(0)
  const [showComments, setShowComments] = useState<string | null>(null)
  const [comments, setComments] = useState<{ [key: string]: Comment[] }>({})
  const [newComment, setNewComment] = useState('')
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [activeTab, setActiveTab] = useState<'recent' | 'popular'>('recent')
  const [popularPosts, setPopularPosts] = useState<Post[]>(() => getCachedPopularPosts())
  const [trendingHashtags, setTrendingHashtags] = useState<{ hashtag: string; count: number }[]>([])
  const [isLoadingPopular, setIsLoadingPopular] = useState(false)
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null)
  const [connectingPostIds, setConnectingPostIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  // Fetch initial posts
  useEffect(() => {
    if (user) {
      fetchPosts()
      fetchTrendingHashtags()
    }
  }, [user])

  // Fetch popular posts when tab changes
  useEffect(() => {
    if (user && activeTab === 'popular' && popularPosts.length === 0) {
      fetchPopularPosts()
    }
  }, [user, activeTab])

  // Real-time subscription for new posts
  useEffect(() => {
    if (!user) return

    const supabase = createClient()

    const channel = supabase
      .channel('community-posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Post',
        },
        async (payload) => {
          // Increment new posts count
          setNewPostsCount(prev => prev + 1)

          // Fetch the complete post with user data
          const response = await fetch('/api/posts')
          if (response.ok) {
            const data = await response.json()
            // Add new post silently (it will be at the top)
            setPosts(data.posts)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/posts')
      if (response.ok) {
        const data = await response.json()
        setPosts(data.posts)
        setNewPostsCount(0) // Reset count when fetching

        // Cache posts to localStorage for instant display next time
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('community_posts', JSON.stringify(data.posts))
          } catch (error) {
            console.error('Error caching posts:', error)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching posts:', error)
    }
  }

  const fetchPopularPosts = async () => {
    setIsLoadingPopular(true)
    try {
      const response = await fetch('/api/posts/popular?limit=20&days=7')
      if (response.ok) {
        const data = await response.json()
        setPopularPosts(data.posts)

        // Cache popular posts to localStorage
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('community_popular_posts', JSON.stringify(data.posts))
          } catch (error) {
            console.error('Error caching popular posts:', error)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching popular posts:', error)
    } finally {
      setIsLoadingPopular(false)
    }
  }

  const fetchTrendingHashtags = async () => {
    try {
      const response = await fetch('/api/posts/trending-hashtags?limit=5&days=7')
      if (response.ok) {
        const data = await response.json()
        setTrendingHashtags(data.trending)
      }
    } catch (error) {
      console.error('Error fetching trending hashtags:', error)
    }
  }


  const handleSharePost = async (postId: string) => {
    const shareUrl = `${window.location.origin}/share/${postId}`

    // Check if Web Share API is available (mobile devices and some browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this post on TwinMate',
          text: 'I found this interesting post on TwinMate - Join to connect with study partners!',
          url: shareUrl,
        })
      } catch (error) {
        // User cancelled or error occurred
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error)
          // Fallback to copy link
          copyShareLink(shareUrl)
        }
      }
    } else {
      // Fallback: Copy link to clipboard
      copyShareLink(shareUrl)
    }

    // Close menu after sharing
    setOpenMenuPostId(null)
  }

  const copyShareLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      alert(t('shareLinkCopied'))
    }).catch(err => {
      console.error('Failed to copy:', err)
      alert(t('failedToCopyLink'))
    })
  }

  const handleLike = async (postId: string, isLiked: boolean) => {
    try {
      const method = isLiked ? 'DELETE' : 'POST'
      const response = await fetch(`/api/posts/${postId}/like`, { method })

      if (response.ok) {
        // Update local state immediately
        setPosts(prev => {
          const updated = prev.map(post =>
            post.id === postId
              ? {
                  ...post,
                  isLikedByUser: !isLiked,
                  _count: {
                    ...post._count,
                    likes: post._count.likes + (isLiked ? -1 : 1),
                  },
                }
              : post
          )

          // Update cache
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('community_posts', JSON.stringify(updated))
            } catch (error) {
              console.error('Error updating cache:', error)
            }
          }

          return updated
        })
      }
    } catch (error) {
      console.error('Error liking post:', error)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/posts/search?q=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.posts)
      }
    } catch (error) {
      console.error('Error searching:', error)
    }
  }

  // Real-time search (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch()
      } else {
        setIsSearching(false)
        setSearchResults([])
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchComments = async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}/comments`)
      if (response.ok) {
        const data = await response.json()
        setComments(prev => ({ ...prev, [postId]: data.comments }))
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const handleComment = async (postId: string) => {
    if (!newComment.trim()) return

    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      })

      if (response.ok) {
        setNewComment('')
        await fetchComments(postId)
        // Update comment count
        setPosts(prev =>
          prev.map(post =>
            post.id === postId
              ? { ...post, _count: { ...post._count, comments: post._count.comments + 1 } }
              : post
          )
        )
      }
    } catch (error) {
      console.error('Error commenting:', error)
    }
  }

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

  const handleEditPost = async (postId: string) => {
    if (!editContent.trim()) return

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      })

      if (response.ok) {
        const data = await response.json()
        // Update post in local state
        setPosts(prev =>
          prev.map(post =>
            post.id === postId ? { ...post, content: data.post.content } : post
          )
        )
        setEditingPostId(null)
        setEditContent('')
      } else {
        const error = await response.json()
        alert(error.error || t('failedToEditPost'))
      }
    } catch (error) {
      console.error('Error editing post:', error)
      alert(t('failedToEditPost'))
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm(t('confirmDeletePost'))) {
      return
    }

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const data = await response.json()
        // Remove post from local state
        setPosts(prev => prev.filter(post => post.id !== postId))
        setSearchResults(prev => prev.filter(post => post.id !== postId))
        setPopularPosts(prev => prev.filter(post => post.id !== postId))
        alert(data.message || t('postMovedToHistory'))
      } else {
        const error = await response.json()
        alert(error.error || t('failedToDeletePostAlert'))
      }
    } catch (error) {
      console.error('Error deleting post:', error)
      alert(t('failedToDeletePostAlert'))
    }
  }

  const startEditPost = (post: Post) => {
    setEditingPostId(post.id)
    setEditContent(post.content)
  }

  const cancelEdit = () => {
    setEditingPostId(null)
    setEditContent('')
  }

  const handleSendConnection = async (userId: string, postId: string) => {
    if (!user) return

    setConnectingPostIds(prev => new Set(prev).add(postId))
    try {
      const response = await fetch('/api/connections/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: userId }),
      })

      if (response.ok) {
        // Update connection status in local state
        setPosts(prev =>
          prev.map(post =>
            post.id === postId
              ? { ...post, connectionStatus: 'pending' }
              : post
          )
        )
        setSearchResults(prev =>
          prev.map(post =>
            post.id === postId
              ? { ...post, connectionStatus: 'pending' }
              : post
          )
        )
        setPopularPosts(prev =>
          prev.map(post =>
            post.id === postId
              ? { ...post, connectionStatus: 'pending' }
              : post
          )
        )
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to send connection request')
      }
    } catch (error) {
      console.error('Error sending connection:', error)
      alert(t('failedToSendConnectionRequest'))
    } finally {
      setConnectingPostIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(postId)
        return newSet
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const displayPosts = isSearching
    ? searchResults
    : activeTab === 'popular'
    ? popularPosts
    : posts

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors group"
              >
                <svg className="w-6 h-6 text-gray-600 group-hover:text-gray-900 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {t('title')}
              </h1>
              {newPostsCount > 0 && (
                <motion.button
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  onClick={fetchPosts}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="font-medium">{newPostsCount} {t('newPostsNotification')}</span>
                </motion.button>
              )}
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full px-4 py-2.5 pl-11 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all bg-white/80 backdrop-blur-sm"
                />
                <svg
                  className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left/Center */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('recent')}
                  className={`flex-1 px-6 py-4 font-semibold transition relative ${
                    activeTab === 'recent'
                      ? 'text-blue-600'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  {t('recent')}
                  {activeTab === 'recent' && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600"
                    />
                  )}
                </button>
                <button
                  onClick={() => {
                    setActiveTab('popular')
                    if (popularPosts.length === 0) {
                      fetchPopularPosts()
                    }
                  }}
                  className={`flex-1 px-6 py-4 font-semibold transition relative ${
                    activeTab === 'popular'
                      ? 'text-blue-600'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  🔥 {t('popular')}
                  {activeTab === 'popular' && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600"
                    />
                  )}
                </button>
              </div>
            </div>

        {/* Loading state for popular posts */}
        {isLoadingPopular && (
          <div className="flex justify-center py-8">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

            {/* Posts Feed */}
            {!isLoadingPopular && (
            <div className="space-y-6">
              {displayPosts.map((post) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/50 p-6 hover:shadow-xl transition-all"
                >
              {/* Post Header */}
              <div className="flex items-start gap-3 mb-4">
                {/* Clickable Avatar */}
                <Link href={`/profile/${post.user.id}`}>
                  <div className="cursor-pointer hover:opacity-80 transition">
                    <PartnerAvatar
                      avatarUrl={post.user.avatarUrl}
                      name={post.user.name}
                      size="md"
                      onlineStatus={post.user.onlineStatus as 'ONLINE' | 'OFFLINE'}
                      showStatus={post.connectionStatus === 'connected'}
                    />
                  </div>
                </Link>
                <div className="flex-1">
                  {/* Clickable Name */}
                  <Link href={`/profile/${post.user.id}`}>
                    <p className="font-semibold text-gray-900 hover:text-blue-600 cursor-pointer transition">
                      {post.user.name}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-500">
                      {new Date(post.createdAt).toLocaleString()}
                    </p>
                    {/* Connect Button (only show for other users) */}
                    {post.user.id !== user.id && (
                      <>
                        <span className="text-sm text-gray-400">•</span>
                        {post.connectionStatus === 'connected' ? (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded font-medium">
                            ✓ {t('connected')}
                          </span>
                        ) : post.connectionStatus === 'pending' ? (
                          <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-medium">
                            {t('pending')}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSendConnection(post.user.id, post.id)}
                            disabled={connectingPostIds.has(post.id)}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {connectingPostIds.has(post.id) ? t('sending') : t('connect')}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Three-dots menu */}
                <div className="relative">
                  <button
                    onClick={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                    title={t('moreOptions')}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                    </svg>
                  </button>

                  {/* Dropdown menu */}
                  {openMenuPostId === post.id && (
                    <>
                      {/* Backdrop to close menu */}
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenuPostId(null)}></div>

                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        {/* Share option - always visible */}
                        <button
                          onClick={() => handleSharePost(post.id)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          {t('sharePost')}
                        </button>

                        {/* Delete - only for post owner */}
                        {post.user.id === user.id && (
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
                            {t('deletePost')}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Post Content - Show edit mode or regular content */}
              {editingPostId === post.id ? (
                <div className="mb-4">
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
                        {t('cancel')}
                      </button>
                      <button
                        onClick={() => handleEditPost(post.id)}
                        disabled={!editContent.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                      >
                        {t('save')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-gray-800 mb-4 whitespace-pre-wrap">{post.content}</p>

                  {/* Post Images */}
                  {post.imageUrls && post.imageUrls.length > 0 && (
                    <div className={`grid gap-2 mb-4 ${
                      post.imageUrls.length === 1 ? 'grid-cols-1' :
                      post.imageUrls.length === 2 ? 'grid-cols-2' :
                      post.imageUrls.length === 3 ? 'grid-cols-2' :
                      'grid-cols-2'
                    }`}>
                      {post.imageUrls.map((url, index) => (
                        <div
                          key={index}
                          className={`relative ${
                            post.imageUrls.length === 3 && index === 0 ? 'col-span-2' : ''
                          }`}
                        >
                          <img
                            src={url}
                            alt={`Post image ${index + 1}`}
                            className="w-full h-auto max-h-96 object-cover rounded-lg cursor-pointer hover:opacity-95 transition"
                            onClick={() => window.open(url, '_blank')}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Post Link Preview */}
                  {post.postUrl && (
                    <a
                      href={post.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mb-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span className="text-sm font-medium break-all">{post.postUrl}</span>
                      </div>
                    </a>
                  )}
                </div>
              )}

              {/* Post Actions */}
              <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleLike(post.id, post.isLikedByUser || false)}
                  className={`flex items-center gap-2 ${
                    post.isLikedByUser ? 'text-red-600' : 'text-gray-600'
                  } hover:text-red-600 transition`}
                >
                  <svg
                    className="w-5 h-5"
                    fill={post.isLikedByUser ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                  <span className="text-sm font-medium">{post._count.likes}</span>
                </button>

                <button
                  onClick={() => toggleComments(post.id)}
                  className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <span className="text-sm font-medium">{post._count.comments}</span>
                </button>
              </div>

              {/* Comments Section */}
              {showComments === post.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="space-y-3 mb-4">
                    {comments[post.id]?.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <PartnerAvatar
                          avatarUrl={comment.user.avatarUrl}
                          name={comment.user.name}
                          size="sm"
                          onlineStatus={comment.user.onlineStatus as 'ONLINE' | 'OFFLINE'}
                          showStatus={!!comment.user.onlineStatus}
                        />
                        <div className="flex-1 bg-gray-50 rounded-lg p-3">
                          <p className="font-semibold text-sm">{comment.user.name}</p>
                          <p className="text-gray-800 text-sm">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={t('writeComment')}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleComment(post.id)
                        }
                      }}
                    />
                    <button
                      onClick={() => handleComment(post.id)}
                      disabled={!newComment.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition"
                    >
                      {tCommon('send')}
                    </button>
                  </div>
                </div>
                )}
              </motion.div>
            ))}

            {displayPosts.length === 0 && (
              <div className="text-center py-16 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/50">
                <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 text-lg font-medium">
                  {isSearching ? t('noPostsFound') : t('noPostsYet')}
                </p>
                {!isSearching && (
                  <button
                    onClick={() => router.push('/community/create')}
                    className="mt-4 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
                  >
                    {t('createFirstPost')}
                  </button>
                )}
              </div>
            )}
          </div>
            )}
          </div>

          {/* Sidebar - Right */}
          <div className="lg:col-span-1">
            {/* Trending Hashtags */}
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/50 p-6 sticky top-24">
              <h3 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">🔥 {t('trendingHashtags')}</h3>
              {trendingHashtags.length > 0 ? (
                <div className="space-y-3">
                  {trendingHashtags.map((item, index) => (
                    <button
                      key={item.hashtag}
                      onClick={() => {
                        setSearchQuery(item.hashtag)
                        setActiveTab('recent')
                      }}
                      className="w-full text-left p-3 rounded-lg hover:bg-blue-50 transition group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-gray-300 group-hover:text-blue-400 transition">
                            #{index + 1}
                          </span>
                          <span className="font-semibold text-blue-600 group-hover:text-blue-700">
                            {item.hashtag}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">{item.count} {t('posts')}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">{t('noTrendingHashtags')}</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Floating Create Post Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => router.push('/community/create')}
        className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-2xl hover:shadow-blue-500/50 flex items-center justify-center z-50 transition-all group"
        aria-label={t('createNewPost')}
      >
        <svg className="w-8 h-8 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </motion.button>
    </div>
  )
}
