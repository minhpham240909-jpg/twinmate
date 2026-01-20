'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Clock, 
  Play, 
  Check, 
  Heart, 
  Trash2, 
  Plus,
  AlertCircle,
  TrendingUp,
  ChevronRight,
  Flame
} from 'lucide-react'

interface StudyDebt {
  id: string
  title: string
  description?: string
  debtMinutes: number
  paidMinutes: number
  progressPercent: number
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FORGIVEN' | 'EXPIRED'
  source: string
  subject?: string
  priority: number
  createdAt: string
}

interface DebtSummary {
  totalQueuedMinutes: number
  totalPaidMinutes: number
  queuedCount: number
  inProgressCount: number
  completedCount: number
  overallProgress: number
}

/**
 * StudyDebtProgressBar - Visual progress bar for study debt
 * Shows overall debt repayment progress with encouraging messaging
 */
export function StudyDebtProgressBar({
  summary,
  className = '',
}: {
  summary: DebtSummary | null
  className?: string
}) {
  if (!summary) return null

  const totalDebt = summary.totalQueuedMinutes
  const paidOff = summary.totalPaidMinutes
  const remaining = Math.max(totalDebt - paidOff, 0)
  const progress = summary.overallProgress

  // Encouraging message based on progress
  const getMessage = () => {
    if (totalDebt === 0) return 'No study debt! You\'re all caught up 🎉'
    if (progress >= 100) return 'All debt paid off! Amazing work! 🏆'
    if (progress >= 75) return 'Almost there! Keep pushing! 💪'
    if (progress >= 50) return 'Halfway done! Great progress! 🌟'
    if (progress >= 25) return 'Making progress! Every minute counts! ✨'
    return 'One step at a time. You\'ve got this! 🚀'
  }

  // Format minutes to hours/mins display
  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const minutes = mins % 60
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  return (
    <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="font-bold text-neutral-900 dark:text-white">Study Debt</h3>
            <p className="text-sm text-neutral-500">{getMessage()}</p>
          </div>
        </div>
        {totalDebt > 0 && (
          <span className="text-2xl font-bold text-neutral-900 dark:text-white">
            {progress}%
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {totalDebt > 0 && (
        <>
          <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500 relative"
              style={{ width: `${progress}%` }}
            >
              {progress >= 10 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{formatTime(paidOff)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between text-xs text-neutral-500">
            <span>{formatTime(paidOff)} paid</span>
            <span>{formatTime(remaining)} remaining</span>
          </div>

          {/* Quick Stats */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex-1 text-center">
              <p className="text-lg font-bold text-neutral-900 dark:text-white">{summary.queuedCount}</p>
              <p className="text-xs text-neutral-500">Queued</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-lg font-bold text-blue-600">{summary.inProgressCount}</p>
              <p className="text-xs text-neutral-500">In Progress</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-lg font-bold text-green-600">{summary.completedCount}</p>
              <p className="text-xs text-neutral-500">Completed</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * StudyDebtQueue - Full queue view with debt items
 */
export function StudyDebtQueue({ className = '' }: { className?: string }) {
  const [debts, setDebts] = useState<StudyDebt[]>([])
  const [summary, setSummary] = useState<DebtSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  const fetchDebts = useCallback(async () => {
    try {
      const response = await fetch('/api/study-debt')
      if (response.ok) {
        const data = await response.json()
        setDebts(data.debts || [])
        setSummary(data.summary || null)
      }
    } catch (error) {
      console.error('Failed to fetch debts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDebts()
  }, [fetchDebts])

  const handleAction = async (debtId: string, action: string, minutes?: number) => {
    try {
      const response = await fetch(`/api/study-debt/${debtId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, minutes }),
      })
      if (response.ok) {
        fetchDebts()
      }
    } catch (error) {
      console.error('Failed to update debt:', error)
    }
  }

  const handleDelete = async (debtId: string) => {
    if (!confirm('Remove this from your debt queue?')) return
    try {
      const response = await fetch(`/api/study-debt/${debtId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchDebts()
      }
    } catch (error) {
      console.error('Failed to delete debt:', error)
    }
  }

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'MISSED_SESSION': return 'Missed session'
      case 'BROKEN_STREAK': return 'Broken streak'
      case 'INCOMPLETE_GOAL': return 'Incomplete goal'
      case 'SELF_ADDED': return 'Self-added'
      case 'COURSE_ASSIGNMENT': return 'Course'
      default: return source
    }
  }

  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const minutes = mins % 60
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  if (loading) {
    return (
      <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Progress Bar */}
      <StudyDebtProgressBar summary={summary} />

      {/* Debt Queue */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <h3 className="font-bold text-neutral-900 dark:text-white">Debt Queue</h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Debt
          </button>
        </div>

        {debts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 font-medium">No study debt!</p>
            <p className="text-sm text-neutral-500 mt-1">You&apos;re all caught up. Keep it going!</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {debts.map(debt => (
              <div key={debt.id} className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    debt.status === 'IN_PROGRESS' 
                      ? 'bg-blue-100 dark:bg-blue-900/30' 
                      : 'bg-neutral-100 dark:bg-neutral-800'
                  }`}>
                    {debt.status === 'IN_PROGRESS' ? (
                      <Flame className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-neutral-500" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-neutral-900 dark:text-white truncate">
                        {debt.title}
                      </h4>
                      <span className="text-xs px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-500">
                        {getSourceLabel(debt.source)}
                      </span>
                    </div>

                    {debt.subject && (
                      <p className="text-sm text-neutral-500 mb-2">{debt.subject}</p>
                    )}

                    {/* Mini Progress Bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            debt.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-neutral-300 dark:bg-neutral-600'
                          }`}
                          style={{ width: `${debt.progressPercent}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                        {formatTime(debt.paidMinutes)} / {formatTime(debt.debtMinutes)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {debt.status === 'QUEUED' && (
                      <button
                        onClick={() => handleAction(debt.id, 'start')}
                        className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 transition-colors"
                        title="Start"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {debt.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => {
                          const mins = prompt('How many minutes did you study?', '15')
                          if (mins && !isNaN(parseInt(mins))) {
                            handleAction(debt.id, 'log_time', parseInt(mins))
                          }
                        }}
                        className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400 transition-colors"
                        title="Log time"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleAction(debt.id, 'forgive')}
                      className="p-2 hover:bg-pink-100 dark:hover:bg-pink-900/30 rounded-lg text-pink-600 dark:text-pink-400 transition-colors"
                      title="Forgive"
                    >
                      <Heart className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(debt.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Debt Modal */}
      {showAddModal && (
        <AddDebtModal onClose={() => setShowAddModal(false)} onAdded={fetchDebts} />
      )}
    </div>
  )
}

/**
 * AddDebtModal - Modal for adding new study debt
 */
function AddDebtModal({ 
  onClose, 
  onAdded 
}: { 
  onClose: () => void
  onAdded: () => void 
}) {
  const [title, setTitle] = useState('')
  const [debtMinutes, setDebtMinutes] = useState(30)
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/study-debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          debtMinutes,
          source: 'SELF_ADDED',
          subject: subject.trim() || undefined,
        }),
      })

      if (response.ok) {
        onAdded()
        onClose()
      }
    } catch (error) {
      console.error('Failed to add debt:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-md w-full shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-4">Add Study Debt</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              What do you owe?
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Review Chapter 5 notes"
              className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Study time to pay back (minutes)
            </label>
            <input
              type="number"
              value={debtMinutes}
              onChange={e => setDebtMinutes(parseInt(e.target.value) || 30)}
              min={5}
              max={480}
              className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Subject (optional)
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g., Mathematics"
              className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add to Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StudyDebtQueue
