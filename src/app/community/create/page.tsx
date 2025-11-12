'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

export default function CreatePostPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [content, setContent] = useState('')
  const [postUrl, setPostUrl] = useState('')
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [isPosting, setIsPosting] = useState(false)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [allowSharing, setAllowSharing] = useState(true)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionUsers, setMentionUsers] = useState<{ id: string; name: string; avatarUrl: string | null }[]>([])
  const [mentionCursorPosition, setMentionCursorPosition] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [activeTab, setActiveTab] = useState<'text' | 'link' | 'image'>('text')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content])

  const handleContentChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart || 0
    setContent(value)
    setMentionCursorPosition(cursorPos)

    // Check if user typed @
    const textBeforeCursor = value.substring(0, cursorPos)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)

    if (mentionMatch) {
      const query = mentionMatch[1]
      setMentionQuery(query)

      if (query.length >= 1) {
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
    const textBeforeCursor = content.substring(0, mentionCursorPosition)
    const textAfterCursor = content.substring(mentionCursorPosition)
    const beforeMention = textBeforeCursor.replace(/@\w*$/, `@${user.name} `)
    const newContent = beforeMention + textAfterCursor
    setContent(newContent)
    setShowMentions(false)
    setMentionUsers([])
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + selectedImages.length > 4) {
      toast.error('Maximum 4 images allowed per post')
      return
    }

    setSelectedImages(prev => [...prev, ...files])
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
    if (!content.trim() && selectedImages.length === 0 && !postUrl.trim()) {
      toast.error('Please add some content to your post')
      return
    }

    setIsPosting(true)
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

      // Create post
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim() || (imageUrls.length > 0 ? 'Posted images' : 'Shared a link'),
          imageUrls,
          postUrl: postUrl.trim() || null,
          allowSharing
        }),
      })

      if (response.ok) {
        toast.success('Post created successfully!')
        // Redirect back to community page
        router.push('/community')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create post')
      }
    } catch (error) {
      console.error('Error creating post:', error)
      toast.error('Failed to create post. Please try again.')
    } finally {
      setIsPosting(false)
      setIsUploadingImages(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/community')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-medium">Back to Community</span>
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Create Post
            </h1>
            <div className="w-24"></div> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
        >
          {/* User Info */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-purple-50/50">
            <div className="flex items-center gap-3">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name || 'User'}
                  className="w-12 h-12 rounded-full border-2 border-white shadow-sm"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-lg border-2 border-white shadow-sm">
                  {(profile?.name || 'U')[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900">{profile?.name || 'User'}</p>
                <p className="text-sm text-gray-500">Posting to Community</p>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-6">
            {/* Tab Selector */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('text')}
                className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                  activeTab === 'text'
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Text
                </span>
                {activeTab === 'text' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('link')}
                className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                  activeTab === 'link'
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Link
                </span>
                {activeTab === 'link' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('image')}
                className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                  activeTab === 'image'
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Images
                </span>
                {activeTab === 'image' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                  />
                )}
              </button>
            </div>

            {/* Text Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'text' && (
                <motion.div
                  key="text"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="relative"
                >
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={handleContentChange}
                    placeholder="What's on your mind? Share your thoughts, ask questions, or start a discussion..."
                    className="w-full p-4 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-900 placeholder-gray-400 min-h-[200px] text-lg"
                    rows={8}
                    maxLength={5000}
                  />
                  
                  {/* @ Mention Autocomplete */}
                  {showMentions && mentionUsers.length > 0 && (
                    <div className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {mentionUsers.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => insertMention(user)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition text-left"
                        >
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.name}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {user.name[0]}
                            </div>
                          )}
                          <span className="font-medium text-gray-900">@{user.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-gray-500">
                      {content.length}/5000 characters
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Link Content */}
              {activeTab === 'link' && (
                <motion.div
                  key="link"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Link URL
                      </label>
                      <input
                        type="url"
                        value={postUrl}
                        onChange={(e) => setPostUrl(e.target.value)}
                        placeholder="https://example.com/article"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-900 placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Add a comment (optional)
                      </label>
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Share your thoughts about this link..."
                        className="w-full p-4 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-900 placeholder-gray-400 min-h-[120px]"
                        rows={4}
                        maxLength={5000}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Image Content */}
              {activeTab === 'image' && (
                <motion.div
                  key="image"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="space-y-4">
                    {/* Image Upload Area */}
                    {imagePreviewUrls.length === 0 ? (
                      <label className="block w-full border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer group">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-lg font-medium text-gray-700">Click to upload images</p>
                            <p className="text-sm text-gray-500 mt-1">Up to 4 images (PNG, JPG, GIF)</p>
                          </div>
                        </div>
                      </label>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {imagePreviewUrls.map((url, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={url}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-48 object-cover rounded-xl border-2 border-gray-200"
                            />
                            <button
                              onClick={() => removeImage(index)}
                              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg hover:bg-red-600"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        {imagePreviewUrls.length < 4 && (
                          <label className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer flex items-center justify-center">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleImageSelect}
                              className="hidden"
                            />
                            <div className="flex flex-col items-center gap-2">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              <span className="text-sm text-gray-600">Add more</span>
                            </div>
                          </label>
                        )}
                      </div>
                    )}

                    {/* Image Caption */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Add a caption (optional)
                      </label>
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Describe your images..."
                        className="w-full p-4 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-900 placeholder-gray-400 min-h-[100px]"
                        rows={3}
                        maxLength={5000}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Allow Sharing */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={allowSharing}
                  onChange={(e) => setAllowSharing(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                />
                <div>
                  <span className="font-medium text-gray-900">Allow sharing</span>
                  <p className="text-sm text-gray-500">Others can share your post</p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => router.push('/community')}
              className="px-6 py-2.5 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePost}
              disabled={(!content.trim() && selectedImages.length === 0 && !postUrl.trim()) || isPosting || isUploadingImages}
              className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl disabled:shadow-none flex items-center gap-2"
            >
              {isPosting || isUploadingImages ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {isUploadingImages ? 'Uploading...' : 'Posting...'}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Post
                </>
              )}
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

