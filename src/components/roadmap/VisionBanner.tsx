'use client'

/**
 * VISION BANNER COMPONENT
 *
 * Displays the transformation narrative at the top of the roadmap.
 * Shows:
 * - Vision: WHY this journey matters
 * - Target user: Who this is for (identity shift)
 * - Success metrics: What you'll be able to do
 *
 * Design: Inspiring but professional, motivational without being cheesy
 */

import { memo, useState } from 'react'
import {
  Sparkles,
  Target,
  Trophy,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface VisionBannerProps {
  vision?: string
  targetUser?: string
  successMetrics?: string[]
  outOfScope?: string[]
  estimatedDays?: number
  dailyCommitment?: string
  className?: string
  defaultExpanded?: boolean
}

// ============================================
// COMPONENT
// ============================================

export const VisionBanner = memo(function VisionBanner({
  vision,
  targetUser,
  successMetrics,
  outOfScope,
  estimatedDays,
  dailyCommitment,
  className = '',
  defaultExpanded = false,
}: VisionBannerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Don't render if no vision content
  if (!vision && !targetUser && !successMetrics?.length) {
    return null
  }

  return (
    <div
      className={`
        rounded-2xl overflow-hidden
        bg-gradient-to-br from-blue-50 to-indigo-50
        dark:from-blue-950/30 dark:to-indigo-950/30
        border border-blue-100 dark:border-blue-900/50
        ${className}
      `}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-blue-100/30 dark:hover:bg-blue-900/20 transition-colors"
      >
        {/* Icon */}
        <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>

        {/* Vision text */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 text-sm uppercase tracking-wide mb-1">
            Your Transformation
          </h3>
          <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
            {vision || 'Complete this roadmap to master the skills you need.'}
          </p>
        </div>

        {/* Expand/collapse icon */}
        <div className="p-1 text-blue-500 dark:text-blue-400">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Target user identity */}
          {targetUser && (
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
                <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-0.5">
                  You&apos;ll Become
                </p>
                <p className="text-sm text-indigo-800 dark:text-indigo-200">
                  {targetUser}
                </p>
              </div>
            </div>
          )}

          {/* Success metrics */}
          {successMetrics && successMetrics.length > 0 && (
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/50">
                <Trophy className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide mb-1.5">
                  Success Looks Like
                </p>
                <ul className="space-y-1.5">
                  {successMetrics.map((metric, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-green-800 dark:text-green-200"
                    >
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-500" />
                      <span>{metric}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Out of scope */}
          {outOfScope && outOfScope.length > 0 && (
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/50">
                <XCircle className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1.5">
                  Save For Later
                </p>
                <ul className="space-y-1">
                  {outOfScope.map((item, index) => (
                    <li
                      key={index}
                      className="text-sm text-neutral-600 dark:text-neutral-400"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Time commitment */}
          {(estimatedDays || dailyCommitment) && (
            <div className="flex items-center gap-4 pt-2 border-t border-blue-100 dark:border-blue-900/50">
              {estimatedDays && (
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {estimatedDays}
                  </p>
                  <p className="text-xs text-blue-500 dark:text-blue-400">
                    days
                  </p>
                </div>
              )}
              {dailyCommitment && (
                <div className="flex-1">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {dailyCommitment}
                  </p>
                  <p className="text-xs text-blue-500 dark:text-blue-400">
                    daily commitment
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default VisionBanner
