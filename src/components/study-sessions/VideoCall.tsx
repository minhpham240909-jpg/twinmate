// VideoCall Component - Agora RTC Video Call UI

'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useVideoCall } from '@/lib/hooks/useVideoCall'
import type { ILocalVideoTrack, IRemoteVideoTrack } from '@/lib/agora/types'
import { getNetworkQualityLabel } from '@/lib/agora/client'
import { createClient } from '@/lib/supabase/client'
import InCallMessagePopup from './InCallMessagePopup'
import toast from 'react-hot-toast'

interface VideoCallProps {
  sessionId: string
  agoraChannel: string
  userId: string
  userName: string
  onCallEnd: () => void
  onOpenChat?: () => void
  pipMode?: boolean
  onTogglePip?: () => void
  audioOnly?: boolean // For audio-only calls (no video)
  onUserJoined?: () => void // Callback when any user joins the call
}

interface ChatMessage {
  id: string
  content: string
  sender: {
    id: string
    name: string
    avatarUrl: string | null
  }
}

export default function VideoCall({
  sessionId,
  agoraChannel,
  userId,
  userName,
  onCallEnd,
  onOpenChat,
  pipMode = false,
  onTogglePip,
  audioOnly = false, // Default to video call
  onUserJoined: onUserJoinedProp,
}: VideoCallProps) {
  console.log('🎬 VideoCall component rendered with audioOnly:', audioOnly)
  const hasJoinedRef = useRef(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [inCallMessages, setInCallMessages] = useState<ChatMessage[]>([])
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [activeOverlay, setActiveOverlay] = useState<'timer' | 'chat' | 'goals' | 'participants' | null>(null)
  const [leaveNotification, setLeaveNotification] = useState<string | null>(null)
  const supabase = createClient()

  const {
    isConnected,
    isConnecting,
    connectionError,
    localAudioEnabled,
    localVideoEnabled,
    isScreenSharing,
    remoteUsers,
    networkQuality,
    screenShareUserId,
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    localTracks,
  } = useVideoCall({
    channelName: agoraChannel,
    audioOnly, // Pass audioOnly mode to hook
    onUserJoined: (uid) => {
      console.log('User joined callback:', uid)
      toast.success('Someone joined the call')
      // Call the parent's onUserJoined callback if provided
      onUserJoinedProp?.()
    },
    onUserLeft: (uid) => {
      console.log('User left callback:', uid)

      // Show leave notification
      setLeaveNotification('Someone left the session')

      // Auto-hide after 3 seconds
      setTimeout(() => setLeaveNotification(null), 3000)

      // Also show toast
      toast('Someone left the session', { icon: '👋' })
    },
    onError: (error) => {
      console.error('Video call error:', error)
    },
  })

  const startScreenShareRef = useRef(startScreenShare)
  const stopScreenShareRef = useRef(stopScreenShare)

  useEffect(() => {
    startScreenShareRef.current = startScreenShare
    stopScreenShareRef.current = stopScreenShare
  }, [startScreenShare, stopScreenShare])

  // Auto-join on mount (only once)
  useEffect(() => {
    console.log('🔄 VideoCall mount effect running - hasJoined:', hasJoinedRef.current)
    if (!hasJoinedRef.current) {
      hasJoinedRef.current = true
      console.log('📞 Triggering joinCall() from VideoCall component')
      joinCall()
    } else {
      console.log('⏭️ Skipping joinCall - already called')
    }

    return () => {
      console.log('🧹 VideoCall component unmounting')
      // Cleanup handled by useVideoCall hook
    }
  }, [joinCall])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if dialog is showing
      if (showLeaveDialog) {
        return
      }

      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // M key - Toggle mute/unmute
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        toggleAudio()
      }

      // V key - Toggle video (disabled for audio-only calls)
      if (!audioOnly && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault()
        toggleVideo()
      }

      // S key - Toggle screen share
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        if (isScreenSharing) {
          stopScreenShareRef.current()
        } else {
          startScreenShareRef.current()
        }
      }

      // ESC key - Leave call
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setShowLeaveDialog(true)
      }
    }

    // Only add listener if connected
    if (isConnected) {
      window.addEventListener('keydown', handleKeyPress)

      return () => {
        window.removeEventListener('keydown', handleKeyPress)
      }
    }
  }, [isConnected, showLeaveDialog, toggleAudio, toggleVideo, isScreenSharing, audioOnly])

  // Subscribe to chat messages while in video call
  useEffect(() => {
    if (!sessionId || !userId) return

    let isSubscribed = true

    // Subscribe to new messages
    const channel = supabase
      .channel(`video-call-${sessionId}-messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'SessionMessage',
          filter: `sessionId=eq.${sessionId}`,
        },
        async (payload) => {
          if (!isSubscribed) return

          const newMessage = payload.new as { id: string; senderId: string }
          const messageId = newMessage.id
          const senderId = newMessage.senderId

          // Skip if message is from current user
          if (senderId === userId) return

          try {
            // Fetch full message with sender info
            const res = await fetch(`/api/study-sessions/${sessionId}/messages/${messageId}`)
            const data = await res.json()

            if (data.success && data.message) {
              // Add to queue
              setInCallMessages((prev) => [...prev, data.message])
            }
          } catch (error) {
            console.error('Error fetching message:', error)
          }
        }
      )
      .subscribe()

    return () => {
      isSubscribed = false
      supabase.removeChannel(channel)
    }
  }, [sessionId, userId, supabase])

  // Handle dismissing current message popup
  const handleDismissMessage = () => {
    setInCallMessages((prev) => prev.slice(1)) // Remove first message
  }

  // Handle opening chat from popup
  const handleViewChat = () => {
    if (onOpenChat) {
      onOpenChat()
    }
  }

  const handleConfirmLeave = async () => {
    setShowLeaveDialog(false)
    await leaveCall()
    onCallEnd()
  }

  const handleCancelLeave = () => {
    setShowLeaveDialog(false)
  }

  // Network quality indicator
  const networkQualityInfo = networkQuality
    ? getNetworkQualityLabel(networkQuality.uplinkNetworkQuality)
    : { label: 'Unknown', color: 'gray' }

  // Main container classes based on pipMode
  const containerClasses = pipMode
    ? "fixed bottom-4 right-4 w-96 h-64 z-50 rounded-xl shadow-2xl overflow-hidden border border-gray-700 bg-gray-900 transition-all duration-300"
    : `fixed inset-0 z-50 transition-all duration-300 ${audioOnly ? 'bg-gradient-to-br from-purple-900 via-gray-900 to-gray-900' : 'bg-gray-900'}`

  return (
    <div className={containerClasses}>
      {/* Leave Notification Overlay */}
      {leaveNotification && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-gray-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2">
            <span className="text-2xl">👋</span>
            <span className="font-medium">{leaveNotification}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b ${audioOnly ? 'from-purple-900/50' : 'from-black/50'} to-transparent p-4 z-10`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {audioOnly && (
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            )}
            <div>
              <h2 className="text-white font-semibold text-lg">{audioOnly ? 'Audio Call' : 'Video Call'}</h2>
              <p className="text-white/70 text-sm">
                {remoteUsers.size + 1} participant{remoteUsers.size !== 0 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Network Quality */}
          {isConnected && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/30 rounded-full">
              <div
                className={`w-2 h-2 rounded-full ${
                  networkQualityInfo.color === 'green'
                    ? 'bg-green-500'
                    : networkQualityInfo.color === 'yellow'
                    ? 'bg-yellow-500'
                    : networkQualityInfo.color === 'orange'
                    ? 'bg-orange-500'
                    : networkQualityInfo.color === 'red'
                    ? 'bg-red-500'
                    : 'bg-gray-500'
                }`}
              />
              <span className="text-white text-xs">{networkQualityInfo.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Video Grid */}
      {isConnecting && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Connecting to call...</p>
          </div>
        </div>
      )}

      {connectionError && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-white text-xl font-semibold mb-2">Connection Failed</h3>
            <p className="text-white/70 mb-6">{connectionError}</p>
            <div className="flex gap-3">
              <button
                onClick={joinCall}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Retry
              </button>
              <button
                onClick={onCallEnd}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isConnected && (
        <>
          <VideoGrid
            localVideoTrack={localTracks.videoTrack}
            localScreenTrack={localTracks.screenTrack}
            localVideoEnabled={localVideoEnabled}
            localAudioEnabled={localAudioEnabled}
            isScreenSharing={isScreenSharing}
            userName={userName}
            remoteUsers={remoteUsers}
            screenShareUserId={screenShareUserId}
          />

          {/* Control Panel */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-6 z-10">
            <div className="flex items-center justify-center gap-4">
              {/* Mute/Unmute Audio */}
              <button
                onClick={toggleAudio}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
                  localAudioEnabled
                    ? 'bg-gray-700 hover:bg-gray-600'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
                title={localAudioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {localAudioEnabled ? (
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      clipRule="evenodd"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                    />
                  </svg>
                )}
              </button>

              {/* Toggle Video - Hidden for audio-only calls */}
              {!audioOnly && (
                <button
                  onClick={toggleVideo}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
                    localVideoEnabled
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                  title={localVideoEnabled ? 'Disable Camera' : 'Enable Camera'}
                >
                  {localVideoEnabled ? (
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                  )}
                </button>
              )}

              {/* Share Screen */}
              <button
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
                  isScreenSharing
                    ? 'bg-blue-600 hover:bg-blue-700 animate-pulse'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title={isScreenSharing ? 'Stop screen sharing (or press S)' : 'Share Screen (or press S) - Select a specific window/tab to avoid infinite mirror'}
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {isScreenSharing ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  )}
                </svg>
              </button>

              {/* Toggle PiP */}
              {onTogglePip && (
                <button
                  onClick={onTogglePip}
                  className="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition"
                  title={pipMode ? "Expand" : "Minimize"}
                >
                  {pipMode ? (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  )}
                </button>
              )}

              {/* Leave Call */}
              <button
                onClick={() => setShowLeaveDialog(true)}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition"
                title="Leave Call"
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
                  />
                </svg>
              </button>
            </div>

            {/* Keyboard Shortcuts Hint */}
            <p className="text-center text-white/50 text-xs mt-3">
              Press M to mute/unmute{!audioOnly && ' • V for video'} • S for screen share • ESC to leave
              {isScreenSharing && <span className="text-blue-400 font-semibold"> • (Press S again to stop)</span>}
            </p>
          </div>
        </>
      )}

      {/* Leave Confirmation Dialog */}
      {showLeaveDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-white text-xl font-semibold mb-3">Leave Call?</h3>
            <p className="text-white/70 mb-6">
              Are you sure you want to leave the call? You can rejoin anytime.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelLeave}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLeave}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Call Message Popup - Show first message in queue */}
      {inCallMessages.length > 0 && (
        <InCallMessagePopup
          message={inCallMessages[0]}
          onDismiss={handleDismissMessage}
          onViewChat={handleViewChat}
        />
      )}
    </div>
  )
}

