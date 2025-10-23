'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Post = {
  id: string
  content: string
  imageUrls: string[]
  createdAt: string
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
  _count: {
    likes: number
    comments: number
    reposts: number
  }
  isLikedByUser?: boolean
  isRepostedByUser?: boolean
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

export default function CommunityPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [newPostContent, setNewPostContent] = useState('')
  const [isPostingLoading, setIsPostingLoading] = useState(false)
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
  const [popularPosts, setPopularPosts] = useState<Post[]>([])
  const [trendingHashtags, setTrendingHashtags] = useState<{ hashtag: string; count: number }[]>([])
  const [isLoadingPopular, setIsLoadingPopular] = useState(false)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null)
  const [allowSharing, setAllowSharing] = useState(true)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionUsers, setMentionUsers] = useState<{ id: string; name: string; avatarUrl: string | null }[]>([])
  const [mentionCursorPosition, setMentionCursorPosition] = useState(0)

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

  // Handle @ mention detection and search
  const handleContentChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart || 0
    setNewPostContent(value)
    setMentionCursorPosition(cursorPos)

    // Check if user typed @
    const textBeforeCursor = value.substring(0, cursorPos)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)

    if (mentionMatch) {
      const query = mentionMatch[1]
      setMentionQuery(query)

      if (query.length >= 1) {
        // Search for users
        try {
          const response = await fetch(`/api/users/mentions?query=${encodeURIComponent(query)}&limit=5`)
          if (response.ok) {
            const data = await response.json()
            setMentionUsers(data.users)
            setShowMentions(data.users.length > 0)
          }
        } catch (error) {
          console.error('Error searching users:', error)
        }
      } else {
        setShowMentions(false)
        setMentionUsers([])
      }
    } else {
      setShowMentions(false)
      setMentionUsers([])
    }
  }

  const insertMention = (user: { id: string; name: string; avatarUrl: string | null }) => {
    const textBeforeCursor = newPostContent.substring(0, mentionCursorPosition)
    const textAfterCursor = newPostContent.substring(mentionCursorPosition)

    // Replace @query with @username
    const beforeMention = textBeforeCursor.replace(/@\w*$/, `@${user.name} `)
    const newContent = beforeMention + textAfterCursor

    setNewPostContent(newContent)
    setShowMentions(false)
    setMentionUsers([])
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + selectedImages.length > 4) {
      alert('Maximum 4 images allowed per post')
      return
    }

    setSelectedImages(prev => [...prev, ...files])

    // Create preview URLs
    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreviewUrls(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index))
  }

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && selectedImages.length === 0) return

    setIsPostingLoading(true)
    try {
      let imageUrls: string[] = []

      // Upload images if any
      if (selectedImages.length > 0) {
        setIsUploadingImages(true)
        const formData = new FormData()
        selectedImages.forEach(image => {
          formData.append('images', image)
        })

        const uploadResponse = await fetch('/api/upload/post-images', {
          method: 'POST',
          body: formData,
        })

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json()
          imageUrls = uploadData.urls
        } else {
          throw new Error('Failed to upload images')
        }
        setIsUploadingImages(false)
      }

      // Create post with content and image URLs
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newPostContent.trim() || 'Posted images',
          imageUrls,
          allowSharing
        }),
      })

      if (response.ok) {
        setNewPostContent('')
        setSelectedImages([])
        setImagePreviewUrls([])
        await fetchPosts()
      }
    } catch (error) {
      console.error('Error creating post:', error)
      alert('Failed to create post. Please try again.')
    } finally {
      setIsPostingLoading(false)
      setIsUploadingImages(false)
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
      alert('Share link copied to clipboard!')
    }).catch(err => {
      console.error('Failed to copy:', err)
      alert('Failed to copy link. Please try again.')
    })
  }

  const handleLike = async (postId: string, isLiked: boolean) => {
    try {
      const method = isLiked ? 'DELETE' : 'POST'
      const response = await fetch(`/api/posts/${postId}/like`, { method })

      if (response.ok) {
        // Update local state immediately
        setPosts(prev =>
          prev.map(post =>
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
        )
      }
    } catch (error) {
      console.error('Error liking post:', error)
    }
  }

  const handleRepost = async (postId: string, isReposted: boolean) => {
    try {
      const method = isReposted ? 'DELETE' : 'POST'
      const response = await fetch(`/api/posts/${postId}/repost`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify({}) : undefined,
      })

      if (response.ok) {
        setPosts(prev =>
          prev.map(post =>
            post.id === postId
              ? {
                  ...post,
                  isRepostedByUser: !isReposted,
                  _count: {
                    ...post._count,
                    reposts: post._count.reposts + (isReposted ? -1 : 1),
                  },
                }
              : post
          )
        )
      }
    } catch (error) {
      console.error('Error reposting:', error)
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
        alert(error.error || 'Failed to edit post')
      }
    } catch (error) {
      console.error('Error editing post:', error)
      alert('Failed to edit post')
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('This post will be deleted for 30 days. You can restore it anytime before permanent deletion.')) {
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
        alert(data.message || 'Post moved to history. You can restore it within 30 days.')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete post')
      }
    } catch (error) {
      console.error('Error deleting post:', error)
      alert('Failed to delete post')
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-blue-600">Community</h1>
              {newPostsCount > 0 && (
                <button
                  onClick={fetchPosts}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {newPostsCount} new {newPostsCount === 1 ? 'post' : 'posts'}
                </button>
              )}
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search posts, #hashtags, @usernames..."
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
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

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left/Center */}
          <div className="lg:col-span-2">
            {/* Create Post */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 relative">
          <textarea
            value={newPostContent}
            onChange={handleContentChange}
            placeholder="What's on your mind? Use @ to mention users, # for hashtags"
            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            maxLength={5000}
          />

          {/* @ Mention Autocomplete Dropdown */}
          {showMentions && mentionUsers.length > 0 && (
            <div className="absolute z-10 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {mentionUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => insertMention(user)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-blue-50 transition text-left"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {user.name[0]}
                    </div>
                  )}
                  <span className="font-medium text-gray-900">@{user.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Image Previews */}
          {imagePreviewUrls.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {imagePreviewUrls.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {newPostContent.length}/5000
              </span>

              {/* Image Upload Button */}
              <label className="cursor-pointer flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium">
                  {selectedImages.length > 0 ? `${selectedImages.length}/4` : 'Add Images'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={selectedImages.length >= 4}
                />
              </label>

              {isUploadingImages && (
                <span className="text-sm text-blue-600">Uploading images...</span>
              )}

              {/* Allow Sharing Checkbox */}
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowSharing}
                  onChange={(e) => setAllowSharing(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span>Allow sharing</span>
              </label>
            </div>

            <button
              onClick={handleCreatePost}
              disabled={(!newPostContent.trim() && selectedImages.length === 0) || isPostingLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              {isPostingLoading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('recent')}
              className={`flex-1 px-6 py-4 font-semibold transition ${
                activeTab === 'recent'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Recent Posts
            </button>
            <button
              onClick={() => {
                setActiveTab('popular')
                if (popularPosts.length === 0) {
                  fetchPopularPosts()
                }
              }}
              className={`flex-1 px-6 py-4 font-semibold transition ${
                activeTab === 'popular'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              🔥 Popular (7 days)
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
        <div className="space-y-4">
          {displayPosts.map((post) => (
            <div key={post.id} className="bg-white rounded-xl shadow-sm p-6">
              {/* Post Header */}
              <div className="flex items-start gap-3 mb-4">
                {post.user.avatarUrl ? (
                  <img
                    src={post.user.avatarUrl}
                    alt={post.user.name}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {post.user.name[0]}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{post.user.name}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(post.createdAt).toLocaleString()}
                  </p>
                </div>

                {/* Three-dots menu */}
                <div className="relative">
                  <button
                    onClick={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                    title="More options"
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
                          Share post
                        </button>

                        {/* Edit and Delete - only for post owner */}
                        {post.user.id === user.id && (
                          <>
                            <button
                              onClick={() => {
                                startEditPost(post)
                                setOpenMenuPostId(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit post
                            </button>
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
                              Delete post
                            </button>
                          </>
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

                <button
                  onClick={() => handleRepost(post.id, post.isRepostedByUser || false)}
                  className={`flex items-center gap-2 ${
                    post.isRepostedByUser ? 'text-green-600' : 'text-gray-600'
                  } hover:text-green-600 transition`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                  <span className="text-sm font-medium">{post._count.reposts}</span>
                </button>
              </div>

              {/* Comments Section */}
              {showComments === post.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="space-y-3 mb-4">
                    {comments[post.id]?.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        {comment.user.avatarUrl ? (
                          <img
                            src={comment.user.avatarUrl}
                            alt={comment.user.name}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm">
                            {comment.user.name[0]}
                          </div>
                        )}
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
                      placeholder="Write a comment..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => {
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
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {displayPosts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {isSearching ? 'No posts found' : 'No posts yet. Be the first to post!'}
              </p>
            </div>
          )}
        </div>
        )}
          </div>

          {/* Sidebar - Right */}
          <div className="lg:col-span-1">
            {/* Trending Hashtags */}
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
              <h3 className="text-lg font-bold text-gray-900 mb-4">🔥 Trending Hashtags</h3>
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
                        <span className="text-sm text-gray-500">{item.count} posts</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No trending hashtags yet. Start using hashtags in your posts!</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
