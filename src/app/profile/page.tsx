'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

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
  const tCommon = useTranslations('common')

  const [posts, setPosts] = useState<UserPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [activeTab, setActiveTab] = useState<'about' | 'posts'>('about')
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin')
      return
    }

    if (user) {
      fetchUserPosts()
    }
  }, [user, authLoading])

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Back Button */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push('/dashboard')}
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
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name || user.email}
                className="w-32 h-32 rounded-full mx-auto mb-6 object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-32 h-32 rounded-full mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-4xl font-bold border-4 border-white shadow-lg">
                {profile?.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
              </div>
            )}

            {/* Name */}
            <h1 className="text-3xl font-bold text-gray-900 mb-6">{profile?.name || user.email}</h1>

            {/* Edit Profile Button */}
            <button
              onClick={() => router.push('/profile/edit')}
              className="px-8 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition shadow-md"
            >
              {t('editProfile')}
            </button>
          </div>

          {/* Info Cards with Icons */}
          <div className="px-6 pb-6 space-y-4">
            {/* Age */}
            {(profile as any)?.age && (
              <div className="flex items-center text-gray-700">
                <span className="text-2xl mr-4">🎂</span>
                <span className="text-lg">{(profile as any).age}</span>
              </div>
            )}

            {/* Role */}
            {(profile as any)?.role && (
              <div className="flex items-center text-gray-700">
                <span className="text-2xl mr-4">💼</span>
                <span className="text-lg">{(profile as any).role}</span>
              </div>
            )}

            {/* School/Location */}
            {(profile as any)?.school && (
              <div className="flex items-center text-gray-700">
                <span className="text-2xl mr-4">🏛️</span>
                <span className="text-lg">{(profile as any).school}</span>
              </div>
            )}

            {/* Email */}
            <div className="flex items-center text-gray-700">
              <span className="text-2xl mr-4">✉️</span>
              <span className="text-lg">{user.email}</span>
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
                {t('about')}
              </button>
              <button
                onClick={() => setActiveTab('posts')}
                className={`flex-1 py-4 text-center font-semibold transition ${
                  activeTab === 'posts'
                    ? 'text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('posts')}
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
                {(profile as any)?.aboutYourself && (
                  <div>
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{(profile as any).aboutYourself}</p>
                  </div>
                )}

                {/* About Yourself Items/Tags */}
                {(profile as any)?.aboutYourselfItems && (profile as any).aboutYourselfItems.length > 0 && (
                  <div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {(profile as any).aboutYourselfItems.map((item: string, index: number) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                {profile && ((profile as any).subjects?.length > 0 || (profile as any).interests?.length > 0 || (profile as any).languages) && (
                  <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                    {/* Subjects */}
                    {(profile as any).subjects?.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">{t('subjects')}</h3>
                        <div className="flex flex-wrap gap-2">
                          {(profile as any).subjects.map((subject: string, index: number) => (
                            <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                              {subject}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interests */}
                    {(profile as any).interests?.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">{t('interests')}</h3>
                        <div className="flex flex-wrap gap-2">
                          {(profile as any).interests.map((interest: string, index: number) => (
                            <span key={index} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>
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
                  posts.map((post) => (
                    <div key={post.id} className="border border-gray-200 rounded-lg p-4">
                      {/* Post Header with Three-Dot Menu */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {profile?.avatarUrl ? (
                            <img
                              src={profile.avatarUrl}
                              alt={profile.name || user.email}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                              {profile?.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                            </div>
                          )}
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
                        <span>❤️ {post._count.likes}</span>
                        <span>💬 {post._count.comments}</span>
                        <span>🔁 {post._count.reposts}</span>
                        <span className="ml-auto text-xs">{new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
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
      </main>
    </div>
  )
}
