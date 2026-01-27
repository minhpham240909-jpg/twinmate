'use client'

/**
 * QUICK CAPTURE
 *
 * Floating action button and modal for capturing learning.
 * Features:
 * - FAB at bottom right
 * - Quick note/photo/link/highlight capture
 * - Auto-links to current roadmap/step if active
 * - Voice memo support (future)
 */

import { useState, useCallback, memo, useRef, useEffect } from 'react'
import {
  Plus,
  X,
  FileText,
  Camera,
  Link2,
  Highlighter,
  Mic,
  Send,
  Loader2,
  BookOpen,
  Tag,
  Check,
} from 'lucide-react'
import type { CaptureType, CreateCaptureInput } from '@/hooks/useCaptures'

interface QuickCaptureProps {
  onCapture: (input: CreateCaptureInput) => Promise<boolean>
  activeRoadmapId?: string
  activeStepId?: string
  subject?: string
}

interface CaptureOption {
  type: CaptureType
  icon: typeof FileText
  label: string
  placeholder: string
  color: string
}

const CAPTURE_OPTIONS: CaptureOption[] = [
  {
    type: 'NOTE',
    icon: FileText,
    label: 'Note',
    placeholder: 'Write a quick note about what you learned...',
    color: 'blue',
  },
  {
    type: 'HIGHLIGHT',
    icon: Highlighter,
    label: 'Highlight',
    placeholder: 'Paste a key quote or highlight...',
    color: 'yellow',
  },
  {
    type: 'LINK',
    icon: Link2,
    label: 'Link',
    placeholder: 'Paste a useful resource URL...',
    color: 'green',
  },
  {
    type: 'PHOTO',
    icon: Camera,
    label: 'Photo',
    placeholder: 'Describe what this image shows...',
    color: 'purple',
  },
]

// Floating Action Button
export const QuickCaptureFAB = memo(function QuickCaptureFAB({
  onClick,
  hasUnreviewedCaptures = false,
}: {
  onClick: () => void
  hasUnreviewedCaptures?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all active:scale-95"
      aria-label="Quick capture"
    >
      <Plus className="w-6 h-6" />
      {hasUnreviewedCaptures && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">!</span>
        </span>
      )}
    </button>
  )
})

// Quick Capture Modal
export const QuickCaptureModal = memo(function QuickCaptureModal({
  isOpen,
  onClose,
  onCapture,
  activeRoadmapId,
  activeStepId,
  subject,
}: QuickCaptureProps & { isOpen: boolean; onClose: () => void }) {
  const [selectedType, setSelectedType] = useState<CaptureType>('NOTE')
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [linkToRoadmap, setLinkToRoadmap] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedType('NOTE')
      setContent('')
      setTitle('')
      setTags([])
      setTagInput('')
      setLinkToRoadmap(true)
      setShowSuccess(false)
      // Focus textarea after a short delay
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) return

    setIsSaving(true)

    const input: CreateCaptureInput = {
      type: selectedType,
      content: content.trim(),
      title: title.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      roadmapId: linkToRoadmap ? activeRoadmapId : undefined,
      stepId: linkToRoadmap ? activeStepId : undefined,
      subject: subject || undefined,
    }

    const success = await onCapture(input)
    setIsSaving(false)

    if (success) {
      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        onClose()
      }, 1000)
    }
  }, [content, title, tags, selectedType, linkToRoadmap, activeRoadmapId, activeStepId, subject, onCapture, onClose])

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
      setTags([...tags, trimmed])
      setTagInput('')
    }
  }, [tagInput, tags])

  const handleRemoveTag = useCallback((tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }, [tags])

  const selectedOption = CAPTURE_OPTIONS.find(o => o.type === selectedType) || CAPTURE_OPTIONS[0]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-hidden">
        {/* Success overlay */}
        {showSuccess && (
          <div className="absolute inset-0 bg-green-500 z-10 flex items-center justify-center">
            <div className="text-center text-white">
              <Check className="w-12 h-12 mx-auto mb-2" />
              <p className="font-semibold">Captured!</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Quick Capture
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Type selector */}
          <div className="flex gap-2">
            {CAPTURE_OPTIONS.map((option) => {
              const Icon = option.icon
              const isSelected = selectedType === option.type

              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setSelectedType(option.type)}
                  className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    isSelected
                      ? `border-${option.color}-500 bg-${option.color}-50 dark:bg-${option.color}-950/30`
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${
                    isSelected
                      ? `text-${option.color}-600 dark:text-${option.color}-400`
                      : 'text-neutral-500'
                  }`} />
                  <span className={`text-xs font-medium ${
                    isSelected
                      ? `text-${option.color}-700 dark:text-${option.color}-300`
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}>
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Title (optional) */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Content */}
          <div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={selectedOption.placeholder}
              rows={4}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-neutral-400" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Tags (optional)
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm rounded-lg"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            {tags.length < 5 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Add tag..."
                  className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                  className="px-3 py-2 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Link to roadmap option */}
          {activeRoadmapId && (
            <label className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={linkToRoadmap}
                onChange={(e) => setLinkToRoadmap(e.target.checked)}
                className="w-5 h-5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-neutral-500" />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  Link to current roadmap
                </span>
              </div>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim() || isSaving}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Save Capture</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
})

// Combined component for convenience
export function QuickCapture({
  onCapture,
  activeRoadmapId,
  activeStepId,
  subject,
  hasUnreviewedCaptures = false,
}: QuickCaptureProps & { hasUnreviewedCaptures?: boolean }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleCapture = useCallback(async (input: CreateCaptureInput): Promise<boolean> => {
    const result = await onCapture(input)
    return !!result
  }, [onCapture])

  return (
    <>
      <QuickCaptureFAB
        onClick={() => setIsOpen(true)}
        hasUnreviewedCaptures={hasUnreviewedCaptures}
      />
      <QuickCaptureModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onCapture={handleCapture}
        activeRoadmapId={activeRoadmapId}
        activeStepId={activeStepId}
        subject={subject}
      />
    </>
  )
}
