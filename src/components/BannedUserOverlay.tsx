'use client'

/**
 * Banned User Overlay Component
 * Shows when a user is banned or deactivated
 * Blocks access to the app with an informative message
 */

import { useAccessStatus, formatBanExpiration } from '@/hooks/useAccessStatus'
import { useAuth } from '@/lib/auth/context'

interface BannedUserOverlayProps {
  children: React.ReactNode
}

export default function BannedUserOverlay({ children }: BannedUserOverlayProps) {
  const { user, signOut } = useAuth()
  const { canAccess, banStatus, isDeactivated, reason, isLoading } = useAccessStatus()

  // Don't block if:
  // - No user is logged in
  // - Still loading
  // - User can access
  if (!user || isLoading || canAccess) {
    return <>{children}</>
  }

  // User is banned
  if (banStatus?.isBanned) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-red-500/30 shadow-2xl p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-2">Account Suspended</h1>

          {/* Ban type */}
          <div className="mb-4">
            {banStatus.banType === 'PERMANENT' ? (
              <span className="inline-block px-3 py-1 bg-red-500/20 text-red-400 text-sm font-semibold rounded-full">
                Permanent Ban
              </span>
            ) : (
              <span className="inline-block px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm font-semibold rounded-full">
                Temporary Ban - Expires {formatBanExpiration(banStatus.expiresAt)}
              </span>
            )}
          </div>

          {/* Reason */}
          {banStatus.reason && (
            <div className="bg-slate-800 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm text-slate-400 mb-1">Reason:</p>
              <p className="text-slate-200">{banStatus.reason}</p>
            </div>
          )}

          {/* Message */}
          <p className="text-slate-400 mb-6">
            Your account has been suspended for violating our community guidelines.
            {banStatus.banType === 'TEMPORARY' && (
              <> Your access will be restored {formatBanExpiration(banStatus.expiresAt)}.</>
            )}
          </p>

          {/* Appeal link */}
          <p className="text-sm text-slate-500 mb-6">
            If you believe this is a mistake, please contact support at{' '}
            <a href="mailto:support@clerva.com" className="text-blue-400 hover:underline">
              support@clerva.com
            </a>
          </p>

          {/* Sign out button */}
          <button
            onClick={() => signOut()}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // User is deactivated
  if (isDeactivated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-yellow-500/30 shadow-2xl p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-2">Account Deactivated</h1>

          {/* Reason */}
          {reason && (
            <div className="bg-slate-800 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm text-slate-400 mb-1">Reason:</p>
              <p className="text-slate-200">{reason}</p>
            </div>
          )}

          {/* Message */}
          <p className="text-slate-400 mb-6">
            Your account has been deactivated by an administrator.
            If you believe this is a mistake, please contact support.
          </p>

          {/* Contact support */}
          <p className="text-sm text-slate-500 mb-6">
            Contact us at{' '}
            <a href="mailto:support@clerva.com" className="text-blue-400 hover:underline">
              support@clerva.com
            </a>
          </p>

          {/* Sign out button */}
          <button
            onClick={() => signOut()}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // Fallback - should not reach here
  return <>{children}</>
}
