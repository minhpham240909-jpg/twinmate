'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PresenceIndicatorProps {
  sessionId: string
}

interface PresenceState {
  user_id: string
  online_at: string
}

export default function PresenceIndicator({ sessionId }: PresenceIndicatorProps) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase.channel(`session-${sessionId}-presence`, {
      config: {
        presence: {
          key: sessionId,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const userIds = new Set<string>()

        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            const p = presence as unknown as { user_id?: string }
            if (p.user_id) {
              userIds.add(p.user_id)
            }
          })
        })

        setOnlineUsers(userIds)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track current user's presence
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            })
          }
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, supabase])

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        <span className="text-sm text-gray-600">{onlineUsers.size} online</span>
      </div>
    </div>
  )
}
