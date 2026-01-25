'use client'

/**
 * REMEDIATION MODAL
 *
 * Displays when user needs to complete remediation before continuing.
 * Cannot be dismissed until remediation is complete.
 */

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, Clock, CheckCircle, BookOpen, Target } from 'lucide-react'

interface RemediationMission {
  id: string
  type: 'SKILL_GAP' | 'PATTERN_FIX' | 'CONCEPT_REVIEW'
  title: string
  directive: string
  context: string
  estimatedMinutes: number
  proofRequired: 'explanation' | 'quiz' | 'practice'
  criteria: {
    type: string
    threshold?: number
    description: string
  }
  mandatory: boolean
  linkedWeakSpot?: {
    id: string
    topic: string
    failedAttempts: number
  }
}

interface RemediationModalProps {
  onComplete?: () => void
}

export function RemediationModal({ onComplete }: RemediationModalProps) {
  const [missions, setMissions] = useState<RemediationMission[]>([])
  const [currentMission, setCurrentMission] = useState<RemediationMission | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [proofContent, setProofContent] = useState('')
  const [quizScore, setQuizScore] = useState<number>(0)
  const [result, setResult] = useState<{ passed: boolean; feedback: string } | null>(null)

  const fetchRemediation = useCallback(async () => {
    try {
      const response = await fetch('/api/enforcement/remediation')
      if (response.ok) {
        const data = await response.json()
        if (data.remediation.required) {
          setMissions(data.remediation.missions)
          setCurrentMission(data.remediation.missions[0] || null)
        } else {
          // No remediation required
          setMissions([])
          setCurrentMission(null)
          onComplete?.()
        }
      }
    } catch (error) {
      console.error('Failed to fetch remediation:', error)
    } finally {
      setLoading(false)
    }
  }, [onComplete])

  useEffect(() => {
    fetchRemediation()
  }, [fetchRemediation])

  const submitProof = async () => {
    if (!currentMission) return

    setSubmitting(true)
    setResult(null)

    try {
      const proof = {
        type: currentMission.proofRequired,
        content: proofContent,
        score: currentMission.proofRequired === 'quiz' ? quizScore : undefined,
      }

      const response = await fetch('/api/enforcement/remediation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionId: currentMission.id,
          proof,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setResult(data.result)

        if (data.result.passed) {
          // Move to next mission or complete
          if (!data.remainingRemediation.required) {
            setTimeout(() => {
              onComplete?.()
            }, 2000)
          } else {
            // Refresh to get remaining missions
            setTimeout(() => {
              setProofContent('')
              setQuizScore(0)
              setResult(null)
              fetchRemediation()
            }, 2000)
          }
        }
      }
    } catch (error) {
      console.error('Failed to submit remediation:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Don't render if no remediation needed
  if (!loading && missions.length === 0) {
    return null
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'SKILL_GAP':
        return <Target className="w-6 h-6" />
      case 'CONCEPT_REVIEW':
        return <BookOpen className="w-6 h-6" />
      default:
        return <AlertTriangle className="w-6 h-6" />
    }
  }

  const getProofPlaceholder = (proofType: string) => {
    switch (proofType) {
      case 'explanation':
        return 'Explain the concept in your own words. Show that you understand it by describing how it works, when to use it, and common pitfalls to avoid...'
      case 'practice':
        return 'Describe how you completed the practice. What did you do? What did you learn? Share your solution or approach...'
      case 'quiz':
        return 'Enter your quiz answers or describe your quiz performance...'
      default:
        return 'Provide proof of your understanding...'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-zinc-900 border border-red-500/30 rounded-xl shadow-2xl max-h-[90vh] overflow-hidden">
        {/* Header - Cannot dismiss */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-red-500/10">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Remediation Required</h2>
              <p className="text-sm text-red-300">
                Complete this before continuing with your roadmap
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : currentMission ? (
            <div className="space-y-6">
              {/* Mission Header */}
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-red-500/10 text-red-400">
                  {getTypeIcon(currentMission.type)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{currentMission.title}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      ~{currentMission.estimatedMinutes} min
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {currentMission.proofRequired}
                    </span>
                  </div>
                </div>
              </div>

              {/* Directive */}
              <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <p className="text-white font-medium">{currentMission.directive}</p>
                {currentMission.context && (
                  <p className="mt-2 text-sm text-zinc-400">{currentMission.context}</p>
                )}
              </div>

              {/* Criteria */}
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <h4 className="font-medium text-amber-400 mb-2">Success Criteria</h4>
                <p className="text-sm text-amber-200">{currentMission.criteria.description}</p>
              </div>

              {/* Linked Weak Spot */}
              {currentMission.linkedWeakSpot && (
                <div className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-700">
                  <h4 className="font-medium text-zinc-300 mb-1">Related Weak Spot</h4>
                  <p className="text-white">{currentMission.linkedWeakSpot.topic}</p>
                  <p className="text-sm text-zinc-400 mt-1">
                    Failed {currentMission.linkedWeakSpot.failedAttempts} time(s)
                  </p>
                </div>
              )}

              {/* Result Display */}
              {result && (
                <div
                  className={`p-4 rounded-lg border ${
                    result.passed
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {result.passed ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    )}
                    <span
                      className={`font-medium ${
                        result.passed ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {result.passed ? 'Passed' : 'Not Sufficient'}
                    </span>
                  </div>
                  <p
                    className={`text-sm ${
                      result.passed ? 'text-green-300' : 'text-red-300'
                    }`}
                  >
                    {result.feedback}
                  </p>
                </div>
              )}

              {/* Proof Input */}
              {!result?.passed && (
                <>
                  {currentMission.proofRequired === 'quiz' && (
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Quiz Score (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={quizScore}
                        onChange={e => setQuizScore(Number(e.target.value))}
                        className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                        placeholder="Enter your quiz score (0-100)"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      {currentMission.proofRequired === 'explanation'
                        ? 'Your Explanation'
                        : currentMission.proofRequired === 'practice'
                        ? 'Practice Summary'
                        : 'Your Response'}
                    </label>
                    <textarea
                      value={proofContent}
                      onChange={e => setProofContent(e.target.value)}
                      rows={6}
                      className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                      placeholder={getProofPlaceholder(currentMission.proofRequired)}
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      Minimum 100 characters for explanations
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={submitProof}
                    disabled={
                      submitting ||
                      (currentMission.proofRequired === 'explanation' &&
                        proofContent.length < 100)
                    }
                    className="w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-semibold transition-colors"
                  >
                    {submitting ? 'Submitting...' : 'Submit Proof'}
                  </button>
                </>
              )}

              {/* Progress indicator */}
              {missions.length > 1 && (
                <div className="pt-4 border-t border-zinc-800">
                  <p className="text-sm text-zinc-400 text-center">
                    Mission {missions.findIndex(m => m.id === currentMission.id) + 1} of{' '}
                    {missions.length}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-white font-medium">All remediation complete</p>
              <p className="text-zinc-400 text-sm mt-1">You may continue with your roadmap</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RemediationModal
