'use client'

/**
 * Progressive Disclosure System
 *
 * RETENTION STRATEGY: Show focused Day 1 experience, gradually unlock features
 *
 * Logic:
 * - New users (0-2 sessions): Show only primary CTA + 1 suggestion + unlock teaser
 * - Engaged users (3-9 sessions): Show main features, hide advanced stats
 * - Power users (10+ sessions): Show everything
 *
 * This prevents cognitive overload and creates curiosity-driven progression.
 *
 * SCALABILITY: Lightweight component with no database calls
 * All data passed as props from parent (already fetched)
 */

import { ReactNode } from 'react'
import { Lock, Sparkles, Users, Trophy, TrendingUp } from 'lucide-react'

// =============================================================================
// CONFIGURATION
// =============================================================================

export const DISCLOSURE_THRESHOLDS = {
  // Sessions needed to unlock each tier
  TIER_1_BASIC: 0,        // Day 1: Primary CTA, greeting, 1 suggestion
  TIER_2_SOCIAL: 3,       // After 3 sessions: Partners, classmates, full suggestions
  TIER_3_STATS: 5,        // After 5 sessions: Weekly stats, points display
  TIER_4_FULL: 10,        // Power user: Everything visible
} as const

export type UserTier = 'new_user' | 'engaged' | 'active' | 'power_user'

// =============================================================================
// TIER CALCULATION
// =============================================================================

export function calculateUserTier(totalSessions: number): UserTier {
  if (totalSessions < DISCLOSURE_THRESHOLDS.TIER_2_SOCIAL) return 'new_user'
  if (totalSessions < DISCLOSURE_THRESHOLDS.TIER_3_STATS) return 'engaged'
  if (totalSessions < DISCLOSURE_THRESHOLDS.TIER_4_FULL) return 'active'
  return 'power_user'
}

export function shouldShowFeature(
  feature: 'partners' | 'classmates' | 'suggestions' | 'quick_stats' | 'weekly_stats' | 'quick_actions' | 'quick_session' | 'im_stuck' | 'leaderboard',
  totalSessions: number
): boolean {
  const tier = calculateUserTier(totalSessions)

  switch (feature) {
    case 'suggestions':
      // Always show 1 suggestion, but limit count for new users
      return true
    case 'quick_session':
      // Quick Session is unlocked from Day 1 - low barrier entry point
      return true
    case 'im_stuck':
      // "I'm Stuck" requires context from previous sessions
      return tier !== 'new_user'
    case 'classmates':
    case 'partners':
    case 'quick_actions':
      // Legacy: quick_actions still works for backwards compatibility
      return tier !== 'new_user'
    case 'quick_stats':
      return totalSessions >= DISCLOSURE_THRESHOLDS.TIER_3_STATS
    case 'weekly_stats':
      return totalSessions >= DISCLOSURE_THRESHOLDS.TIER_3_STATS
    case 'leaderboard':
      // Leaderboard unlocks at tier 3 (5+ sessions)
      return totalSessions >= DISCLOSURE_THRESHOLDS.TIER_3_STATS
    default:
      return true
  }
}

// =============================================================================
// UNLOCK TEASER COMPONENT
// =============================================================================

interface UnlockTeaserProps {
  sessionsCompleted: number
  sessionsNeeded: number
  featureName: string
  featureIcon: ReactNode
  description: string
}

