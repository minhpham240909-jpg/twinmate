'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Sparkles,
  UserX,
  Loader2,
  MessageCircle,
  Brain,
  Clock,
  BookOpen,
} from 'lucide-react'

interface SearchCriteria {
  subjects?: string[]
  subjectDescription?: string
  school?: string
  locationCity?: string
  locationState?: string
  locationCountry?: string
  skillLevel?: string
  studyStyle?: string
  interests?: string[]
  goals?: string[]
  availableDays?: string[]
  availableHours?: string
  ageRange?: string
  role?: string[]
  languages?: string
  searchedName?: string
  userDefinedQualities?: string
}

interface AIPartnerSuggestionModalProps {
  isOpen: boolean
  onClose: () => void
  searchCriteria: SearchCriteria
  searchQuery?: string // The text they searched for (could be a name)
  noResultsReason?: 'no_match' | 'name_not_found' | 'no_partners'
}

export default function AIPartnerSuggestionModal({
  isOpen,
  onClose,
  searchCriteria,
  searchQuery,
  noResultsReason = 'no_match',
}: AIPartnerSuggestionModalProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showQualitiesInput, setShowQualitiesInput] = useState(false)
  const [userQualities, setUserQualities] = useState('')

  // Build display text from search criteria
  const getSearchSummary = () => {
    const parts: string[] = []
    if (searchCriteria.subjects?.length) {
      parts.push(searchCriteria.subjects.join(', '))
    }
    if (searchCriteria.school) {
      parts.push(searchCriteria.school)
    }
    if (searchCriteria.locationCity) {
      parts.push(searchCriteria.locationCity)
    } else if (searchCriteria.locationCountry) {
      parts.push(searchCriteria.locationCountry)
    }
    if (searchCriteria.skillLevel) {
      parts.push(searchCriteria.skillLevel.charAt(0) + searchCriteria.skillLevel.slice(1).toLowerCase())
    }
    return parts.length > 0 ? parts.join(' • ') : 'study partner'
  }

  const handleStartAIPartner = async () => {
    setError('')
    setIsLoading(true)

    try {
      // If user was searching for a name and provided qualities, add them to criteria
      const finalCriteria = { ...searchCriteria }
      if (searchQuery && noResultsReason === 'name_not_found') {
        finalCriteria.searchedName = searchQuery
        if (userQualities.trim()) {
          finalCriteria.userDefinedQualities = userQualities.trim()
        }
      }

      const response = await fetch('/api/ai-partner/session-from-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchCriteria: finalCriteria,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start AI session')
      }

      // Redirect to the AI session
      router.push(`/ai-partner/${data.session.id}`)
      onClose()
    } catch (err) {
      console.error('Failed to start AI partner:', err)
      setError(err instanceof Error ? err.message : 'Failed to start AI partner')
    } finally {
      setIsLoading(false)
    }
  }

  // Determine the message based on the reason - using consistent format across the app
  const getMessage = () => {
    // Build a dynamic title based on search criteria (similar to search page logic)
    const buildDynamicTitle = () => {
      if (searchQuery) {
        return `${searchQuery} partners aren't available right now`
      }
      if (searchCriteria.subjects?.length) {
        const subjectsText = searchCriteria.subjects.slice(0, 2).join(', ') +
          (searchCriteria.subjects.length > 2 ? ' & more' : '')
        return `${subjectsText} partners aren't available right now`
      }
      if (searchCriteria.subjectDescription) {
        const desc = searchCriteria.subjectDescription.slice(0, 30) +
          (searchCriteria.subjectDescription.length > 30 ? '...' : '')
        return `Partners for ${desc} aren't available`
      }
      if (searchCriteria.skillLevel) {
        return `${searchCriteria.skillLevel.charAt(0) + searchCriteria.skillLevel.slice(1).toLowerCase()} level partners aren't available right now`
      }
      if (searchCriteria.studyStyle) {
        return `${searchCriteria.studyStyle.charAt(0) + searchCriteria.studyStyle.slice(1).toLowerCase()} study style partners aren't available`
      }
      if (searchCriteria.interests?.length) {
        return `Partners interested in ${searchCriteria.interests.slice(0, 2).join(' & ')} aren't available`
      }
      if (searchCriteria.goals?.length) {
        return `Partners with ${searchCriteria.goals.slice(0, 2).join(' & ')} goals aren't available`
      }
      if (searchCriteria.role?.length) {
        return `${searchCriteria.role.join(' / ')} partners aren't available right now`
      }
      if (searchCriteria.ageRange) {
        return `Partners in the ${searchCriteria.ageRange} range aren't available`
      }
      if (searchCriteria.availableDays?.length || searchCriteria.availableHours) {
        const daysText = searchCriteria.availableDays?.length
          ? 'on ' + searchCriteria.availableDays.slice(0, 2).join(' & ')
          : ''
        const hoursText = searchCriteria.availableHours ? ` (${searchCriteria.availableHours})` : ''
        return `Partners available ${daysText}${hoursText} aren't available`
      }
      if (searchCriteria.locationCity || searchCriteria.locationState || searchCriteria.locationCountry) {
        return `Partners in ${searchCriteria.locationCity || searchCriteria.locationState || searchCriteria.locationCountry} aren't available right now`
      }
      if (searchCriteria.school) {
        return `Partners from ${searchCriteria.school} aren't available right now`
      }
      if (searchCriteria.languages) {
        return `Partners who speak ${searchCriteria.languages} aren't available right now`
      }
      return 'No matching partners found'
    }

    // Build a dynamic subtitle based on search criteria
    const buildDynamicSubtitle = () => {
      if (searchQuery) {
        return `But I can be your study partner! I'll adapt to help you with what you're looking for.`
      }
      if (searchCriteria.subjects?.length) {
        return `But I can be your ${searchCriteria.subjects[0]} study partner! Let's learn together.`
      }
      if (searchCriteria.subjectDescription) {
        return `But I can help you with ${searchCriteria.subjectDescription.slice(0, 50)}! Let's learn together.`
      }
      if (searchCriteria.skillLevel) {
        return `But I can adapt to your ${searchCriteria.skillLevel.toLowerCase()} level! Let's study together.`
      }
      if (searchCriteria.studyStyle) {
        return `But I can match your ${searchCriteria.studyStyle.toLowerCase()} study style! Let's learn together.`
      }
      if (searchCriteria.interests?.length) {
        return `But I can help you with ${searchCriteria.interests[0].toLowerCase()}! Let's study together.`
      }
      if (searchCriteria.goals?.length) {
        return `But I can help you achieve your ${searchCriteria.goals[0].toLowerCase()} goal! Let's work together.`
      }
      if (searchCriteria.role?.length) {
        return `But I can be your AI study buddy for ${searchCriteria.role[0].toLowerCase()}s! Let's learn together.`
      }
      if (searchCriteria.availableDays?.length || searchCriteria.availableHours) {
        return `But I'm always available whenever you need! Let's study together.`
      }
      if (searchCriteria.locationCity || searchCriteria.locationState || searchCriteria.locationCountry) {
        return `But I can be your virtual study partner from anywhere! Let's connect.`
      }
      if (searchCriteria.school) {
        return `But I can help you study as if we were classmates! Let's learn together.`
      }
      if (searchCriteria.languages) {
        return `But I can communicate in multiple languages! Let's study together.`
      }
      return "But I can be your AI study partner! I'm always available to help you learn."
    }

    return {
      title: buildDynamicTitle(),
      subtitle: buildDynamicSubtitle(),
    }
  }

  const message = getMessage()

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
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
                onClick={onClose}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden">
                    <Image src="/logo.png" alt="AI Partner" width={38} height={38} className="object-contain" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-slate-900 rounded-full flex items-center justify-center border-2 border-purple-500">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{message.title}</h2>
                  <p className="text-slate-400 text-sm">{message.subtitle}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Features */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <MessageCircle className="w-5 h-5 text-blue-400" />
                  <span className="text-sm text-slate-300">Chat & Discuss</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <Brain className="w-5 h-5 text-purple-400" />
                  <span className="text-sm text-slate-300">Quiz & Flashcards</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <Clock className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-slate-300">Pomodoro Timer</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <BookOpen className="w-5 h-5 text-orange-400" />
                  <span className="text-sm text-slate-300">Study Support</span>
                </div>
              </div>

              {/* Search criteria display */}
              {Object.keys(searchCriteria).some(k => {
                const val = searchCriteria[k as keyof SearchCriteria]
                return val && (Array.isArray(val) ? val.length > 0 : true)
              }) && (
                <div className="mb-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                  <p className="text-xs text-slate-400 mb-2">I'll match your search:</p>
                  <p className="text-sm text-slate-200">{getSearchSummary()}</p>
                </div>
              )}

              {/* Name search - ask for qualities */}
              {noResultsReason === 'name_not_found' && searchQuery && (
                <div className="mb-6">
                  {!showQualitiesInput ? (
                    <button
                      onClick={() => setShowQualitiesInput(true)}
                      className="w-full p-3 text-left bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-blue-500/50 transition-colors"
                    >
                      <p className="text-sm text-slate-300">
                        What qualities were you looking for in {searchQuery}?
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Click to describe (optional)
                      </p>
                    </button>
                  ) : (
                    <div>
                      <label className="text-sm text-slate-300 mb-2 block">
                        What qualities were you looking for?
                      </label>
                      <textarea
                        value={userQualities}
                        onChange={(e) => setUserQualities(e.target.value)}
                        placeholder="e.g., Someone good at explaining complex topics, patient, likes to work through problems step by step..."
                        rows={3}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none text-sm"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Notification about real partners */}
              <div className="mb-6 flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <UserX className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-200">
                  We'll notify you when a matching partner becomes available so you can switch anytime.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-700/50 bg-slate-800/30">
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  Keep Searching
                </button>
                <button
                  onClick={handleStartAIPartner}
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
                      Start with AI
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
