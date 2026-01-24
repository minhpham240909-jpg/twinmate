'use client'

/**
 * Guest Empty State Component
 *
 * Reusable component shown to guest users on pages that require an account.
 * Provides clear messaging and easy sign-up path.
 *
 * Design principles:
 * - Non-intrusive but clear about benefits
 * - Single CTA to reduce decision fatigue
 * - Consistent styling across all pages
 */

import { useRouter } from 'next/navigation'
import { UserPlus, Sparkles, TrendingUp, Shield, Zap } from 'lucide-react'

type PageType = 'progress' | 'settings' | 'flashcards' | 'profile' | 'generic'

interface GuestEmptyStateProps {
  pageType: PageType
}

const PAGE_CONFIG: Record<PageType, {
  icon: React.ReactNode
  title: string
  description: string
  benefits: string[]
}> = {
  progress: {
    icon: <TrendingUp className="w-12 h-12 text-blue-500" />,
    title: 'Track Your Learning Journey',
    description: 'Create a free account to see your progress, streaks, and achievements.',
    benefits: [
      'View weekly activity stats',
      'Track your learning streak',
      'Earn XP and milestones',
      'See your strong and weak topics',
    ],
  },
  settings: {
    icon: <Shield className="w-12 h-12 text-purple-500" />,
    title: 'Save Your Preferences',
    description: 'Create a free account to customize your learning experience.',
    benefits: [
      'Set your study preferences',
      'Choose your subjects',
      'Enable notifications',
      'Sync across devices',
    ],
  },
  flashcards: {
    icon: <Zap className="w-12 h-12 text-yellow-500" />,
    title: 'Save Your Flashcards',
    description: 'Create a free account to save and review your flashcards anytime.',
    benefits: [
      'Save unlimited flashcards',
      'Spaced repetition learning',
      'Track mastery progress',
      'Study offline',
    ],
  },
  profile: {
    icon: <UserPlus className="w-12 h-12 text-green-500" />,
    title: 'Create Your Profile',
    description: 'Create a free account to personalize your learning experience.',
    benefits: [
      'Personalized AI responses',
      'Save your learning history',
      'Track achievements',
      'Sync across devices',
    ],
  },
  generic: {
    icon: <Sparkles className="w-12 h-12 text-pink-500" />,
    title: 'Unlock Full Features',
    description: 'Create a free account to access all features.',
    benefits: [
      'Unlimited AI help',
      'Save your progress',
      'Track achievements',
      'Personalized learning',
    ],
  },
}

export default function GuestEmptyState({ pageType }: GuestEmptyStateProps) {
  const router = useRouter()
  const config = PAGE_CONFIG[pageType]

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full flex items-center justify-center">
            {config.icon}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
          {config.title}
        </h2>

        {/* Description */}
        <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-6">
          {config.description}
        </p>

        {/* Benefits */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 mb-6 text-left">
          <ul className="space-y-2">
            {config.benefits.map((benefit, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => router.push('/auth?tab=signup')}
          className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          Create Free Account
        </button>

        {/* Sign in link */}
        <button
          onClick={() => router.push('/auth?tab=signin')}
          className="mt-3 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
        >
          Already have an account? Sign in
        </button>

        {/* Footer note */}
        <p className="text-xs text-neutral-400 mt-4">
          No credit card required. Free forever.
        </p>
      </div>
    </div>
  )
}
