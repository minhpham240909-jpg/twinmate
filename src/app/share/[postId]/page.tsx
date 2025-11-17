'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import GlowBorder from '@/components/ui/GlowBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'

type SharedPost = {
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
  likesCount: number
  commentsCount: number
  repostsCount: number
  comments: {
    id: string
    content: string
    createdAt: string
    user: {
      id: string
      name: string
      avatarUrl: string | null
    }
  }[]
  hasMoreComments: boolean
}

export default function SharedPostPage() {
  const router = useRouter()
  const params = useParams()
  const postId = params.postId as string

  const [post, setPost] = useState<SharedPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (postId) {
      fetchSharedPost()
    }
  }, [postId])

  const fetchSharedPost = async () => {
    try {
      const response = await fetch(`/api/posts/share/${postId}`)

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load post')
        setLoading(false)
        return
      }

      const data = await response.json()
      setPost(data.post)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching shared post:', err)
      setError('Failed to load post')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Post Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'This post may have been removed or is no longer available.'}</p>
          <Link
            href="/auth/signin"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Go to TwinMate
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-blue-600">TwinMate</h1>
            <Link
              href="/auth/signin"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Shared Post Card */}
        <FadeIn delay={0.1}>
          <GlowBorder color="#3b82f6" intensity="medium" animated={false}  style={{ borderRadius: 12 }}>
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
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
          </div>

          {/* Post Content */}
          <div className="mb-4">
            <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>

            {/* Post Images */}
            {post.imageUrls && post.imageUrls.length > 0 && (
              <div className={`grid gap-2 mt-4 ${
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
                      className="w-full h-auto max-h-96 object-cover rounded-lg"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Post Stats */}
          <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
            {post.likesCount > 0 && (
              <Pulse>
                <div className="flex items-center gap-2 text-gray-600 hover:text-red-500 hover:scale-110 transition-all cursor-default">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className="text-sm font-medium">{post.likesCount} likes</span>
                </div>
              </Pulse>
            )}
            {post.commentsCount > 0 && (
              <Pulse>
                <div className="flex items-center gap-2 text-gray-600 hover:text-blue-500 hover:scale-110 transition-all cursor-default">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-sm font-medium">{post.commentsCount} comments</span>
                </div>
              </Pulse>
            )}
            {post.repostsCount > 0 && (
              <Pulse>
                <div className="flex items-center gap-2 text-gray-600 hover:text-green-500 hover:scale-110 transition-all cursor-default">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span className="text-sm font-medium">{post.repostsCount} reposts</span>
                </div>
              </Pulse>
            )}
          </div>

          {/* Sign in to interact */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Bounce>
              <Link
                href="/auth/signin"
                className="w-full block text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:scale-105 transition-all font-semibold shadow-lg"
              >
                Sign in to like and comment
              </Link>
            </Bounce>
          </div>
        </div>

        {/* Comments Section */}
        {post.comments && post.comments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Comments</h3>
            <div className="space-y-3">
              {post.comments.map((comment) => (
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
              {post.hasMoreComments && (
                <Link
                  href="/auth/signin"
                  className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign in to see more comments
                </Link>
              )}
            </div>
          </div>
        )}

        {/* CTA Card */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-2">See more posts like this</h2>
          <p className="text-blue-100 mb-6">Join TwinMate to connect with study partners</p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition font-semibold"
            >
              Join Now
            </Link>
            <Link
              href="/auth/signin"
              className="px-6 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition font-semibold"
            >
              Sign In
            </Link>
          </div>
            </div>
          </GlowBorder>
        </FadeIn>
      </main>
    </div>
  )
}
