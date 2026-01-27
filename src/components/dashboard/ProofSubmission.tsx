'use client'

/**
 * Proof Submission Component
 * For completing missions with different proof types
 */

import { memo, useState } from 'react'
import {
  Loader2,
  ChevronLeft,
  Send,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import type { Mission } from '@/lib/mission-engine'

interface ProofSubmissionProps {
  mission: Mission
  onSubmit: (proof: { type: string; content: string; score?: number }) => void
  onBack: () => void
  isLoading: boolean
}

export const ProofSubmission = memo(function ProofSubmission({
  mission,
  onSubmit,
  onBack,
  isLoading,
}: ProofSubmissionProps) {
  const [content, setContent] = useState('')
  const [selfScore, setSelfScore] = useState<number | null>(null)

  const handleSubmit = () => {
    onSubmit({
      type: mission.proofRequired,
      content: content.trim(),
      score: selfScore || undefined,
    })
  }

  const isValid = content.trim().length >= 20 || mission.proofRequired === 'self_report'

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm">Back to mission</span>
      </button>

      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
          Submit Your Proof
        </h3>
        <p className="text-neutral-500 dark:text-neutral-400 mb-4">
          {mission.criteria.description}
        </p>

        {/* Different proof types */}
        {mission.proofRequired === 'explanation' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Explain in your own words
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Without looking at notes, explain the concept..."
              rows={5}
              disabled={isLoading}
              className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-blue-500 resize-none"
            />
            <p className="text-xs text-neutral-400">
              {content.length}/20 characters minimum
            </p>
          </div>
        )}

        {mission.proofRequired === 'self_report' && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Did you complete the mission requirements?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setContent('completed')}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  content === 'completed'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-2 border-green-500'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-2 border-transparent'
                }`}
              >
                <CheckCircle2 className="w-5 h-5 mx-auto mb-1" />
                Yes, completed
              </button>
              <button
                onClick={() => setContent('struggled')}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  content === 'struggled'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-2 border-amber-500'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-2 border-transparent'
                }`}
              >
                <AlertTriangle className="w-5 h-5 mx-auto mb-1" />
                I struggled
              </button>
            </div>
          </div>
        )}

        {mission.proofRequired === 'quiz' && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              What was your quiz score?
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={selfScore || ''}
                onChange={(e) => {
                  setSelfScore(Number(e.target.value))
                  setContent(`Score: ${e.target.value}%`)
                }}
                placeholder="0"
                className="w-20 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-center text-lg font-semibold"
              />
              <span className="text-lg font-semibold text-neutral-600 dark:text-neutral-400">%</span>
            </div>
            {mission.criteria.threshold && (
              <p className="text-xs text-neutral-500">
                Required: {mission.criteria.threshold}% or higher
              </p>
            )}
          </div>
        )}

        {mission.proofRequired === 'submission' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Submit your work
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe what you completed or paste your work..."
              rows={5}
              disabled={isLoading}
              className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-blue-500 resize-none"
            />
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          className="w-full mt-6 flex items-center justify-center gap-2 py-3.5 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Submit Proof</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
})
