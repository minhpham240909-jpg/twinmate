'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Tldraw, Editor, TLStoreSnapshot, createTLStore, defaultShapeUtils } from 'tldraw'
import 'tldraw/tldraw.css'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/auth/context'

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
  const { user } = useAuth()
  const [whiteboard, setWhiteboard] = useState<SessionWhiteboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const editorRef = useRef<Editor | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  // Fix hydration: only render after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load whiteboard on mount
  useEffect(() => {
    if (mounted) {
      loadWhiteboard()
    }
  }, [sessionId, mounted])

  // Set up real-time sync for other users' changes
  useEffect(() => {
    if (!mounted) return

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
        async (payload) => {
          console.log('[Whiteboard] Real-time update received:', payload)
          const updated = payload.new as SessionWhiteboard
          
          // Only reload if the update was from another user
          if (updated.lastEditedBy !== user?.id) {
            setWhiteboard(updated)
            // Optionally reload the canvas state here
            await loadCanvasState()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, mounted, user?.id])

  const loadWhiteboard = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/study-sessions/${sessionId}/whiteboard`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to load whiteboard')

      setWhiteboard(data.whiteboard)
      setError(null)
      
      // Load canvas state if it exists
      await loadCanvasState()
    } catch (err: any) {
      console.error('[Whiteboard] Load error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadCanvasState = async () => {
    try {
      // Load persisted state from localStorage first (instant)
      const persistedState = localStorage.getItem(`tldraw-${sessionId}`)
      if (persistedState && editorRef.current) {
        try {
          const snapshot = JSON.parse(persistedState) as TLStoreSnapshot
          // Use tldraw v4 API for loading snapshot
          editorRef.current.store.put(Object.values(snapshot.store || {}))
          console.log('[Whiteboard] Loaded state from localStorage')
        } catch (e) {
          console.error('[Whiteboard] Failed to parse persisted state:', e)
        }
      }
    } catch (err) {
      console.error('[Whiteboard] Error loading canvas state:', err)
    }
  }

  const saveCanvasState = useCallback(async () => {
    if (!editorRef.current || isSaving) return

    try {
      setIsSaving(true)
      
      // Get current snapshot from tldraw using v4 API
      const allRecords = editorRef.current.store.allRecords()
      const snapshot = {
        store: allRecords.reduce((acc, record) => {
          acc[record.id] = record
          return acc
        }, {} as Record<string, any>),
        schema: editorRef.current.store.schema.serialize()
      }
      const snapshotJson = JSON.stringify(snapshot)
      
      // Save to localStorage for instant persistence
      localStorage.setItem(`tldraw-${sessionId}`, snapshotJson)
      
      // Debounced save to backend
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/whiteboard/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              whiteboardData: snapshot,
              title: whiteboard?.title || 'Whiteboard'
            })
          })
          
          const data = await res.json()
          
          if (data.success) {
            console.log('[Whiteboard] Saved to backend, version:', data.whiteboard.version)
          } else {
            console.error('[Whiteboard] Save failed:', data.error)
          }
        } catch (err) {
          console.error('[Whiteboard] Backend save error:', err)
        } finally {
          setIsSaving(false)
        }
      }, 2000) // Debounce 2 seconds
      
    } catch (err) {
      console.error('[Whiteboard] Save error:', err)
      setIsSaving(false)
    }
  }, [sessionId, whiteboard?.title, isSaving])

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor
    console.log('[Whiteboard] Tldraw mounted successfully')
    
    // Load initial state
    loadCanvasState()
    
    // Listen for changes and save
    const cleanupFn = editor.store.listen((entry) => {
      // Save on any store change
      saveCanvasState()
    }, { scope: 'all' })
    
    return () => {
      cleanupFn()
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [saveCanvasState])

  if (!mounted) {
    return null // Prevent hydration mismatch
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          <div className="text-gray-500">Loading whiteboard...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
          <p className="font-semibold mb-2">⚠️ Error Loading Whiteboard</p>
          <p>{error}</p>
        </div>
        <button
          onClick={loadWhiteboard}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          🔄 Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">🎨 Collaborative Whiteboard</h3>
          <p className="text-sm text-gray-500 mt-1">
            Draw, annotate, and collaborate in real-time with your study partners
          </p>
        </div>
        {isSaving && (
          <span className="text-xs text-gray-500 flex items-center gap-2">
            <div className="animate-spin w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full"></div>
            Saving...
          </span>
        )}
      </div>

      {/* Whiteboard Info */}
      {whiteboard && mounted && (
        <div className="text-xs text-gray-500">
          Version {whiteboard.version} • Auto-saves every 2 seconds
        </div>
      )}

      {/* Tldraw Canvas */}
      <div 
        className="w-full border-2 border-gray-200 rounded-lg bg-white overflow-hidden" 
        style={{ height: '600px' }}
      >
        <Tldraw
          onMount={handleMount}
          autoFocus
        />
      </div>

      {/* Help Text */}
      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <p className="font-medium mb-1">💡 Whiteboard Tips:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Use the toolbar on the left to select drawing tools</li>
          <li>Select mode (V) to move and resize objects</li>
          <li>Draw mode (D) to create freehand drawings</li>
          <li>Add text (T), shapes, arrows, and sticky notes</li>
          <li>Your changes save automatically every 2 seconds</li>
          <li>All participants see updates in real-time</li>
        </ul>
      </div>
    </div>
  )
}
