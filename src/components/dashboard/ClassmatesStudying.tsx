'use client'

/**
 * PartnersStudying - Social Gravity Component
 *
 * Vision: Create FOMO by showing who's studying right now
 *
 * Display modes:
 * 1. Specific friends/partners: "Sarah is studying Biology"
 * 2. General: "12 students studying now"
 *
 * This creates the "social gravity" that makes users stay
 */

import { useRouter } from 'next/navigation'
import {
  Users,
  ChevronRight,
  Zap,
} from 'lucide-react'
import Image from 'next/image'

interface StudyingPartner {
  id: string
  name: string
  avatarUrl: string | null
  subject?: string
  activityType?: string
}

interface ClassmatesStudyingProps {
  // Direct study partners who are online
  studyingPartners?: StudyingPartner[]
  // Total studying count
  totalStudying?: number
  className?: string
}

export default function ClassmatesStudying({
  studyingPartners = [],
  totalStudying = 0,
  className = '',
}: ClassmatesStudyingProps) {
  const router = useRouter()

  // Don't show if nobody is studying
  if (totalStudying === 0 && studyingPartners.length === 0) {
    return null
  }

  // Get avatar or initials - with null safety
  const getAvatar = (partner: StudyingPartner) => {
    if (partner.avatarUrl) {
      return (
        <Image
          src={partner.avatarUrl}
          alt={partner.name || 'Study partner'}
          width={32}
          height={32}
          className="w-8 h-8 rounded-full object-cover"
        />
      )
    }

    // Safe initials extraction - handle null, undefined, or empty name
    const name = partner.name || ''
    const initials = name.length > 0
      ? name
          .split(' ')
          .filter(n => n.length > 0)
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : '?'

    return (
      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
          {initials || '?'}
        </span>
      </div>
    )
  }

  // Handle study with partner
  const handleStudyWithPartner = (partnerId: string) => {
    router.push(`/partners/${partnerId}`)
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
          {totalStudying > 0 ? `${totalStudying} studying now` : 'Friends studying'}
        </h3>
      </div>

      <div className="space-y-3">
        {/* Direct Study Partners (Friends) - Most Important */}
        {studyingPartners.length > 0 && (
          <div className="space-y-2">
            {studyingPartners.slice(0, 3).map((partner) => (
              <button
                key={partner.id}
                onClick={() => handleStudyWithPartner(partner.id)}
                className="w-full p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors flex items-center gap-3 group"
              >
                {/* Online indicator + Avatar */}
                <div className="relative">
                  {getAvatar(partner)}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-neutral-900" />
                </div>

                {/* Name + Subject */}
                <div className="flex-1 text-left">
                  <p className="font-medium text-neutral-900 dark:text-white text-sm">
                    {partner.name.split(' ')[0]} is studying
                  </p>
                  {partner.subject && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {partner.subject}
                    </p>
                  )}
                </div>

                {/* Action */}
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Study together</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </button>
            ))}

            {/* Show more if more than 3 */}
            {studyingPartners.length > 3 && (
              <button
                onClick={() => router.push('/partners')}
                className="w-full py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              >
                +{studyingPartners.length - 3} more studying
              </button>
            )}
          </div>
        )}

        {/* General count (fallback when no specific data) */}
        {studyingPartners.length === 0 && totalStudying > 0 && (
          <div className="p-4 bg-neutral-100 dark:bg-neutral-800/50 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-200 dark:bg-neutral-700 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-neutral-900 dark:text-white">
                {totalStudying} students studying
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Join the study community
              </p>
            </div>
            <button
              onClick={() => router.push('/solo-study')}
              className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors flex items-center gap-1"
            >
              <Zap className="w-4 h-4" />
              <span>Study</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
