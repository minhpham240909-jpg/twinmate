'use client'

import { useState, useEffect } from 'react'
import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import { createClient } from '@/lib/supabase/client'

interface SessionWhiteboard {
  id: string
  sessionId: string
  title: string
  description: string | null
  snapshotUrl: string | null
  thumbnailUrl: string | null
  lastEditedBy: string | null
  lastSyncedAt: Date
  version: number
  createdAt: Date
  updatedAt: Date
}

interface SessionWhiteboardProps {
  sessionId: string
}

export default function SessionWhiteboard({ sessionId }: SessionWhiteboardProps) {
  const [whiteboard, setWhiteboard] = useState<SessionWhiteboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Load whiteboard on mount
  useEffect(() => {
    loadWhiteboard()
  }, [sessionId])

  // Set up real-time sync
  useEffect(() => {
    const channel = supabase
      .channel(`session-whiteboard:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'SessionWhiteboard',
          filter: `sessionId=eq.${sessionId}`,
        },
        (payload) => {
          console.log('[Whiteboard] Real-time update received:', payload)
          handleRealtimeUpdate(payload.new as SessionWhiteboard)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  const loadWhiteboard = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/study-sessions/${sessionId}/whiteboard`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to load whiteboard')

      setWhiteboard(data.whiteboard)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRealtimeUpdate = (updatedWhiteboard: SessionWhiteboard) => {
    setWhiteboard(updatedWhiteboard)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading whiteboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Collaborative Whiteboard</h3>
          <p className="text-sm text-gray-500 mt-1">
            Draw, annotate, and collaborate in real-time with your study partners
          </p>
        </div>
      </div>

      {/* Whiteboard Info */}
      {whiteboard && (
        <div className="text-xs text-gray-500">
          Last synced: {new Date(whiteboard.lastSyncedAt).toLocaleString()} • Version {whiteboard.version}
        </div>
      )}

      {/* Tldraw Canvas */}
      <div className="relative w-full" style={{ height: '600px' }}>
        <div className="absolute inset-0 border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
          <Tldraw
            key={`whiteboard-${sessionId}`}
            autoFocus
            persistenceKey={`whiteboard-${sessionId}`}
            onMount={() => {
              console.log('[Whiteboard] Tldraw mounted successfully')
            }}
          />
        </div>
      </div>

      {/* Help Text */}
      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <p className="font-medium mb-1">💡 Whiteboard Tips:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Use the toolbar on the left to select drawing tools</li>
          <li>Select mode (V) to move and resize objects</li>
          <li>Draw mode (D) to create freehand drawings</li>
          <li>Add text (T), shapes, arrows, and sticky notes</li>
          <li>Your changes are saved automatically and synced with other participants</li>
        </ul>
      </div>
    </div>
  )
}
