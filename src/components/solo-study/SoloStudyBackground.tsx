'use client'

import { useState, useEffect, ReactNode } from 'react'
import { Image as ImageIcon, ChevronUp } from 'lucide-react'

// Virtual backgrounds for Solo Study
export const SOLO_STUDY_BACKGROUNDS = [
  {
    id: 'library',
    name: 'Library',
    bgClass: 'bg-gradient-to-br from-amber-900/90 via-neutral-900 to-neutral-950',
    previewColor: '#78350f',
    icon: '📚',
  },
  {
    id: 'cafe',
    name: 'Cafe',
    bgClass: 'bg-gradient-to-br from-orange-900/80 via-stone-900 to-neutral-950',
    previewColor: '#7c2d12',
    icon: '☕',
  },
  {
    id: 'nature',
    name: 'Nature',
    bgClass: 'bg-gradient-to-br from-green-900/80 via-emerald-950 to-neutral-950',
    previewColor: '#14532d',
    icon: '🌲',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    bgClass: 'bg-gradient-to-br from-blue-900/80 via-cyan-950 to-neutral-950',
    previewColor: '#1e3a5f',
    icon: '🌊',
  },
  {
    id: 'night',
    name: 'Night Sky',
    bgClass: 'bg-gradient-to-br from-indigo-950 via-purple-950 to-neutral-950',
    previewColor: '#1e1b4b',
    icon: '🌙',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    bgClass: 'bg-neutral-950',
    previewColor: '#0a0a0a',
    icon: '⬛',
  },
]

interface SoloStudyBackgroundProps {
  backgroundId: string
  children?: ReactNode
  onChangeBackground?: (bgId: string) => void
  showSelector?: boolean
}

export default function SoloStudyBackground({
  backgroundId,
  children,
  onChangeBackground,
  showSelector = false,
}: SoloStudyBackgroundProps) {
  const [showPanel, setShowPanel] = useState(false)
  const currentBg = SOLO_STUDY_BACKGROUNDS.find((b) => b.id === backgroundId) || SOLO_STUDY_BACKGROUNDS[0]

  // If just rendering background without selector
  if (!showSelector) {
    return (
      <div className={`min-h-screen ${currentBg.bgClass} transition-colors duration-700`}>
        {/* Subtle animated overlay for depth */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
          </div>
        </div>
        {children}
      </div>
    )
  }

  // Render selector button
  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
          showPanel
            ? 'bg-white/20 text-white'
            : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white'
        }`}
        title="Change Background"
      >
        <ImageIcon className="w-5 h-5" />
        <span className="text-sm hidden sm:inline">{currentBg.name}</span>
        <ChevronUp className={`w-4 h-4 transition-transform ${showPanel ? '' : 'rotate-180'}`} />
      </button>

      {/* Background Panel */}
      {showPanel && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-neutral-900/95 backdrop-blur-sm border border-neutral-800 rounded-2xl shadow-2xl p-4 z-50">
          <h4 className="font-semibold text-white mb-3">Virtual Background</h4>

          <div className="grid grid-cols-3 gap-2">
            {SOLO_STUDY_BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                onClick={() => {
                  onChangeBackground?.(bg.id)
                  setShowPanel(false)
                }}
                className={`relative aspect-square rounded-xl overflow-hidden transition-all group ${
                  backgroundId === bg.id
                    ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900'
                    : 'hover:ring-2 hover:ring-neutral-600'
                }`}
              >
                <div
                  className={`absolute inset-0 ${bg.bgClass}`}
                  style={{ backgroundColor: bg.previewColor }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl mb-1">{bg.icon}</span>
                  <span className="text-xs text-white font-medium">{bg.name}</span>
                </div>
                {backgroundId === bg.id && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>

          <p className="text-xs text-neutral-500 mt-3">
            Background syncs with your ambient sounds
          </p>
        </div>
      )}
    </div>
  )
}
