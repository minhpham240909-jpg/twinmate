'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseVoiceRecordingOptions {
  maxDuration?: number // Max recording duration in seconds (default: 60)
  onTranscriptionComplete?: (text: string) => void
  onError?: (error: string) => void
}

interface UseVoiceRecordingReturn {
  isRecording: boolean
  isTranscribing: boolean
  isSupported: boolean
  duration: number
  error: string | null
  startRecording: () => Promise<void>
  stopRecording: () => Promise<string | null>
  cancelRecording: () => void
}

export function useVoiceRecording(options: UseVoiceRecordingOptions = {}): UseVoiceRecordingReturn {
  const {
    maxDuration = 60,
    onTranscriptionComplete,
    onError,
  } = options

  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  // Check browser support on mount
  useEffect(() => {
    const checkSupport = () => {
      const hasMediaDevices = typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'

      const hasMediaRecorder = typeof MediaRecorder !== 'undefined'

      setIsSupported(hasMediaDevices && hasMediaRecorder)
    }

    checkSupport()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      const msg = 'Voice recording is not supported in this browser'
      setError(msg)
      onError?.(msg)
      return
    }

    setError(null)
    audioChunksRef.current = []

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })

      streamRef.current = stream

      // Create MediaRecorder with best available codec
      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      })

      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onerror = () => {
        const msg = 'Recording failed. Please try again.'
        setError(msg)
        onError?.(msg)
        stopRecordingInternal()
      }

      // Start recording
      recorder.start(1000) // Collect data every second
      setIsRecording(true)
      startTimeRef.current = Date.now()
      setDuration(0)

      // Update duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setDuration(elapsed)

        // Auto-stop at max duration
        if (elapsed >= maxDuration) {
          stopRecording()
        }
      }, 100)

    } catch (err) {
      console.error('[Voice Recording] Error starting:', err)

      let msg = 'Could not access microphone'
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          msg = 'Microphone permission denied. Please allow access in your browser settings.'
        } else if (err.name === 'NotFoundError') {
          msg = 'No microphone found. Please connect a microphone.'
        }
      }

      setError(msg)
      onError?.(msg)
    }
  }, [isSupported, maxDuration, onError])

  const stopRecordingInternal = useCallback(() => {
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Stop recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    setIsRecording(false)
  }, [])

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!isRecording || !mediaRecorderRef.current) {
      return null
    }

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current!

      recorder.onstop = async () => {
        stopRecordingInternal()

        // Check if we have any audio data
        if (audioChunksRef.current.length === 0) {
          const msg = 'No audio recorded. Please try again.'
          setError(msg)
          onError?.(msg)
          resolve(null)
          return
        }

        // Create audio blob
        const mimeType = recorder.mimeType || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })

        // Check minimum size
        if (audioBlob.size < 1000) {
          const msg = 'Recording too short. Please speak for at least a second.'
          setError(msg)
          onError?.(msg)
          resolve(null)
          return
        }

        // Transcribe the audio
        setIsTranscribing(true)
        setError(null)

        try {
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')

          const response = await fetch('/api/study/voice', {
            method: 'POST',
            body: formData,
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.error || 'Transcription failed')
          }

          const text = data.text || ''
          onTranscriptionComplete?.(text)
          resolve(text)

        } catch (err) {
          console.error('[Voice Recording] Transcription error:', err)
          const msg = err instanceof Error ? err.message : 'Failed to transcribe audio'
          setError(msg)
          onError?.(msg)
          resolve(null)
        } finally {
          setIsTranscribing(false)
        }
      }

      // Stop the recorder
      if (recorder.state === 'recording') {
        recorder.stop()
      } else {
        stopRecordingInternal()
        resolve(null)
      }
    })
  }, [isRecording, stopRecordingInternal, onTranscriptionComplete, onError])

  const cancelRecording = useCallback(() => {
    stopRecordingInternal()
    audioChunksRef.current = []
    setDuration(0)
    setError(null)
  }, [stopRecordingInternal])

  return {
    isRecording,
    isTranscribing,
    isSupported,
    duration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  }
}

/**
 * Get the best supported MIME type for audio recording
 */
function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ]

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }

  return 'audio/webm' // Fallback
}
