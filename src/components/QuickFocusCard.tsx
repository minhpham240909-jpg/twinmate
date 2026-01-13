'use client'

/**
 * QuickFocusCard - Zero-Motivation Entry Point
 *
 * The "I don't know what I want to study" instant action.
 * One big button that starts a 7-minute focus timer immediately.
 * No choices, no setup, no friction.
 *
 * Philosophy: The app should tell users what to do in 5 seconds,
 * not ask them to make decisions when they have no motivation.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Play, Timer, Zap } from 'lucide-react'

interface QuickFocusCardProps {
  className?: string
}

export default function QuickFocusCard({ className = '' }: QuickFocusCardProps) {
  const router = useRouter()
  const t = useTranslations('quickFocus')
  const [isStarting, setIsStarting] = useState(false)

  const handleStartFocus = async () => {
    if (isStarting) return

    setIsStarting(true)

    try {
      // Create a new focus session
      const response = await fetch('/api/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: 7 }),
      })

      if (!response.ok) {
        throw new Error('Failed to start focus session')
      }

      const data = await response.json()

      // Navigate to the focus timer page
      router.push(`/focus/${data.session.id}`)
    } catch (error) {
      console.error('Error starting focus session:', error)
      setIsStarting(false)
    }
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Main Card */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-blue-700 rounded-3xl p-8 shadow-2xl shadow-blue-500/25 relative">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{t('title')}</h2>
              <p className="text-blue-100 text-sm">{t('subtitle')}</p>
            </div>
          </div>

          {/* Timer display */}
          <div className="flex items-center gap-2 mb-6">
            <Timer className="w-5 h-5 text-blue-200" />
            <span className="text-blue-100 text-lg font-medium">{t('duration')}</span>
          </div>

          {/* Start Button - THE MAIN ACTION */}
          <button
            onClick={handleStartFocus}
            disabled={isStarting}
            className="w-full py-5 bg-white hover:bg-blue-50 disabled:bg-white/80 rounded-2xl font-bold text-xl text-blue-600 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/10 flex items-center justify-center gap-3 group"
          >
            {isStarting ? (
              <>
                <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>{t('starting')}</span>
              </>
            ) : (
              <>
                <Play className="w-7 h-7 fill-blue-600 group-hover:scale-110 transition-transform" />
                <span>{t('startButton')}</span>
              </>
            )}
          </button>

          {/* Micro-copy */}
          <p className="text-center text-blue-200 text-sm mt-4">
            {t('microCopy')}
          </p>
        </div>
      </div>
    </div>
  )
}
