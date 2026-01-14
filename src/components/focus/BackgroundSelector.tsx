'use client'

import { useState, useEffect, useCallback } from 'react'
import { Image as ImageIcon, ChevronDown } from 'lucide-react'
import { VIRTUAL_BACKGROUNDS, STORAGE_KEYS } from '@/lib/focus/constants'

interface BackgroundSelectorProps {
  onBackgroundChange: (bgClass: string) => void
}

export default function BackgroundSelector({ onBackgroundChange }: BackgroundSelectorProps) {
  const [selectedBg, setSelectedBg] = useState('none')
  const [showPanel, setShowPanel] = useState(false)

  // Load saved preference
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BACKGROUND) || 'none'
    setSelectedBg(saved)
    const bg = VIRTUAL_BACKGROUNDS.find(b => b.id === saved)
    if (bg) {
      onBackgroundChange(bg.bgClass)
    }
  }, [onBackgroundChange])

  const handleSelect = useCallback((bgId: string) => {
    setSelectedBg(bgId)
    localStorage.setItem(STORAGE_KEYS.BACKGROUND, bgId)
    const bg = VIRTUAL_BACKGROUNDS.find(b => b.id === bgId)
    if (bg) {
      onBackgroundChange(bg.bgClass)
    }
    setShowPanel(false)
  }, [onBackgroundChange])

  const currentBg = VIRTUAL_BACKGROUNDS.find(b => b.id === selectedBg)

  return (
    <div className="relative">
      {/* Compact Toggle */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
          showPanel
            ? 'bg-white/20 text-white'
            : selectedBg !== 'none'
            ? 'bg-blue-500/20 text-blue-400'
            : 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300'
        }`}
        title="Change Background"
      >
        <ImageIcon className="w-4 h-4" />
        <span className="text-sm hidden sm:inline">{currentBg?.name || 'Background'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${showPanel ? 'rotate-180' : ''}`} />
      </button>

      {/* Background Panel */}
      {showPanel && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-neutral-900/95 backdrop-blur-sm border border-neutral-800 rounded-2xl shadow-2xl p-4 z-50">
          <h4 className="font-semibold text-white mb-3">Virtual Background</h4>
          
          <div className="grid grid-cols-3 gap-2">
            {VIRTUAL_BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                onClick={() => handleSelect(bg.id)}
                className={`relative aspect-square rounded-xl overflow-hidden transition-all group ${
                  selectedBg === bg.id
                    ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900'
                    : 'hover:ring-2 hover:ring-neutral-600'
                }`}
              >
                <div 
                  className={`absolute inset-0 ${bg.bgClass}`}
                  style={{ backgroundColor: bg.previewColor }}
                />
                <div className="absolute inset-0 flex items-end justify-center p-1.5 bg-gradient-to-t from-black/70 to-transparent">
                  <span className="text-xs text-white font-medium truncate">{bg.name}</span>
                </div>
                {selectedBg === bg.id && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>

          <p className="text-xs text-neutral-500 mt-3">
            Your preference is saved automatically
          </p>
        </div>
      )}
    </div>
  )
}
