'use client'

/**
 * Onboarding Prompt Component
 * Guidance first - simple goal input with optional materials
 */

import { memo, useState, useRef } from 'react'
import {
  Loader2,
  ArrowRight,
  Link2,
  Image as ImageIcon,
  FileText,
  Video,
  X,
  Upload,
} from 'lucide-react'
import type { InputMaterial } from './types'
import { getInputTypeLabel } from './utils'

interface OnboardingPromptProps {
  onSubmitGoal: (goal: string, inputUrl?: string, inputImage?: string) => void
  isLoading: boolean
  suggestedGoal?: string | null
}

export const OnboardingPrompt = memo(function OnboardingPrompt({
  onSubmitGoal,
  isLoading,
  suggestedGoal,
}: OnboardingPromptProps) {
  const [goal, setGoal] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [inputMaterial, setInputMaterial] = useState<InputMaterial>({ type: 'none', value: '' })
  const [showInputOptions, setShowInputOptions] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    if (goal.trim().length >= 10) {
      const inputUrl = inputMaterial.type === 'url' ? inputMaterial.value : undefined
      const inputImage = inputMaterial.type === 'image' ? inputMaterial.value : undefined
      // Enhancement happens silently on the backend - no user choice
      onSubmitGoal(goal.trim(), inputUrl, inputImage)
    }
  }

  const handleStartSuggested = () => {
    if (suggestedGoal) {
      onSubmitGoal(suggestedGoal)
    }
  }

  const handleUrlAdd = () => {
    if (urlInput.trim()) {
      const url = urlInput.trim()
      setInputMaterial({
        type: 'url',
        value: url,
        preview: url.length > 50 ? url.slice(0, 50) + '...' : url,
      })
      setUrlInput('')
      setShowInputOptions(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setInputMaterial({
          type: 'image',
          value: base64,
          preview: file.name,
        })
        setShowInputOptions(false)
      }
      reader.readAsDataURL(file)
    }
  }

  const clearInput = () => {
    setInputMaterial({ type: 'none', value: '' })
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 space-y-6">
      {/* Welcome Message */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
          What do you want to learn?
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400">
          Tell me your goal. I&apos;ll create a personalized roadmap.
        </p>
      </div>

      {/* Suggested Goal for Returning Users */}
      {suggestedGoal && !showCustomInput && (
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2">
            Suggested for you
          </p>
          <p className="text-neutral-800 dark:text-neutral-200 font-medium mb-3">
            {suggestedGoal}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleStartSuggested}
              disabled={isLoading}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Start This
            </button>
            <button
              onClick={() => setShowCustomInput(true)}
              className="px-3 py-2 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            >
              Different goal
            </button>
          </div>
        </div>
      )}

      {/* Input - Simple, no magic wand */}
      <div className="space-y-3">
        <textarea
          ref={inputRef}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onFocus={() => setShowCustomInput(true)}
          placeholder="I want to learn..."
          disabled={isLoading}
          rows={3}
          className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
        />

        {/* Input Material Section - Simplified */}
        {inputMaterial.type !== 'none' ? (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
            {inputMaterial.type === 'url' && (
              <>
                {inputMaterial.value.includes('youtube') || inputMaterial.value.includes('youtu.be') ? (
                  <Video className="w-4 h-4 text-red-500 flex-shrink-0" />
                ) : inputMaterial.value.endsWith('.pdf') ? (
                  <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />
                ) : (
                  <Link2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    {getInputTypeLabel(inputMaterial.value)}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">{inputMaterial.preview}</p>
                </div>
              </>
            )}
            {inputMaterial.type === 'image' && (
              <>
                <ImageIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Image</p>
                  <p className="text-xs text-neutral-500 truncate">{inputMaterial.preview}</p>
                </div>
              </>
            )}
            <button
              onClick={clearInput}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-neutral-500" />
            </button>
          </div>
        ) : showCustomInput && (
          <>
            {!showInputOptions && (
              <button
                onClick={() => setShowInputOptions(true)}
                className="w-full flex items-center justify-center gap-2 py-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-sm transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Add material (optional)</span>
              </button>
            )}

            {showInputOptions && (
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    Add Material
                  </p>
                  <button
                    onClick={() => setShowInputOptions(false)}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full"
                  >
                    <X className="w-4 h-4 text-neutral-400" />
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Paste URL or YouTube link..."
                    className="flex-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleUrlAdd}
                    disabled={!urlInput.trim()}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 text-sm transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Upload Image</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            )}
          </>
        )}

        {/* Primary Action - Single clear button */}
        <button
          onClick={handleSubmit}
          disabled={goal.trim().length < 10 || isLoading}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>Create Roadmap</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {goal.trim().length > 0 && goal.trim().length < 10 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            Add a bit more detail
          </p>
        )}
      </div>
    </div>
  )
})
