'use client'

/**
 * STUDY DEBT PANEL
 *
 * Displays and manages study debt.
 * Shows:
 * - Total debt owed
 * - Individual debt items
 * - Progress on paying back debt
 */

import { useEffect, useState, useCallback } from 'react'
import { Clock, CheckCircle, AlertTriangle, X } from 'lucide-react'

interface DebtItem {
  id: string
  title: string
  description: string | null
  source: string
  status: string
  debtMinutes: number
  paidMinutes: number
  progressPercent: number
  subject: string | null
  priority: number
  expiresAt: string | null
  createdAt: string
}

interface DebtState {
  totalOwed: number
  totalPaid: number
  totalRemaining: number
  itemCount: number
  items: DebtItem[]
  message: string
  tone: 'encouragement' | 'warning' | 'consequence' | 'neutral'
}

interface StudyDebtPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function StudyDebtPanel({ isOpen, onClose }: StudyDebtPanelProps) {
  const [debt, setDebt] = useState<DebtState | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDebt = useCallback(async () => {
    try {
      const response = await fetch('/api/enforcement/debt')
      if (response.ok) {
        const data = await response.json()
        setDebt(data.debt)
      }
    } catch (error) {
      console.error('Failed to fetch study debt:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchDebt()
    }
  }, [isOpen, fetchDebt])

  if (!isOpen) return null

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'MISSED_SESSION':
        return 'Missed Session'
      case 'BROKEN_STREAK':
        return 'Broken Streak'
      case 'INCOMPLETE_GOAL':
        return 'Incomplete Goal'
      case 'SELF_ADDED':
        return 'Self Added'
      default:
        return source
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'MISSED_SESSION':
        return 'bg-amber-500/20 text-amber-400'
      case 'BROKEN_STREAK':
        return 'bg-red-500/20 text-red-400'
      case 'INCOMPLETE_GOAL':
        return 'bg-orange-500/20 text-orange-400'
      default:
        return 'bg-zinc-500/20 text-zinc-400'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Study Debt</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : debt ? (
            <>
              {/* Summary */}
              <div className="mb-6 p-4 rounded-lg bg-zinc-800/50">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-white">{debt.totalRemaining}</p>
                    <p className="text-xs text-zinc-400">Minutes Owed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-400">{debt.totalPaid}</p>
                    <p className="text-xs text-zinc-400">Minutes Paid</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-400">{debt.itemCount}</p>
                    <p className="text-xs text-zinc-400">Debts</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-center text-zinc-300">{debt.message}</p>
              </div>

              {/* Debt Items */}
              {debt.items.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-zinc-300">No study debt. Clean slate.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {debt.items.map(item => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border border-zinc-800 bg-zinc-800/30"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium text-white">{item.title}</h3>
                          {item.description && (
                            <p className="text-sm text-zinc-400 mt-1">{item.description}</p>
                          )}
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${getSourceColor(
                            item.source
                          )}`}
                        >
                          {getSourceLabel(item.source)}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-zinc-400 mb-1">
                          <span>{item.paidMinutes}/{item.debtMinutes} minutes</span>
                          <span>{Math.round(item.progressPercent)}%</span>
                        </div>
                        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
                            style={{ width: `${item.progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Expiry warning */}
                      {item.expiresAt && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          <span>
                            Expires {new Date(item.expiresAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Info */}
              <div className="mt-6 p-4 rounded-lg bg-zinc-800/30 border border-zinc-700">
                <p className="text-sm text-zinc-400">
                  Study debt is paid automatically when you study. Each minute you spend learning
                  reduces your debt. Complete missions to clear your debt faster.
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-zinc-400">
              Failed to load debt information
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StudyDebtPanel
