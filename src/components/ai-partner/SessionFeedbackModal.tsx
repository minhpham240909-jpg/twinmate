'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Star, Sparkles, Clock, MessageSquare, CheckCircle, Loader2 } from 'lucide-react'

interface SessionFeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (rating: number | null, feedback: string | null) => Promise<void>
  sessionStats: {
    focusTime: number // in seconds
    messageCount: number
    subject?: string | null
  }
}

export default function SessionFeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  sessionStats,
}: SessionFeedbackModalProps) {
  const [rating, setRating] = useState<number | null>(null)
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    if (mins < 60) {
      return `${mins} minute${mins !== 1 ? 's' : ''}`
    }
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours}h ${remainingMins}m`
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onSubmit(rating, feedback.trim() || null)
      setHasSubmitted(true)
      // Auto close after success
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = async () => {
    setIsSubmitting(true)
    try {
      await onSubmit(null, null)
      onClose()
    } catch (error) {
      console.error('Failed to skip feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        >
          {hasSubmitted ? (
            // Success State
            <div className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle className="w-8 h-8 text-green-400" />
              </motion.div>
              <h3 className="text-xl font-semibold text-white mb-2">Thank you!</h3>
              <p className="text-slate-400">Your feedback helps us improve.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="relative bg-gradient-to-r from-blue-600/20 to-purple-600/20 px-6 py-8 text-center border-b border-slate-700/50">
                <button
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>

                <motion.div
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Great Study Session!
                  </h2>
                  <p className="text-slate-300">
                    Thank you for studying with our AI Partner
                  </p>
                </motion.div>
              </div>

              {/* Stats */}
              <div className="px-6 py-4 border-b border-slate-700/50">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                    <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                    <p className="text-lg font-semibold text-white">
                      {formatTime(sessionStats.focusTime)}
                    </p>
                    <p className="text-xs text-slate-400">Focus Time</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                    <MessageSquare className="w-5 h-5 text-green-400 mx-auto mb-1" />
                    <p className="text-lg font-semibold text-white">
                      {sessionStats.messageCount}
                    </p>
                    <p className="text-xs text-slate-400">Messages</p>
                  </div>
                </div>
                {sessionStats.subject && (
                  <p className="text-center text-sm text-slate-400 mt-3">
                    Subject: <span className="text-slate-300">{sessionStats.subject}</span>
                  </p>
                )}
              </div>

              {/* Rating */}
              <div className="px-6 py-4 border-b border-slate-700/50">
                <p className="text-sm text-slate-300 text-center mb-3">
                  How was your experience? (Optional)
                </p>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(null)}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          star <= (hoveredRating ?? rating ?? 0)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {rating && (
                  <p className="text-center text-xs text-slate-400 mt-2">
                    {rating === 5
                      ? 'Excellent!'
                      : rating === 4
                      ? 'Great!'
                      : rating === 3
                      ? 'Good'
                      : rating === 2
                      ? 'Fair'
                      : 'Poor'}
                  </p>
                )}
              </div>

              {/* Feedback */}
              <div className="px-6 py-4">
                <label className="block text-sm text-slate-300 mb-2">
                  Any feedback? (Optional)
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us what you liked or how we can improve..."
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-slate-500 text-right mt-1">
                  {feedback.length}/500
                </p>
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Skip
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Submit'
                  )}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
