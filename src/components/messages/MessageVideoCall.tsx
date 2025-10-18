// MessageVideoCall Component - Video call for DM/Group messages

'use client'

import React, { useEffect, useRef } from 'react'
import VideoCall from '@/components/study-sessions/VideoCall'

interface MessageVideoCallProps {
  conversationId: string
  conversationType: 'partner' | 'group'
  userId: string
  userName: string
  onCallEnd: () => void
  callMessageId: string
  callStartTime: number
}

export default function MessageVideoCall({
  conversationId,
  conversationType,
  userId,
  userName,
  onCallEnd,
  callMessageId,
  callStartTime,
}: MessageVideoCallProps) {
  const hasTrackedJoin = useRef(false)

  // Generate Agora channel name (same logic as chat page)
  const channelName = conversationType === 'partner'
    ? `dm${[userId, conversationId].sort().join('').replace(/-/g, '').slice(0, 60)}`
    : `grp${conversationId.replace(/-/g, '').slice(0, 60)}`

  const handleCallEnd = async () => {
    try {
      // Calculate call duration
      const callDuration = Math.floor((Date.now() - callStartTime) / 1000)
      const callStatus = hasTrackedJoin.current ? 'COMPLETED' : (callDuration < 30 ? 'CANCELLED' : 'MISSED')

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
          callType: 'VIDEO', // Can be enhanced to track actual type
        }),
      })
    } catch (error) {
      console.error('Error ending call:', error)
    }

    // Call parent's onCallEnd
    onCallEnd()
  }

  return (
    <VideoCall
      sessionId={conversationId}
      agoraChannel={channelName}
      userId={userId}
      userName={userName}
      onCallEnd={handleCallEnd}
      onOpenChat={undefined}
      pipMode={false}
    />
  )
}