// Video Grid Component - Memoized to prevent infinite re-renders
const VideoGrid = React.memo(function VideoGrid({
  localVideoTrack,
  localScreenTrack,
  localVideoEnabled,
  localAudioEnabled,
  isScreenSharing,
  userName,
  remoteUsers,
  screenShareUserId,
}: {
  localVideoTrack: ILocalVideoTrack | null
  localScreenTrack: ILocalVideoTrack | null
  localVideoEnabled: boolean
  localAudioEnabled: boolean
  isScreenSharing: boolean
  userName: string
  remoteUsers: Map<import('agora-rtc-sdk-ng').UID, import('@/lib/agora/types').RemoteUser>
  screenShareUserId: import('agora-rtc-sdk-ng').UID | null
}) {
  // Debug logging
  console.log('VideoGrid render - isScreenSharing:', isScreenSharing, 'screenShareUserId:', screenShareUserId)
  console.log('VideoGrid render - localScreenTrack:', !!localScreenTrack)
  console.log('VideoGrid render - remoteUsers with screen share:', 
    Array.from(remoteUsers.values()).filter(u => u.hasScreenShare).map(u => u.uid))

  // Check if someone is sharing screen
  const hasScreenShare = isScreenSharing || Array.from(remoteUsers.values()).some((u) => u.hasScreenShare)

  // Screen share layout: main screen + sidebar with videos
  if (hasScreenShare) {
    // Find who is sharing screen (only show ONE screen share)
    let screenShareComponent = null
    let screenShareKey = null

    // Priority: Local screen share takes precedence
    if (isScreenSharing && localScreenTrack) {
      // You are sharing - Show a placeholder instead of the actual screen share
      // This prevents the infinite tunnel effect when user shares entire screen
      screenShareKey = 'local-screen-share'
      console.log('Creating local screen share placeholder (you are sharing)')
      screenShareComponent = (
        <LocalScreenSharePlaceholder
          key={screenShareKey}
          name={`${userName} (You)`}
        />
      )
    } else if (!isScreenSharing) {
      // Only look for remote screen shares if you're not sharing
      // Use screenShareUserId to find the specific user who is sharing
      const sharingUser = screenShareUserId 
        ? remoteUsers.get(screenShareUserId)
        : Array.from(remoteUsers.values()).find(
            (user) => user.hasScreenShare && user.screenTrack
          )

      if (sharingUser && sharingUser.screenTrack) {
        screenShareKey = `remote-screen-share-${sharingUser.uid}`
        console.log('Creating remote screen share component for user:', sharingUser.uid)
        screenShareComponent = (
          <ScreenShareTile
            key={screenShareKey}
            screenTrack={sharingUser.screenTrack}
            name={`User ${sharingUser.uid}`}
          />
        )
      }
    }

    console.log('Rendering screen share layout with component:', screenShareKey)
    
    // CRITICAL: Only render if we actually have a screen share component
    if (!screenShareComponent) {
      console.warn('No screen share component to render despite hasScreenShare=true')
      // Fall through to normal grid layout
    } else {
      return (
        <div className="h-full flex gap-2 p-2">
          {/* Main Screen Share Area - ONLY ONE SCREEN */}
          <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center">
            {screenShareComponent}
          </div>

        {/* Sidebar with participant videos */}
        <div className="w-48 flex flex-col gap-2 overflow-y-auto">
          {/* Local Video - ONLY show camera feed, never screen share */}
          <VideoTile
            videoTrack={localVideoTrack}
            hasVideo={localVideoEnabled}
            hasAudio={localAudioEnabled}
            name={`${userName} (You)`}
            isLocal={true}
          />

          {/* Remote Videos */}
          {Array.from(remoteUsers.values()).map((user) => (
            <VideoTile
              key={user.uid}
              videoTrack={user.videoTrack}
              hasVideo={user.hasVideo}
              hasAudio={user.hasAudio}
              name={`User ${user.uid}`}
              isLocal={false}
            />
          ))}
        </div>
      </div>
      )
    }
  }

  // Normal grid layout (no screen share)
  const totalParticipants = remoteUsers.size + 1

  // Calculate grid layout
  const gridCols =
    totalParticipants === 1
      ? 1
      : totalParticipants === 2
      ? 2
      : totalParticipants <= 4
      ? 2
      : totalParticipants <= 9
      ? 3
      : 4

  return (
    <div
      className={`h-full p-4 grid gap-4 content-center`}
      style={{
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gridAutoRows: 'minmax(200px, 1fr)',
      }}
    >
      {/* Local Video */}
      <VideoTile
        videoTrack={localVideoTrack}
        hasVideo={localVideoEnabled}
        hasAudio={localAudioEnabled}
        name={`${userName} (You)`}
        isLocal={true}
      />

      {/* Remote Videos */}
      {Array.from(remoteUsers.values()).map((user) => (
        <VideoTile
          key={user.uid}
          videoTrack={user.videoTrack}
          hasVideo={user.hasVideo}
          hasAudio={user.hasAudio}
          name={`User ${user.uid}`}
          isLocal={false}
        />
      ))}
    </div>
  )
})

