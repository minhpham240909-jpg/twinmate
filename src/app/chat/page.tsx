'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Chat page - Redirects to Partner Chat by default
 * Group chat is accessible via button in the Partner Chat page
 */
export default function ChatPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
      return
    }

    // Redirect to partner chat by default
    if (!loading && user) {
      router.replace('/chat/partners')
    }
  }, [user, loading, router])

  // Show loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-neutral-500 dark:text-neutral-400">Loading...</p>
      </div>
    </div>
  )
}
