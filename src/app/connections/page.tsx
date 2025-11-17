'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import ElectricBorder from '@/components/landing/ElectricBorder'
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{tCommon('loading')}</p>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-blue-600">{t('title')}</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Error Message */}
        {error && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={fetchConnectionRequests}
                className="ml-auto px-3 py-1 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                {t('retry')}
              </button>
            </div>
          </div>
        )}
        <div className="max-w-4xl mx-auto">
          {/* Tabs */}
          <FadeIn delay={0.1}>
            <div className="flex gap-4 mb-6 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('received')}
                className={`pb-3 px-4 font-medium transition-all hover:scale-105 ${
                  activeTab === 'received'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t('received')} {receivedRequests.length > 0 && (
                  <Pulse>
                    <span className="ml-1 text-blue-600">({receivedRequests.length})</span>
                  </Pulse>
                )}
              </button>
              <button
                onClick={() => setActiveTab('sent')}
                className={`pb-3 px-4 font-medium transition-all hover:scale-105 ${
                  activeTab === 'sent'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t('sent')} {sentRequests.length > 0 && (
                  <Pulse>
                    <span className="ml-1 text-blue-600">({sentRequests.length})</span>
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
                  <div className="bg-white rounded-xl p-12 text-center">
                    <p className="text-gray-600">{t('noPending')}</p>
                  </div>
                ) : (
                  receivedRequests.map((request, index) => (
                    <FadeIn key={request.id} delay={index * 0.05}>
                      <ElectricBorder color="#3b82f6" speed={1} chaos={0.3} thickness={2} style={{ borderRadius: 12 }}>
                        <div className="bg-white rounded-xl p-6 shadow-sm">
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
                                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                                      {getInitials(request.sender.name)}
                                    </div>
                                  </Pulse>
                                </Bounce>
                              )}
                              <div>
                                <h3 className="font-semibold text-gray-900">{request.sender.name}</h3>
                                <p className="text-sm text-gray-600">{request.sender.email}</p>
                                {request.message && (
                                  <p className="text-sm text-gray-700 mt-2">{request.message}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Bounce delay={index * 0.1 + 0.1}>
                                <button
                                  onClick={() => handleAccept(request.id)}
                                  disabled={processingRequest === request.id}
                                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 hover:scale-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg"
                                >
                                  {processingRequest === request.id ? t('processing') : t('accept')}
                                </button>
                              </Bounce>
                              <Bounce delay={index * 0.1 + 0.2}>
                                <button
                                  onClick={() => handleDecline(request.id)}
                                  disabled={processingRequest === request.id}
                                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 hover:scale-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                >
                                  {processingRequest === request.id ? t('processing') : t('decline')}
                                </button>
                              </Bounce>
                            </div>
                          </div>
                        </div>
                      </ElectricBorder>
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
                  <div className="bg-white rounded-xl p-12 text-center">
                    <p className="text-gray-600">{t('noSent')}</p>
                  </div>
                ) : (
                  sentRequests.map((request, index) => (
                    <FadeIn key={request.id} delay={index * 0.05}>
                      <ElectricBorder color="#8b5cf6" speed={1} chaos={0.3} thickness={2} style={{ borderRadius: 12 }}>
                        <div className="bg-white rounded-xl p-6 shadow-sm">
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
                                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                                    {getInitials(request.receiver.name)}
                                  </div>
                                </Pulse>
                              </Bounce>
                            )}
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{request.receiver.name}</h3>
                              <p className="text-sm text-gray-600">{request.receiver.email}</p>
                              <Pulse>
                                <p className="text-sm text-yellow-600 mt-2 font-medium">{t('pendingResponse')}</p>
                              </Pulse>
                            </div>
                          </div>
                        </div>
                      </ElectricBorder>
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
