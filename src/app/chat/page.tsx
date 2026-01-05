'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { subscribeToUnreadMessages } from '@/lib/supabase/realtime'

export default function ChatSelectionPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')
  const [unreadCounts, setUnreadCounts] = useState({ partner: 0, group: 0 })
  const [groupIds, setGroupIds] = useState<string[]>([])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  // Fetch user's group IDs for real-time subscription
  useEffect(() => {
    if (!user) return

    const fetchGroupIds = async () => {
      try {
        const response = await fetch('/api/groups/my-groups')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.groups) {
            const ids = data.groups.map((g: { id: string }) => g.id)
            setGroupIds(ids)
          }
        }
      } catch (error) {
        console.error('Error fetching group IDs:', error)
      }
    }

    fetchGroupIds()
  }, [user])

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

    // Pass groupIds to enable real-time group message updates
    const cleanup = subscribeToUnreadMessages(user.id, refreshUnreadCounts, groupIds.length > 0 ? groupIds : undefined)
    return cleanup
  }, [user, groupIds])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-500 dark:text-neutral-400">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* Header */}
      <header className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-neutral-700 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white tracking-tight">
                {t('title')}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Section */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-neutral-900 dark:text-white mb-3 tracking-tight">
              {t('chooseChatType')}
            </h2>
            <p className="text-base text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
              {t('chooseChatTypeDescription')}
            </p>
          </div>

          {/* Selection Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Partner Chat Card */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/chat/partners')}
              className="group text-left bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 overflow-hidden"
            >
              {/* Card Header */}
              <div className="relative h-40 bg-gradient-to-r from-blue-500 to-blue-600 overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)]"></div>
                <div className="absolute top-5 right-5 w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                {unreadCounts.partner > 0 && (
                  <div className="absolute top-4 left-5 bg-white text-blue-600 text-xs px-2.5 py-1 rounded-full font-medium">
                    {unreadCounts.partner} new
                  </div>
                )}
                <div className="absolute bottom-5 left-5">
                  <h3 className="text-xl font-semibold text-white mb-1">{t('partnerChat')}</h3>
                  <p className="text-blue-100 text-sm">{t('oneOnOneConversations')}</p>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border border-neutral-300 dark:border-neutral-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm">{t('privateMessages')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border border-neutral-300 dark:border-neutral-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm">{t('videoAudioCalls')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border border-neutral-300 dark:border-neutral-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm">{t('searchPartnersAndMessages')}</p>
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">{t('getStarted')}</span>
                  <svg className="w-4 h-4 text-neutral-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </motion.button>

            {/* Group Chat Card */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/chat/groups')}
              className="group text-left bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 overflow-hidden"
            >
              {/* Card Header */}
              <div className="relative h-40 bg-gradient-to-r from-blue-500 to-blue-500 overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)]"></div>
                <div className="absolute top-5 right-5 w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                {unreadCounts.group > 0 && (
                  <div className="absolute top-4 left-5 bg-white text-blue-600 text-xs px-2.5 py-1 rounded-full font-medium">
                    {unreadCounts.group} new
                  </div>
                )}
                <div className="absolute bottom-5 left-5">
                  <h3 className="text-xl font-semibold text-white mb-1">{t('groupChat')}</h3>
                  <p className="text-blue-100 text-sm">{t('groupConversations')}</p>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border border-neutral-300 dark:border-neutral-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm">{t('groupMessages')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border border-neutral-300 dark:border-neutral-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm">{t('viewGroupMembers')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border border-neutral-300 dark:border-neutral-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm">{t('searchGroupsAndMessages')}</p>
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">{t('getStarted')}</span>
                  <svg className="w-4 h-4 text-neutral-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </motion.button>
          </div>
        </div>
      </main>
    </div>
  )
}
