'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  Bot,
  Sparkles,
  Clock,
  MessageSquare,
  Star,
  ChevronRight,
  Loader2,
  History,
  Search,
  ArrowRight,
  Play,
  Pause,
} from 'lucide-react'

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
  const [resumingId, setResumingId] = useState<string | null>(null)

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

  const handleResumeSession = async (sessionId: string) => {
    setResumingId(sessionId)
    try {
      const res = await fetch(`/api/ai-partner/session/${sessionId}/resume`, {
        method: 'POST',
      })
      const data = await res.json()

      if (data.success) {
        toast.success('Session resumed!')
        router.push(`/ai-partner/${sessionId}`)
      } else {
        toast.error(data.error || 'Failed to resume session')
      }
    } catch (error) {
      console.error('Failed to resume session:', error)
      toast.error('Failed to resume session')
    } finally {
      setResumingId(null)
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

  const formatDuration = (startedAt: string, endedAt: string | null, status: string) => {
    if (status === 'ACTIVE') return 'In progress'
    if (status === 'PAUSED') return 'Paused'
    if (!endedAt) return 'In progress'
    const start = new Date(startedAt).getTime()
    const end = new Date(endedAt).getTime()
    const durationMins = Math.floor((end - start) / 60000)
    if (durationMins < 60) return `${durationMins}m`
    const hours = Math.floor(durationMins / 60)
    const mins = durationMins % 60
    return `${hours}h ${mins}m`
  }

  // Check if there's an active or paused session
  const activeSession = sessions.find(s => s.status === 'ACTIVE')
  const pausedSession = sessions.find(s => s.status === 'PAUSED')

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
                Your fallback study companion when no partners are available
              </p>
            </div>
          </div>
        </div>

        {/* Active Session Banner */}
        {activeSession && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <button
              onClick={() => router.push(`/ai-partner/${activeSession.id}`)}
              className="w-full bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-2xl p-6 hover:from-green-600/30 hover:to-emerald-600/30 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center relative">
                    <Bot className="w-7 h-7 text-white" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-slate-950 animate-pulse" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-semibold text-white">
                      Continue Active Session
                    </h2>
                    <p className="text-slate-400 text-sm">
                      {activeSession.subject || 'General Study'} • {activeSession.messageCount} messages
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 text-green-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </motion.div>
        )}

        {/* Paused Session Banner */}
        {pausedSession && !activeSession && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <button
              onClick={() => handleResumeSession(pausedSession.id)}
              disabled={resumingId === pausedSession.id}
              className="w-full bg-gradient-to-r from-amber-600/20 to-orange-600/20 border border-amber-500/30 rounded-2xl p-6 hover:from-amber-600/30 hover:to-orange-600/30 transition-all group disabled:opacity-70"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center relative">
                    <Bot className="w-7 h-7 text-white" />
                    <Pause className="absolute -top-1 -right-1 w-4 h-4 text-amber-400 bg-slate-950 rounded-full p-0.5" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      Resume Paused Session
                      {resumingId === pausedSession.id && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                    </h2>
                    <p className="text-slate-400 text-sm">
                      {pausedSession.subject || 'General Study'} • {pausedSession.messageCount} messages
                    </p>
                  </div>
                </div>
                <Play className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
            </button>
          </motion.div>
        )}

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 bg-slate-800/30 rounded-2xl border border-slate-700/50 p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            How AI Partner Works
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-semibold text-sm">1</span>
              </div>
              <div>
                <p className="text-white font-medium">Search for a partner</p>
                <p className="text-slate-400 text-sm">Use the search page to find study partners by subject, location, skill level, etc.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-purple-400 font-semibold text-sm">2</span>
              </div>
              <div>
                <p className="text-white font-medium">No partners available?</p>
                <p className="text-slate-400 text-sm">If no one matches your criteria, you&apos;ll see an option to try AI Partner.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-green-400 font-semibold text-sm">3</span>
              </div>
              <div>
                <p className="text-white font-medium">AI becomes your partner</p>
                <p className="text-slate-400 text-sm">The AI adopts the perspective of the partner you were looking for - same subject, location, skill level.</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push('/search')}
            className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-600 transition-all"
          >
            <Search className="w-5 h-5" />
            Find Partners
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
            <h2 className="text-lg font-semibold text-white">Session History</h2>
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
                Search for partners to get started with AI Partner
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
                  <div
                    className={`w-full bg-slate-800/50 border rounded-xl p-4 transition-all text-left ${
                      session.status === 'ACTIVE' || session.status === 'PAUSED'
                        ? 'border-slate-600/50 hover:bg-slate-800 cursor-pointer'
                        : 'border-slate-700/50 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            session.status === 'ACTIVE'
                              ? 'bg-green-500/20'
                              : session.status === 'PAUSED'
                              ? 'bg-amber-500/20'
                              : 'bg-slate-700/50'
                          }`}
                        >
                          <Bot
                            className={`w-5 h-5 ${
                              session.status === 'ACTIVE'
                                ? 'text-green-400'
                                : session.status === 'PAUSED'
                                ? 'text-amber-400'
                                : 'text-slate-400'
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-white flex items-center gap-2">
                            {session.subject || 'General Study'}
                            {session.status === 'PAUSED' && (
                              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                                Paused
                              </span>
                            )}
                            {session.status === 'ACTIVE' && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                                Active
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(session.startedAt, session.endedAt, session.status)}
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
                          <button
                            onClick={() => router.push(`/ai-partner/${session.id}`)}
                            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                          >
                            <ChevronRight className="w-5 h-5 text-green-400" />
                          </button>
                        )}
                        {session.status === 'PAUSED' && (
                          <button
                            onClick={() => handleResumeSession(session.id)}
                            disabled={resumingId === session.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            {resumingId === session.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Play className="w-4 h-4" />
                                Resume
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
