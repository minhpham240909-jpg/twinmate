'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Star, Send, Loader2, MessageSquare, Clock, Brain } from 'lucide-react'

interface EndSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onEnd: (rating?: number, feedback?: string) => Promise<void>
  sessionStats?: {
    duration: number
    messageCount: number
    quizCount: number
  }
}

export default function EndSessionModal({
  isOpen,
  onClose,
  onEnd,
  sessionStats,
}: EndSessionModalProps) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleEnd = async () => {
    setIsLoading(true)
    try {
      await onEnd(rating || undefined, feedback || undefined)
      onClose()
    } catch (error) {
      console.error('Failed to end session:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins} minutes`
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-slate-900 rounded-3xl max-w-md w-full border border-slate-700/50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-700/50">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">End Study Session</h2>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Stats */}
            {sessionStats && (
              <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700/50">
                <p className="text-sm text-slate-400 mb-3">Session Summary</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                      <Clock className="w-4 h-4" />
                    </div>
                    <p className="text-lg font-bold text-white">
                      {formatDuration(sessionStats.duration)}
                    </p>
                    <p className="text-xs text-slate-500">Duration</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <p className="text-lg font-bold text-white">
                      {sessionStats.messageCount}
                    </p>
                    <p className="text-xs text-slate-500">Messages</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                      <Brain className="w-4 h-4" />
                    </div>
                    <p className="text-lg font-bold text-white">
                      {sessionStats.quizCount}
                    </p>
                    <p className="text-xs text-slate-500">Quizzes</p>
                  </div>
                </div>
              </div>
            )}

            {/* Rating */}
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-300 mb-3">
                  How was your AI study partner?
                </p>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          star <= (hoveredRating || rating)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-center text-sm text-slate-400 mt-2">
                    {rating === 5
                      ? 'Excellent! 🎉'
                      : rating === 4
                      ? 'Great!'
                      : rating === 3
                      ? 'Good'
                      : rating === 2
                      ? 'Could be better'
                      : 'Needs improvement'}
                  </p>
                )}
              </div>

              {/* Feedback */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">
                  Any feedback? (optional)
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What went well? What could be improved?"
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-700/50 bg-slate-800/30">
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  Continue Studying
                </button>
                <button
                  onClick={handleEnd}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Ending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      End Session
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
