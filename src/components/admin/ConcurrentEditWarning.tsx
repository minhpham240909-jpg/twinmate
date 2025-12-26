// Concurrent Edit Warning Component
// Shows real-time warnings when other admins are viewing/editing the same resource
// Uses WebSocket presence for instant notifications

'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Users, X } from 'lucide-react'
import { useAdminConcurrentEdit } from '@/hooks/useAdminRealtime'

interface ConcurrentEditWarningProps {
  adminId: string
  resourceType: string
  resourceId: string
  resourceName?: string
}

export function ConcurrentEditWarning({
  adminId,
  resourceType,
  resourceId,
  resourceName,
}: ConcurrentEditWarningProps) {
  const { otherAdmins, hasConflict } = useAdminConcurrentEdit(
    adminId,
    resourceType,
    resourceId
  )

  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed state when other admins change
  useEffect(() => {
    if (hasConflict) {
      setDismissed(false)
    }
  }, [hasConflict, otherAdmins.length])

  if (!hasConflict || dismissed) {
    return null
  }

  const adminCount = otherAdmins.length
  const adminNames = otherAdmins
    .map(a => a.adminId.split('@')[0] || 'Another admin')
    .join(', ')

  return (
    <div className="relative mb-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 p-1 text-yellow-400 hover:text-yellow-300 transition-colors"
        aria-label="Dismiss warning"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="flex-shrink-0 p-2 bg-yellow-500/20 rounded-full">
          {adminCount > 1 ? (
            <Users className="w-5 h-5 text-yellow-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-yellow-300">
            {adminCount === 1
              ? 'Another admin is viewing this'
              : `${adminCount} other admins are viewing this`}
          </h4>
          <p className="mt-1 text-sm text-yellow-200/80">
            {resourceName
              ? `${adminNames} ${adminCount === 1 ? 'is' : 'are'} currently viewing "${resourceName}". Changes may conflict.`
              : `${adminNames} ${adminCount === 1 ? 'is' : 'are'} currently viewing this ${resourceType}. Coordinate before making changes.`}
          </p>

          {/* Show admin list with timestamps */}
          {adminCount > 0 && (
            <div className="mt-3 space-y-1">
              {otherAdmins.slice(0, 5).map((admin, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs text-yellow-200/60"
                >
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="truncate">
                    {admin.adminId.split('@')[0] || 'Admin'}
                  </span>
                  <span className="text-yellow-200/40">
                    • {formatTimeAgo(admin.timestamp)}
                  </span>
                </div>
              ))}
              {adminCount > 5 && (
                <div className="text-xs text-yellow-200/40">
                  + {adminCount - 5} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper to format timestamps
function formatTimeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)

  if (seconds < 30) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

// Compact inline version for tight spaces
export function ConcurrentEditBadge({
  adminId,
  resourceType,
  resourceId,
}: Omit<ConcurrentEditWarningProps, 'resourceName'>) {
  const { otherAdmins, hasConflict } = useAdminConcurrentEdit(
    adminId,
    resourceType,
    resourceId
  )

  if (!hasConflict) {
    return null
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium"
      title={`${otherAdmins.length} other admin(s) viewing`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
      {otherAdmins.length} viewing
    </div>
  )
}
