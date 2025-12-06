'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Bot,
  Sparkles,
  Plus,
  Clock,
  MessageSquare,
  Star,
  ChevronRight,
  Loader2,
  History,
} from 'lucide-react'
import StartAIPartnerModal from '@/components/ai-partner/StartAIPartnerModal'

interface AISession {
  id: string
  subject: string | null
  status: string
  startedAt: string
  endedAt: string | null
  messageCount: number
  rating: number | null
}

export default function AIPartnerPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<AISession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showStartModal, setShowStartModal] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/ai-partner/session?limit=10')
      const data = await res.json()
      if (data.success) {
        setSessions(data.sessions)
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartSession = async (data: {
    subject?: string
    skillLevel?: string
    studyGoal?: string
  }) => {
    setIsStarting(true)
    try {
      const res = await fetch('/api/ai-partner/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await res.json()

      if (result.success) {
        router.push(`/ai-partner/${result.session.id}`)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Failed to start session:', error)
      throw error
    } finally {
      setIsStarting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const formatDuration = (startedAt: string, endedAt: string | null) => {
    if (!endedAt) return 'In progress'
    const start = new Date(startedAt).getTime()
    const end = new Date(endedAt).getTime()
    const durationMins = Math.floor((end - start) / 60000)
    if (durationMins < 60) return `${durationMins}m`
    const hours = Math.floor(durationMins / 60)
    const mins = durationMins % 60
    return `${hours}h ${mins}m`
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Study Partner</h1>
              <p className="text-slate-400 text-sm">
                Your instant AI-powered study companion
              </p>
            </div>
          </div>
        </div>

        {/* Start New Session Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => setShowStartModal(true)}
            className="w-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-6 hover:from-blue-600/30 hover:to-purple-600/30 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-7 h-7 text-white" />
                </div>
                <div className="text-left">
                  <h2 className="text-lg font-semibold text-white">
                    Start New Session
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Chat, quiz, and study with your AI partner
                  </p>
                </div>
              </div>
              <Sparkles className="w-6 h-6 text-purple-400 group-hover:text-purple-300 transition-colors" />
            </div>
          </button>
        </motion.div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <MessageSquare className="w-6 h-6 text-blue-400 mb-2" />
            <h3 className="font-medium text-white text-sm">Chat & Explain</h3>
            <p className="text-slate-500 text-xs">Get concepts explained clearly</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <Sparkles className="w-6 h-6 text-purple-400 mb-2" />
            <h3 className="font-medium text-white text-sm">Generate Quizzes</h3>
            <p className="text-slate-500 text-xs">Test your knowledge</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <Clock className="w-6 h-6 text-green-400 mb-2" />
            <h3 className="font-medium text-white text-sm">Pomodoro Timer</h3>
            <p className="text-slate-500 text-xs">Stay focused with breaks</p>
          </div>
        </div>

        {/* Recent Sessions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">Recent Sessions</h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/30 rounded-2xl border border-slate-700/50">
              <Bot className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No sessions yet</p>
              <p className="text-slate-500 text-sm">
                Start your first AI study session above!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <button
                    onClick={() => {
                      if (session.status === 'ACTIVE') {
                        router.push(`/ai-partner/${session.id}`)
                      }
                    }}
                    disabled={session.status !== 'ACTIVE'}
                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800 transition-all text-left group disabled:opacity-60 disabled:cursor-default"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            session.status === 'ACTIVE'
                              ? 'bg-green-500/20'
                              : 'bg-slate-700/50'
                          }`}
                        >
                          <Bot
                            className={`w-5 h-5 ${
                              session.status === 'ACTIVE'
                                ? 'text-green-400'
                                : 'text-slate-400'
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {session.subject || 'General Study'}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(session.startedAt, session.endedAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {session.messageCount} msgs
                            </span>
                            {session.rating && (
                              <span className="flex items-center gap-1 text-yellow-400">
                                <Star className="w-3 h-3 fill-yellow-400" />
                                {session.rating}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          {formatDate(session.startedAt)}
                        </span>
                        {session.status === 'ACTIVE' && (
                          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
                        )}
                      </div>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Start Session Modal */}
      <StartAIPartnerModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        onStart={handleStartSession}
      />
    </div>
  )
}
