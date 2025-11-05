// useVideoCall - Custom hook for managing Agora video call state

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  NetworkQuality,
  UID,
} from 'agora-rtc-sdk-ng'
import {
  createAgoraClient,
  fetchAgoraToken,
  createLocalTracks,
  createScreenShareTrack,
} from '@/lib/agora/client'
import type { RemoteUser, LocalTracks, UseVideoCallReturn } from '@/lib/agora/types'
import toast from 'react-hot-toast'

interface UseVideoCallOptions {
  channelName: string
  onUserJoined?: (uid: UID) => void
  onUserLeft?: (uid: UID) => void
  onError?: (error: Error) => void
  audioOnly?: boolean // For audio-only calls (no video)
}

export function useVideoCall({
  channelName,
  onUserJoined,
  onUserLeft,
  onError,
  audioOnly = false,
}: UseVideoCallOptions): UseVideoCallReturn {
  console.log('🎯 useVideoCall initialized with audioOnly:', audioOnly)

  // Client state
  const [client, setClient] = useState<IAgoraRTCClient | null>(null)
  const clientRef = useRef<IAgoraRTCClient | null>(null)

  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // Local media state
  const [localTracks, setLocalTracks] = useState<LocalTracks>({
    videoTrack: null,
    audioTrack: null,
    screenTrack: null,
  })
  const localTracksRef = useRef<LocalTracks>({
    videoTrack: null,
    audioTrack: null,
    screenTrack: null,
  })

  const [localAudioEnabled, setLocalAudioEnabled] = useState(true)
  const [localVideoEnabled, setLocalVideoEnabled] = useState(() => {
    const videoEnabled = !audioOnly
    console.log('🎥 Initial localVideoEnabled:', videoEnabled, '(audioOnly:', audioOnly, ')')
    return videoEnabled
  }) // Start with video OFF for audio-only calls
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  // Remote users state
  const [remoteUsers, setRemoteUsers] = useState<Map<UID, RemoteUser>>(new Map())
  const remoteUsersRef = useRef<Map<UID, RemoteUser>>(new Map())

  // Screen share state
  const [screenShareUserId, setScreenShareUserId] = useState<UID | null>(null)

  // Guards to prevent duplicate operations
  const isStartingScreenShareRef = useRef(false)
  const isStoppingScreenShareRef = useRef(false)

  // Network quality
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality | null>(null)

  // Token and config
  const tokenRef = useRef<string | null>(null)
  const appIdRef = useRef<string | null>(null)
  const uidRef = useRef<UID | null>(null)

  // Join attempt tracker to prevent duplicate joins
  const isJoiningRef = useRef(false)

  /**
   * Initialize Agora client and set up event listeners
   */
  const initializeClient = useCallback(() => {
    const agoraClient = createAgoraClient()
    clientRef.current = agoraClient
    setClient(agoraClient)

    // Event: User published (video/audio)
    agoraClient.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      console.log('User published:', user.uid, mediaType)

      try {
        // Subscribe to the remote user
        await agoraClient.subscribe(user, mediaType)
        console.log('✅ Subscribed to', user.uid, mediaType)

        // IMPORTANT: Play audio track immediately after subscription
        if (mediaType === 'audio' && user.audioTrack) {
          try {
            user.audioTrack.play()
            console.log('🔊 Playing audio track for user:', user.uid)

            // Set volume to 100 to ensure it's audible
            user.audioTrack.setVolume(100)
            console.log('🔊 Audio volume set to 100 for user:', user.uid)
          } catch (audioError) {
            console.error('❌ Error playing audio track:', audioError)
          }
        }

        // Detect if this is a screen share BEFORE updating state
        let isScreenShare = false
        if (mediaType === 'video') {
          const videoTrack = user.videoTrack
          isScreenShare = videoTrack?.getMediaStreamTrack()?.label?.toLowerCase().includes('screen') ?? false
          console.log('Video track label:', videoTrack?.getMediaStreamTrack()?.label, 'isScreenShare:', isScreenShare)
        }

        // Update remote users state
        setRemoteUsers((prev) => {
          const newMap = new Map(prev)
          const existingUser = newMap.get(user.uid) || {
            uid: user.uid,
            hasAudio: false,
            hasVideo: false,
            hasScreenShare: false,
          }

          if (mediaType === 'video') {
            const videoTrack = user.videoTrack

            if (isScreenShare) {
              // This is a screen share
              existingUser.hasScreenShare = true
              existingUser.screenTrack = videoTrack
            } else {
              // This is a regular camera video
              existingUser.hasVideo = true
              existingUser.videoTrack = videoTrack
            }
          } else if (mediaType === 'audio') {
            existingUser.hasAudio = true
            existingUser.audioTrack = user.audioTrack
          }

          newMap.set(user.uid, existingUser)
          remoteUsersRef.current = newMap
          return newMap
        })

        // Set screen share user ID AFTER state update completes
        if (isScreenShare) {
          setScreenShareUserId(user.uid)
        }
      } catch (error) {
        console.error('Error subscribing to user:', error)
      }
    })

    // Event: User unpublished (video/audio)
    agoraClient.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      console.log('User unpublished:', user.uid, mediaType)

      setRemoteUsers((prev) => {
        const newMap = new Map(prev)
        const existingUser = newMap.get(user.uid)

        if (existingUser) {
          if (mediaType === 'video') {
            // Clear both camera video and screen share
            // (we can't tell which one was unpublished, so clear both)
            existingUser.hasVideo = false
            existingUser.videoTrack = undefined
            existingUser.hasScreenShare = false
            existingUser.screenTrack = undefined

            // Clear screen share user ID if this user was sharing
            if (screenShareUserId === user.uid) {
              setScreenShareUserId(null)
            }
          } else if (mediaType === 'audio') {
            existingUser.hasAudio = false
            existingUser.audioTrack = undefined
          }

          newMap.set(user.uid, existingUser)
        }

        remoteUsersRef.current = newMap
        return newMap
      })
    })

    // Event: User joined channel
    agoraClient.on('user-joined', (user: IAgoraRTCRemoteUser) => {
      console.log('User joined:', user.uid)
      onUserJoined?.(user.uid)
      toast.success(`User ${user.uid} joined the call`)
    })

    // Event: User left channel
    agoraClient.on('user-left', (user: IAgoraRTCRemoteUser, reason: string) => {
      console.log('User left:', user.uid, reason)

      setRemoteUsers((prev) => {
        const newMap = new Map(prev)
        newMap.delete(user.uid)
        remoteUsersRef.current = newMap
        return newMap
      })

      // Clear screen share state if this user was sharing
      if (screenShareUserId === user.uid) {
        setScreenShareUserId(null)
      }

      onUserLeft?.(user.uid)

      const message = reason === 'ServerTimeOut'
        ? `User ${user.uid} lost connection`
        : `User ${user.uid} left the call`
      toast(message)
    })

    // Event: Network quality
    agoraClient.on('network-quality', (stats: NetworkQuality) => {
      setNetworkQuality(stats)

      // Warn on poor network quality
      if (stats.downlinkNetworkQuality > 4 || stats.uplinkNetworkQuality > 4) {
        console.warn('Poor network quality detected')
      }
    })

    // Event: Connection state change
    agoraClient.on('connection-state-change', (curState: string, prevState: string) => {
      console.log('Connection state changed:', prevState, '->', curState)

      if (curState === 'DISCONNECTED') {
        setIsConnected(false)
        toast.error('Disconnected from call')
      } else if (curState === 'CONNECTED') {
        setIsConnected(true)
      }
    })

    // Event: Token privilege will expire
    agoraClient.on('token-privilege-will-expire', async () => {
      console.log('Token privilege will expire, renewing...')
      try {
        const { token } = await fetchAgoraToken(channelName, uidRef.current || undefined)
        await agoraClient.renewToken(token)
        tokenRef.current = token
        toast.success('Connection renewed')
      } catch (error) {
        console.error('Failed to renew token:', error)
        toast.error('Failed to renew connection')
      }
    })

    return agoraClient
  }, [channelName, onUserJoined, onUserLeft])

  /**
   * Join the video call
   */
  const joinCall = useCallback(async () => {
    console.log('🎯 joinCall called - Current state:', {
      isConnecting,
      isConnected,
      isJoiningRef: isJoiningRef.current,
      channelName
    })

    // Prevent duplicate join attempts
    if (isConnecting || isConnected || isJoiningRef.current) {
      console.warn('⛔ Already connecting or connected - aborting join')
      return
    }

    // Mark as joining
    isJoiningRef.current = true
    setIsConnecting(true)
    setConnectionError(null)
    console.log('✅ Starting join process...')

    try {
      // Initialize client if not already done
      let agoraClient = clientRef.current
      if (!agoraClient) {
        console.log('📡 Initializing Agora client...')
        agoraClient = initializeClient()
      }

      // Check if client is already connected
      if (agoraClient.connectionState === 'CONNECTED' || agoraClient.connectionState === 'CONNECTING') {
        console.log('✅ Client already connected or connecting, skipping join')
        setIsConnected(true)
        setIsConnecting(false)
        isJoiningRef.current = false
        return
      }

      // Fetch token
      console.log('🔑 Fetching Agora token for channel:', channelName)
      const tokenData = await fetchAgoraToken(channelName)
      console.log('✅ Token fetched successfully:', { appId: tokenData.appId, uid: tokenData.uid })

      tokenRef.current = tokenData.token
      appIdRef.current = tokenData.appId
      uidRef.current = tokenData.uid

      // Join the channel
      console.log('🚀 Joining Agora channel:', channelName, 'with UID:', tokenData.uid)
      await agoraClient.join(
        tokenData.appId,
        channelName,
        tokenData.token,
        tokenData.uid
      )

      console.log('✅ Successfully joined Agora channel')

      // Create local tracks
      console.log('🎥 Creating local media tracks (video:', localVideoEnabled, ', audio:', localAudioEnabled, ')...')
      const tracks = await createLocalTracks({
        videoEnabled: localVideoEnabled,
        audioEnabled: localAudioEnabled,
      })

      console.log('✅ Local tracks created:', {
        hasVideo: !!tracks.videoTrack,
        hasAudio: !!tracks.audioTrack
      })

      // Ensure local audio track is enabled and unmuted
      if (tracks.audioTrack) {
        await tracks.audioTrack.setEnabled(true)
        tracks.audioTrack.setVolume(100)
        console.log('🔊 Local audio track enabled and volume set to 100')
      } else {
        console.warn('⚠️ No local audio track was created!')
      }

      localTracksRef.current = {
        videoTrack: tracks.videoTrack || null,
        audioTrack: tracks.audioTrack || null,
        screenTrack: null,
      }
      setLocalTracks(localTracksRef.current)

      // Publish local tracks
      const tracksToPublish = []
      if (tracks.videoTrack) {
        tracksToPublish.push(tracks.videoTrack)
        console.log('📹 Adding video track to publish')
      }
      if (tracks.audioTrack) {
        tracksToPublish.push(tracks.audioTrack)
        console.log('🎤 Adding audio track to publish')
      }

      if (tracksToPublish.length > 0) {
        console.log('📤 Publishing', tracksToPublish.length, 'local tracks...')
        await agoraClient.publish(tracksToPublish)
        console.log('✅ Published local tracks successfully:', {
          publishedVideo: !!tracks.videoTrack,
          publishedAudio: !!tracks.audioTrack
        })
      } else {
        console.warn('⚠️ No tracks to publish!')
      }

      setIsConnected(true)
      setIsConnecting(false)
      isJoiningRef.current = false
      console.log('🎉 Call connection complete!')
      toast.success('Connected to call')
    } catch (error) {
      console.error('❌ Error joining call:', error)

      let errorMessage = 'Failed to join call'

      if (error && typeof error === 'object' && 'code' in error) {
        console.error('Error code:', error.code)
        if (error.code === 'PERMISSION_DENIED') {
          errorMessage = 'Camera or microphone permission denied. Please enable them in your browser settings.'
        } else if (error.code === 'NETWORK_ERROR') {
          errorMessage = 'Network connection failed. Please check your internet connection.'
        }
      }

      if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        console.error('Error message:', error.message)
        errorMessage = error.message
      }

      console.error('Final error message:', errorMessage)

      setConnectionError(errorMessage)
      toast.error(errorMessage)
      onError?.(error instanceof Error ? error : new Error(errorMessage))
      setIsConnecting(false)
      isJoiningRef.current = false
    }
  }, [
    isConnecting,
    isConnected,
    channelName,
    localVideoEnabled,
    localAudioEnabled,
    initializeClient,
    onError,
  ])

  /**
   * Leave the video call
   */
  const leaveCall = useCallback(async () => {
    try {
      const agoraClient = clientRef.current

      // Stop and close local tracks
      if (localTracksRef.current.videoTrack) {
        localTracksRef.current.videoTrack.stop()
        localTracksRef.current.videoTrack.close()
      }
      if (localTracksRef.current.audioTrack) {
        localTracksRef.current.audioTrack.stop()
        localTracksRef.current.audioTrack.close()
      }
      if (localTracksRef.current.screenTrack) {
        localTracksRef.current.screenTrack.stop()
        localTracksRef.current.screenTrack.close()
      }

      setLocalTracks({ videoTrack: null, audioTrack: null, screenTrack: null })
      localTracksRef.current = { videoTrack: null, audioTrack: null, screenTrack: null }

      // Leave the channel
      if (agoraClient) {
        await agoraClient.leave()
        console.log('Left the channel')
      }

      // Reset state
      setIsConnected(false)
      setRemoteUsers(new Map())
      remoteUsersRef.current = new Map()
      setConnectionError(null)
      isJoiningRef.current = false

      toast.success('Left the call')
    } catch (error) {
      console.error('Error leaving call:', error)
      toast.error('Error leaving call')
      isJoiningRef.current = false
    }
  }, [])

  /**
   * Toggle local audio (mute/unmute)
   */
  const toggleAudio = useCallback(async () => {
    try {
      const audioTrack = localTracksRef.current.audioTrack

      if (!audioTrack) {
        console.warn('No audio track to toggle')
        return
      }

      const newState = !localAudioEnabled
      await audioTrack.setEnabled(newState)
      setLocalAudioEnabled(newState)

      toast.success(newState ? 'Microphone unmuted' : 'Microphone muted', {
        icon: newState ? '🎤' : '🔇',
      })
    } catch (error) {
      console.error('Error toggling audio:', error)
      toast.error('Failed to toggle microphone')
    }
  }, [localAudioEnabled])

  /**
   * Toggle local video (camera on/off)
   */
  const toggleVideo = useCallback(async () => {
    try {
      const videoTrack = localTracksRef.current.videoTrack

      if (!videoTrack) {
        console.warn('No video track to toggle')
        return
      }

      const newState = !localVideoEnabled
      await videoTrack.setEnabled(newState)
      setLocalVideoEnabled(newState)

      toast.success(newState ? 'Camera enabled' : 'Camera disabled', {
        icon: newState ? '📹' : '📵',
      })
    } catch (error) {
      console.error('Error toggling video:', error)
      toast.error('Failed to toggle camera')
    }
  }, [localVideoEnabled])

  /**
   * Start screen sharing
   */
  const startScreenShare = useCallback(async () => {
    console.log('🚀 START SCREEN SHARE CALLED', new Error().stack)
    try {
      // AGGRESSIVE GUARD: Prevent duplicate calls
      if (isStartingScreenShareRef.current) {
        console.warn('⛔ Already starting screen share, ignoring duplicate call')
        return
      }

      if (isScreenSharing) {
        console.warn('⛔ Already screen sharing')
        return
      }

      console.log('✅ Proceeding with screen share start')

      if (screenShareUserId) {
        toast.error('Someone else is already sharing their screen')
        return
      }

      const agoraClient = clientRef.current
      if (!agoraClient || !isConnected) {
        toast.error('Not connected to call')
        return
      }

      // Set guard flag
      isStartingScreenShareRef.current = true

      // Show helpful guidance toast BEFORE the browser picker appears
      toast('Select a specific window or tab (not "Entire Screen") to avoid infinite mirror effect', {
        duration: 6000,
        icon: '💡',
        position: 'top-center',
      })

      // Create screen share track FIRST (must be immediate after user click)
      // Browser requires getDisplayMedia to be called directly from user gesture
      const screenTrackResult = await createScreenShareTrack()

      // Now unpublish camera video track (Agora doesn't allow multiple video tracks)
      const videoTrack = localTracksRef.current.videoTrack
      if (videoTrack) {
        await agoraClient.unpublish([videoTrack])
        console.log('Camera video unpublished before screen share')
      }

      // Handle both single track and array of tracks (video + audio)
      const screenTrack = Array.isArray(screenTrackResult) ? screenTrackResult[0] : screenTrackResult

      // Store the track
      localTracksRef.current.screenTrack = screenTrack
      setLocalTracks({ ...localTracksRef.current })

      // Publish screen share track(s)
      if (Array.isArray(screenTrackResult)) {
        await agoraClient.publish(screenTrackResult)
      } else {
        await agoraClient.publish([screenTrackResult])
      }
      console.log('Screen share track published')

      setIsScreenSharing(true)
      setScreenShareUserId(uidRef.current)
      toast.success('Screen sharing started')

      // Clear guard flag - success!
      isStartingScreenShareRef.current = false

      // DON'T add track-ended listener - it causes infinite loops
      // User must manually stop screen share
    } catch (error) {
      console.error('Error starting screen share:', error)
      // Clear guard flag on error
      isStartingScreenShareRef.current = false

      let errorMessage = 'Failed to start screen sharing'
      let showError = true

      if (error && typeof error === 'object' && 'name' in error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          // User clicked "Cancel" on the screen share picker - this is normal
          errorMessage = 'Screen sharing cancelled'
          showError = false // Don't show error toast for user cancellation
          console.log('User cancelled screen sharing')
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Screen sharing is not supported in this browser.'
        } else if (error.name === 'InvalidStateError') {
          errorMessage = 'Cannot start screen sharing at this time. Please try again.'
        }
      }

      // Only show error toast if it's an actual error, not user cancellation
      if (showError) {
        toast.error(errorMessage)
      }

      setIsScreenSharing(false)
    }
  }, [isScreenSharing, screenShareUserId, isConnected])

  /**
   * Stop screen sharing
   */
  const stopScreenShare = useCallback(async () => {
    console.log('🛑 STOP SCREEN SHARE CALLED', new Error().stack)
    try {
      // AGGRESSIVE GUARD: Prevent duplicate calls
      if (isStoppingScreenShareRef.current) {
        console.warn('⛔ Already stopping screen share, ignoring duplicate call')
        return
      }

      console.log('✅ Proceeding with screen share stop')

      const agoraClient = clientRef.current
      const screenTrack = localTracksRef.current.screenTrack

      if (!screenTrack) {
        console.warn('No screen share track to stop')
        return
      }

      // Set guard flag
      isStoppingScreenShareRef.current = true

      // Remove all event listeners from the track to prevent loops
      try {
        screenTrack.removeAllListeners()
      } catch (e) {
        // Ignore if removeAllListeners fails
      }

      // Unpublish screen share track
      if (agoraClient && isConnected) {
        await agoraClient.unpublish([screenTrack])
        console.log('Screen share track unpublished')
      }

      // Stop and close the track
      screenTrack.stop()
      screenTrack.close()

      // Clear the track
      localTracksRef.current.screenTrack = null
      setLocalTracks({ ...localTracksRef.current })

      // Re-publish camera video track if it exists and was enabled
      const videoTrack = localTracksRef.current.videoTrack
      if (agoraClient && isConnected && videoTrack && localVideoEnabled) {
        await agoraClient.publish([videoTrack])
        console.log('Camera video re-published after screen share')
      }

      setIsScreenSharing(false)
      setScreenShareUserId(null)
      toast.success('Screen sharing stopped')

      // Clear guard flag - success!
      isStoppingScreenShareRef.current = false
    } catch (error) {
      console.error('Error stopping screen share:', error)
      toast.error('Failed to stop screen sharing')

      // Clear guard flag on error
      isStoppingScreenShareRef.current = false
    }
  }, [isConnected, localVideoEnabled])

  /**
   * Set volume for a remote user
   */
  const setVolume = useCallback((uid: UID, volume: number) => {
    const user = remoteUsersRef.current.get(uid)
    if (user?.audioTrack) {
      user.audioTrack.setVolume(volume)
    }
  }, [])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      if (isConnected) {
        leaveCall()
      }
    }
  }, [isConnected, leaveCall])

  return {
    // State
    isConnected,
    isConnecting,
    connectionError,
    localAudioEnabled,
    localVideoEnabled,
    isScreenSharing,
    remoteUsers,
    networkQuality,
    screenShareUserId,

    // Actions
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    setVolume,

    // Client reference
    client,
    localTracks,
  }
}
