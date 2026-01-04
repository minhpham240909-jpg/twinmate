'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import GlowBorder from '@/components/ui/GlowBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'

interface ConnectionRequest {
  id: string
  status: string
  message?: string | null
  createdAt: string
  senderId: string
  receiverId: string
  sender: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
  receiver: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
}

export default function ConnectionsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const t = useTranslations('connections')
  const tCommon = useTranslations('common')
  const [sentRequests, setSentRequests] = useState<ConnectionRequest[]>([])
  const [receivedRequests, setReceivedRequests] = useState<ConnectionRequest[]>([])
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received')
  const [error, setError] = useState('')
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())

  // Message truncation threshold
  const MESSAGE_TRUNCATE_LENGTH = 100

  const toggleMessageExpand = (requestId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev)
      if (next.has(requestId)) {
        next.delete(requestId)
      } else {
        next.add(requestId)
      }
      return next
    })
  }

  const shouldTruncate = (message: string | null | undefined) => {
    return message && message.length > MESSAGE_TRUNCATE_LENGTH
  }

  const getDisplayMessage = (message: string | null | undefined, requestId: string) => {
    if (!message) return null
    if (expandedMessages.has(requestId) || message.length <= MESSAGE_TRUNCATE_LENGTH) {
      return message
    }
    return message.substring(0, MESSAGE_TRUNCATE_LENGTH) + '...'
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    } else if (user) {
      fetchConnectionRequests()
    }
  }, [user, loading, router])

  const fetchConnectionRequests = async () => {
    setError('')
    try {
      // Fetch all connection requests using the new connections API
      const response = await fetch('/api/connections')

      if (response.ok) {
        const data = await response.json()
        setReceivedRequests(data.received || [])
        setSentRequests(data.sent || [])
      } else {
        const errorData = await response.json().catch(() => ({ error: t('failedToFetch') }))
        setError(errorData.error || t('failedToLoad'))
      }
    } catch (error) {
      console.error('Error fetching connection requests:', error)
      setError(t('connectionError'))
    }
  }

  const handleAccept = async (matchId: string) => {
    if (processingRequest === matchId) return // Prevent double clicks
    
    setProcessingRequest(matchId)
    try {
      const response = await fetch('/api/connections/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId })
      })

      if (response.ok) {
        toast.success(t('connectionAccepted'))
        fetchConnectionRequests()
      } else {
        const errorData = await response.json().catch(() => ({ error: t('failedToAccept') }))
        toast.error(errorData.error || t('failedToAccept'))
      }
    } catch (error) {
      console.error('Error accepting connection:', error)
      toast.error(t('failedToAcceptRetry'))
    } finally {
      setProcessingRequest(null)
    }
  }

  const handleDecline = async (matchId: string) => {
    if (processingRequest === matchId) return // Prevent double clicks
    
    setProcessingRequest(matchId)
    try {
      const response = await fetch('/api/connections/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId })
      })

      if (response.ok) {
        toast.success(t('connectionDeclined'))
        fetchConnectionRequests()
      } else {
        const errorData = await response.json().catch(() => ({ error: t('failedToDecline') }))
        toast.error(errorData.error || t('failedToDecline'))
      }
    } catch (error) {
      console.error('Error declining connection:', error)
      toast.error(t('failedToDeclineRetry'))
    } finally {
      setProcessingRequest(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-slate-400">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  // Helper function to safely get initials
  const getInitials = (name: string) => {
    if (!name || name.length === 0) return 'U'
    return name[0].toUpperCase()
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="backdrop-blur-xl bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-800/50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{t('title')}</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Error Message */}
        {error && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="backdrop-blur-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <button
                onClick={fetchConnectionRequests}
                className="ml-auto px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium transition-colors"
              >
                {t('retry')}
              </button>
            </div>
          </div>
        )}
        <div className="max-w-4xl mx-auto">
          {/* Tabs */}
          <FadeIn delay={0.1}>
            <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-slate-800/50">
              <button
                onClick={() => setActiveTab('received')}
                className={`pb-3 px-4 font-medium transition-all hover:scale-105 ${
                  activeTab === 'received'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                }`}
              >
                {t('received')} {receivedRequests.length > 0 && (
                  <Pulse>
                    <span className="ml-1 text-blue-400">({receivedRequests.length})</span>
                  </Pulse>
                )}
              </button>
              <button
                onClick={() => setActiveTab('sent')}
                className={`pb-3 px-4 font-medium transition-all hover:scale-105 ${
                  activeTab === 'sent'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                }`}
              >
                {t('sent')} {sentRequests.length > 0 && (
                  <Pulse>
                    <span className="ml-1 text-blue-400">({sentRequests.length})</span>
                  </Pulse>
                )}
              </button>
            </div>
          </FadeIn>

          {/* Received Requests */}
          {activeTab === 'received' && (
            <FadeIn delay={0.2}>
              <div className="space-y-4">
                {receivedRequests.length === 0 ? (
                  <div className="backdrop-blur-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800/50 rounded-xl p-12 text-center">
                    <p className="text-gray-700 dark:text-slate-400">{t('noPending')}</p>
                  </div>
                ) : (
                  receivedRequests.map((request, index) => (
                    <FadeIn key={request.id} delay={index * 0.05}>
                      <GlowBorder color="#3b82f6" intensity="medium" animated={false}  style={{ borderRadius: 12 }}>
                        <div className="backdrop-blur-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800/50 rounded-xl p-6 shadow-lg dark:shadow-none">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                              {request.sender.avatarUrl ? (
                                <Bounce delay={index * 0.1}>
                                  <img
                                    src={request.sender.avatarUrl}
                                    alt={request.sender.name}
                                    className="w-12 h-12 rounded-full"
                                  />
                                </Bounce>
                              ) : (
                                <Bounce delay={index * 0.1}>
                                  <Pulse>
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-semibold shadow-lg">
                                      {getInitials(request.sender.name)}
                                    </div>
                                  </Pulse>
                                </Bounce>
                              )}
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 dark:text-slate-100">{request.sender.name}</h3>
                                <p className="text-sm text-gray-600 dark:text-slate-400">{request.sender.email}</p>
                                {request.message && (
                                  <div className="mt-2">
                                    <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">
                                      {getDisplayMessage(request.message, request.id)}
                                    </p>
                                    {shouldTruncate(request.message) && (
                                      <button
                                        onClick={() => toggleMessageExpand(request.id)}
                                        className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium mt-1 transition-colors"
                                      >
                                        {expandedMessages.has(request.id) ? 'Show less' : 'Read more'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Bounce delay={index * 0.1 + 0.1}>
                                <button
                                  onClick={() => handleAccept(request.id)}
                                  disabled={processingRequest === request.id}
                                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm rounded-lg hover:from-blue-600 hover:to-cyan-600 hover:scale-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg"
                                >
                                  {processingRequest === request.id ? t('processing') : t('accept')}
                                </button>
                              </Bounce>
                              <Bounce delay={index * 0.1 + 0.2}>
                                <button
                                  onClick={() => handleDecline(request.id)}
                                  disabled={processingRequest === request.id}
                                  className="px-4 py-2 backdrop-blur-xl bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700/50 text-gray-700 dark:text-slate-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700/50 hover:scale-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                >
                                  {processingRequest === request.id ? t('processing') : t('decline')}
                                </button>
                              </Bounce>
                            </div>
                          </div>
                        </div>
                      </GlowBorder>
                    </FadeIn>
                  ))
                )}
              </div>
            </FadeIn>
          )}

          {/* Sent Requests */}
          {activeTab === 'sent' && (
            <FadeIn delay={0.2}>
              <div className="space-y-4">
                {sentRequests.length === 0 ? (
                  <div className="backdrop-blur-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800/50 rounded-xl p-12 text-center">
                    <p className="text-gray-700 dark:text-slate-400">{t('noSent')}</p>
                  </div>
                ) : (
                  sentRequests.map((request, index) => (
                    <FadeIn key={request.id} delay={index * 0.05}>
                      <GlowBorder color="#8b5cf6" intensity="medium" animated={false}  style={{ borderRadius: 12 }}>
                        <div className="backdrop-blur-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800/50 rounded-xl p-6 shadow-lg dark:shadow-none">
                          <div className="flex items-start gap-4">
                            {request.receiver.avatarUrl ? (
                              <Bounce delay={index * 0.1}>
                                <img
                                  src={request.receiver.avatarUrl}
                                  alt={request.receiver.name}
                                  className="w-12 h-12 rounded-full"
                                />
                              </Bounce>
                            ) : (
                              <Bounce delay={index * 0.1}>
                                <Pulse>
                                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold shadow-lg">
                                    {getInitials(request.receiver.name)}
                                  </div>
                                </Pulse>
                              </Bounce>
                            )}
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-slate-100">{request.receiver.name}</h3>
                              <p className="text-sm text-gray-600 dark:text-slate-400">{request.receiver.email}</p>
                              <Pulse>
                                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2 font-medium">{t('pendingResponse')}</p>
                              </Pulse>
                            </div>
                          </div>
                        </div>
                      </GlowBorder>
                    </FadeIn>
                  ))
                )}
              </div>
            </FadeIn>
          )}
        </div>
      </main>
    </div>
  )
}