// Individual Video Tile - Memoized to prevent unnecessary re-renders
const VideoTile = React.memo(function VideoTile({
  videoTrack,
  hasVideo,
  hasAudio,
  name,
  isLocal: _isLocal,
}: {
  videoTrack: ILocalVideoTrack | IRemoteVideoTrack | undefined | null
  hasVideo: boolean
  hasAudio: boolean
  name: string
  isLocal: boolean
}) {
  const videoRef = useRef<HTMLDivElement>(null)
  const isPlayingRef = useRef(false)

  useEffect(() => {
    const container = videoRef.current

    if (videoTrack && container && hasVideo) {
      // Prevent playing the same track multiple times
      if (isPlayingRef.current) {
        return
      }

      // Clear container before playing
      while (container.firstChild) {
        container.removeChild(container.firstChild)
      }

      try {
        videoTrack.play(container)
        isPlayingRef.current = true
      } catch (error) {
        console.error('Error playing video track:', error)
      }
    }

    return () => {
      if (videoTrack && hasVideo && isPlayingRef.current) {
        try {
          videoTrack.stop()
        } catch (e) {
          // Track might already be stopped
        }
        isPlayingRef.current = false
      }

      // Clear container on cleanup
      if (container) {
        while (container.firstChild) {
          container.removeChild(container.firstChild)
        }
      }
    }
  }, [videoTrack, hasVideo])

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
      {/* Video */}
      {hasVideo ? (
        <div ref={videoRef} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-white text-3xl font-bold">
            {name[0].toUpperCase()}
          </div>
        </div>
      )}

      {/* Name Label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium">{name}</span>

          {/* Audio Indicator */}
          <div className="flex items-center gap-1">
            {!hasAudio && (
              <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                  />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

// Local Screen Share Placeholder - Shows when YOU are sharing (prevents infinite mirror)
const LocalScreenSharePlaceholder = React.memo(function LocalScreenSharePlaceholder({
  name,
}: {
  name: string
}) {
  return (
    <div className="relative w-full h-full bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900 flex items-center justify-center">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-8 max-w-2xl">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 bg-blue-500/30 rounded-full flex items-center justify-center animate-pulse">
              <svg
                className="w-12 h-12 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        {/* Text */}
        <h3 className="text-white text-2xl font-bold mb-3">You&apos;re Sharing Your Screen</h3>
        <p className="text-white/80 text-lg mb-2">
          Other participants can see your screen
        </p>
        <p className="text-white/60 text-sm mb-6">
          (Your screen preview is hidden here to prevent infinite mirror effect)
        </p>

        {/* Status indicator */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-white text-sm font-medium">Screen share active</span>
        </div>
      </div>

      {/* Name overlay */}
      <div className="absolute top-4 left-4 bg-black/70 px-4 py-2 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-white text-sm font-medium">{name} is sharing their screen</span>
        </div>
      </div>
    </div>
  )
})

// Screen Share Tile Component
const ScreenShareTile = React.memo(function ScreenShareTile({
  screenTrack,
  name,
}: {
  screenTrack: ILocalVideoTrack | IRemoteVideoTrack
  name: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playingTrackIdRef = useRef<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !screenTrack) {
      return
    }

    const trackId = screenTrack.getTrackId()
    
    // Skip if we're already playing this exact track
    if (playingTrackIdRef.current === trackId) {
      console.log('Already playing track:', trackId)
      return
    }

    console.log('Starting to play screen share track:', trackId)
    
    // NUCLEAR OPTION: Clear EVERYTHING from container
    container.innerHTML = ''
    
    // Create a wrapper div with overflow hidden to contain any duplicates
    const wrapper = document.createElement('div')
    wrapper.style.width = '100%'
    wrapper.style.height = '100%'
    wrapper.style.position = 'relative'
    wrapper.style.overflow = 'hidden'
    wrapper.id = `screen-wrapper-${Date.now()}`
    
    // Add a play container inside the wrapper
    const playContainer = document.createElement('div')
    playContainer.style.width = '100%'
    playContainer.style.height = '100%'
    playContainer.style.position = 'absolute'
    playContainer.style.top = '0'
    playContainer.style.left = '0'
    playContainer.id = `screen-play-${Date.now()}`
    
    wrapper.appendChild(playContainer)
    container.appendChild(wrapper)
    
    // Now play the new track in the specific container
    try {
      // The play method creates a new video element inside the container
      screenTrack.play(playContainer)
      playingTrackIdRef.current = trackId
      console.log('Successfully playing screen share in container:', playContainer.id)
      
      // IMMEDIATE check and cleanup of duplicates
      setTimeout(() => {
        const allVideos = wrapper.getElementsByTagName('video')
        console.log(`Found ${allVideos.length} video elements after play`)
        
        if (allVideos.length > 1) {
          console.warn(`DUPLICATE VIDEOS DETECTED! Found ${allVideos.length} videos`)
          // Keep only the first video, hide/remove all others
          for (let i = 1; i < allVideos.length; i++) {
            const video = allVideos[i]
            video.style.display = 'none'
            video.pause()
            video.srcObject = null
            video.remove()
          }
        }
        
        // Also check parent container for any stray videos
        const parentVideos = container.getElementsByTagName('video')
        if (parentVideos.length > 1) {
          console.error(`CRITICAL: Multiple videos in parent container! Count: ${parentVideos.length}`)
          // Keep only first video element
          for (let i = parentVideos.length - 1; i > 0; i--) {
            parentVideos[i].remove()
          }
        }
        
        // Style the remaining video to ensure it fits properly
        if (allVideos.length > 0) {
          const video = allVideos[0]
          video.style.width = '100%'
          video.style.height = '100%'
          video.style.objectFit = 'contain'
          video.style.position = 'absolute'
          video.style.top = '0'
          video.style.left = '0'
        }
      }, 100)
      
      // Reduced monitoring frequency: Check every 1 second instead of 200ms
      // Only monitor for 2 seconds instead of 3 seconds to reduce CPU usage
      let checkCount = 0
      const monitorInterval = setInterval(() => {
        checkCount++
        const videos = container.getElementsByTagName('video')
        if (videos.length > 1) {
          console.error(`[Check ${checkCount}] STILL MULTIPLE VIDEOS! Count: ${videos.length}`)
          // Remove ALL except first
          while (videos.length > 1) {
            const lastVideo = videos[videos.length - 1]
            lastVideo.pause()
            lastVideo.srcObject = null
            lastVideo.remove()
          }
        }
      }, 1000) // Reduced from 200ms to 1000ms (5x less frequent)
      
      // Stop monitoring after 2 seconds instead of 3 seconds
      setTimeout(() => {
        clearInterval(monitorInterval)
        console.log('Stopped monitoring for duplicate videos')
      }, 2000) // Reduced from 3000ms to 2000ms
    } catch (error) {
      console.error('Error playing screen share:', error)
      playingTrackIdRef.current = null
    }

    // Cleanup function
    return () => {
      console.log('Cleaning up screen share display for track:', trackId)
      
      // DON'T stop the track itself - it might be used elsewhere
      // Just clean up the video elements in our container
      if (container) {
        const allVideos = container.getElementsByTagName('video')
        while (allVideos.length > 0) {
          const video = allVideos[0]
          video.pause()
          video.srcObject = null
          video.load()
          video.remove()
        }
        // Clear all children
        while (container.firstChild) {
          container.removeChild(container.firstChild)
        }
      }
      
      playingTrackIdRef.current = null
    }
  }, [screenTrack])

  return (
    <div className="relative w-full h-full bg-gray-900">
      {/* Screen share video container - single div that will contain the video */}
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      />

      {/* Name overlay */}
      <div className="absolute top-4 left-4 bg-black/70 px-4 py-2 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-white text-sm font-medium">{name} is sharing their screen</span>
        </div>
      </div>
    </div>
  )
})
