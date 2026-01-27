'use client'

/**
 * CONFIDENCE METER COMPONENT
 *
 * Displays user's learning confidence/readiness as a visual meter.
 * Shows percentage with breakdown factors on hover/tap.
 *
 * Features:
 * - Animated circular progress
 * - Color coding based on confidence level
 * - Expandable breakdown details
 * - Next milestone indicator
 * - Responsive design
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  TrendingUp,
  Target,
  Flame,
  Brain,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface ConfidenceBreakdown {
  progressScore: number
  consistencyScore: number
  masteryScore: number
  engagementScore: number
}

interface NextMilestone {
  percentage: number
  description: string
}

interface ConfidenceMeterProps {
  roadmapId: string
  className?: string
  compact?: boolean // For inline display
  showBreakdown?: boolean // Whether to allow expanding breakdown
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getConfidenceColor(confidence: number): {
  text: string
  bg: string
  ring: string
  gradient: string
} {
  if (confidence >= 80) {
    return {
      text: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-500',
      ring: 'ring-green-200 dark:ring-green-800',
      gradient: 'from-green-500 to-emerald-500',
    }
  } else if (confidence >= 60) {
    return {
      text: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500',
      ring: 'ring-blue-200 dark:ring-blue-800',
      gradient: 'from-blue-500 to-cyan-500',
    }
  } else if (confidence >= 40) {
    return {
      text: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500',
      ring: 'ring-amber-200 dark:ring-amber-800',
      gradient: 'from-amber-500 to-yellow-500',
    }
  } else {
    return {
      text: 'text-neutral-600 dark:text-neutral-400',
      bg: 'bg-neutral-400',
      ring: 'ring-neutral-200 dark:ring-neutral-700',
      gradient: 'from-neutral-400 to-neutral-500',
    }
  }
}

// ============================================
// CIRCULAR PROGRESS COMPONENT
// ============================================

function CircularProgress({
  percentage,
  size = 120,
  strokeWidth = 8,
  color,
}: {
  percentage: number
  size?: number
  strokeWidth?: number
  color: { gradient: string; text: string }
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-neutral-200 dark:text-neutral-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#confidence-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        {/* Gradient definition */}
        <defs>
          <linearGradient id="confidence-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" className={`${color.gradient.includes('green') ? 'text-green-500' : color.gradient.includes('blue') ? 'text-blue-500' : color.gradient.includes('amber') ? 'text-amber-500' : 'text-neutral-400'}`} stopColor="currentColor" />
            <stop offset="100%" className={`${color.gradient.includes('emerald') ? 'text-emerald-500' : color.gradient.includes('cyan') ? 'text-cyan-500' : color.gradient.includes('yellow') ? 'text-yellow-500' : 'text-neutral-500'}`} stopColor="currentColor" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${color.text}`}>{percentage}%</span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Ready</span>
      </div>
    </div>
  )
}

// ============================================
// BREAKDOWN ITEM COMPONENT
// ============================================

function BreakdownItem({
  icon,
  label,
  score,
  weight,
}: {
  icon: React.ReactNode
  label: string
  score: number
  weight: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            {score}%
          </span>
        </div>
        <div className="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-[10px] text-neutral-400">{weight} weight</span>
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ConfidenceMeter({
  roadmapId,
  className = '',
  compact = false,
  showBreakdown = true,
}: ConfidenceMeterProps) {
  const [confidence, setConfidence] = useState<number>(0)
  const [breakdown, setBreakdown] = useState<ConfidenceBreakdown | null>(null)
  const [message, setMessage] = useState<string>('')
  const [nextMilestone, setNextMilestone] = useState<NextMilestone | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const color = useMemo(() => getConfidenceColor(confidence), [confidence])

  // Fetch confidence data
  const fetchConfidence = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/roadmap/confidence?roadmapId=${roadmapId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch confidence')
      }

      const data = await response.json()

      if (data.success) {
        setConfidence(data.confidence)
        setBreakdown(data.breakdown)
        setMessage(data.message)
        setNextMilestone(data.nextMilestone || null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [roadmapId])

  // Fetch on mount and when roadmapId changes
  useEffect(() => {
    fetchConfidence()
  }, [fetchConfidence])

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-6 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`p-4 bg-red-50 dark:bg-red-950/30 rounded-xl ${className}`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={fetchConfidence}
          className="mt-2 text-sm text-red-700 dark:text-red-300 underline"
        >
          Try again
        </button>
      </div>
    )
  }

  // Compact view
  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className={`w-12 h-12 rounded-full ${color.ring} ring-4 flex items-center justify-center ${color.bg}`}>
          <span className="text-sm font-bold text-white">{confidence}%</span>
        </div>
        <div>
          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Confidence
          </span>
          <p className="text-xs text-neutral-500 line-clamp-1">{message}</p>
        </div>
      </div>
    )
  }

  // Full view
  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className={`w-5 h-5 ${color.text}`} />
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">
            Learning Confidence
          </h3>
        </div>
        <button
          onClick={fetchConfidence}
          disabled={isLoading}
          className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-neutral-500 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main content */}
      <div className="p-6">
        {/* Circular progress */}
        <div className="flex justify-center mb-4">
          <CircularProgress percentage={confidence} color={color} />
        </div>

        {/* Message */}
        <p className="text-center text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          {message}
        </p>

        {/* Next milestone */}
        {nextMilestone && (
          <div className="mb-4 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Next milestone</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {nextMilestone.percentage}%
                </span>
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {nextMilestone.description}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Breakdown toggle */}
        {showBreakdown && breakdown && (
          <div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              <span>{isExpanded ? 'Hide' : 'View'} breakdown</span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {/* Breakdown details */}
            {isExpanded && (
              <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <BreakdownItem
                  icon={<Target className="w-4 h-4 text-blue-600" />}
                  label="Progress"
                  score={breakdown.progressScore}
                  weight="40%"
                />
                <BreakdownItem
                  icon={<Flame className="w-4 h-4 text-orange-600" />}
                  label="Consistency"
                  score={breakdown.consistencyScore}
                  weight="25%"
                />
                <BreakdownItem
                  icon={<Brain className="w-4 h-4 text-purple-600" />}
                  label="Mastery"
                  score={breakdown.masteryScore}
                  weight="25%"
                />
                <BreakdownItem
                  icon={<MessageSquare className="w-4 h-4 text-green-600" />}
                  label="Engagement"
                  score={breakdown.engagementScore}
                  weight="10%"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ConfidenceMeter
