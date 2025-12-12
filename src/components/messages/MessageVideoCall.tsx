// MessageVideoCall Component - Video call for DM/Group messages

'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import VideoCall from '@/components/study-sessions/VideoCallDynamic'

interface MessageVideoCallProps {
  conversationId: string
  conversationType: 'partner' | 'group'
  userId: string
  userName: string
  onCallEnd: () => void
  callMessageId: string
  callStartTime: number
  callType?: 'VIDEO' | 'AUDIO' // Type of call
}

export default function MessageVideoCall({
  conversationId,
  conversationType,
  userId,
  userName,
  onCallEnd,
  callMessageId,
  callStartTime,
  callType = 'VIDEO',
}: MessageVideoCallProps) {
  console.log('📞 MessageVideoCall received callType:', callType, '→ audioOnly:', callType === 'AUDIO')
  const hasTrackedJoin = useRef(false)
  const hasEndedCall = useRef(false)

  // Generate Agora channel name (same logic as chat page)
  const channelName = conversationType === 'partner'
    ? `dm${[userId, conversationId].sort().join('').replace(/-/g, '').slice(0, 60)}`
    : `grp${conversationId.replace(/-/g, '').slice(0, 60)}`

  // Track when user successfully joins the call
  const handleUserJoined = useCallback(() => {
    if (!hasTrackedJoin.current) {
      hasTrackedJoin.current = true
      console.log('📞 User successfully joined call - marking as connected')
    }
  }, [])

  // Mark as joined when component mounts (user initiated the call)
  useEffect(() => {
    // Small delay to ensure connection is established
    const timer = setTimeout(() => {
      hasTrackedJoin.current = true
      console.log('📞 Call initiated - marking as connected')
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const handleCallEnd = useCallback(async () => {
    // Prevent duplicate end calls
    if (hasEndedCall.current) {
      console.log('📞 Call already ended, skipping duplicate')
      return
    }
    hasEndedCall.current = true

    try {
      // Calculate call duration
      const callDuration = Math.floor((Date.now() - callStartTime) / 1000)

      // Determine call status based on whether user joined and duration
      let callStatus: 'COMPLETED' | 'CANCELLED' | 'MISSED'
      if (hasTrackedJoin.current && callDuration >= 5) {
        // User was connected for at least 5 seconds - call completed
        callStatus = 'COMPLETED'
      } else if (callDuration < 10) {
        // Very short call (under 10 seconds) - likely cancelled
        callStatus = 'CANCELLED'
      } else {
        // Longer duration but never connected - missed
        callStatus = 'MISSED'
      }

      console.log('📞 Ending call:', { callDuration, callStatus, hasTrackedJoin: hasTrackedJoin.current })

      // Update call message
      await fetch('/api/messages/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          messageId: callMessageId,
          callDuration,
          callStatus,
          conversationId,
          conversationType,
          callType,
        }),
      })
    } catch (error) {
      console.error('Error ending call:', error)
    }

    // Call parent's onCallEnd
    onCallEnd()
  }, [callMessageId, callStartTime, conversationId, conversationType, callType, onCallEnd])

  return (
    <VideoCall
      sessionId={conversationId}
      agoraChannel={channelName}
      userId={userId}
      userName={userName}
      onCallEnd={handleCallEnd}
      onOpenChat={undefined}
      pipMode={false}
      audioOnly={callType === 'AUDIO'}
      onUserJoined={handleUserJoined}
    />
  )
}
