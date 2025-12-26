'use client'

/**
 * SharedNotesViewer Component
 *
 * Displays notes that another user has shared to the screen.
 * This is a read-only view of shared notes content.
 */

import { FileText, User, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface SharedNotesViewerProps {
  title: string
  content: string
  sharedBy: {
    name: string
    avatarUrl?: string | null
  }
  onClose?: () => void
}

export default function SharedNotesViewer({
  title,
  content,
  sharedBy,
  onClose
}: SharedNotesViewerProps) {
  return (
    <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <FileText className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{title || 'Shared Notes'}</h3>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>Shared by</span>
              {sharedBy.avatarUrl ? (
                <img
                  src={sharedBy.avatarUrl}
                  alt={sharedBy.name}
                  className="w-5 h-5 rounded-full"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center">
                  <User className="w-3 h-3 text-slate-400" />
                </div>
              )}
              <span className="font-medium text-slate-300">{sharedBy.name}</span>
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
        <p className="text-xs text-slate-500 text-center">
          This is a shared view. You cannot edit these notes.
        </p>
      </div>
    </div>
  )
}
