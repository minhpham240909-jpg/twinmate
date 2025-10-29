'use client'

import { useEffect, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import { Search, Sparkles, BookOpen, Brain, Users, Calendar, Lightbulb, FileText, X } from 'lucide-react'

interface CommandPaletteProps {
  onSelectAction?: (action: string, data?: any) => void
}

export default function CommandPalette({ onSelectAction }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Toggle with Cmd+K (Mac) or Ctrl+K (Windows/Linux)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!open) return

    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open])

  const handleSelect = useCallback((action: string, data?: any) => {
    setOpen(false)
    setSearch('')
    onSelectAction?.(action, data)
  }, [onSelectAction])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[20vh]">
      <Command
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden"
        shouldFilter={true}
      >
        {/* Search Input */}
        <div className="flex items-center border-b border-slate-200 px-4">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command or search..."
            className="flex-1 py-4 bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
          />
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Command List */}
        <Command.List className="max-h-[400px] overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-slate-500">
            No results found.
          </Command.Empty>

          {/* AI Actions */}
          <Command.Group heading="AI Actions" className="mb-2">
            <Command.Item
              onSelect={() => handleSelect('ask', { prompt: 'Help me summarize my last study session' })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors data-[selected=true]:bg-blue-50"
            >
              <Sparkles className="w-5 h-5 text-blue-600" />
              <div className="flex-1">
                <p className="font-medium text-slate-900">Summarize Session</p>
                <p className="text-xs text-slate-500">Get a summary of your recent study session</p>
              </div>
            </Command.Item>

            <Command.Item
              onSelect={() => handleSelect('ask', { prompt: 'Generate a quiz to test my knowledge' })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors data-[selected=true]:bg-blue-50"
            >
              <Brain className="w-5 h-5 text-purple-600" />
              <div className="flex-1">
                <p className="font-medium text-slate-900">Generate Quiz</p>
                <p className="text-xs text-slate-500">Create a quiz to test your understanding</p>
              </div>
            </Command.Item>

            <Command.Item
              onSelect={() => handleSelect('ask', { prompt: 'Create flashcards from my notes' })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors data-[selected=true]:bg-blue-50"
            >
              <BookOpen className="w-5 h-5 text-green-600" />
              <div className="flex-1">
                <p className="font-medium text-slate-900">Create Flashcards</p>
                <p className="text-xs text-slate-500">Generate flashcards from your materials</p>
              </div>
            </Command.Item>

            <Command.Item
              onSelect={() => handleSelect('ask', { prompt: 'Find me a study partner' })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors data-[selected=true]:bg-blue-50"
            >
              <Users className="w-5 h-5 text-orange-600" />
              <div className="flex-1">
                <p className="font-medium text-slate-900">Find Study Partner</p>
                <p className="text-xs text-slate-500">Match with compatible study partners</p>
              </div>
            </Command.Item>

            <Command.Item
              onSelect={() => handleSelect('ask', { prompt: 'Create a study plan for me' })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors data-[selected=true]:bg-blue-50"
            >
              <Calendar className="w-5 h-5 text-indigo-600" />
              <div className="flex-1">
                <p className="font-medium text-slate-900">Create Study Plan</p>
                <p className="text-xs text-slate-500">Build a personalized study schedule</p>
              </div>
            </Command.Item>

            <Command.Item
              onSelect={() => handleSelect('ask', { prompt: 'Search my notes for ' + search })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors data-[selected=true]:bg-blue-50"
            >
              <FileText className="w-5 h-5 text-slate-600" />
              <div className="flex-1">
                <p className="font-medium text-slate-900">Search Notes</p>
                <p className="text-xs text-slate-500">Search through your uploaded materials</p>
              </div>
            </Command.Item>
          </Command.Group>

          {/* Navigation */}
          <Command.Group heading="Quick Navigation" className="mb-2">
            <Command.Item
              onSelect={() => handleSelect('navigate', { path: '/dashboard' })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors data-[selected=true]:bg-slate-50"
            >
              <div className="w-5 h-5 flex items-center justify-center text-slate-600">📊</div>
              <p className="font-medium text-slate-900">Dashboard</p>
            </Command.Item>

            <Command.Item
              onSelect={() => handleSelect('navigate', { path: '/study-sessions' })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors data-[selected=true]:bg-slate-50"
            >
              <div className="w-5 h-5 flex items-center justify-center text-slate-600">📚</div>
              <p className="font-medium text-slate-900">Study Sessions</p>
            </Command.Item>

            <Command.Item
              onSelect={() => handleSelect('navigate', { path: '/groups' })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors data-[selected=true]:bg-slate-50"
            >
              <div className="w-5 h-5 flex items-center justify-center text-slate-600">👥</div>
              <p className="font-medium text-slate-900">Study Groups</p>
            </Command.Item>

            <Command.Item
              onSelect={() => handleSelect('navigate', { path: '/connections' })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors data-[selected=true]:bg-slate-50"
            >
              <div className="w-5 h-5 flex items-center justify-center text-slate-600">🤝</div>
              <p className="font-medium text-slate-900">Connections</p>
            </Command.Item>

            <Command.Item
              onSelect={() => handleSelect('navigate', { path: '/community' })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors data-[selected=true]:bg-slate-50"
            >
              <div className="w-5 h-5 flex items-center justify-center text-slate-600">🌐</div>
              <p className="font-medium text-slate-900">Community</p>
            </Command.Item>
          </Command.Group>
        </Command.List>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-2 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs">Esc</kbd>
              Close
            </span>
          </div>
          <div>
            Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs">⌘K</kbd> anytime
          </div>
        </div>
      </Command>
    </div>
  )
}
