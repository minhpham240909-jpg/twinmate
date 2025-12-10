'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Sparkles,
  BookOpen,
  Target,
  GraduationCap,
  Loader2,
  AlertCircle,
} from 'lucide-react'

interface StartAIPartnerModalProps {
  isOpen: boolean
  onClose: () => void
  onStart: (data: {
    subject?: string
    skillLevel?: string
    studyGoal?: string
  }) => Promise<void>
  isFallback?: boolean // True if shown because no human partner available
}

const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'English',
  'History',
  'Economics',
  'Psychology',
  'Art',
  'Music',
  'Other',
]

const SKILL_LEVELS = [
  { value: 'BEGINNER', label: 'Beginner', description: 'Just starting out' },
  { value: 'INTERMEDIATE', label: 'Intermediate', description: 'Some experience' },
  { value: 'ADVANCED', label: 'Advanced', description: 'Strong foundation' },
  { value: 'EXPERT', label: 'Expert', description: 'Deep knowledge' },
]

export default function StartAIPartnerModal({
  isOpen,
  onClose,
  onStart,
  isFallback = false,
}: StartAIPartnerModalProps) {
  const [subject, setSubject] = useState('')
  const [customSubject, setCustomSubject] = useState('')
  const [skillLevel, setSkillLevel] = useState('')
  const [studyGoal, setStudyGoal] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStart = async () => {
    setError('')
    setIsLoading(true)

    try {
      await onStart({
        subject: subject === 'Other' ? customSubject : subject,
        skillLevel,
        studyGoal,
      })
      onClose()
    } catch (err) {
      setError('Failed to start session. Please try again.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setSubject('')
    setCustomSubject('')
    setSkillLevel('')
    setStudyGoal('')
    setError('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-700/50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-6 border-b border-slate-700/50">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden">
                  <Image src="/logo.png" alt="AI Partner" width={38} height={38} className="object-contain" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    AI Study Partner
                  </h2>
                  <p className="text-slate-400 text-sm">
                    {isFallback
                      ? 'No human partners available right now'
                      : 'Start an instant study session'}
                  </p>
                </div>
              </div>

              {isFallback && (
                <div className="mt-4 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-200">
                    Your AI study partner is ready to help while you wait for a human partner.
                    You can study together until someone becomes available.
                  </p>
                </div>
              )}
            </div>

            {/* AI Disclosure */}
            <div className="px-6 py-3 bg-slate-800/50 border-b border-slate-700/50">
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>
                  <strong className="text-purple-300">This is an AI assistant</strong> - not a real person.
                  Conversations are moderated for safety.
                </span>
              </p>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Subject */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  What subject are you studying?
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a subject (optional)</option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {subject === 'Other' && (
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Enter your subject"
                    className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>

              {/* Skill Level */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <GraduationCap className="w-4 h-4 text-green-400" />
                  Your skill level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SKILL_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setSkillLevel(level.value)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        skillLevel === level.value
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <p className="font-medium text-sm">{level.label}</p>
                      <p className="text-xs opacity-70">{level.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Study Goal */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <Target className="w-4 h-4 text-purple-400" />
                  What do you want to achieve today?
                </label>
                <textarea
                  value={studyGoal}
                  onChange={(e) => setStudyGoal(e.target.value)}
                  placeholder="e.g., Understand calculus derivatives, Practice essay writing, Review for test..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-700/50 bg-slate-800/30">
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStart}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Start Session
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
