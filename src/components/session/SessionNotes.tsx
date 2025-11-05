'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SessionNote {
  id: string
  sessionId: string
  title: string
  content: string | null
  contentUrl: string | null
  lastEditedBy: string | null
  lastEditedAt: Date
  version: number
  createdAt: Date
  updatedAt: Date
}

interface SessionNotesProps {
  sessionId: string
}

export default function SessionNotes({ sessionId }: SessionNotesProps) {
  const [note, setNote] = useState<SessionNote | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [conflictWarning, setConflictWarning] = useState(false)

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const lastVersionRef = useRef<number>(0)
  const supabase = createClient()

  // Load note on mount
  useEffect(() => {
    loadNote()
  }, [sessionId])

  // Set up real-time sync
  useEffect(() => {
    const channel = supabase
      .channel(`session-notes:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'SessionNote',
          filter: `sessionId=eq.${sessionId}`,
        },
        (payload) => {
          console.log('[Notes] Real-time update received:', payload)
          handleRealtimeUpdate(payload.new as SessionNote)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  const loadNote = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/study-sessions/${sessionId}/notes`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to load note')

      const noteData = data.note
      setNote(noteData)
      setTitle(noteData.title || '')
      setContent(noteData.content || '')
      lastVersionRef.current = noteData.version
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRealtimeUpdate = (updatedNote: SessionNote) => {
    // Check if there's a version conflict
    if (updatedNote.version > lastVersionRef.current) {
      setNote(updatedNote)
      lastVersionRef.current = updatedNote.version

      // Show warning if user has unsaved changes
      if (title !== updatedNote.title || content !== (updatedNote.content || '')) {
        setConflictWarning(true)
        // Auto-dismiss after 5 seconds
        setTimeout(() => setConflictWarning(false), 5000)
      } else {
        // Update local state with server data
        setTitle(updatedNote.title || '')
        setContent(updatedNote.content || '')
      }
    }
  }

  const saveNote = useCallback(async (newTitle: string, newContent: string) => {
    try {
      setSaving(true)
      setError(null)

      const res = await fetch(`/api/study-sessions/${sessionId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save note')

      setNote(data.note)
      lastVersionRef.current = data.note.version
      setLastSaved(new Date())
      setConflictWarning(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }, [sessionId])

  const debouncedSave = useCallback((newTitle: string, newContent: string) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for auto-save (2 seconds after user stops typing)
    saveTimeoutRef.current = setTimeout(() => {
      saveNote(newTitle, newContent)
    }, 2000)
  }, [saveNote])

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    debouncedSave(newTitle, content)
  }

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    debouncedSave(title, newContent)
  }

  const handleManualSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveNote(title, content)
  }

  const handleRefresh = () => {
    loadNote()
    setConflictWarning(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading notes...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Shared Notes</h3>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-sm text-gray-500 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </span>
          )}
          {lastSaved && !saving && (
            <span className="text-sm text-gray-500">
              Last saved: {new Date(lastSaved).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleManualSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
          >
            Save Now
          </button>
        </div>
      </div>

      {/* Conflict Warning */}
      {conflictWarning && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-yellow-800">
              This note was updated by another user
            </p>
            <p className="text-xs text-yellow-600">
              Your changes may conflict with theirs. Click refresh to see the latest version.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Note Info */}
      {note && note.lastEditedBy && (
        <div className="text-xs text-gray-500">
          Last edited {new Date(note.lastEditedAt).toLocaleString()} • Version {note.version}
        </div>
      )}

      {/* Title Input */}
      <div>
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note Title"
          className="w-full px-4 py-3 text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Content Editor */}
      <div>
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Start typing your notes here... (Markdown supported)"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
          rows={20}
        />
        <div className="mt-2 text-xs text-gray-500">
          💡 Tip: Changes are automatically saved as you type. Notes are shared with all session participants.
        </div>
      </div>

      {/* Formatting Help */}
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600 hover:text-gray-900 font-medium">
          Markdown Formatting Guide
        </summary>
        <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-2 text-xs text-gray-600">
          <div><code className="bg-gray-200 px-2 py-1 rounded"># Heading 1</code> - Large heading</div>
          <div><code className="bg-gray-200 px-2 py-1 rounded">## Heading 2</code> - Medium heading</div>
          <div><code className="bg-gray-200 px-2 py-1 rounded">**bold**</code> - <strong>Bold text</strong></div>
          <div><code className="bg-gray-200 px-2 py-1 rounded">*italic*</code> - <em>Italic text</em></div>
          <div><code className="bg-gray-200 px-2 py-1 rounded">- Item</code> - Bullet list</div>
          <div><code className="bg-gray-200 px-2 py-1 rounded">1. Item</code> - Numbered list</div>
          <div><code className="bg-gray-200 px-2 py-1 rounded">`code`</code> - Inline code</div>
          <div><code className="bg-gray-200 px-2 py-1 rounded">```code block```</code> - Code block</div>
        </div>
      </details>
    </div>
  )
}
