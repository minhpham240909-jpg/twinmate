// Agora RTC Client Initialization and Utilities

import AgoraRTC, { type IAgoraRTCClient } from 'agora-rtc-sdk-ng'

// Lazy initialization - only run on client side
let isInitialized = false

function initializeAgoraSDK() {
  if (isInitialized || typeof window === 'undefined') {
    return
  }

  // Set log level - reduce noise from expected errors
  if (process.env.NODE_ENV === 'development') {
    AgoraRTC.setLogLevel(4) // 0: Debug, 1: Info, 2: Warning, 3: Error, 4: None (silence all)
  } else {
    AgoraRTC.setLogLevel(4) // Production: no logs
  }

  // Filter out expected "user cancelled" errors from console
  if (typeof window !== 'undefined') {
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      const message = args.join(' ')

      // Don't log Agora "user cancelled screen share" errors
      if (
        message.includes('PERMISSION_DENIED') &&
        (message.includes('NotAllowedError') || message.includes('user denied permission'))
      ) {
        // This is expected when user cancels - log as info instead
        console.log('Screen share cancelled by user (this is normal)')
        return
      }

      // Log all other errors normally
      originalError.apply(console, args)
    }
  }

  isInitialized = true
}

/**
 * Create a new Agora RTC client
 * @returns IAgoraRTCClient instance
 */
export function createAgoraClient(): IAgoraRTCClient {
  // Initialize SDK on first client creation
  initializeAgoraSDK()

  const client = AgoraRTC.createClient({
    mode: 'rtc', // Real-time communication mode
    codec: 'vp8', // VP8 codec for better browser compatibility
  })

  return client
}

/**
 * Fetch Agora token from server
 * @param channelName - Agora channel name
 * @param uid - User ID (optional, will be generated if not provided)
 * @returns Promise with token data
 */
export async function fetchAgoraToken(
  channelName: string,
  uid?: number | string
): Promise<{
  token: string
  appId: string
  channelName: string
  uid: number
  expiresAt: number
}> {
  try {
    const response = await fetch('/api/messages/agora-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channelName,
        uid,
        role: 'publisher', // All users can publish video/audio
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to fetch Agora token')
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Failed to generate token')
    }

    return data
  } catch (error) {
    console.error('Error fetching Agora token:', error)
    throw error
  }
}

/**
 * Check if browser supports Agora RTC
 * @returns boolean indicating support
 */
export function checkSystemRequirements(): {
  supported: boolean
  details: {
    videoSupported: boolean
    audioSupported: boolean
    screenShareSupported: boolean
  }
} {
  // Return false if running on server
  if (typeof window === 'undefined') {
    return {
      supported: false,
      details: {
        videoSupported: false,
        audioSupported: false,
        screenShareSupported: false,
      },
    }
  }

  const videoSupported = AgoraRTC.checkVideoTrackIsActive !== undefined
  const audioSupported = AgoraRTC.checkAudioTrackIsActive !== undefined
  const screenShareSupported =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getDisplayMedia !== 'undefined'

  return {
    supported: videoSupported && audioSupported,
    details: {
      videoSupported,
      audioSupported,
      screenShareSupported,
    },
  }
}

/**
 * Get available camera devices
 */
export async function getCameraDevices(): Promise<MediaDeviceInfo[]> {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const devices = await AgoraRTC.getCameras()
    return devices
  } catch (error) {
    console.error('Error getting cameras:', error)
    return []
  }
}

/**
 * Get available microphone devices
 */
export async function getMicrophoneDevices(): Promise<MediaDeviceInfo[]> {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const devices = await AgoraRTC.getMicrophones()
    return devices
  } catch (error) {
    console.error('Error getting microphones:', error)
    return []
  }
}

/**
 * Create local video and audio tracks
 */
export async function createLocalTracks(options?: {
  videoEnabled?: boolean
  audioEnabled?: boolean
  cameraId?: string
  microphoneId?: string
}) {
  if (typeof window === 'undefined') {
    throw new Error('Cannot create tracks on server side')
  }

  const { videoEnabled = true, audioEnabled = true, cameraId, microphoneId } = options || {}

  try {
    const tracks: {
      videoTrack?: Awaited<ReturnType<typeof AgoraRTC.createCameraVideoTrack>>
      audioTrack?: Awaited<ReturnType<typeof AgoraRTC.createMicrophoneAudioTrack>>
    } = {}

    if (videoEnabled) {
      tracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
        cameraId,
        encoderConfig: {
          width: 640,
          height: 480,
          frameRate: 15,
          bitrateMin: 400,
          bitrateMax: 1000,
        },
      })
    }

    if (audioEnabled) {
      tracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        microphoneId,
        encoderConfig: {
          sampleRate: 48000,
          stereo: true,
          bitrate: 128,
        },
      })
    }

    return tracks
  } catch (error) {
    console.error('Error creating local tracks:', error)
    throw error
  }
}

/**
 * Create screen share track with advanced configuration
 * NOTE: This is configured to prefer window/tab selection and exclude current tab
 * to avoid infinite tunnel effect
 */
export async function createScreenShareTrack() {
  if (typeof window === 'undefined') {
    throw new Error('Cannot create screen share track on server side')
  }

  try {
    // IMPORTANT: We need to request the display media with specific constraints
    // to prevent the infinite tunnel effect

    // First, try using native getDisplayMedia with advanced constraints
    // This gives us more control over what can be shared
    if (navigator.mediaDevices?.getDisplayMedia) {
      try {
        // Request screen share with preferences to avoid infinite mirror
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'window', // Prefer window over screen/monitor
            selfBrowserSurface: 'exclude', // Exclude the current browser tab (Chrome 94+)
            surfaceSwitching: 'include', // Allow switching between windows
            systemAudio: 'exclude', // Don't capture system audio
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 15, max: 30 },
          } as MediaTrackConstraints,
          audio: false, // No audio from screen share
        })

        // Create Agora track from the MediaStream
        const videoTrack = stream.getVideoTracks()[0]

        // Use Agora's method to create a track from the existing MediaStreamTrack
        const screenTrack = AgoraRTC.createCustomVideoTrack({
          mediaStreamTrack: videoTrack,
        })

        console.log('✅ Screen share created with advanced constraints to prevent infinite mirror')
        return screenTrack
      } catch (nativeError) {
        console.warn('Advanced screen share constraints not supported, falling back to Agora default:', nativeError)
        // Fall through to default Agora method
      }
    }

    // Fallback: Use Agora's default method (for older browsers)
    const screenTrack = await AgoraRTC.createScreenVideoTrack(
      {
        encoderConfig: {
          width: 1920,
          height: 1080,
          frameRate: 15,
          bitrateMin: 1000,
          bitrateMax: 3000,
        },
        optimizationMode: 'detail', // Better for text/documents
      },
      'disable' // Disable audio capture from screen share
    )

    return screenTrack
  } catch (error) {
    console.error('Error creating screen share track:', error)
    throw error
  }
}

/**
 * Format network quality as human-readable string
 */
export function getNetworkQualityLabel(quality: number): {
  label: string
  color: string
} {
  switch (quality) {
    case 0:
      return { label: 'Unknown', color: 'gray' }
    case 1:
      return { label: 'Excellent', color: 'green' }
    case 2:
      return { label: 'Good', color: 'green' }
    case 3:
      return { label: 'Fair', color: 'yellow' }
    case 4:
      return { label: 'Poor', color: 'orange' }
    case 5:
      return { label: 'Very Poor', color: 'red' }
    case 6:
      return { label: 'Disconnected', color: 'red' }
    default:
      return { label: 'Unknown', color: 'gray' }
  }
}