export function UnlockTeaser({
  sessionsCompleted,
  sessionsNeeded,
  featureName,
  featureIcon,
  description,
}: UnlockTeaserProps) {
  const remaining = Math.max(0, sessionsNeeded - sessionsCompleted)

  if (remaining === 0) return null

  return (
    <div className="bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 border border-neutral-200 dark:border-neutral-700 border-dashed rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl flex items-center justify-center">
          <Lock className="w-4 h-4 text-neutral-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {featureIcon}
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              {featureName}
            </p>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {description}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-neutral-900 dark:text-white">
            {remaining}
          </p>
          <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
            {remaining === 1 ? 'session' : 'sessions'} left
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, (sessionsCompleted / sessionsNeeded) * 100)}%` }}
        />
      </div>
    </div>
  )
}

// =============================================================================
// NEW USER WELCOME SECTION
// =============================================================================

interface NewUserWelcomeProps {
  userName: string
  sessionsCompleted: number
}

export function NewUserWelcome({ userName, sessionsCompleted }: NewUserWelcomeProps) {
  const firstName = userName?.split(' ')[0] || 'there'

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 mb-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-2xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
            Welcome to Clerva, {firstName}!
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
            Let&apos;s build your study habit together. Complete your first few sessions to unlock all features.
          </p>

          {/* Mini progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-blue-200 dark:bg-blue-900/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (sessionsCompleted / 3) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
              {sessionsCompleted}/3 sessions
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// UNLOCK TEASERS SECTION (shows what's coming)
// =============================================================================

interface UnlockTeasersSectionProps {
  sessionsCompleted: number
}

export function UnlockTeasersSection({ sessionsCompleted }: UnlockTeasersSectionProps) {
  const tier = calculateUserTier(sessionsCompleted)

  // Don't show for power users
  if (tier === 'power_user') return null

  const teasers: Array<{
    feature: string
    icon: ReactNode
    description: string
    threshold: number
  }> = []

  // Show next unlock only
  if (sessionsCompleted < DISCLOSURE_THRESHOLDS.TIER_2_SOCIAL) {
    teasers.push({
      feature: 'Study Partners',
      icon: <Users className="w-4 h-4 text-purple-500" />,
      description: 'See who else is studying and connect',
      threshold: DISCLOSURE_THRESHOLDS.TIER_2_SOCIAL,
    })
  } else if (sessionsCompleted < DISCLOSURE_THRESHOLDS.TIER_3_STATS) {
    teasers.push({
      feature: 'Stats & Points',
      icon: <Trophy className="w-4 h-4 text-amber-500" />,
      description: 'Track your progress and earn rewards',
      threshold: DISCLOSURE_THRESHOLDS.TIER_3_STATS,
    })
  } else if (sessionsCompleted < DISCLOSURE_THRESHOLDS.TIER_4_FULL) {
    teasers.push({
      feature: 'Advanced Analytics',
      icon: <TrendingUp className="w-4 h-4 text-green-500" />,
      description: 'Deep insights into your study patterns',
      threshold: DISCLOSURE_THRESHOLDS.TIER_4_FULL,
    })
  }

  if (teasers.length === 0) return null

  return (
    <div className="space-y-3">
      {teasers.map((teaser) => (
        <UnlockTeaser
          key={teaser.feature}
          sessionsCompleted={sessionsCompleted}
          sessionsNeeded={teaser.threshold}
          featureName={teaser.feature}
          featureIcon={teaser.icon}
          description={teaser.description}
        />
      ))}
    </div>
  )
}

// =============================================================================
// FEATURE WRAPPER (conditionally renders children)
// =============================================================================

interface FeatureGateProps {
  feature: 'partners' | 'classmates' | 'suggestions' | 'quick_stats' | 'weekly_stats' | 'quick_actions' | 'quick_session' | 'im_stuck' | 'leaderboard'
  sessionsCompleted: number
  children: ReactNode
  fallback?: ReactNode
}

export function FeatureGate({
  feature,
  sessionsCompleted,
  children,
  fallback = null,
}: FeatureGateProps) {
  if (shouldShowFeature(feature, sessionsCompleted)) {
    return <>{children}</>
  }
  return <>{fallback}</>
}

// =============================================================================
// SUGGESTIONS LIMITER (show only 1 for new users)
// =============================================================================

export function getSuggestionsLimit(sessionsCompleted: number): number {
  const tier = calculateUserTier(sessionsCompleted)

  switch (tier) {
    case 'new_user':
      return 1
    case 'engaged':
      return 2
    case 'active':
      return 3
    default:
      return 5
  }
}
