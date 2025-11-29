'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import Image from 'next/image'
import GlowBorder from '@/components/ui/GlowBorder'
import Pulse from '@/components/ui/Pulse'
import Bounce from '@/components/ui/Bounce'

interface IncomingCall {
  notificationId: string
  callerId: string
  callerName: string
  callerAvatar?: string
  conversationId: string
  conversationType: 'partner' | 'group'
  isGroupCall: boolean
}

export default function IncomingCallModal() {
  const router = useRouter()
  const { user } = useAuth()
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [isRinging, setIsRinging] = useState(false)

  // Audio element for ringtone
  useEffect(() => {
    if (incomingCall && isRinging) {
      // Create ringtone sound (browser beep)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 440 // A4 note
      gainNode.gain.value = 0.1 // Volume

      oscillator.start()

      // Ring for 2 seconds, pause 1 second, repeat
      const ringInterval = setInterval(() => {
        oscillator.stop()
        setTimeout(() => {
          const newOsc = audioContext.createOscillator()
          newOsc.connect(gainNode)
          newOsc.frequency.value = 440
          newOsc.start()
        }, 1000)
      }, 3000)

      return () => {
        clearInterval(ringInterval)
        oscillator.stop()
        audioContext.close()
      }
    }
  }, [incomingCall, isRinging])

  // TODO: Subscribe to realtime notifications instead of polling
  // The app should use Supabase realtime subscriptions for INCOMING_CALL notifications
  // Pattern: supabase.channel(`notifications:${user.id}`).on('postgres_changes', ...)
  // For now, this polling is removed to reduce API load. Incoming calls should be
  // implemented using a proper realtime notification system.
  useEffect(() => {
    if (!user?.id) return

    // Placeholder for future realtime subscription implementation
    // When implementing:
    // 1. Subscribe to Notification table changes for current user
    // 2. Filter for type === 'INCOMING_CALL' and isRead === false
    // 3. Update incomingCall state when new call notification arrives
    // 4. Clean up subscription on unmount

    console.log('IncomingCallModal: Realtime notification subscription not yet implemented')

    return () => {
      // Cleanup will go here
    }
  }, [user?.id])

  const handleAccept = async () => {
    if (!incomingCall) return

    setIsRinging(false)

    // Mark notification as read
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: incomingCall.notificationId })
      })
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }

    // Navigate to the call
    router.push(
      `/chat?conversation=${incomingCall.conversationId}&type=${incomingCall.conversationType}`
    )

    setIncomingCall(null)
  }

  const handleDecline = async () => {
    if (!incomingCall) return

    setIsRinging(false)

    // Mark notification as read (declined)
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: incomingCall.notificationId })
      })
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }

    setIncomingCall(null)
  }

  if (!incomingCall) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center">
        {/* Modal */}
        <Bounce>
          <GlowBorder color="#3b82f6" animated={true}  style={{ borderRadius: 16 }}>
            <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8 max-w-md w-full mx-4">
              {/* Caller Avatar */}
              <div className="flex flex-col items-center mb-6">
                <Pulse>
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold mb-4 ring-4 ring-blue-200">
              {incomingCall.callerAvatar ? (
                <Image
                  src={incomingCall.callerAvatar}
                  alt={incomingCall.callerName}
                  width={96}
                  height={96}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                incomingCall.callerName.charAt(0).toUpperCase()
                  )}
                  </div>
                </Pulse>

                {/* Call Info */}
                <Bounce delay={0.1}>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {incomingCall.callerName}
                  </h2>
                </Bounce>
                <Bounce delay={0.2}>
                  <p className="text-slate-300 mb-1">
                    {incomingCall.isGroupCall ? 'Group Call' : 'Incoming Call'}
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

              {/* Auto-dismiss timer (optional) */}
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
