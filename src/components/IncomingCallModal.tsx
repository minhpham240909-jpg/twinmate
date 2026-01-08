'use client'

/**
 * IncomingCallModal - Real-time incoming call notification UI
 *
 * This component displays incoming call notifications with:
 * - Animated UI with pulse effects
 * - Caller avatar and name
 * - Accept/Decline buttons
 * - Ringtone audio
 * - Auto-dismiss after 30 seconds
 *
 * Uses IncomingCallContext for real-time Supabase subscriptions
 */

import { useEffect, useCallback } from 'react'
import Image from 'next/image'
import GlowBorder from '@/components/ui/GlowBorder'
import Pulse from '@/components/ui/Pulse'
import Bounce from '@/components/ui/Bounce'
import { useIncomingCall } from '@/contexts/IncomingCallContext'

export default function IncomingCallModal() {
  const { incomingCall, isRinging, acceptCall, declineCall } = useIncomingCall()

  // Ringtone audio effect
  // CRITICAL: Properly manage Web Audio Context to prevent memory leaks
  useEffect(() => {
    if (!incomingCall || !isRinging) return

    let audioContext: AudioContext | null = null
    let gainNode: GainNode | null = null
    let currentOscillator: OscillatorNode | null = null
    let ringInterval: NodeJS.Timeout | null = null
    let isCleanedUp = false

    const createRingtone = () => {
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        gainNode = audioContext.createGain()
        gainNode.connect(audioContext.destination)
        gainNode.gain.value = 0.1 // Volume

        const startRing = () => {
          if (isCleanedUp || !audioContext || !gainNode) return

          // Stop previous oscillator if exists
          if (currentOscillator) {
            try {
              currentOscillator.stop()
              currentOscillator.disconnect()
            } catch {
              // Ignore errors from already stopped oscillators
            }
          }

          // Create new oscillator for this ring cycle
          currentOscillator = audioContext.createOscillator()
          currentOscillator.connect(gainNode)
          currentOscillator.frequency.value = 440 // A4 note
          currentOscillator.start()

          // Stop after 2 seconds (ring duration)
          setTimeout(() => {
            if (currentOscillator && !isCleanedUp) {
              try {
                currentOscillator.stop()
                currentOscillator.disconnect()
              } catch {
                // Ignore errors
              }
              currentOscillator = null
            }
          }, 2000)
        }

        // Start first ring immediately
        startRing()

        // Repeat ring every 3 seconds (2s ring + 1s pause)
        ringInterval = setInterval(startRing, 3000)
      } catch (error) {
        console.error('Error creating ringtone:', error)
      }
    }

    createRingtone()

    // CRITICAL: Cleanup function to prevent memory leaks
    return () => {
      isCleanedUp = true

      if (ringInterval) {
        clearInterval(ringInterval)
        ringInterval = null
      }

      if (currentOscillator) {
        try {
          currentOscillator.stop()
          currentOscillator.disconnect()
        } catch {
          // Ignore errors from already stopped oscillators
        }
        currentOscillator = null
      }

      if (gainNode) {
        try {
          gainNode.disconnect()
        } catch {
          // Ignore errors
        }
        gainNode = null
      }

      if (audioContext) {
        try {
          audioContext.close()
        } catch {
          // Ignore errors from already closed context
        }
        audioContext = null
      }
    }
  }, [incomingCall, isRinging])

  // Handle accept - navigate to call page
  const handleAccept = useCallback(async () => {
    if (!incomingCall) return

    // Store call info before clearing (acceptCall will clear incomingCall state)
    const { conversationId, conversationType, callType, messageId } = incomingCall

    // Call the accept handler from context (marks notification as read, updates call status)
    await acceptCall()

    // Build call URL with all necessary params
    const callUrl = new URL(`/call/${conversationType}/${conversationId}`, window.location.origin)
    callUrl.searchParams.set('callType', callType || 'VIDEO')
    if (messageId) {
      callUrl.searchParams.set('messageId', messageId)
    }

    // Navigate to the dedicated call page
    // Use window.location.href for full page navigation to ensure clean state
    window.location.href = callUrl.toString()
  }, [incomingCall, acceptCall])

  // Handle decline
  const handleDecline = useCallback(async () => {
    await declineCall()
  }, [declineCall])

  // Don't render if no incoming call
  if (!incomingCall) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center">
        {/* Modal */}
        <Bounce>
          <GlowBorder color="#3b82f6" animated={true} style={{ borderRadius: 16 }}>
            <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8 max-w-md w-full mx-4">
              {/* Caller Avatar */}
              <div className="flex flex-col items-center mb-6">
                <Pulse>
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-3xl font-bold mb-4 ring-4 ring-blue-200 overflow-hidden">
                    {incomingCall.callerAvatar ? (
                      <Image
                        src={incomingCall.callerAvatar}
                        alt={incomingCall.callerName}
                        width={96}
                        height={96}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      incomingCall.callerName.charAt(0).toUpperCase()
                    )}
                  </div>
                </Pulse>

                {/* Call Info */}
                <Bounce delay={0.1}>
                  <h2 className="text-2xl font-bold text-white mb-2 text-center">
                    {incomingCall.callerName}
                  </h2>
                </Bounce>

                {/* Group name if applicable */}
                {incomingCall.isGroupCall && incomingCall.groupName && (
                  <Bounce delay={0.15}>
                    <p className="text-blue-400 text-sm mb-1">
                      {incomingCall.groupName}
                    </p>
                  </Bounce>
                )}

                <Bounce delay={0.2}>
                  <p className="text-slate-300 mb-1">
                    {incomingCall.isGroupCall ? 'Group Call' : 'Incoming Call'}
                    {incomingCall.callType === 'AUDIO' && ' (Audio)'}
                    {incomingCall.callType === 'VIDEO' && ' (Video)'}
                  </p>
                </Bounce>

                <Bounce delay={0.3}>
                  <Pulse>
                    <p className="text-sm text-slate-400">
                      {isRinging ? '📞 Ringing...' : 'Connecting...'}
                    </p>
                  </Pulse>
                </Bounce>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                {/* Decline Button */}
                <Bounce delay={0.4}>
                  <button
                    onClick={handleDecline}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-4 px-6 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Decline
                  </button>
                </Bounce>

                {/* Accept Button */}
                <Bounce delay={0.5}>
                  <Pulse>
                    <button
                      onClick={handleAccept}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Accept
                    </button>
                  </Pulse>
                </Bounce>
              </div>

              {/* Auto-dismiss timer */}
              <p className="text-center text-xs text-slate-500 mt-4">
                Call will timeout in 30 seconds
              </p>
            </div>
          </GlowBorder>
        </Bounce>
      </div>
    </>
  )
}
