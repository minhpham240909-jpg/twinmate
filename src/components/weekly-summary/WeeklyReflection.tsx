'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  BookOpen, 
  Clock, 
  Flame, 
  Target, 
  MessageSquare,
  ChevronRight,
  Star,
  Sparkles,
  Send
} from 'lucide-react'

interface WeeklySummary {
  id: string
  weekStart: string
  weekEnd: string
  year: number
  weekNumber: number
  totalStudyMinutes: number
  totalSessions: number
  streakAtWeekEnd: number
  streakMaintained: boolean
  goalMinutes?: number
  goalAchieved: boolean
  goalAchievementPercent: number
  topSubjects: string[]
  reflectionPrompt?: string
  reflectionResponse?: string
  reflectionCompletedAt?: string
  weekSatisfactionRating?: number
  nextWeekIntentions?: string
  isComplete: boolean
}

/**
 * WeeklyReflection - End-of-week reflection component
 * Displays weekly stats and prompts for reflection
 */
export function WeeklyReflection({ className = '' }: { className?: string }) {
  const [summary, setSummary] = useState<WeeklySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  // Reflection form state
  const [reflectionResponse, setReflectionResponse] = useState('')
  const [satisfactionRating, setSatisfactionRating] = useState(0)
  const [nextWeekIntentions, setNextWeekIntentions] = useState('')

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/weekly-summary?week=current')
      if (response.ok) {
        const data = await response.json()
        setSummary(data.summary)
        
        // Pre-fill if already started
        if (data.summary?.reflectionResponse) {
          setReflectionResponse(data.summary.reflectionResponse)
          setSatisfactionRating(data.summary.weekSatisfactionRating || 0)
          setNextWeekIntentions(data.summary.nextWeekIntentions || '')
        }
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reflectionResponse.trim() || reflectionResponse.length < 10) return

    setSubmitting(true)
    try {
      const response = await fetch('/api/weekly-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reflectionResponse: reflectionResponse.trim(),
          weekSatisfactionRating: satisfactionRating || undefined,
          nextWeekIntentions: nextWeekIntentions.trim() || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Failed to submit reflection:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const minutes = mins % 60
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`
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

  if (!summary) {
    return null
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Weekly Stats Card */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-neutral-900 dark:text-white">Week {summary.weekNumber}</h3>
            <p className="text-sm text-neutral-500">{formatDateRange(summary.weekStart, summary.weekEnd)}</p>
          </div>
          {summary.isComplete && (
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium rounded-full">
              Reflected ✓
            </span>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-neutral-900 dark:text-white">
              {formatTime(summary.totalStudyMinutes)}
            </p>
            <p className="text-xs text-neutral-500">Study Time</p>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
            <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-neutral-900 dark:text-white">
              {summary.totalSessions}
            </p>
            <p className="text-xs text-neutral-500">Sessions</p>
          </div>
          
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 text-center">
            <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-neutral-900 dark:text-white">
              {summary.streakAtWeekEnd}
            </p>
            <p className="text-xs text-neutral-500">Streak Days</p>
          </div>
          
          <div className={`rounded-xl p-3 text-center ${
            summary.goalAchieved 
              ? 'bg-green-50 dark:bg-green-900/20' 
              : 'bg-neutral-50 dark:bg-neutral-800'
          }`}>
            <Target className={`w-5 h-5 mx-auto mb-1 ${
              summary.goalAchieved 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-neutral-500'
            }`} />
            <p className="text-lg font-bold text-neutral-900 dark:text-white">
              {Math.round(summary.goalAchievementPercent)}%
            </p>
            <p className="text-xs text-neutral-500">Goal Progress</p>
          </div>
        </div>

        {/* Top Subjects */}
        {summary.topSubjects.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <p className="text-sm text-neutral-500 mb-2">Top subjects this week:</p>
            <div className="flex flex-wrap gap-2">
              {summary.topSubjects.slice(0, 5).map((subject, i) => (
                <span 
                  key={i}
                  className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm rounded-full"
                >
                  {subject}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reflection Card */}
      {!summary.isComplete ? (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-white dark:bg-neutral-800 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 dark:text-white">End-of-Week Reflection</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Take a moment to reflect on your week
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reflection Prompt */}
            <div className="bg-white/70 dark:bg-neutral-800/70 rounded-xl p-4">
              <p className="text-neutral-700 dark:text-neutral-300 font-medium">
                💭 {summary.reflectionPrompt || 'How did your week go? What went well, and what would you like to improve?'}
              </p>
            </div>

            {/* Reflection Response */}
            <textarea
              value={reflectionResponse}
              onChange={e => setReflectionResponse(e.target.value)}
              placeholder="Write your reflection here..."
              rows={4}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              required
              minLength={10}
            />

            {/* Satisfaction Rating */}
            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                How satisfied are you with this week?
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setSatisfactionRating(rating)}
                    className={`p-2 rounded-lg transition-colors ${
                      satisfactionRating >= rating
                        ? 'bg-yellow-100 dark:bg-yellow-900/30'
                        : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    <Star className={`w-5 h-5 ${
                      satisfactionRating >= rating
                        ? 'text-yellow-500 fill-yellow-500'
                        : 'text-neutral-400'
                    }`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Next Week Intentions */}
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">
                What&apos;s one thing you want to focus on next week?
              </label>
              <input
                type="text"
                value={nextWeekIntentions}
                onChange={e => setNextWeekIntentions(e.target.value)}
                placeholder="e.g., Study for 30 minutes every morning"
                className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || reflectionResponse.length < 10}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Reflection (+25 XP)
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* Completed Reflection View */
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 dark:text-white">Your Reflection</h3>
              <p className="text-sm text-neutral-500">
                Completed {new Date(summary.reflectionCompletedAt!).toLocaleDateString()}
              </p>
            </div>
            {summary.weekSatisfactionRating && (
              <div className="ml-auto flex">
                {Array.from({ length: summary.weekSatisfactionRating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                ))}
              </div>
            )}
          </div>

          <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap mb-4">
            {summary.reflectionResponse}
          </p>

          {summary.nextWeekIntentions && (
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <p className="text-sm text-neutral-500 mb-1">Next week&apos;s focus:</p>
              <p className="text-neutral-700 dark:text-neutral-300 font-medium">
                {summary.nextWeekIntentions}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default WeeklyReflection
