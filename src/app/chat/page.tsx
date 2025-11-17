'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { subscribeToUnreadMessages } from '@/lib/supabase/realtime'
import ElectricBorder from '@/components/landing/ElectricBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'

export default function ChatSelectionPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')
  const [unreadCounts, setUnreadCounts] = useState({ partner: 0, group: 0 })

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  // Fetch unread message counts
  useEffect(() => {
    if (!user) return

    const fetchUnreadCounts = async () => {
      try {
        const response = await fetch('/api/messages/unread-counts')
        if (response.ok) {
          const data = await response.json()
          setUnreadCounts({ partner: data.partner || 0, group: data.group || 0 })
        }
      } catch (error) {
        console.error('Error fetching unread counts:', error)
      }
    }

    fetchUnreadCounts()
    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCounts, 30000)
    return () => clearInterval(interval)
  }, [user])

  // Real-time subscription for unread count updates
  useEffect(() => {
    if (!user) return

    const refreshUnreadCounts = async () => {
      try {
        const response = await fetch('/api/messages/unread-counts')
        if (response.ok) {
          const data = await response.json()
          setUnreadCounts({ partner: data.partner || 0, group: data.group || 0 })
        }
      } catch (error) {
        console.error('Error refreshing unread counts:', error)
      }
    }

    const cleanup = subscribeToUnreadMessages(user.id, refreshUnreadCounts)
    return cleanup
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {t('title')}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Welcome Section */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">
              {t('chooseChatType')}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t('chooseChatTypeDescription')}
            </p>
          </div>

          {/* Selection Cards */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Partner Chat Card */}
            <FadeIn delay={0} direction="up">
              <ElectricBorder
                color={unreadCounts.partner > 0 ? "#3b82f6" : "#e5e7eb"}
                speed={1}
                chaos={unreadCounts.partner > 0 ? 0.5 : 0.2}
                thickness={2}
                style={{ borderRadius: 16 }}
                className="h-full"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="h-full"
                >
                  <button
                    onClick={() => router.push('/chat/partners')}
                    className="w-full h-full bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group border-2 border-transparent hover:border-blue-200"
                  >
                <div className="relative h-48 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  <div className="absolute top-6 right-6 w-16 h-16 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  {unreadCounts.partner > 0 && (
                    <Pulse>
                      <div className="absolute top-4 left-6 bg-red-600 text-white text-xs px-2.5 py-1 rounded-full font-bold shadow-lg z-10">
                        {unreadCounts.partner}
                      </div>
                    </Pulse>
                  )}
                  <div className="absolute bottom-6 left-6">
                    <h3 className="text-2xl font-bold text-white mb-2">{t('partnerChat')}</h3>
                    <p className="text-blue-100 text-sm">{t('oneOnOneConversations')}</p>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-3 text-left">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-gray-700 text-sm">{t('privateMessages')}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-gray-700 text-sm">{t('videoAudioCalls')}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-gray-700 text-sm">{t('searchPartnersAndMessages')}</p>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">{t('getStarted')}</span>
                    <svg className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                  </button>
                </motion.div>
              </ElectricBorder>
            </FadeIn>

            {/* Group Chat Card */}
            <FadeIn delay={0.1} direction="up">
              <ElectricBorder
                color={unreadCounts.group > 0 ? "#8b5cf6" : "#e5e7eb"}
                speed={1}
                chaos={unreadCounts.group > 0 ? 0.5 : 0.2}
                thickness={2}
                style={{ borderRadius: 16 }}
                className="h-full"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="h-full"
                >
                  <button
                    onClick={() => router.push('/chat/groups')}
                    className="w-full h-full bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group border-2 border-transparent hover:border-purple-200"
                  >
                <div className="relative h-48 bg-gradient-to-br from-purple-500 via-purple-600 to-pink-600 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  <div className="absolute top-6 right-6 w-16 h-16 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  {unreadCounts.group > 0 && (
                    <Pulse>
                      <div className="absolute top-4 left-6 bg-red-600 text-white text-xs px-2.5 py-1 rounded-full font-bold shadow-lg z-10">
                        {unreadCounts.group}
                      </div>
                    </Pulse>
                  )}
                  <div className="absolute bottom-6 left-6">
                    <h3 className="text-2xl font-bold text-white mb-2">{t('groupChat')}</h3>
                    <p className="text-purple-100 text-sm">{t('groupConversations')}</p>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-3 text-left">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-gray-700 text-sm">{t('groupMessages')}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-gray-700 text-sm">{t('viewGroupMembers')}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-gray-700 text-sm">{t('searchGroupsAndMessages')}</p>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">{t('getStarted')}</span>
                    <svg className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                  </button>
                </motion.div>
              </ElectricBorder>
            </FadeIn>
          </div>
        </div>
      </main>
    </div>
  )
}
