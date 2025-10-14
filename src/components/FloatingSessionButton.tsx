'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useBackgroundSession } from '@/lib/session/BackgroundSessionContext'

export default function FloatingSessionButton() {
  const router = useRouter()
  const pathname = usePathname()
  const { activeSessionId } = useBackgroundSession()

  // Don't show button if:
  // 1. No active session
  // 2. Already on the session page
  if (!activeSessionId || pathname?.startsWith(`/study-sessions/${activeSessionId}`)) {
    return null
  }

  const handleReturnToSession = () => {
    if (activeSessionId) {
      router.push(`/study-sessions/${activeSessionId}`)
    }
  }

  return (
    <button
      onClick={handleReturnToSession}
      className="fixed bottom-6 right-6 z-50 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-2 font-semibold animate-pulse"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Return to Study Session
    </button>
  )
}
