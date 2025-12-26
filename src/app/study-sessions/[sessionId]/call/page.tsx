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
import SessionFlashcards from '@/components/session/SessionFlashcards'
import SessionNotes from '@/components/session/SessionNotes'
import SharedNotesViewer from '@/components/session/SharedNotesViewer'
import SessionWhiteboard from '@/components/session/SessionWhiteboard'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import GlowBorder from '@/components/ui/GlowBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'
import OfflineWarning from '@/components/OfflineWarning'

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
  const t = useTranslations('studySessions')
  const tCommon = useTranslations('common')

  const [session, setSession] = useState<Session | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [activeFeature, setActiveFeature] = useState<'timer' | 'chat' | 'goals' | 'flashcards' | 'notes' | 'whiteboard' | 'participants' | null>('timer')
  const [showInviteModal, setShowInviteModal] = useState(false)

  // Shared notes state
  const [sharedNotes, setSharedNotes] = useState<{
    content: string
    title: string
    sharedBy: { id: string; name: string; avatarUrl?: string | null }
  } | null>(null)
  const [isSharingNotes, setIsSharingNotes] = useState(false)

  // Shared flashcards state
  const [sharedFlashcards, setSharedFlashcards] = useState<{
    flashcards: Array<{ id: string; front: string; back: string; difficulty: number; userId: string }>
    currentIndex: number
    isFlipped: boolean
    sharedBy: { id: string; name: string; avatarUrl?: string | null }
  } | null>(null)
  const [isSharingFlashcards, setIsSharingFlashcards] = useState(false)

  // Shared whiteboard state
  const [sharedWhiteboard, setSharedWhiteboard] = useState<{
    imageData: string
    sharedBy: { id: string; name: string; avatarUrl?: string | null }
  } | null>(null)
  const [isSharingWhiteboard, setIsSharingWhiteboard] = useState(false)

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
          toast.error(t('sessionHasEnded'))
          router.push('/study-sessions')
          return
        }

        setSession(sess)
      } else {
        toast.error(data.error || t('failedToLoadSession'))
        router.push('/study-sessions')
      }
    } catch (error) {
      console.error('Error fetching session:', error)
      toast.error(t('failedToLoadSession'))
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

    console.log('[Call RT] Setting up participant listener...')
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
          console.log('[Call RT] New participant joined:', payload)
          fetchSession() // Refresh to get new participant list

          // Show toast notification
          const newParticipant = payload.new as { userId?: string }
          if (newParticipant.userId && newParticipant.userId !== user?.id) {
            toast.success(t('someoneJoinedSession'))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'SessionParticipant',
          filter: `sessionId=eq.${sessionId}`,
        },
        (payload) => {
          console.log('[Call RT] Participant updated:', payload)
          fetchSession() // Refresh to get updated participant data
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
          console.log('[Call RT] Participant left:', payload)
          fetchSession() // Refresh to get updated participant list

          // Show toast notification
          toast('Someone left the session', { icon: '👋' })
        }
      )
      .subscribe((status) => {
        console.log('[Call RT] Participant subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('[Call RT] Successfully subscribed to participant changes')
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[Call RT] Failed to subscribe to participant changes')
        }
      })

    return () => {
      console.log('[Call RT] Cleaning up participant listener')
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

  // Supabase Realtime: Listen for shared notes broadcasts
  useEffect(() => {
    if (!sessionId || !user) return

    const channel = supabase
      .channel(`shared-notes-${sessionId}`)
      .on('broadcast', { event: 'share-notes' }, (payload) => {
        // Don't show your own shared notes
        if (payload.payload.sharedBy.id !== user.id) {
          setSharedNotes(payload.payload)
          toast.success(`${payload.payload.sharedBy.name} shared their notes`)
        }
      })
      .on('broadcast', { event: 'stop-share-notes' }, (payload) => {
        if (sharedNotes?.sharedBy.id === payload.payload.userId) {
          setSharedNotes(null)
        }
      })
      // Flashcards sharing events
      .on('broadcast', { event: 'share-flashcards' }, (payload) => {
        if (payload.payload.sharedBy.id !== user.id) {
          setSharedFlashcards(payload.payload)
          toast.success(`${payload.payload.sharedBy.name} shared their flashcards`)
        }
      })
      .on('broadcast', { event: 'stop-share-flashcards' }, (payload) => {
        if (sharedFlashcards?.sharedBy.id === payload.payload.userId) {
          setSharedFlashcards(null)
        }
      })
      // Whiteboard sharing events
      .on('broadcast', { event: 'share-whiteboard' }, (payload) => {
        if (payload.payload.sharedBy.id !== user.id) {
          setSharedWhiteboard(payload.payload)
          toast.success(`${payload.payload.sharedBy.name} shared their whiteboard`)
        }
      })
      .on('broadcast', { event: 'stop-share-whiteboard' }, (payload) => {
        if (sharedWhiteboard?.sharedBy.id === payload.payload.userId) {
          setSharedWhiteboard(null)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, user, supabase, sharedNotes?.sharedBy.id, sharedFlashcards?.sharedBy.id, sharedWhiteboard?.sharedBy.id])

  // Handler: Share notes to all participants
  const handleShareNotes = useCallback(async (content: string, title: string) => {
    if (!user || !profile) return

    const channel = supabase.channel(`shared-notes-${sessionId}`)
    await channel.send({
      type: 'broadcast',
      event: 'share-notes',
      payload: {
        content,
        title,
        sharedBy: {
          id: user.id,
          name: profile.name || 'Anonymous',
          avatarUrl: profile.avatarUrl,
        },
      },
    })

    setIsSharingNotes(true)
    toast.success('Notes shared with all participants')
  }, [user, profile, sessionId, supabase])

  // Handler: Stop sharing notes
  const handleStopSharingNotes = useCallback(async () => {
    if (!user) return

    const channel = supabase.channel(`shared-notes-${sessionId}`)
    await channel.send({
      type: 'broadcast',
      event: 'stop-share-notes',
      payload: { userId: user.id },
    })

    setIsSharingNotes(false)
  }, [user, sessionId, supabase])

  // Handler: Share flashcards to all participants
  const handleShareFlashcards = useCallback(async (data: {
    flashcards: Array<{ id: string; front: string; back: string; difficulty: number; userId: string }>
    currentIndex: number
    isFlipped: boolean
    sharedBy: { id: string; name: string; avatarUrl?: string | null }
  }) => {
    if (!user || !profile) return

    const channel = supabase.channel(`shared-notes-${sessionId}`)
    await channel.send({
      type: 'broadcast',
      event: 'share-flashcards',
      payload: {
        ...data,
        sharedBy: {
          id: user.id,
          name: profile.name || 'Anonymous',
          avatarUrl: profile.avatarUrl,
        },
      },
    })

    setIsSharingFlashcards(true)
  }, [user, profile, sessionId, supabase])

  // Handler: Stop sharing flashcards
  const handleStopSharingFlashcards = useCallback(async () => {
    if (!user) return

    const channel = supabase.channel(`shared-notes-${sessionId}`)
    await channel.send({
      type: 'broadcast',
      event: 'stop-share-flashcards',
      payload: { userId: user.id },
    })

    setIsSharingFlashcards(false)
  }, [user, sessionId, supabase])

  // Handler: Share whiteboard to all participants
  const handleShareWhiteboard = useCallback(async (data: {
    imageData: string
    sharedBy: { id: string; name: string; avatarUrl?: string | null }
  }) => {
    if (!user || !profile) return

    const channel = supabase.channel(`shared-notes-${sessionId}`)
    await channel.send({
      type: 'broadcast',
      event: 'share-whiteboard',
      payload: {
        ...data,
        sharedBy: {
          id: user.id,
          name: profile.name || 'Anonymous',
          avatarUrl: profile.avatarUrl,
        },
      },
    })

    setIsSharingWhiteboard(true)
  }, [user, profile, sessionId, supabase])

  // Handler: Stop sharing whiteboard
  const handleStopSharingWhiteboard = useCallback(async () => {
    if (!user) return

    const channel = supabase.channel(`shared-notes-${sessionId}`)
    await channel.send({
      type: 'broadcast',
      event: 'stop-share-whiteboard',
      payload: { userId: user.id },
    })

    setIsSharingWhiteboard(false)
  }, [user, sessionId, supabase])

  const handleEndCall = async () => {
    if (!confirm(t('confirmLeaveCall'))) return

    await leaveCall()
    router.push('/study-sessions')
  }

  if (loading || loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-900 dark:text-white">{t('loadingStudyCall')}</p>
        </div>
      </div>
    )
  }

  if (!user || !profile || !session) return null

  const isHost = session.createdBy.id === user.id

  // Count connected users (video) vs total participants (database)
  const connectedCount = remoteUsers.size + 1 // +1 for local user
  const totalParticipants = session.participants.length

  return (
    <div className="h-screen bg-white dark:bg-slate-950 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="bg-gray-50 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <h1 className="text-gray-900 dark:text-white font-semibold text-lg">{session.title}</h1>
          <Pulse>
            <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full font-medium">{t('live')}</span>
          </Pulse>
          <span className="text-gray-600 dark:text-slate-400 text-sm">
            {totalParticipants} {totalParticipants === 1 ? t('participant') : t('participantsPlural')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Bounce>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:scale-105 transition-all text-sm font-medium flex items-center gap-2 shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              {t('invite')}
            </button>
          </Bounce>
          <button onClick={handleEndCall} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 hover:scale-105 transition-all text-sm font-medium shadow-lg">
            {t('leaveCall')}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Call Area (Floating/Resizable) */}
        <div className={`${activeFeature ? 'w-1/3' : 'flex-1'} relative bg-slate-950 transition-all duration-300`}>
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-900 dark:text-white text-sm">{t('connecting')}</p>
              </div>
            </div>
          )}

          {connectionError && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-white dark:bg-slate-950">
              <div className="text-center max-w-md p-6">
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-gray-900 dark:text-white text-xl font-semibold mb-2">{t('connectionFailed')}</h3>
                <p className="text-gray-700 dark:text-slate-300 mb-6">{connectionError}</p>
                <button onClick={joinCall} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  {t('retry')}
                </button>
              </div>
            </div>
          )}

          {/* Video Grid */}
          {isConnected && (
            <FadeIn>
              <div className="h-full p-2 grid gap-2" style={{ gridTemplateColumns: remoteUsers.size === 0 ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                {/* Local Video (current user) */}
                <FadeIn delay={0.1}>
                  <VideoTile videoTrack={localTracks.videoTrack} hasVideo={localVideoEnabled} hasAudio={localAudioEnabled} name={`${profile.name} (${t('you')})`} />
                </FadeIn>

                {/* Remote users (actually connected via Agora) */}
                {Array.from(remoteUsers.values()).map((remoteUser, index) => (
                  <FadeIn key={remoteUser.uid} delay={0.2 + index * 0.1}>
                    <VideoTile
                      videoTrack={remoteUser.videoTrack}
                      hasVideo={remoteUser.hasVideo}
                      hasAudio={remoteUser.hasAudio}
                      name={`User ${remoteUser.uid}`}
                    />
                  </FadeIn>
                ))}
              </div>
            </FadeIn>
          )}

          {/* Video Controls (Bottom) */}
          {isConnected && (
            <FadeIn delay={0.3}>
              <div className="absolute bottom-0 left-0 right-0 bg-gray-50 dark:bg-slate-900/95 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 p-4">
                <div className="flex items-center justify-center gap-3">
                  <Bounce delay={0}>
                    <button
                      onClick={toggleAudio}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 ${localAudioEnabled ? 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-white/10' : 'bg-red-600 hover:bg-red-700'}`}
                      title={localAudioEnabled ? t('mute') : t('unmute')}
                    >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {localAudioEnabled ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    )}
                    </svg>
                  </button>
                  </Bounce>

                  <Bounce delay={0.1}>
                    <button
                      onClick={toggleVideo}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 ${localVideoEnabled ? 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-white/10' : 'bg-red-600 hover:bg-red-700'}`}
                      title={localVideoEnabled ? t('stopVideo') : t('startVideo')}
                    >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  </Bounce>

                  <Bounce delay={0.2}>
                    <button
                      onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 relative ${isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-white/10'}`}
                      title={isScreenSharing ? t('stopSharing') : t('shareScreen')}
                    >
                      {isScreenSharing && (
                        <Pulse>
                          <div className="absolute inset-0 rounded-full bg-blue-600 opacity-50" />
                        </Pulse>
                      )}
                      <svg className="w-5 h-5 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </Bounce>
                </div>
              </div>
            </FadeIn>
          )}
        </div>

        {/* Study Features Panel */}
        {activeFeature && (
          <div className="flex-1 bg-gray-50 dark:bg-slate-900 flex flex-col overflow-hidden">
            {/* Feature Tabs */}
            <div className="bg-gray-50 dark:bg-slate-900/95 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 flex overflow-x-auto">
              <button onClick={() => setActiveFeature('timer')} className={`flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all hover:scale-105 ${activeFeature === 'timer' ? 'bg-gray-100 dark:bg-slate-800 text-blue-400 border-b-2 border-blue-500' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                ⏱️ {t('timer')}
              </button>
              <button onClick={() => setActiveFeature('goals')} className={`flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all hover:scale-105 ${activeFeature === 'goals' ? 'bg-gray-100 dark:bg-slate-800 text-blue-400 border-b-2 border-blue-500' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                ✅ {t('goals')} ({session.goals.filter((g) => g.isCompleted).length}/{session.goals.length})
              </button>
              <button onClick={() => setActiveFeature('chat')} className={`flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all hover:scale-105 ${activeFeature === 'chat' ? 'bg-gray-100 dark:bg-slate-800 text-blue-400 border-b-2 border-blue-500' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                💬 {t('chat')}
              </button>
              <button onClick={() => setActiveFeature('flashcards')} className={`flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all hover:scale-105 ${activeFeature === 'flashcards' ? 'bg-gray-100 dark:bg-slate-800 text-blue-400 border-b-2 border-blue-500' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                📚 Flashcards
              </button>
              <button onClick={() => setActiveFeature('notes')} className={`flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all hover:scale-105 ${activeFeature === 'notes' ? 'bg-gray-100 dark:bg-slate-800 text-blue-400 border-b-2 border-blue-500' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                📝 Notes
              </button>
              <button onClick={() => setActiveFeature('whiteboard')} className={`flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all hover:scale-105 ${activeFeature === 'whiteboard' ? 'bg-gray-100 dark:bg-slate-800 text-blue-400 border-b-2 border-blue-500' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                🎨 Whiteboard
              </button>
              <button onClick={() => setActiveFeature('participants')} className={`flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all hover:scale-105 ${activeFeature === 'participants' ? 'bg-gray-100 dark:bg-slate-800 text-blue-400 border-b-2 border-blue-500' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                👥 {t('participants')} ({connectedCount}/{totalParticipants})
              </button>
              <button onClick={() => setActiveFeature(null)} className="px-4 py-3 text-gray-600 dark:text-slate-500 hover:text-gray-900 dark:hover:text-slate-300 hover:scale-110 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Feature Content */}
            <div className="flex-1 overflow-auto">
              {/* Offline Warning */}
              <OfflineWarning 
                message="You are offline. Real-time features and messaging are unavailable."
                className="m-4"
                showWhenSlow
              />
              
              <div className={`p-6 ${activeFeature === 'timer' ? 'block' : 'hidden'}`}>
                <SessionTimer sessionId={sessionId} isHost={isHost} size="large" />
              </div>
              <div className={activeFeature === 'goals' ? 'block' : 'hidden'}>
                <SessionGoals sessionId={sessionId} goals={session.goals} onGoalsUpdate={fetchSession} />
              </div>
              <div className={activeFeature === 'chat' ? 'block' : 'hidden'}>
                <SessionChat sessionId={sessionId} isHost={isHost} onUnreadCountChange={() => {}} isVisible={activeFeature === 'chat'} />
              </div>
              <div className={`p-6 ${activeFeature === 'flashcards' ? 'block' : 'hidden'}`}>
                <SessionFlashcards
                  sessionId={sessionId}
                  currentUserId={user.id}
                  onShareFlashcards={handleShareFlashcards}
                  onStopSharing={handleStopSharingFlashcards}
                  isSharing={isSharingFlashcards}
                  sharedFlashcards={sharedFlashcards}
                />
              </div>
              <div className={`p-6 ${activeFeature === 'notes' ? 'block' : 'hidden'}`}>
                <SessionNotes
                  sessionId={sessionId}
                  onShareNotes={handleShareNotes}
                  onStopSharing={handleStopSharingNotes}
                  isSharing={isSharingNotes}
                />

                {/* Display shared notes from other participants */}
                {sharedNotes && (
                  <div className="mt-6">
                    <SharedNotesViewer
                      title={sharedNotes.title}
                      content={sharedNotes.content}
                      sharedBy={sharedNotes.sharedBy}
                      onClose={() => setSharedNotes(null)}
                    />
                  </div>
                )}
              </div>
              {/* FIX: Always render whiteboard but hide with CSS to prevent Tldraw unmounting */}
              <div className="p-6" style={{ display: activeFeature === 'whiteboard' ? 'block' : 'none' }}>
                <SessionWhiteboard
                  sessionId={sessionId}
                  onShareWhiteboard={handleShareWhiteboard}
                  onStopSharing={handleStopSharingWhiteboard}
                  isSharing={isSharingWhiteboard}
                  sharedWhiteboard={sharedWhiteboard}
                />
              </div>
              {/* Participants Panel */}
              <div className={`p-6 ${activeFeature === 'participants' ? 'block' : 'hidden'}`}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {t('participants')}
                    </h3>
                    <span className="text-sm text-gray-500 dark:text-slate-400">
                      {connectedCount} {t('connected')} / {totalParticipants} {t('total')}
                    </span>
                  </div>

                  {/* Connected via Video indicator */}
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      {connectedCount} {connectedCount === 1 ? 'user' : 'users'} connected to video call
                    </p>
                  </div>

                  {/* Database Participants List */}
                  <div className="space-y-2">
                    {session.participants.map((participant) => {
                      const isCurrentUser = participant.userId === user.id
                      const isConnectedToVideo = isCurrentUser || Array.from(remoteUsers.keys()).some(
                        uid => String(uid).includes(participant.userId.substring(0, 8))
                      )

                      return (
                        <div
                          key={participant.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            isConnectedToVideo
                              ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                              : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                          }`}
                        >
                          {/* Avatar */}
                          <div className="relative">
                            {participant.avatarUrl ? (
                              <img
                                src={participant.avatarUrl}
                                alt={participant.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                                {participant.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            {/* Connection status dot */}
                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${
                              isConnectedToVideo ? 'bg-green-500' : 'bg-gray-400'
                            }`}></span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {participant.name}
                              {isCurrentUser && <span className="text-blue-500 ml-1">({t('you')})</span>}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                              {participant.role === 'HOST' ? t('host') : t('participant')}
                            </p>
                          </div>

                          {/* Status */}
                          <div className="text-right">
                            {isConnectedToVideo ? (
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                {t('connected')}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-slate-400">
                                {t('notConnected')}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Remote Users from Agora (for debugging) */}
                  {remoteUsers.size > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
                      <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">
                        Video Stream UIDs: {Array.from(remoteUsers.keys()).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature Toggle Button (when closed) */}
        {!activeFeature && (
          <Bounce>
            <div className="absolute top-20 right-4 z-10">
              <GlowBorder color="#3b82f6" intensity="medium" animated={false}  style={{ borderRadius: 12 }}>
                <div className="bg-white dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-lg shadow-lg p-2 space-y-2">
                  <Bounce delay={0}>
                    <button onClick={() => setActiveFeature('timer')} className="w-12 h-12 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:scale-110 transition-all flex items-center justify-center shadow-md" title={t('timer')}>
                      <span className="text-xl">⏱️</span>
                    </button>
                  </Bounce>
                  <Bounce delay={0.1}>
                    <button onClick={() => setActiveFeature('goals')} className="w-12 h-12 bg-purple-600 text-white rounded-lg hover:bg-purple-700 hover:scale-110 transition-all flex items-center justify-center shadow-md" title={t('goals')}>
                      <span className="text-xl">✅</span>
                    </button>
                  </Bounce>
                  <Bounce delay={0.2}>
                    <button onClick={() => setActiveFeature('chat')} className="w-12 h-12 bg-green-600 text-white rounded-lg hover:bg-green-700 hover:scale-110 transition-all flex items-center justify-center shadow-md" title={t('chat')}>
                      <span className="text-xl">💬</span>
                    </button>
                  </Bounce>
                  <Bounce delay={0.3}>
                    <button onClick={() => setActiveFeature('flashcards')} className="w-12 h-12 bg-orange-600 text-white rounded-lg hover:bg-orange-700 hover:scale-110 transition-all flex items-center justify-center shadow-md" title={tCommon('flashcards')}>
                      <span className="text-xl">📚</span>
                    </button>
                  </Bounce>
                  <Bounce delay={0.4}>
                    <button onClick={() => setActiveFeature('notes')} className="w-12 h-12 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 hover:scale-110 transition-all flex items-center justify-center shadow-md" title={tCommon('notes')}>
                      <span className="text-xl">📝</span>
                    </button>
                  </Bounce>
                  <Bounce delay={0.5}>
                    <button onClick={() => setActiveFeature('whiteboard')} className="w-12 h-12 bg-pink-600 text-white rounded-lg hover:bg-pink-700 hover:scale-110 transition-all flex items-center justify-center shadow-md" title={tCommon('whiteboard')}>
                      <span className="text-xl">🎨</span>
                    </button>
                  </Bounce>
                  <Bounce delay={0.6}>
                    <button onClick={() => setActiveFeature('participants')} className="w-12 h-12 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 hover:scale-110 transition-all flex items-center justify-center shadow-md" title={t('participants')}>
                      <span className="text-xl">👥</span>
                    </button>
                  </Bounce>
                </div>
              </GlowBorder>
            </div>
          </Bounce>
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
    <GlowBorder color={hasVideo ? "#3b82f6" : "#8b5cf6"} intensity="medium" animated={false}  style={{ borderRadius: 12 }}>
      <div className="relative bg-gray-100 dark:bg-slate-800 rounded-lg overflow-hidden aspect-video">
        {hasVideo ? (
          <div ref={videoRef} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
            <Pulse>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-white text-2xl font-bold">{name[0].toUpperCase()}</div>
            </Pulse>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gray-50/80 dark:bg-slate-900/80 backdrop-blur-sm p-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-900 dark:text-white text-xs font-medium">{name}</span>
            {!hasAudio && (
              <Pulse>
                <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                </div>
              </Pulse>
            )}
          </div>
        </div>
      </div>
    </GlowBorder>
  )
}
