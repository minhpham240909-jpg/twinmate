'use client'

/**
 * GOAL CELEBRATION MODAL
 *
 * Shows when user hits their daily learning goal.
 * Features:
 * - Animated celebration
 * - Streak display
 * - Weekly progress
 * - Option to keep going or finish
 */

import { memo, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Target,
  Flame,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Calendar,
  CheckCircle2,
} from 'lucide-react'

interface GoalCelebrationProps {
  isOpen: boolean
  onClose: () => void
  onKeepGoing: () => void
  targetMinutes: number
  actualMinutes: number
  currentStreak: number
  weekDaysCompleted: number
  xpEarned: number
  bonusXp?: number
}

export const GoalCelebration = memo(function GoalCelebration({
  isOpen,
  onClose,
  onKeepGoing,
  targetMinutes,
  actualMinutes,
  currentStreak,
  weekDaysCompleted,
  xpEarned,
  bonusXp = 0,
}: GoalCelebrationProps) {
  const [mounted, setMounted] = useState(false)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      // Delay content animation
      const timer = setTimeout(() => setShowContent(true), 100)
      return () => clearTimeout(timer)
    } else {
      setShowContent(false)
    }
  }, [isOpen])

  if (!mounted || !isOpen) return null

  const totalXp = xpEarned + bonusXp

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-sm bg-gradient-to-b from-blue-600 to-indigo-700 rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-500 ${
          showContent ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        {/* Confetti background effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][i % 5],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative p-8 text-center text-white">
          {/* Sparkle icon */}
          <div className="mb-4 inline-flex">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                <Target className="w-10 h-10 text-white" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-300 animate-bounce" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold mb-2">Daily Goal Hit!</h2>

          {/* Time display */}
          <div className="mb-6">
            <div className="text-5xl font-bold mb-1">
              {actualMinutes}/{targetMinutes}
            </div>
            <div className="text-white/80 text-sm">minutes completed</div>
          </div>

          {/* Stats row */}
          <div className="flex justify-center gap-6 mb-8">
            {/* Streak */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-orange-300 mb-1">
                <Flame className="w-5 h-5" />
                <span className="text-2xl font-bold">{currentStreak}</span>
              </div>
              <div className="text-xs text-white/70">day streak</div>
            </div>

            {/* Week progress */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-green-300 mb-1">
                <Calendar className="w-5 h-5" />
                <span className="text-2xl font-bold">{weekDaysCompleted}/7</span>
              </div>
              <div className="text-xs text-white/70">this week</div>
            </div>

            {/* XP earned */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-yellow-300 mb-1">
                <TrendingUp className="w-5 h-5" />
                <span className="text-2xl font-bold">+{totalXp}</span>
              </div>
              <div className="text-xs text-white/70">XP earned</div>
            </div>
          </div>

          {/* Bonus message */}
          {bonusXp > 0 && (
            <div className="mb-6 px-4 py-2 bg-yellow-500/20 rounded-xl inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-yellow-300" />
              <span className="text-sm text-yellow-200">
                +{bonusXp} streak bonus!
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onKeepGoing}
              className="w-full py-4 bg-white text-blue-600 font-semibold rounded-2xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
            >
              Keep Going
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 bg-white/10 text-white font-medium rounded-2xl hover:bg-white/20 transition-colors"
            >
              Done for Today
            </button>
          </div>
        </div>
      </div>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
            opacity: 0.5;
          }
        }
        .animate-float {
          animation: float ease-in-out infinite;
        }
      `}</style>
    </div>,
    document.body
  )
})

export default GoalCelebration
