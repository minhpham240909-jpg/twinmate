'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { X, Mail, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Banner that appears at the top of the page when user's email is not verified
 */
export function EmailVerificationBanner() {
  const { user } = useAuth()
  const [verified, setVerified] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user) {
      setVerified(true)
      setChecking(false)
      return
    }

    // Check verification status
    async function checkVerification() {
      try {
        const response = await fetch('/api/auth/verify-email')
        if (response.ok) {
          const data = await response.json()
          setVerified(data.verified)
        }
      } catch (error) {
        console.error('Error checking email verification:', error)
      } finally {
        setChecking(false)
      }
    }

    checkVerification()
  }, [user])

  const handleResend = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Verification email sent! Please check your inbox.')
      } else {
        toast.error(data.error || 'Failed to send verification email')
      }
    } catch (error) {
      toast.error('Failed to send verification email')
    } finally {
      setLoading(false)
    }
  }

  // Don't show banner if:
  // - User is not logged in
  // - Email is verified
  // - Banner was dismissed
  // - Still checking status
  if (!user || verified || dismissed || checking) {
    return null
  }

  return (
    <div className="bg-yellow-500/10 backdrop-blur-md border-b border-yellow-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-yellow-100">
                <span className="font-medium">Email verification required.</span>{' '}
                Please verify your email address to access all features. Check your inbox for the verification link.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleResend}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-yellow-100 bg-yellow-600/30 backdrop-blur-sm border border-yellow-500/40 rounded-lg hover:bg-yellow-600/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Mail className="h-4 w-4" />
              {loading ? 'Sending...' : 'Resend Email'}
            </button>

            <button
              onClick={() => setDismissed(true)}
              className="inline-flex items-center justify-center p-1.5 text-yellow-300 hover:bg-yellow-500/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-colors backdrop-blur-sm"
              aria-label="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
