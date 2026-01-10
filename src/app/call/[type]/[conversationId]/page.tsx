'use client'

/**
 * Call Page - Dedicated page for partner/group calls
 *
 * This page handles incoming and outgoing calls for:
 * - Partner (1-on-1 DM) calls
 * - Group calls
 *
 * URL structure: /call/[type]/[conversationId]?callType=VIDEO|AUDIO&messageId=xxx
 * - type: 'partner' | 'group'
 * - conversationId: Partner user ID or Group ID
 * - callType: VIDEO or AUDIO
 * - messageId: Optional call message ID for status updates
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import dynamic from 'next/dynamic'

// Dynamically import VideoCall to avoid SSR issues with Agora
const VideoCall = dynamic(
  () => import('@/components/study-sessions/VideoCall'),
  { ssr: false }
)

export default function CallPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  // Extract params
  const type = params.type as 'partner' | 'group'
  const conversationId = params.conversationId as string
  const callType = (searchParams.get('callType') as 'VIDEO' | 'AUDIO') || 'VIDEO'
  const messageId = searchParams.get('messageId') || null

  // Track call state
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const callStartTimeRef = useRef<number>(Date.now())
  const hasTrackedJoinRef = useRef(false)
  const hasEndedCallRef = useRef(false)

  // Generate Agora channel name (deterministic based on participants)
  const channelName = type === 'partner'
    ? `dm${[user?.id || '', conversationId].sort().join('').replace(/-/g, '').slice(0, 60)}`
    : `grp${conversationId.replace(/-/g, '').slice(0, 60)}`

  // Validate params and auth
  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push('/auth')
      return
    }

    if (!type || !conversationId) {
      setError('Invalid call parameters')
      return
    }

    if (type !== 'partner' && type !== 'group') {
      setError('Invalid call type')
      return
    }

    // All validations passed
    setIsReady(true)
  }, [loading, user, type, conversationId, router])

  // Track when user joins call
  const handleUserJoined = useCallback(() => {
    if (!hasTrackedJoinRef.current) {
      hasTrackedJoinRef.current = true
      console.log('[CallPage] User joined call')
    }
  }, [])

  // Handle call end
  const handleCallEnd = useCallback(async () => {
    if (hasEndedCallRef.current) {
      console.log('[CallPage] Call already ended, skipping')
      return
    }
    hasEndedCallRef.current = true

    try {
      // Calculate call duration
      const callDuration = Math.floor((Date.now() - callStartTimeRef.current) / 1000)

      // Determine call status
      let callStatus: 'COMPLETED' | 'CANCELLED' | 'MISSED'
      if (hasTrackedJoinRef.current && callDuration >= 5) {
        callStatus = 'COMPLETED'
      } else if (callDuration < 10) {
        callStatus = 'CANCELLED'
      } else {
        callStatus = 'MISSED'
      }

      console.log('[CallPage] Ending call:', { callDuration, callStatus, messageId })

      // Update call message if we have messageId
      if (messageId) {
        await fetch('/api/messages/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'end',
            messageId,
            callDuration,
            callStatus,
            conversationId,
            conversationType: type,
            callType,
          }),
        })
      }
    } catch (err) {
      console.error('[CallPage] Error ending call:', err)
    }

    // FIX: Dispatch event to refresh dashboard online partners immediately
    window.dispatchEvent(new CustomEvent('call-ended'))
    
    // Navigate back to chat
    router.push(`/chat?conversation=${conversationId}&type=${type}`)
  }, [messageId, conversationId, type, callType, router])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center max-w-md p-6">
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">Call Error</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Not ready yet
  if (!isReady || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Connecting to call...</p>
        </div>
      </div>
    )
  }

  // Render VideoCall component
  return (
    <VideoCall
      sessionId={conversationId}
      agoraChannel={channelName}
      userId={user.id}
      userName={profile.name || 'User'}
      onCallEnd={handleCallEnd}
      audioOnly={callType === 'AUDIO'}
      onUserJoined={handleUserJoined}
    />
  )
}
