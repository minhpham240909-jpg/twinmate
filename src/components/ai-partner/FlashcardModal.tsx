'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { BookOpen, X, MessageSquare, FileText, Sparkles, Loader2 } from 'lucide-react'

export type FlashcardSource = 'chat' | 'topic'

export interface FlashcardConfig {
  source: FlashcardSource
  count: number
  topic?: string
}

interface FlashcardModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (config: FlashcardConfig) => Promise<void>
  isGenerating?: boolean
  hasConversation?: boolean // If false, "From Chat" option is disabled
  subject?: string | null // Session subject for topic default
}

const PRESET_COUNTS = [5, 10, 15, 20]
const MAX_COUNT = 20
const MIN_COUNT = 1

export default function FlashcardModal({
  isOpen,
  onClose,
  onGenerate,
  isGenerating = false,
  hasConversation = true,
  subject,
}: FlashcardModalProps) {
  const t = useTranslations('aiPartner')
  const tCommon = useTranslations('common')

  const [source, setSource] = useState<FlashcardSource>(hasConversation ? 'chat' : 'topic')
  const [count, setCount] = useState(5)
  const [customCount, setCustomCount] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [topic, setTopic] = useState('')

  const handlePresetClick = (presetCount: number) => {
    setCount(presetCount)
    setIsCustom(false)
    setCustomCount('')
  }

  const handleCustomCountChange = (value: string) => {
    setCustomCount(value)
    const parsed = parseInt(value)
    if (!isNaN(parsed) && parsed >= MIN_COUNT && parsed <= MAX_COUNT) {
      setCount(parsed)
      setIsCustom(true)
    }
  }

  const handleCustomFocus = () => {
    setIsCustom(true)
  }

  const handleGenerate = async () => {
    const config: FlashcardConfig = {
      source,
      count,
      ...(source === 'topic' && { topic: topic.trim() || subject || '' }),
    }
    await onGenerate(config)
  }

  const canGenerate = source === 'chat'
    ? hasConversation
    : (topic.trim() || subject)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-green-400" />
                Generate Flashcards
              </h3>
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Source Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Generate From
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSource('chat')}
                  disabled={isGenerating || !hasConversation}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    source === 'chat'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                  } ${!hasConversation ? 'opacity-50 cursor-not-allowed' : ''} disabled:cursor-not-allowed`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <MessageSquare className={`w-6 h-6 ${source === 'chat' ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span className={`text-sm font-medium ${source === 'chat' ? 'text-blue-300' : 'text-slate-300'}`}>
                      From Chat
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    Based on your conversation
                  </p>
                  {!hasConversation && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800/80 rounded-xl">
                      <span className="text-xs text-slate-400">Chat more first</span>
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setSource('topic')}
                  disabled={isGenerating}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    source === 'topic'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileText className={`w-6 h-6 ${source === 'topic' ? 'text-purple-400' : 'text-slate-400'}`} />
                    <span className={`text-sm font-medium ${source === 'topic' ? 'text-purple-300' : 'text-slate-300'}`}>
                      From Topic
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    Enter a specific topic
                  </p>
                </button>
              </div>
            </div>

            {/* Topic Input (only shown when "From Topic" is selected) */}
            {source === 'topic' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Topic
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={subject || 'e.g., Photosynthesis, World War II...'}
                  disabled={isGenerating}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
                {subject && !topic && (
                  <p className="text-xs text-slate-500 mt-2">
                    Will use session subject: {subject}
                  </p>
                )}
              </div>
            )}

            {/* Count Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Number of Flashcards
              </label>

              {/* Preset Buttons */}
              <div className="flex gap-2 mb-3">
                {PRESET_COUNTS.map((presetCount) => (
                  <button
                    key={presetCount}
                    onClick={() => handlePresetClick(presetCount)}
                    disabled={isGenerating}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      count === presetCount && !isCustom
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    } disabled:opacity-50`}
                  >
                    {presetCount}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">Custom:</span>
                <input
                  type="number"
                  min={MIN_COUNT}
                  max={MAX_COUNT}
                  value={customCount}
                  onChange={(e) => handleCustomCountChange(e.target.value)}
                  onFocus={handleCustomFocus}
                  placeholder="1-20"
                  disabled={isGenerating}
                  className={`w-24 px-3 py-2 bg-slate-900 border rounded-lg text-white text-center text-sm focus:outline-none disabled:opacity-50 ${
                    isCustom ? 'border-green-500' : 'border-slate-700 focus:border-green-500'
                  }`}
                />
                {isCustom && (
                  <span className="text-sm text-green-400">
                    {count} cards
                  </span>
                )}
              </div>
            </div>

            {/* Info Text for Chat Source */}
            {source === 'chat' && hasConversation && (
              <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-sm text-blue-300">
                  <Sparkles className="w-4 h-4 inline mr-1" />
                  AI will analyze your conversation and create flashcards based on the topics you discussed.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !canGenerate}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
