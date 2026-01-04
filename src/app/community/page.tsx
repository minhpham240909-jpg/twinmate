'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'
import { motion } from 'framer-motion'
import ReportModal from '@/components/ReportModal'
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize'

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
  sharedGroups?: Array<{ id: string; name: string }> // Groups that both user and poster are members of
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
      if (!cached) return []

      const posts: Post[] = JSON.parse(cached)

      // Validate cache: if posts don't have connectionStatus field (old cache), return empty
      // This ensures users see fresh data with Partner/Group badges
      if (posts.length > 0 && posts[0].connectionStatus === undefined) {
        localStorage.removeItem('community_posts') // Clear old cache
        return []
      }

      return posts
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
      if (!cached) return []

      const posts: Post[] = JSON.parse(cached)

      // Validate cache: if posts don't have connectionStatus field (old cache), return empty
      if (posts.length > 0 && posts[0].connectionStatus === undefined) {
        localStorage.removeItem('community_popular_posts') // Clear old cache
        return []
      }

      return posts
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
  const [reportModal, setReportModal] = useState<{ isOpen: boolean; contentType: 'post' | 'comment'; contentId: string; preview: string } | null>(null)

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
        () => {
          // PERFORMANCE: Only increment counter, don't fetch all posts
          // User can click "New Posts" button to refresh when ready
          // This prevents re-downloading entire feed on every new post
          setNewPostsCount(prev => prev + 1)
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
    // Only show loading spinner if there are no cached posts
    if (popularPosts.length === 0) {
      setIsLoadingPopular(true)
    }
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
        // Helper to update like state
        const updateLikeState = (posts: Post[]) =>
          posts.map(post =>
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

        // Update all post states
        setPosts(prev => {
          const updated = updateLikeState(prev)
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

        // Also update search results and popular posts
        setSearchResults(prev => updateLikeState(prev))
        setPopularPosts(prev => {
          const updated = updateLikeState(prev)
          // Update popular posts cache
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('community_popular_posts', JSON.stringify(updated))
            } catch (error) {
              console.error('Error updating popular cache:', error)
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

    const commentContent = newComment
    setNewComment('') // Clear input immediately for better UX

    // Store previous state for rollback
    const previousPosts = posts
    const previousSearchResults = searchResults
    const previousPopularPosts = popularPosts

    // Helper to update comment count
    const updateCommentCount = (posts: Post[]) =>
      posts.map(post =>
        post.id === postId
          ? { ...post, _count: { ...post._count, comments: post._count.comments + 1 } }
          : post
      )

    // Optimistic update - increment comment count immediately
    setPosts(prev => updateCommentCount(prev))
    setSearchResults(prev => updateCommentCount(prev))
    setPopularPosts(prev => updateCommentCount(prev))

    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentContent }),
      })

      if (response.ok) {
        // Success - fetch updated comments list
        await fetchComments(postId)
      } else {
        // ROLLBACK: Restore previous state
        setPosts(previousPosts)
        setSearchResults(previousSearchResults)
        setPopularPosts(previousPopularPosts)
        
        // Restore comment input
        setNewComment(commentContent)
        
        const error = await response.json()
        alert(error.error || 'Failed to add comment. Please try again.')
      }
    } catch (error) {
      console.error('Error commenting:', error)
      
      // ROLLBACK: Restore previous state
      setPosts(previousPosts)
      setSearchResults(previousSearchResults)
      setPopularPosts(previousPopularPosts)
      
      // Restore comment input
      setNewComment(commentContent)
      alert('Failed to add comment. Please try again.')
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

        // Helper to update post content
        const updatePostContent = (posts: Post[]) =>
          posts.map(post =>
            post.id === postId ? { ...post, content: data.post.content } : post
          )

        // Update all post states
        setPosts(prev => updatePostContent(prev))
        setSearchResults(prev => updatePostContent(prev))
        setPopularPosts(prev => updatePostContent(prev))

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

    // Store previous state for rollback
    const previousPosts = posts
    const previousSearchResults = searchResults
    const previousPopularPosts = popularPosts

    // Optimistic update - remove post immediately
    setPosts(prev => prev.filter(post => post.id !== postId))
    setSearchResults(prev => prev.filter(post => post.id !== postId))
    setPopularPosts(prev => prev.filter(post => post.id !== postId))

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message || t('postMovedToHistory'))
      } else {
        // ROLLBACK: Restore previous state
        setPosts(previousPosts)
        setSearchResults(previousSearchResults)
        setPopularPosts(previousPopularPosts)
        
        const error = await response.json()
        alert(error.error || t('failedToDeletePostAlert'))
      }
    } catch (error) {
      console.error('Error deleting post:', error)
      
      // ROLLBACK: Restore previous state
      setPosts(previousPosts)
      setSearchResults(previousSearchResults)
      setPopularPosts(previousPopularPosts)
      
      alert(t('failedToDeletePostAlert'))
    }
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
      <div className="min-h-screen bg-white dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">{tCommon('loading')}</p>
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
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* Header */}
      <header className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors group"
              >
                <svg className="w-6 h-6 text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                {t('title')}
              </h1>
              {newPostsCount > 0 && (
                <motion.button
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  onClick={fetchPosts}
                  className="flex items-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
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
                  className="w-full px-4 py-2.5 pl-11 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-700 transition-all bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400"
                />
                <svg
                  className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400 dark:text-neutral-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <div className="flex border-b border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={() => setActiveTab('recent')}
                  className={`flex-1 px-6 py-4 font-semibold transition relative ${
                    activeTab === 'recent'
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {t('recent')}
                  {activeTab === 'recent' && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white"
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
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-blue-500'
                  }`}
                >
                  {t('popular')}
                  {activeTab === 'popular' && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-blue-500"
                    />
                  )}
                </button>
              </div>
            </div>

        {/* Loading state for popular posts - only show when no cached posts */}
        {isLoadingPopular && popularPosts.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

            {/* Posts Feed - show immediately if we have cached posts */}
            {(!isLoadingPopular || popularPosts.length > 0) && (
            <div className="space-y-6">
              {displayPosts.map((post, index) => {
                // Determine if post is trending/popular (high engagement or in popular tab)
                const isPopular = activeTab === 'popular' || (post._count.likes + post._count.comments + post._count.reposts) > 10
                const highEngagement = (post._count.likes + post._count.comments + post._count.reposts) > 20

                // Post content JSX (shared between wrapped and unwrapped versions)
                const postContent = (
                  <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6 hover:shadow-md transition-all">
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
                    <p className="font-semibold text-neutral-900 dark:text-white hover:text-blue-500 cursor-pointer transition">
                      {post.user.name}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {new Date(post.createdAt).toLocaleString()}
                    </p>
                    {/* Partner/Group Label or Connect Button (only show for other users) */}
                    {post.user.id !== user.id && (
                      <>
                        <span className="text-sm text-neutral-400 dark:text-neutral-600">•</span>
                        {post.connectionStatus === 'connected' ? (
                          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full font-medium flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                            </svg>
                            Partner
                          </span>
                        ) : post.sharedGroups && post.sharedGroups.length > 0 ? (
                          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full font-medium flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                            </svg>
                            Group Member • {post.sharedGroups[0].name}
                          </span>
                        ) : post.connectionStatus === 'pending' ? (
                          <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full font-medium">
                            {t('pending')}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSendConnection(post.user.id, post.id)}
                            disabled={connectingPostIds.has(post.id)}
                            className="text-xs px-2 py-1 bg-gradient-to-r from-blue-500 to-blue-500 text-white rounded-full hover:from-blue-600 hover:to-blue-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
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

                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 z-20">
                        {/* Share option - always visible */}
                        <button
                          onClick={() => handleSharePost(post.id)}
                          className="w-full px-4 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          {t('sharePost')}
                        </button>

                        {/* Report - only for other users' posts */}
                        {post.user.id !== user.id && (
                          <button
                            onClick={() => {
                              setReportModal({
                                isOpen: true,
                                contentType: 'post',
                                contentId: post.id,
                                preview: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
                              })
                              setOpenMenuPostId(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                            </svg>
                            {t('reportPost') || 'Report Post'}
                          </button>
                        )}

                        {/* Delete - only for post owner */}
                        {post.user.id === user.id && (
                          <button
                            onClick={() => {
                              handleDeletePost(post.id)
                              setOpenMenuPostId(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
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
                    className="w-full p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                    rows={4}
                    maxLength={5000}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      {editContent.length}/5000
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        onClick={() => handleEditPost(post.id)}
                        disabled={!editContent.trim()}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-500 text-white rounded-lg hover:from-blue-600 hover:to-blue-600 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed transition"
                      >
                        {t('save')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-neutral-900 dark:text-white mb-4 whitespace-pre-wrap">{sanitizeText(post.content)}</p>

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
                  {post.postUrl && sanitizeUrl(post.postUrl) && (
                    <a
                      href={sanitizeUrl(post.postUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mb-4 p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
                    >
                      <div className="flex items-center gap-2 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span className="text-sm font-medium break-all">{sanitizeUrl(post.postUrl)}</span>
                      </div>
                    </a>
                  )}
                </div>
              )}

              {/* Post Actions */}
              <div className="flex items-center gap-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={() => handleLike(post.id, post.isLikedByUser || false)}
                  className={`flex items-center gap-2 hover:scale-105 transition-transform ${
                    post.isLikedByUser ? 'text-blue-500' : 'text-neutral-500 dark:text-neutral-400'
                  } hover:text-blue-500`}
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
                  className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 hover:text-blue-500 hover:scale-105 transition-all"
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
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
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
                        <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3">
                          <p className="font-semibold text-sm text-neutral-900 dark:text-white">{sanitizeText(comment.user.name)}</p>
                          <p className="text-neutral-600 dark:text-neutral-300 text-sm">{sanitizeText(comment.content)}</p>
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
                      className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleComment(post.id)
                        }
                      }}
                    />
                    <button
                      onClick={() => handleComment(post.id)}
                      disabled={!newComment.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-500 text-white rounded-lg hover:from-blue-600 hover:to-blue-600 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 transition-all"
                    >
                      {tCommon('send')}
                    </button>
                  </div>
                </div>
                )}
                  </div>
                )
                
                return (
                  <div key={post.id}>
                    {postContent}
                  </div>
                )
              })}

            {displayPosts.length === 0 && (
              <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800">
                <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-neutral-700 dark:text-neutral-300 text-lg font-medium">
                  {isSearching ? t('noPostsFound') : t('noPostsYet')}
                </p>
                {!isSearching && (
                  <button
                    onClick={() => router.push('/community/create')}
                    className="mt-4 px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-500 text-white rounded-xl hover:from-blue-600 hover:to-blue-600 transition-all shadow-md"
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
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6 sticky top-24">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">{t('trendingHashtags')}</h3>
              {trendingHashtags.length > 0 ? (
                <div className="space-y-3">
                  {trendingHashtags.map((item, index) => (
                    <button
                      key={item.hashtag}
                      onClick={() => {
                        setSearchQuery(item.hashtag)
                        setActiveTab('recent')
                      }}
                      className="w-full text-left p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-neutral-300 dark:text-neutral-600 group-hover:text-blue-500 transition">
                            #{index + 1}
                          </span>
                          <span className="font-semibold text-blue-500 dark:text-blue-400 group-hover:text-blue-600">
                            {item.hashtag}
                          </span>
                        </div>
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">{item.count} {t('posts')}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('noTrendingHashtags')}</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Floating Create Post Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => router.push('/community/create')}
        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-blue-500 to-blue-500 text-white rounded-full shadow-lg hover:from-blue-600 hover:to-blue-600 flex items-center justify-center z-50 transition-all"
        aria-label={t('createNewPost')}
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </motion.button>

      {/* Report Modal */}
      {reportModal && (
        <ReportModal
          isOpen={reportModal.isOpen}
          onClose={() => setReportModal(null)}
          contentType={reportModal.contentType}
          contentId={reportModal.contentId}
          contentPreview={reportModal.preview}
        />
      )}
    </div>
  )
}
