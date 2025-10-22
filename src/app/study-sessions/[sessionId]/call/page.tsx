'use client'

import React from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useVideoCall } from '@/lib/hooks/useVideoCall'
import SessionChat from '@/components/SessionChat'
import SessionGoals from '@/components/SessionGoals'
import SessionTimer from '@/components/study-sessions/SessionTimer'
import InviteModal from '@/components/study-sessions/InviteModal'
import { createClient } from '@/lib/supabase/client'

interface Participant {
  id: string
  userId: string
  name: string
  avatarUrl: string | null
  role: string
}

interface Goal {
  id: string
  title: string
  description: string | null
  isCompleted: boolean
  order: number
}

interface Session {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  agoraChannel: string | null
  createdBy: {
    id: string
    name: string
  }
  participants: Participant[]
  goals: Goal[]
}

export default function StudyCallPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string
  const supabase = createClient()

  const [session, setSession] = useState<Session | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [activeFeature, setActiveFeature] = useState<'timer' | 'chat' | 'goals' | null>('timer')
  const [showInviteModal, setShowInviteModal] = useState(false)

  const fetchSession = useCallback(async () => {
    if (!user || !sessionId) return

    try {
      const res = await fetch(`/api/study-sessions/${sessionId}`)
      const data = await res.json()

      if (data.success) {
        const sess = data.session

        // If still in WAITING, redirect to lobby
        if (sess.status === 'WAITING') {
          toast('Session hasn\'t started yet')
          router.push(`/study-sessions/${sessionId}/lobby`)
          return
        }

        // If COMPLETED or CANCELLED, redirect
        if (sess.status === 'COMPLETED' || sess.status === 'CANCELLED') {
          toast.error('This session has ended')
          router.push('/study-sessions')
          return
        }

        setSession(sess)
      } else {
        toast.error(data.error || 'Failed to load session')
        router.push('/study-sessions')
      }
    } catch (error) {
      console.error('Error fetching session:', error)
      toast.error('Failed to load session')
    } finally {
      setLoadingSession(false)
    }
  }, [user, sessionId, router])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
      return
    }

    if (user) {
      fetchSession()
    }
  }, [user, loading, fetchSession, router])

  // Real-time: Listen for participant changes (joins/leaves)
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`call-participants-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'SessionParticipant',
          filter: `sessionId=eq.${sessionId}`,
        },
        (payload) => {
          console.log('New participant joined call - refreshing session data')
          fetchSession() // Refresh to get new participant list

          // Show toast notification
          const newParticipant = payload.new as { userId?: string }
          if (newParticipant.userId && newParticipant.userId !== user?.id) {
            toast.success('Someone joined the session')
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'SessionParticipant',
          filter: `sessionId=eq.${sessionId}`,
        },
        (payload) => {
          console.log('Participant left call - refreshing session data')
          fetchSession() // Refresh to get updated participant list

          // Show toast notification (we'll enhance this later to show name)
          toast('Someone left the session', { icon: '👋' })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, supabase, fetchSession, user?.id])

  const {
    isConnected,
    isConnecting,
    connectionError,
    localAudioEnabled,
    localVideoEnabled,
    isScreenSharing,
    remoteUsers,
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    localTracks,
  } = useVideoCall({
    channelName: session?.agoraChannel || '',
    audioOnly: false,
    onUserJoined: (uid) => console.log('User joined:', uid),
    onUserLeft: (uid) => console.log('User left:', uid),
    onError: (error) => console.error('Video call error:', error),
  })

  // Auto-join call when session loads
  useEffect(() => {
    if (session?.agoraChannel && !isConnected && !isConnecting) {
      joinCall()
    }
  }, [session, isConnected, isConnecting, joinCall])

  const handleEndCall = async () => {
    if (!confirm('Are you sure you want to leave the study call?')) return

    await leaveCall()
    router.push('/study-sessions')
  }

  if (loading || loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading study call...</p>
        </div>
      </div>
    )
  }

  if (!user || !profile || !session) return null

  const isHost = session.createdBy.id === user.id

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h1 className="text-white font-semibold text-lg">{session.title}</h1>
          <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">LIVE</span>
          <span className="text-gray-400 text-sm">{remoteUsers.size + 1} participant{remoteUsers.size !== 0 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Invite
          </button>
          <button onClick={handleEndCall} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium">
            Leave Call
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Call Area (Floating/Resizable) */}
        <div className={`${activeFeature ? 'w-1/3' : 'flex-1'} relative bg-black transition-all duration-300`}>
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-white text-sm">Connecting...</p>
              </div>
            </div>
          )}

          {connectionError && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
              <div className="text-center max-w-md p-6">
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-white text-xl font-semibold mb-2">Connection Failed</h3>
                <p className="text-white/70 mb-6">{connectionError}</p>
                <button onClick={joinCall} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Video Grid */}
          {isConnected && (
            <div className="h-full p-2 grid gap-2" style={{ gridTemplateColumns: remoteUsers.size === 0 ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              {/* Local Video */}
              <VideoTile videoTrack={localTracks.videoTrack} hasVideo={localVideoEnabled} hasAudio={localAudioEnabled} name={`${profile.name} (You)`} />

              {/* Remote Videos */}
              {Array.from(remoteUsers.values()).map((remoteUser) => (
                <VideoTile key={remoteUser.uid} videoTrack={remoteUser.videoTrack} hasVideo={remoteUser.hasVideo} hasAudio={remoteUser.hasAudio} name={`User ${remoteUser.uid}`} />
              ))}
            </div>
          )}

          {/* Video Controls (Bottom) */}
          {isConnected && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={toggleAudio}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition ${localAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
                  title={localAudioEnabled ? 'Mute' : 'Unmute'}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {localAudioEnabled ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    )}
                  </svg>
                </button>

                <button
                  onClick={toggleVideo}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition ${localVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
                  title={localVideoEnabled ? 'Stop Video' : 'Start Video'}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>

                <button
                  onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition ${isScreenSharing ? 'bg-blue-600 hover:bg-blue-700 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'}`}
                  title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Study Features Panel */}
        {activeFeature && (
          <div className="flex-1 bg-white flex flex-col overflow-hidden">
            {/* Feature Tabs */}
            <div className="bg-gray-50 border-b flex">
              <button onClick={() => setActiveFeature('timer')} className={`flex-1 px-4 py-3 text-sm font-medium ${activeFeature === 'timer' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>
                ⏱️ Timer
              </button>
              <button onClick={() => setActiveFeature('goals')} className={`flex-1 px-4 py-3 text-sm font-medium ${activeFeature === 'goals' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>
                ✅ Goals ({session.goals.filter((g) => g.isCompleted).length}/{session.goals.length})
              </button>
              <button onClick={() => setActiveFeature('chat')} className={`flex-1 px-4 py-3 text-sm font-medium ${activeFeature === 'chat' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>
                💬 Chat
              </button>
              <button onClick={() => setActiveFeature(null)} className="px-4 py-3 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Feature Content */}
            <div className="flex-1 overflow-auto">
              {activeFeature === 'timer' && (
                <div className="p-6">
                  <SessionTimer sessionId={sessionId} isHost={isHost} size="large" />
                </div>
              )}
              {activeFeature === 'goals' && <SessionGoals sessionId={sessionId} goals={session.goals} onGoalsUpdate={fetchSession} />}
              {activeFeature === 'chat' && <SessionChat sessionId={sessionId} isHost={isHost} onUnreadCountChange={() => {}} isVisible={true} />}
            </div>
          </div>
        )}

        {/* Feature Toggle Button (when closed) */}
        {!activeFeature && (
          <div className="absolute top-20 right-4 z-10">
            <div className="bg-white rounded-lg shadow-lg p-2 space-y-2">
              <button onClick={() => setActiveFeature('timer')} className="w-12 h-12 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center" title="Timer">
                <span className="text-xl">⏱️</span>
              </button>
              <button onClick={() => setActiveFeature('goals')} className="w-12 h-12 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center" title="Goals">
                <span className="text-xl">✅</span>
              </button>
              <button onClick={() => setActiveFeature('chat')} className="w-12 h-12 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center" title="Chat">
                <span className="text-xl">💬</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <InviteModal
        sessionId={sessionId}
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />
    </div>
  )
}

// Video Tile Component
function VideoTile({ videoTrack, hasVideo, hasAudio, name }: { videoTrack: unknown; hasVideo: boolean; hasAudio: boolean; name: string }) {
  const videoRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (videoTrack && videoRef.current && hasVideo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (videoTrack as any).play(videoRef.current)
    }

    return () => {
      if (videoTrack && hasVideo) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (videoTrack as any).stop()
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }, [videoTrack, hasVideo])

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
      {hasVideo ? (
        <div ref={videoRef} className="w-full h-full" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-white text-2xl font-bold">{name[0].toUpperCase()}</div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <div className="flex items-center justify-between">
          <span className="text-white text-xs font-medium">{name}</span>
          {!hasAudio && (
            <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
