'use client'

/**
 * PUBLIC SHARED ROADMAP PAGE
 *
 * Displays a shared roadmap publicly.
 * Features:
 * - Full roadmap preview with all steps
 * - Copy to account functionality
 * - View/copy statistics
 * - SEO-friendly structure
 */

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { useSharedRoadmap } from '@/hooks/useSharing'
import { SharedRoadmapView } from '@/components/sharing'
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function SharedRoadmapPage() {
  const params = useParams()
  const shareCode = params?.shareCode as string
  const { user, loading: authLoading } = useAuth()

  const {
    shared,
    isLoading,
    error,
    copyToAccount,
    isCopying,
  } = useSharedRoadmap(shareCode)

  // Track page view
  useEffect(() => {
    if (shared) {
      document.title = `${shared.title} | Clerva`
    }
  }, [shared])

  // Loading state
  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400">
            Loading roadmap...
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
            Unable to Load Roadmap
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {error}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  // Not found state
  if (!shared) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-neutral-200 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-neutral-500" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
            Roadmap Not Found
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            This shared roadmap doesn&apos;t exist or has been removed.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  // Render shared roadmap
  return (
    <SharedRoadmapView
      shared={shared}
      onCopy={copyToAccount}
      isCopying={isCopying}
      isAuthenticated={!!user}
    />
  )
}
