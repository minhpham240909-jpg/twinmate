'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Star, Clock, Trophy, Sparkles, X } from 'lucide-react'

interface SessionCelebrationProps {
  isOpen: boolean
  onClose: () => void
  sessionData: {
    duration: number // in minutes
    type: 'quick_focus' | 'solo_study' | 'ai_partner' | 'study_session'
    pointsEarned?: number
    streakDay?: number
    isNewStreak?: boolean
  }
}

const celebrationMessages = [
  "Amazing work! 🎉",
  "You crushed it! 💪",
  "Fantastic session! ⭐",
  "Keep it up! 🚀",
  "Great progress! 📈",
  "Well done! 🏆",
]

const getSessionTypeLabel = (type: string) => {
  switch (type) {
    case 'quick_focus': return 'Quick Focus'
    case 'solo_study': return 'Solo Study'
    case 'ai_partner': return 'AI Partner Session'
    case 'study_session': return 'Study Session'
    default: return 'Study Session'
  }
}

export default function SessionCelebration({ isOpen, onClose, sessionData }: SessionCelebrationProps) {
  const router = useRouter()
  const [showConfetti, setShowConfetti] = useState(false)
  const [randomMessage] = useState(() =>
    celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)]
  )

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isOpen) return null

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Confetti effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'][i % 7],
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <div className="relative bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5 text-neutral-500" />
        </button>

        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8 text-center text-white">
          <div className="relative">
            <Sparkles className="w-16 h-16 mx-auto mb-4 animate-pulse" />
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center animate-bounce">
              <Star className="w-4 h-4 text-yellow-800" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">{randomMessage}</h2>
          <p className="text-white/80 text-sm">{getSessionTypeLabel(sessionData.type)} Complete</p>
        </div>

        {/* Stats */}
        <div className="p-6 space-y-4">
          {/* Duration */}
          <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Time Studied</p>
                <p className="font-bold text-neutral-900 dark:text-white">{formatDuration(sessionData.duration)}</p>
              </div>
            </div>
          </div>

          {/* Points Earned */}
          {sessionData.pointsEarned && sessionData.pointsEarned > 0 && (
            <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <Star className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Points Earned</p>
                  <p className="font-bold text-neutral-900 dark:text-white">+{sessionData.pointsEarned}</p>
                </div>
              </div>
              <span className="text-2xl">⭐</span>
            </div>
          )}

          {/* Streak */}
          {sessionData.streakDay && sessionData.streakDay > 0 && (
            <div className={`flex items-center justify-between p-4 rounded-xl ${sessionData.isNewStreak ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800' : 'bg-neutral-50 dark:bg-neutral-800'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${sessionData.isNewStreak ? 'bg-gradient-to-br from-orange-400 to-amber-500' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                  <Flame className={`w-5 h-5 ${sessionData.isNewStreak ? 'text-white' : 'text-orange-600 dark:text-orange-400'}`} />
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {sessionData.isNewStreak ? 'New Streak Day!' : 'Current Streak'}
                  </p>
                  <p className="font-bold text-neutral-900 dark:text-white">{sessionData.streakDay} day{sessionData.streakDay !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {sessionData.isNewStreak && <span className="text-2xl">🔥</span>}
            </div>
          )}

          {/* Milestone Achievement */}
          {sessionData.duration >= 60 && (
            <div className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
              <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                1+ Hour Achievement Unlocked!
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="p-6 pt-0 space-y-3">
          <button
            onClick={() => {
              onClose()
              router.push('/dashboard')
            }}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all"
          >
            Back to Dashboard
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            Start Another Session
          </button>
        </div>
      </div>

      {/* CSS for confetti animation */}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
