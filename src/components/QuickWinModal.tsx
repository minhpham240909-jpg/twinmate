'use client'

/**
 * QuickWinModal - First Session Celebration
 *
 * Vision: Emotional anchor for Day 2 return
 *
 * Shown after:
 * - First ever session completion
 * - First session after a break (streak = 1)
 * - Weekly milestone (7-day streak)
 *
 * Message is calm, not hype:
 * "You showed up. That's the hardest part."
 *
 * This builds identity: "I'm someone who studies"
 */

import { useState, useEffect } from 'react'
import {
  X,
  Flame,
  CheckCircle,
  Star,
  Calendar,
  ArrowRight,
} from 'lucide-react'

type WinType = 'first_session' | 'streak_started' | 'streak_milestone'

interface QuickWinModalProps {
  isOpen: boolean
  onClose: () => void
  winType: WinType
  streakCount?: number
  sessionCount?: number
  studyMinutes?: number
}

export default function QuickWinModal({
  isOpen,
  onClose,
  winType,
  streakCount = 1,
  sessionCount = 1,
  studyMinutes = 0,
}: QuickWinModalProps) {
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Brief confetti effect for milestones
      if (winType === 'streak_milestone') {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 2000)
      }
    }
  }, [isOpen, winType])

  if (!isOpen) return null

  // Get content based on win type
  const getContent = () => {
    switch (winType) {
      case 'first_session':
        return {
          icon: <CheckCircle className="w-12 h-12 text-green-500" />,
          title: 'First session complete',
          subtitle: "You showed up. That's the hardest part.",
          message: 'Tomorrow: protect your streak',
          highlight: null,
          accentColor: 'green',
        }

      case 'streak_started':
        return {
          icon: <Flame className="w-12 h-12 text-orange-500" />,
          title: "You're back",
          subtitle: 'Streak started. Keep showing up.',
          message: 'Consistency beats intensity',
          highlight: (
            <div className="flex items-center gap-2 text-orange-500">
              <Flame className="w-5 h-5" />
              <span className="font-bold">{streakCount} day streak</span>
            </div>
          ),
          accentColor: 'orange',
        }

      case 'streak_milestone':
        return {
          icon: <Star className="w-12 h-12 text-yellow-500" />,
          title: `${streakCount} days!`,
          subtitle: "You're building something real.",
          message: 'This is who you are now.',
          highlight: (
            <div className="flex items-center gap-2 text-yellow-500">
              <Calendar className="w-5 h-5" />
              <span className="font-bold">{streakCount}-day milestone</span>
            </div>
          ),
          accentColor: 'yellow',
        }

      default:
        return {
          icon: <CheckCircle className="w-12 h-12 text-blue-500" />,
          title: 'Session complete',
          subtitle: 'Good work.',
          message: null,
          highlight: null,
          accentColor: 'blue',
        }
    }
  }

  const content = getContent()

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Confetti effect (simple CSS animation) */}
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'][
                  Math.floor(Math.random() * 4)
                ],
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1 + Math.random()}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Close button */}
        <div className="absolute top-4 right-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center">
              {content.icon}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            {content.title}
          </h2>

          {/* Subtitle */}
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            {content.subtitle}
          </p>

          {/* Highlight (streak badge) */}
          {content.highlight && (
            <div className="mb-6 flex justify-center">
              <div className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-full">
                {content.highlight}
              </div>
            </div>
          )}

          {/* Stats (if available) */}
          {(sessionCount > 1 || studyMinutes > 0) && (
            <div className="flex justify-center gap-6 mb-6 text-sm text-neutral-500 dark:text-neutral-400">
              {sessionCount > 1 && (
                <div>
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    {sessionCount}
                  </span>{' '}
                  sessions
                </div>
              )}
              {studyMinutes > 0 && (
                <div>
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    {studyMinutes}
                  </span>{' '}
                  min studied
                </div>
              )}
            </div>
          )}

          {/* Message */}
          {content.message && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
              {content.message}
            </p>
          )}

          {/* Action */}
          <button
            onClick={onClose}
            className="w-full py-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2"
          >
            <span>Got it</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CSS for confetti animation */}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 2s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
