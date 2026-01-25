'use client'

/**
 * ENFORCEMENT BANNER
 *
 * Displays authority messages and enforcement status at the top of the dashboard.
 * Shows:
 * - Study debt status
 * - Streak warnings
 * - Pending actions
 * - Remediation requirements
 *
 * Features:
 * - Real-time updates via Supabase subscriptions
 * - Error state display with retry
 * - Graceful degradation
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { AlertTriangle, Clock, Flame, XCircle, ChevronRight, RefreshCw, WifiOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface EnforcementState {
  identity: {
    archetype: string | null
    currentStreak: number
    longestStreak: number
    totalMissionsCompleted: number
    daysSinceLastMission: number
  } | null
  pendingActions: Array<{
    id: string
    type: string
    message: string | null
    acknowledged: boolean
  }>
  debt: {
    totalMinutes: number
    message: string
    tone: 'encouragement' | 'warning' | 'consequence' | 'neutral'
  }
  streak: {
    current: number
    atRisk: boolean
    message: string | null
  }
  inactivityAlert: {
    message: string
    tone: 'warning' | 'consequence' | 'neutral'
    actionRequired?: string
  } | null
}

interface EnforcementBannerProps {
  className?: string
  onActionClick?: (actionId: string) => void
  onViewDebt?: () => void
}

export function EnforcementBanner({
  className = '',
  onActionClick,
  onViewDebt,
}: EnforcementBannerProps) {
  const [state, setState] = useState<EnforcementState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [retrying, setRetrying] = useState(false)
  const subscriptionRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchState = useCallback(async (isRetry = false) => {
    if (isRetry) setRetrying(true)
    setError(null)

    try {
      const response = await fetch('/api/enforcement/state')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setState(data.state)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch enforcement state:', err)
      setError('Unable to load enforcement status')
    } finally {
      setLoading(false)
      setRetrying(false)
    }
  }, [])

  // Setup real-time subscription for instant updates
  useEffect(() => {
    const supabase = createClient()

    // Initial fetch
    fetchState()

    // Subscribe to enforcement-related table changes for this user
    const channel = supabase
      .channel('enforcement-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'EnforcementAction',
        },
        () => {
          // Refetch when enforcement actions change
          fetchState()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'StudyDebt',
        },
        () => {
          // Refetch when study debt changes
          fetchState()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'LearnerIdentity',
        },
        () => {
          // Refetch when identity changes (streak updates)
          fetchState()
        }
      )
      .subscribe()

    subscriptionRef.current = channel

    // Fallback polling every 60 seconds (reduced from 30 since we have real-time)
    const interval = setInterval(fetchState, 60000)

    return () => {
      clearInterval(interval)
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
    }
  }, [fetchState])

  const dismissAction = (actionId: string) => {
    setDismissed(prev => new Set([...prev, actionId]))
  }

  if (loading) {
    return null
  }

  // Show error state with retry button
  if (error && !state) {
    return (
      <div className={`${className}`}>
        <div className="rounded-lg border bg-zinc-800/50 border-zinc-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-zinc-400">
            <WifiOff className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={() => fetchState(true)}
            disabled={retrying}
            className="text-zinc-400 hover:text-white text-sm font-medium flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      </div>
    )
  }

  if (!state) {
    return null
  }

  // Determine what to show
  const showDebtWarning = state.debt.totalMinutes > 0 && state.debt.tone !== 'neutral'
  const showStreakWarning = state.streak.atRisk
  const showInactivityAlert = state.inactivityAlert !== null
  const urgentActions = state.pendingActions.filter(
    a => !a.acknowledged && !dismissed.has(a.id)
  )

  // If nothing to show, return null
  if (!showDebtWarning && !showStreakWarning && !showInactivityAlert && urgentActions.length === 0) {
    return null
  }

  const getToneStyles = (tone: string) => {
    switch (tone) {
      case 'consequence':
        return 'bg-red-500/10 border-red-500/30 text-red-400'
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400'
      case 'encouragement':
        return 'bg-green-500/10 border-green-500/30 text-green-400'
      default:
        return 'bg-zinc-800/50 border-zinc-700 text-zinc-300'
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Inactivity Alert - Highest Priority */}
      {showInactivityAlert && state.inactivityAlert && (
        <div
          className={`rounded-lg border px-4 py-3 flex items-center justify-between ${getToneStyles(
            state.inactivityAlert.tone
          )}`}
        >
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">{state.inactivityAlert.message}</p>
              {state.inactivityAlert.actionRequired && (
                <p className="text-sm opacity-80">{state.inactivityAlert.actionRequired}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Urgent Actions */}
      {urgentActions.map(action => (
        <div
          key={action.id}
          className="rounded-lg border bg-amber-500/10 border-amber-500/30 px-4 py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-400">{action.type.replace(/_/g, ' ')}</p>
              {action.message && (
                <p className="text-sm text-amber-300/80">{action.message}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onActionClick && (
              <button
                onClick={() => onActionClick(action.id)}
                className="text-amber-400 hover:text-amber-300 text-sm font-medium flex items-center gap-1"
              >
                Address <ChevronRight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => dismissAction(action.id)}
              className="text-amber-400/50 hover:text-amber-400"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}

      {/* Streak Warning */}
      {showStreakWarning && !showInactivityAlert && (
        <div
          className={`rounded-lg border px-4 py-3 flex items-center justify-between ${getToneStyles(
            'warning'
          )}`}
        >
          <div className="flex items-center gap-3">
            <Flame className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">
                {state.streak.current} day streak at risk
              </p>
              {state.streak.message && (
                <p className="text-sm opacity-80">{state.streak.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Study Debt Warning */}
      {showDebtWarning && (
        <div
          className={`rounded-lg border px-4 py-3 flex items-center justify-between ${getToneStyles(
            state.debt.tone
          )}`}
        >
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">{state.debt.totalMinutes} minutes of study debt</p>
              <p className="text-sm opacity-80">{state.debt.message}</p>
            </div>
          </div>
          {onViewDebt && (
            <button
              onClick={onViewDebt}
              className="text-sm font-medium flex items-center gap-1 hover:opacity-80"
            >
              View <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default EnforcementBanner
