'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Timer, Play, X, AlertCircle, Zap } from 'lucide-react'

interface StartTimerPromptModalProps {
  isOpen: boolean
  onClose: () => void
  onStartTimer: () => void
}

/**
 * Modal prompting users to start the Pomodoro timer before using AI features.
 * Shown when users try to send messages, generate quizzes, use flashcards, or whiteboard
 * without first starting the timer.
 */
export default function StartTimerPromptModal({
  isOpen,
  onClose,
  onStartTimer,
}: StartTimerPromptModalProps) {
  const handleStartTimer = () => {
    onStartTimer()
    onClose()
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
            <div className="relative bg-gradient-to-r from-blue-600/20 to-amber-600/20 p-6 border-b border-slate-700/50">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-amber-500 flex items-center justify-center">
                  <Timer className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Start the Timer First
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Begin your focused study session
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Info Banner */}
              <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-200 font-medium">
                    Why start the timer?
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    The Pomodoro timer helps you stay focused and tracks your actual study time.
                    This helps you understand how much time you spend learning.
                  </p>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Stay Focused</p>
                    <p className="text-slate-400 text-xs">25-minute study blocks with 5-minute breaks</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Timer className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Track Your Time</p>
                    <p className="text-slate-400 text-xs">See how much time you actually spend studying</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-700/50 bg-slate-800/30">
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors"
                >
                  Maybe Later
                </button>
                <button
                  onClick={handleStartTimer}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Start Timer
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
