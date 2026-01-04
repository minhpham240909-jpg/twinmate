'use client'

/**
 * SessionNotes Component
 *
 * Private note-taking for study sessions.
 * - Each user has their own private notes
 * - Notes are only visible to the owner
 * - Users can share notes to screen for others to view
 * - Auto-saves as user types
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Lock, Share2, Eye, Save, Loader2, FileText } from 'lucide-react'

interface SessionNote {
  id: string
  sessionId: string
  userId: string
  title: string
  content: string | null
  contentUrl: string | null
  lastEditedAt: Date
  version: number
  createdAt: Date
  updatedAt: Date
}

interface SessionNotesProps {
  sessionId: string
  onShareNotes?: (content: string, title: string) => void // Callback when user shares notes
  onStopSharing?: () => void // Callback when user stops sharing notes
  isSharing?: boolean // Whether notes are currently being shared to screen
}

export default function SessionNotes({
  sessionId,
  onShareNotes,
  onStopSharing,
  isSharing = false
}: SessionNotesProps) {
  const [note, setNote] = useState<SessionNote | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showShareConfirm, setShowShareConfirm] = useState(false)

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const lastVersionRef = useRef<number>(0)

  // Load note on mount
  useEffect(() => {
    loadNote()
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

  // Share notes to screen
  const handleShareNotes = () => {
    if (onShareNotes && content) {
      onShareNotes(content, title)
      setShowShareConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading your notes...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h3 className="text-xl font-semibold text-white">My Notes</h3>
          </div>
          {/* Private indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700/50 rounded-full">
            <Lock className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-green-400 font-medium">Private</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Save status */}
          {saving && (
            <span className="text-sm text-slate-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </span>
          )}
          {lastSaved && !saving && (
            <span className="text-sm text-slate-400">
              Saved {new Date(lastSaved).toLocaleTimeString()}
            </span>
          )}

          {/* Share button */}
          {onShareNotes && (
            isSharing ? (
              <button
                onClick={onStopSharing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-green-600/80 hover:bg-red-600 text-white"
              >
                <Eye className="w-4 h-4" />
                Stop Sharing
              </button>
            ) : (
              <button
                onClick={() => setShowShareConfirm(true)}
                disabled={!content}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-blue-600/80 hover:bg-blue-600 text-white disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <Share2 className="w-4 h-4" />
                Share to Screen
              </button>
            )
          )}

          {/* Manual save button */}
          <button
            onClick={handleManualSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600/80 hover:bg-blue-600 disabled:bg-blue-600/30 text-white rounded-lg font-medium transition-colors backdrop-blur-sm"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      {/* Privacy notice */}
      <div className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          Your notes are private and only visible to you. Use "Share to Screen" to show them to your study partners.
        </p>
      </div>

      {/* Share confirmation modal */}
      {showShareConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-blue-500/20">
                <Share2 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Share Notes to Screen</h3>
                <p className="text-sm text-slate-400">Your partners will see your notes</p>
              </div>
            </div>

            <p className="text-slate-300 text-sm mb-6">
              This will share your notes to the session screen. All participants will be able to see your notes content. You can stop sharing at any time.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowShareConfirm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShareNotes}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 text-red-400 rounded-lg text-sm border border-red-500/30 backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Note version info */}
      {note && (
        <div className="text-xs text-slate-500">
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
          className="w-full px-4 py-3 text-lg font-semibold bg-slate-800/40 border border-slate-700/50 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 backdrop-blur-xl"
        />
      </div>

      {/* Content Editor */}
      <div>
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Start typing your notes here... (Markdown supported)"
          className="w-full px-4 py-3 bg-slate-800/40 border border-slate-700/50 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none font-mono text-sm backdrop-blur-xl"
          rows={20}
        />
        <div className="mt-2 text-xs text-slate-400">
          Changes are automatically saved as you type.
        </div>
      </div>

      {/* Formatting Help */}
      <details className="text-sm">
        <summary className="cursor-pointer text-slate-300 hover:text-white font-medium">
          Markdown Formatting Guide
        </summary>
        <div className="mt-3 p-4 bg-slate-800/40 backdrop-blur-sm rounded-lg space-y-2 text-xs text-slate-400 border border-slate-700/50">
          <div><code className="bg-slate-700/50 px-2 py-1 rounded text-slate-300"># Heading 1</code> - Large heading</div>
          <div><code className="bg-slate-700/50 px-2 py-1 rounded text-slate-300">## Heading 2</code> - Medium heading</div>
          <div><code className="bg-slate-700/50 px-2 py-1 rounded text-slate-300">**bold**</code> - <strong>Bold text</strong></div>
          <div><code className="bg-slate-700/50 px-2 py-1 rounded text-slate-300">*italic*</code> - <em>Italic text</em></div>
          <div><code className="bg-slate-700/50 px-2 py-1 rounded text-slate-300">- Item</code> - Bullet list</div>
          <div><code className="bg-slate-700/50 px-2 py-1 rounded text-slate-300">1. Item</code> - Numbered list</div>
          <div><code className="bg-slate-700/50 px-2 py-1 rounded text-slate-300">`code`</code> - Inline code</div>
          <div><code className="bg-slate-700/50 px-2 py-1 rounded text-slate-300">```code block```</code> - Code block</div>
        </div>
      </details>
    </div>
  )
}
