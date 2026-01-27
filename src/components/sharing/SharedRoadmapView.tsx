'use client'

/**
 * SHARED ROADMAP VIEW
 *
 * Public page component for viewing a shared roadmap.
 * Features:
 * - Full roadmap display
 * - Copy to account button
 * - Step preview
 * - Attribution to creator
 */

import { memo } from 'react'
import {
  Clock,
  Target,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Copy,
  Eye,
  Users,
  Loader2,
  AlertTriangle,
  Calendar,
} from 'lucide-react'
import type { PublicSharedRoadmap } from '@/hooks/useSharing'

interface SharedRoadmapViewProps {
  shared: PublicSharedRoadmap
  onCopy: () => Promise<string | null>
  isCopying: boolean
  isAuthenticated: boolean
}

export const SharedRoadmapView = memo(function SharedRoadmapView({
  shared,
  onCopy,
  isCopying,
  isAuthenticated,
}: SharedRoadmapViewProps) {
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const handleCopy = async () => {
    const newId = await onCopy()
    if (newId) {
      // Redirect to dashboard after successful copy
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Hero section */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {shared.title}
          </h1>

          {/* Goal */}
          <p className="text-lg text-white/90 mb-6">
            {shared.goal}
          </p>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/70">
            {shared.subject && (
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                {shared.subject}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4" />
              {shared.totalSteps} steps
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatDuration(shared.estimatedMinutes)}
            </div>
            {shared.completedAt && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Completed {new Date(shared.completedAt).toLocaleDateString()}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-6 pt-6 border-t border-white/20">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-white/60" />
              <span>{shared.viewCount} views</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-white/60" />
              <span>{shared.copyCount} copies</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Copy CTA */}
        <div className="mb-8 p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
                Start this roadmap
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Copy this roadmap to your account and begin your learning journey
              </p>
            </div>
            {isAuthenticated ? (
              <button
                onClick={handleCopy}
                disabled={isCopying}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
              >
                {isCopying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Copying...
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy to My Account
                  </>
                )}
              </button>
            ) : (
              <a
                href="/sign-in"
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
              >
                Sign in to Copy
              </a>
            )}
          </div>
        </div>

        {/* Overview */}
        {shared.overview && (
          <div className="mb-8 p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">
              Overview
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
              {shared.overview}
            </p>
          </div>
        )}

        {/* Pitfalls */}
        {shared.roadmap.pitfalls && shared.roadmap.pitfalls.length > 0 && (
          <div className="mb-8 p-6 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-800/50">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
                Common Pitfalls to Avoid
              </h2>
            </div>
            <ul className="space-y-2">
              {shared.roadmap.pitfalls.map((pitfall, i) => (
                <li key={i} className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                  <span className="text-amber-500 mt-1">•</span>
                  {pitfall}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Success looks like */}
        {shared.roadmap.successLooksLike && (
          <div className="mb-8 p-6 bg-green-50 dark:bg-green-950/20 rounded-2xl border border-green-200 dark:border-green-800/50">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold text-green-900 dark:text-green-200">
                Success Looks Like
              </h2>
            </div>
            <p className="text-green-800 dark:text-green-300">
              {shared.roadmap.successLooksLike}
            </p>
          </div>
        )}

        {/* Steps */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
            Learning Path ({shared.totalSteps} steps)
          </h2>

          {shared.roadmap.steps.map((step, index) => (
            <div
              key={index}
              className="p-5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800"
            >
              {/* Step header */}
              <div className="flex items-start gap-4 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-semibold text-sm shrink-0">
                  {step.order + 1}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-neutral-900 dark:text-white">
                    {step.title}
                  </h3>
                  {step.duration && (
                    <span className="text-sm text-neutral-500">
                      ~{formatDuration(step.duration)}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-neutral-700 dark:text-neutral-300 mb-4 ml-12">
                {step.description}
              </p>

              {/* Step details */}
              <div className="ml-12 space-y-3">
                {step.timeframe && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-neutral-500 uppercase w-20 shrink-0">
                      When
                    </span>
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      {step.timeframe}
                    </span>
                  </div>
                )}
                {step.method && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-neutral-500 uppercase w-20 shrink-0">
                      How
                    </span>
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      {step.method}
                    </span>
                  </div>
                )}
                {step.avoid && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-red-500 uppercase w-20 shrink-0">
                      Avoid
                    </span>
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      {step.avoid}
                    </span>
                  </div>
                )}
                {step.doneWhen && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-green-600 uppercase w-20 shrink-0">
                      Done when
                    </span>
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      {step.doneWhen}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 text-center">
          {isAuthenticated ? (
            <button
              onClick={handleCopy}
              disabled={isCopying}
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl transition-colors shadow-lg shadow-blue-500/30"
            >
              {isCopying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Copying...
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Start This Roadmap
                </>
              )}
            </button>
          ) : (
            <a
              href="/sign-in"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-colors shadow-lg shadow-blue-500/30"
            >
              Sign in to Start
              <ChevronRight className="w-5 h-5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
})
