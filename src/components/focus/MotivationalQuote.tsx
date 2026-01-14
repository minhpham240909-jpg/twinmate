'use client'

import { useState, useEffect, useCallback } from 'react'
import { Quote, RefreshCw, X } from 'lucide-react'
import { MOTIVATIONAL_QUOTES, STORAGE_KEYS } from '@/lib/focus/constants'

interface MotivationalQuoteProps {
  showAtStart?: boolean
}

export default function MotivationalQuote({ showAtStart = true }: MotivationalQuoteProps) {
  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isEnabled, setIsEnabled] = useState(true)

  // Load preferences
  useEffect(() => {
    const enabled = localStorage.getItem(STORAGE_KEYS.QUOTES_ENABLED) !== 'false'
    setIsEnabled(enabled)
    
    if (enabled && showAtStart) {
      // Show quote on start
      const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
      setQuote(randomQuote)
      setIsVisible(true)
      
      // Auto-hide after 8 seconds
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 8000)
      
      return () => clearTimeout(timer)
    }
  }, [showAtStart])

  const getNewQuote = useCallback(() => {
    const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
    setQuote(randomQuote)
    setIsVisible(true)
  }, [])

  const dismiss = useCallback(() => {
    setIsVisible(false)
  }, [])

  const toggleEnabled = useCallback(() => {
    const newEnabled = !isEnabled
    setIsEnabled(newEnabled)
    localStorage.setItem(STORAGE_KEYS.QUOTES_ENABLED, newEnabled.toString())
    if (!newEnabled) {
      setIsVisible(false)
    }
  }, [isEnabled])

  if (!isVisible || !quote) {
    return (
      <button
        onClick={getNewQuote}
        className="p-2.5 rounded-xl bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300 transition-all"
        title={isEnabled ? 'Show motivational quote' : 'Quotes disabled'}
      >
        <Quote className="w-5 h-5" />
      </button>
    )
  }

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 animate-in fade-in zoom-in duration-300 max-w-md w-full mx-4">
      <div className="bg-neutral-900/95 backdrop-blur-sm border border-neutral-800 rounded-2xl shadow-2xl p-6">
        {/* Quote Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
            <Quote className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Quote Text */}
        <blockquote className="text-center mb-4">
          <p className="text-white text-lg font-medium leading-relaxed mb-2">
            &ldquo;{quote.text}&rdquo;
          </p>
          <cite className="text-neutral-400 text-sm not-italic">
            — {quote.author}
          </cite>
        </blockquote>

        {/* Actions */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={getNewQuote}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>New quote</span>
          </button>
          <button
            onClick={dismiss}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
            <span>Dismiss</span>
          </button>
        </div>

        {/* Disable Option */}
        <div className="mt-4 pt-4 border-t border-neutral-800 flex items-center justify-center">
          <button
            onClick={toggleEnabled}
            className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
          >
            Don&apos;t show quotes on start
          </button>
        </div>
      </div>
    </div>
  )
}
