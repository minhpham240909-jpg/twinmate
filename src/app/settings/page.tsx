'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useTheme } from '@/contexts/ThemeContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useTranslations } from 'next-intl'
import { useNotificationPermission } from '@/hooks/useNotificationPermission'
import { getOrCreateDeviceId } from '@/lib/utils/deviceId'
import { motion, AnimatePresence } from 'framer-motion'
import GlowBorder from '@/components/ui/GlowBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'
import {
  User,
  Lock,
  Bell,
  MessageSquare,
  Users,
  Globe,
  Accessibility,
  Database,
  History,
  Link2,
  Settings as SettingsIcon,
  Info,
  ArrowLeft,
  Check,
  X,
  Save,
  RotateCcw,
  Sun,
  Moon,
  Monitor
} from 'lucide-react'

// Types
type DeletedPost = {
  id: string
  content: string
  deletedAt: string
  daysRemaining: number
  _count?: {
    likes: number
    comments: number
    reposts: number
  }
}

interface UserSettings {
  // Account & Profile
  language?: string
  // Privacy & Visibility
  profileVisibility?: 'EVERYONE' | 'CONNECTIONS_ONLY' | 'PRIVATE'
  postPrivacy?: 'PUBLIC' | 'PARTNERS_ONLY'
  searchVisibility?: boolean
  showOnlineStatus?: boolean
  showLastSeen?: boolean
  dataSharing?: 'MINIMAL' | 'STANDARD' | 'FULL'
  locationVisibility?: 'private' | 'match-only' | 'public'
  // Notification Preferences
  notifyConnectionRequests?: boolean
  notifyConnectionAccepted?: boolean
  notifySessionInvites?: boolean
  notifyGroupInvites?: boolean
  notifyMessages?: boolean
  notifyMissedCalls?: boolean
  notifyCommunityActivity?: boolean
  notifySessionReminders?: boolean
  // Email Notifications
  emailConnectionRequests?: boolean
  emailSessionInvites?: boolean
  emailMessages?: boolean
  emailWeeklySummary?: boolean
  // Notification Frequency
  notificationFrequency?: 'REALTIME' | 'DIGEST_DAILY' | 'DIGEST_WEEKLY' | 'OFF'
  // Do Not Disturb
  doNotDisturbEnabled?: boolean
  doNotDisturbStart?: string | null
  doNotDisturbEnd?: string | null
  // Communication Settings
  messageReadReceipts?: boolean
  typingIndicators?: boolean
  autoDownloadMedia?: boolean
  videoQuality?: 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH'
  audioQuality?: 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH'
  enableVirtualBackground?: boolean
  autoAnswerFromPartners?: boolean
  callRingtone?: string
  // Group Settings
  defaultGroupPrivacy?: 'PUBLIC' | 'PRIVATE' | 'INVITE_ONLY'
  groupNotifications?: boolean
  autoJoinMatchingGroups?: boolean
  groupInvitePrivacy?: 'EVERYONE' | 'CONNECTIONS' | 'NOBODY'
  // Content & Community
  feedAlgorithm?: 'RECOMMENDED' | 'CHRONOLOGICAL' | 'TRENDING'
  showTrendingTopics?: boolean
  commentPrivacy?: 'EVERYONE' | 'CONNECTIONS' | 'NOBODY'
  tagPrivacy?: 'EVERYONE' | 'CONNECTIONS' | 'NOBODY'
  contentFiltering?: string[]
  // Accessibility
  theme?: 'LIGHT' | 'DARK' | 'SYSTEM'
  fontSize?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE'
  highContrast?: boolean
  reducedMotion?: boolean
  keyboardShortcuts?: boolean
  colorBlindMode?: 'NONE' | 'PROTANOPIA' | 'DEUTERANOPIA' | 'TRITANOPIA'
  // Data & Storage
  cacheEnabled?: boolean
  autoBackup?: boolean
  storageUsageLimit?: number
  // Integrations
  googleCalendarSync?: boolean
  googleCalendarId?: string | null
  // Advanced
  developerMode?: boolean
  betaFeatures?: boolean
  performanceMode?: 'LOW_POWER' | 'BALANCED' | 'PERFORMANCE'
  analyticsEnabled?: boolean
}

type TabId =
  | 'account'
  | 'privacy'
  | 'notifications'
  | 'communication'
  | 'groups'
  | 'community'
  | 'accessibility'
  | 'data'
  | 'history'
  | 'integrations'
  | 'advanced'
  | 'about'

export default function SettingsPage() {
  const { user, loading, profile } = useAuth()
  const router = useRouter()
  const { theme: currentTheme, setTheme: setGlobalTheme } = useTheme()
  const { settings: globalSettings, loading: loadingSettings, refreshSettings } = useSettings()
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const [activeTab, setActiveTab] = useState<TabId>('account')
  const [settings, setSettings] = useState<UserSettings>(globalSettings)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [initialSettings, setInitialSettings] = useState<UserSettings>(globalSettings)


  // Redirect if not authenticated (use replace to prevent redirect loops)
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/signin')
    }
  }, [user, loading, router])

  // Sync with global settings from context and load location visibility from profile
  useEffect(() => {
    const settingsWithLocation = {
      ...globalSettings,
      locationVisibility: (profile as any)?.location_visibility || 'match-only'
    }
    setSettings(settingsWithLocation)
    setInitialSettings(settingsWithLocation)
  }, [globalSettings, profile])


  // Handle clear cache
  const handleClearCache = async () => {
    if (!confirm(t('confirmClearCache'))) {
      return
    }

    try {
      // Clear localStorage (except auth tokens)
      const keysToKeep = ['sb-access-token', 'sb-refresh-token', 'theme']
      const storage: Record<string, string> = {}
      keysToKeep.forEach(key => {
        const value = localStorage.getItem(key)
        if (value) storage[key] = value
      })

      localStorage.clear()
      keysToKeep.forEach(key => {
        if (storage[key]) localStorage.setItem(key, storage[key])
      })

      // Clear sessionStorage
      sessionStorage.clear()

      // Call API to clear server-side cache
      await fetch('/api/settings/clear-cache', { method: 'POST' })

      toast.success(t('cacheCleared'))
    } catch (error) {
      console.error('Error clearing cache:', error)
      toast.error(t('cacheClearFailed'))
    }
  }

  // Handle export data
  const handleExportData = async () => {
    try {
      toast.loading(t('preparingExport'))

      const response = await fetch('/api/settings/export-data')

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `clerva-data-export-${Date.now()}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast.dismiss()
        toast.success(t('dataExported'))
      } else {
        toast.dismiss()
        toast.error(t('dataExportFailed'))
      }
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.dismiss()
      toast.error(t('dataExportFailed'))
    }
  }

  // Handle delete account
  const handleDeleteAccount = async () => {
    const confirmation = prompt(
      t('confirmDeleteAccount') + '\n\n' +
      t('thisWillPermanentlyDelete') + '\n' +
      '- ' + t('yourProfileAndData') + '\n' +
      '- ' + t('allYourPosts') + '\n' +
      '- ' + t('allYourConnections') + '\n' +
      '- ' + t('allYourMessages') + '\n' +
      '- ' + t('allYourSessions') + '\n\n' +
      t('thisActionCannotBeUndone') + '\n\n' +
      t('typeDeleteToConfirm')
    )

    if (confirmation !== 'DELETE') {
      if (confirmation !== null) {
        toast.error(t('deletionCancelled'))
      }
      return
    }

    try {
      toast.loading(t('deletingAccount'))

      const response = await fetch('/api/settings/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      })

      if (response.ok) {
        toast.dismiss()
        toast.success(t('accountDeleted'))

        // Sign out and redirect to home page
        setTimeout(() => {
          window.location.href = '/auth/signin'
        }, 2000)
      } else {
        const error = await response.json()
        toast.dismiss()
        toast.error(error.error || t('accountDeleteFailed'))
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.dismiss()
      toast.error(t('accountDeleteFailed'))
    }
  }

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(initialSettings)
    setHasChanges(changed)
  }, [settings, initialSettings])

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))

    // Sync theme with global theme provider immediately
    if (key === 'theme' && (value === 'LIGHT' || value === 'DARK' || value === 'SYSTEM')) {
      setGlobalTheme(value)
    }
  }

  // Sync settings theme with global theme on load
  useEffect(() => {
    if (settings.theme && (settings.theme === 'LIGHT' || settings.theme === 'DARK' || settings.theme === 'SYSTEM')) {
      if (settings.theme !== currentTheme) {
        setGlobalTheme(settings.theme)
      }
    }
  }, [settings.theme, currentTheme, setGlobalTheme])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Filter out ALL metadata and system fields that shouldn't be sent to the API
      const {
        id,
        userId,
        createdAt,
        updatedAt,
        user,
        locationVisibility,
        ...settingsToSave
      } = settings as any

      // Save location visibility separately (it's stored in Profile table)
      if (locationVisibility !== undefined && locationVisibility !== (profile as any)?.location_visibility) {
        const locationResponse = await fetch('/api/location/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city: (profile as any)?.location_city || null,
            state: (profile as any)?.location_state || null,
            country: (profile as any)?.location_country || null,
            lat: (profile as any)?.location_lat || null,
            lng: (profile as any)?.location_lng || null,
            visibility: locationVisibility,
          }),
        })

        if (!locationResponse.ok) {
          console.error('[Settings Save] Failed to update location visibility')
          toast.error(t('failedToUpdateLocationVisibility'))
          setSaving(false)
          return
        }
      }

      // Clean up the payload - remove undefined values and convert empty strings to null for nullable fields
      const cleanedSettings: Record<string, any> = {}
      Object.entries(settingsToSave).forEach(([key, value]) => {
        // Only include fields that have actual values
        if (value !== undefined) {
          // Convert empty strings to null for string fields
          if (value === '') {
            cleanedSettings[key] = null
          } else {
            cleanedSettings[key] = value
          }
        }
      })

      console.log('[Settings Save] Sending payload:', cleanedSettings)

      const response = await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedSettings),
      })

      if (response.ok) {
        const data = await response.json()

        // Update local state (include locationVisibility from current settings)
        const updatedSettings = {
          ...data.settings,
          locationVisibility: settings.locationVisibility
        }
        setSettings(updatedSettings)
        setInitialSettings(updatedSettings)
        setHasChanges(false)

        // Refresh global context to propagate changes throughout the app
        await refreshSettings()

        // Re-sync theme with ThemeContext after refresh
        if (data.settings.theme && (data.settings.theme === 'LIGHT' || data.settings.theme === 'DARK' || data.settings.theme === 'SYSTEM')) {
          setGlobalTheme(data.settings.theme)
        }

        toast.success(t('saveSuccess'))
      } else {
        const error = await response.json()
        console.error('[Settings Save Error]', error)

        // Show detailed validation errors if available
        if (error.details && Array.isArray(error.details)) {
          console.error('[Validation Errors]', error.details)
          const firstError = error.details[0]
          if (firstError) {
            toast.error(`${t('validationError')}: ${firstError.path?.join('.')} - ${firstError.message}`)
          } else {
            toast.error(error.message || t('invalidDataFormat'))
          }
        } else {
          toast.error(error.message || error.error || t('saveFailed'))
        }
      }
    } catch (error) {
      console.error('[Settings Save Exception]', error)
      toast.error(t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setSettings(initialSettings)
    setHasChanges(false)
    toast.success(tCommon('cancel'))
  }

  if (loading || loadingSettings) {
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

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { id: 'account', label: t('account'), icon: User, color: 'from-blue-500 to-cyan-500' },
    { id: 'privacy', label: t('privacy'), icon: Lock, color: 'from-purple-500 to-pink-500' },
    { id: 'notifications', label: t('notifications'), icon: Bell, color: 'from-orange-500 to-red-500' },
    { id: 'communication', label: t('communication'), icon: MessageSquare, color: 'from-indigo-500 to-blue-500' },
    { id: 'groups', label: t('groups'), icon: Users, color: 'from-violet-500 to-purple-500' },
    { id: 'community', label: t('community'), icon: Globe, color: 'from-teal-500 to-cyan-500' },
    { id: 'accessibility', label: t('accessibility'), icon: Accessibility, color: 'from-rose-500 to-pink-500' },
    { id: 'data', label: t('data'), icon: Database, color: 'from-slate-500 to-gray-500' },
    { id: 'history', label: 'History', icon: History, color: 'from-zinc-500 to-slate-500' },
    { id: 'integrations', label: t('integrations'), icon: Link2, color: 'from-cyan-500 to-blue-500' },
    { id: 'advanced', label: t('advanced'), icon: SettingsIcon, color: 'from-gray-500 to-slate-500' },
    { id: 'about', label: t('about'), icon: Info, color: 'from-blue-500 to-indigo-500' },
  ]

  const { effectiveTheme } = useTheme()
  
  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      effectiveTheme === 'dark' 
        ? 'bg-gradient-to-br from-gray-900 via-slate-900 to-zinc-900' 
        : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20'
    }`}>
      {/* Header */}
      <header className={`backdrop-blur-lg border-b sticky top-0 z-50 shadow-sm transition-colors duration-300 ${
        effectiveTheme === 'dark'
          ? 'bg-gray-900/80 border-gray-700/50'
          : 'bg-white/80 border-gray-200/50'
      }`}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <motion.button
                onClick={() => router.push('/dashboard')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`p-2 rounded-xl transition-colors duration-200 ${
                  effectiveTheme === 'dark'
                    ? 'hover:bg-gray-800'
                    : 'hover:bg-gray-100/80'
                }`}
              >
                <ArrowLeft className={`w-5 h-5 transition-colors duration-300 ${
                  effectiveTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`} />
              </motion.button>
              <div>
                <h1 className={`text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent ${
                  effectiveTheme === 'dark' ? 'dark:text-blue-400' : ''
                }`}>
                  {t('title')}
                </h1>
                <p className={`text-xs mt-0.5 transition-colors duration-300 ${
                  effectiveTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Manage your account settings and preferences
                </p>
              </div>
            </div>
            <AnimatePresence>
              {hasChanges && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3"
                >
                  <motion.button
                    onClick={handleReset}
                    disabled={saving}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-4 py-2 rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center gap-2 font-medium ${
                      effectiveTheme === 'dark'
                        ? 'text-gray-300 hover:bg-gray-800'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <RotateCcw className="w-4 h-4" />
                    {tCommon('cancel')}
                  </motion.button>
                  <Bounce>
                    <Pulse>
                      <motion.button
                        onClick={handleSave}
                        disabled={saving}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-2 font-medium shadow-md"
                      >
                        {saving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            {tCommon('loading')}
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            {tCommon('save')}
                          </>
                        )}
                      </motion.button>
                    </Pulse>
                  </Bounce>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 max-w-7xl mx-auto">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-72 flex-shrink-0">
            <FadeIn delay={0.1}>
              <GlowBorder color="#3b82f6" intensity="medium" animated={false}  style={{ borderRadius: 16 }}>
                <nav className={`backdrop-blur-lg rounded-2xl shadow-lg border p-3 sticky top-24 transition-colors duration-300 ${
                  effectiveTheme === 'dark'
                    ? 'bg-gray-900/80 border-gray-700/50'
                    : 'bg-white/80 border-gray-200/50'
                }`}>
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <motion.button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 relative overflow-hidden group ${
                        isActive
                          ? 'bg-gradient-to-r ' + tab.color + ' text-white shadow-lg shadow-blue-500/20'
                          : effectiveTheme === 'dark'
                          ? 'text-gray-300 hover:bg-gray-800/80'
                          : 'text-gray-700 hover:bg-gray-50/80'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTab"
                          className={`absolute inset-0 bg-gradient-to-r ${tab.color} opacity-100`}
                          initial={false}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      )}
                      <div className={`relative z-10 flex items-center gap-3 ${isActive ? 'text-white' : ''}`}>
                        <div className={`p-2 rounded-lg ${
                          isActive 
                            ? 'bg-white/20' 
                            : effectiveTheme === 'dark'
                            ? 'bg-gray-800 group-hover:bg-gray-700'
                            : 'bg-gray-100 group-hover:bg-gray-200'
                        }`}>
                          <Icon className={`w-5 h-5 ${
                            isActive 
                              ? 'text-white' 
                              : effectiveTheme === 'dark'
                              ? 'text-gray-400'
                              : 'text-gray-600'
                          }`} />
                        </div>
                        <span className={`font-medium ${
                          isActive 
                            ? 'text-white' 
                            : effectiveTheme === 'dark'
                            ? 'text-gray-300'
                            : 'text-gray-700'
                        }`}>{tab.label}</span>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
                </nav>
              </GlowBorder>
            </FadeIn>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <FadeIn delay={0.2}>
              <GlowBorder color="#8b5cf6" intensity="medium" animated={false}  style={{ borderRadius: 16 }}>
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className={`backdrop-blur-lg rounded-2xl shadow-lg border p-6 sm:p-8 lg:p-10 transition-colors duration-300 ${
                    effectiveTheme === 'dark'
                      ? 'bg-gray-900/80 border-gray-700/50'
                      : 'bg-white/80 border-gray-200/50'
                  }`}
                >
              <AnimatePresence mode="wait">
                {activeTab === 'account' && (
                  <motion.div key="account" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <AccountSettings settings={settings} updateSetting={updateSetting} />
                  </motion.div>
                )}
                {activeTab === 'privacy' && (
                  <motion.div key="privacy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <PrivacySettings settings={settings} updateSetting={updateSetting} />
                  </motion.div>
                )}
                {activeTab === 'notifications' && (
                  <motion.div key="notifications" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <NotificationsSettings settings={settings} updateSetting={updateSetting} />
                  </motion.div>
                )}
                {activeTab === 'communication' && (
                  <motion.div key="communication" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <CommunicationSettings settings={settings} updateSetting={updateSetting} />
                  </motion.div>
                )}
                {activeTab === 'groups' && (
                  <motion.div key="groups" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <GroupsSettings settings={settings} updateSetting={updateSetting} />
                  </motion.div>
                )}
                {activeTab === 'community' && (
                  <motion.div key="community" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <CommunitySettings settings={settings} updateSetting={updateSetting} />
                  </motion.div>
                )}
                {activeTab === 'accessibility' && (
                  <motion.div key="accessibility" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <AccessibilitySettings settings={settings} updateSetting={updateSetting} />
                  </motion.div>
                )}
                {activeTab === 'data' && (
                  <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <DataSettings
                      settings={settings}
                      updateSetting={updateSetting}
                      handleClearCache={handleClearCache}
                      handleExportData={handleExportData}
                      handleDeleteAccount={handleDeleteAccount}
                    />
                  </motion.div>
                )}
                {activeTab === 'history' && (
                  <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <HistorySection />
                  </motion.div>
                )}
                {activeTab === 'integrations' && (
                  <motion.div key="integrations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <IntegrationsSettings settings={settings} updateSetting={updateSetting} />
                  </motion.div>
                )}
                {activeTab === 'advanced' && (
                  <motion.div key="advanced" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <AdvancedSettings settings={settings} updateSetting={updateSetting} />
                  </motion.div>
                )}
                {activeTab === 'about' && (
                  <motion.div key="about" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <AboutSection />
                  </motion.div>
                )}
              </AnimatePresence>
                </motion.div>
              </GlowBorder>
            </FadeIn>
          </main>
        </div>
      </div>

      {/* Floating Save Button for Mobile */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-6 right-6 md:hidden z-50"
          >
            <Bounce>
              <Pulse>
                <motion.button
                  onClick={handleSave}
                  disabled={saving}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-200 disabled:opacity-50 flex items-center gap-2 font-medium"
                >
                  {saving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {t('saving')}
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {t('save')}
                    </>
                  )}
                </motion.button>
              </Pulse>
            </Bounce>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ==========================================
// SETTINGS SECTION COMPONENTS
// ==========================================

// Reusable Components
function SettingSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const { effectiveTheme } = useTheme()
  return (
    <div className="mb-10 last:mb-0">
      <div className="mb-6">
        <h2 className={`text-2xl font-bold mb-2 transition-colors duration-300 ${
          effectiveTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
        }`}>{title}</h2>
        {description && (
          <p className={`text-sm leading-relaxed max-w-2xl transition-colors duration-300 ${
            effectiveTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>{description}</p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const { effectiveTheme } = useTheme()
  return (
    <motion.div
      whileHover={{ 
        backgroundColor: effectiveTheme === 'dark' 
          ? 'rgba(31, 41, 55, 0.8)' 
          : 'rgba(249, 250, 251, 0.8)' 
      }}
      className={`flex items-start justify-between p-4 rounded-xl border transition-all duration-200 group ${
        effectiveTheme === 'dark'
          ? 'border-gray-700/50 bg-gray-800/50 hover:bg-gray-800'
          : 'border-gray-200/50 bg-gray-50/50 hover:bg-gray-50'
      }`}
    >
      <div className="flex-1 pr-4">
        <label className={`text-sm font-semibold cursor-pointer block mb-1 transition-colors duration-300 ${
          effectiveTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
        }`}>{label}</label>
        {description && (
          <p className={`text-xs leading-relaxed transition-colors duration-300 ${
            effectiveTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>{description}</p>
        )}
      </div>
      <motion.button
        onClick={() => onChange(!checked)}
        whileTap={{ scale: 0.95 }}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          checked
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 focus:ring-blue-500'
            : 'bg-gray-300 focus:ring-gray-400'
        }`}
      >
        <motion.span
          layout
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-all duration-300 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
          initial={false}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </motion.button>
    </motion.div>
  )
}

function SelectSetting({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string
  description?: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const { effectiveTheme } = useTheme()
  return (
    <motion.div
      whileHover={{ 
        backgroundColor: effectiveTheme === 'dark' 
          ? 'rgba(31, 41, 55, 0.8)' 
          : 'rgba(249, 250, 251, 0.8)' 
      }}
      className={`p-4 rounded-xl border transition-all duration-200 ${
        effectiveTheme === 'dark'
          ? 'border-gray-700/50 bg-gray-800/50 hover:bg-gray-800'
          : 'border-gray-200/50 bg-gray-50/50 hover:bg-gray-50'
      }`}
    >
      <label className={`block text-sm font-semibold mb-1 transition-colors duration-300 ${
        effectiveTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
      }`}>{label}</label>
      {description && <p className={`text-xs mb-3 leading-relaxed transition-colors duration-300 ${
        effectiveTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
      }`}>{description}</p>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer ${
          effectiveTheme === 'dark'
            ? 'border-gray-600 bg-gray-800 text-gray-100'
            : 'border-gray-300 bg-white text-gray-900'
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </motion.div>
  )
}

function NumberSetting({
  label,
  description,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  label: string
  description?: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  suffix?: string
}) {
  const { effectiveTheme } = useTheme()
  const handleChange = (inputValue: string) => {
    // Handle empty input - use min value
    if (inputValue === '' || inputValue === null || inputValue === undefined) {
      onChange(min)
      return
    }

    // Convert to number safely
    const numValue = Number(inputValue)

    // Check if conversion resulted in a valid number
    if (isNaN(numValue)) {
      onChange(min) // Fallback to min on invalid input
      return
    }

    // Clamp value between min and max
    const clampedValue = Math.min(Math.max(numValue, min), max)
    onChange(clampedValue)
  }

  return (
    <motion.div
      whileHover={{ 
        backgroundColor: effectiveTheme === 'dark' 
          ? 'rgba(31, 41, 55, 0.8)' 
          : 'rgba(249, 250, 251, 0.8)' 
      }}
      className={`p-4 rounded-xl border transition-all duration-200 ${
        effectiveTheme === 'dark'
          ? 'border-gray-700/50 bg-gray-800/50 hover:bg-gray-800'
          : 'border-gray-200/50 bg-gray-50/50 hover:bg-gray-50'
      }`}
    >
      <label className={`block text-sm font-semibold mb-1 transition-colors duration-300 ${
        effectiveTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
      }`}>{label}</label>
      {description && <p className={`text-xs mb-3 leading-relaxed transition-colors duration-300 ${
        effectiveTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
      }`}>{description}</p>}
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={value || min}
          min={min}
          max={max}
          onChange={(e) => handleChange(e.target.value)}
          className={`w-32 px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md ${
            effectiveTheme === 'dark'
              ? 'border-gray-600 bg-gray-800 text-gray-100'
              : 'border-gray-300 bg-white text-gray-900'
          }`}
        />
        {suffix && <span className={`text-sm font-medium transition-colors duration-300 ${
          effectiveTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>{suffix}</span>}
      </div>
    </motion.div>
  )
}

// Account Settings
function AccountSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  const { user, profile } = useAuth()
  const router = useRouter()
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  
  // State for various features
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [showActiveSessions, setShowActiveSessions] = useState(false)
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [emailData, setEmailData] = useState({ newEmail: '', verificationCode: '' })
  const [activeSessions, setActiveSessions] = useState<any[]>([])
  const [profileCompletion, setProfileCompletion] = useState<any>(null)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)

  // 2FA Modal State
  const [show2FAModal, setShow2FAModal] = useState(false)
  const [twoFactorQRCode, setTwoFactorQRCode] = useState<string | null>(null)
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null)
  const [twoFactorVerificationCode, setTwoFactorVerificationCode] = useState('')
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[]>([])
  const [twoFactorStep, setTwoFactorStep] = useState<'setup' | 'verify' | 'backup' | 'disable'>('setup')

  // Load profile completion on mount
  useEffect(() => {
    const fetchProfileCompletion = async () => {
      try {
        const response = await fetch('/api/settings/profile-completion')
        if (response.ok) {
          const data = await response.json()
          setProfileCompletion(data)
        }
      } catch (error) {
        console.error('Error fetching profile completion:', error)
      }
    }
    fetchProfileCompletion()
  }, [])

  // Load 2FA status
  useEffect(() => {
    const fetch2FAStatus = async () => {
      try {
        const response = await fetch('/api/settings/two-factor')
        if (response.ok) {
          const data = await response.json()
          setTwoFactorEnabled(data.enabled || false)
        }
      } catch (error) {
        console.error('Error fetching 2FA status:', error)
      }
    }
    fetch2FAStatus()
  }, [])

  // Load active sessions
  const loadActiveSessions = async () => {
    setSessionsLoading(true)
    try {
      // Get or create device ID
      const deviceId = getOrCreateDeviceId()

      const headers: HeadersInit = {
        'x-device-id': deviceId
      }
      
      const response = await fetch('/api/settings/active-sessions', { headers })
      if (response.ok) {
        const data = await response.json()
        setActiveSessions(data.sessions || [])
      }
    } catch (error) {
      console.error('Error fetching active sessions:', error)
      toast.error('Failed to load active sessions')
    } finally {
      setSessionsLoading(false)
    }
  }

  useEffect(() => {
    if (showActiveSessions) {
      loadActiveSessions()
    }
  }, [showActiveSessions])

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/settings/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Password changed successfully')
        setShowChangePassword(false)
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        toast.error(data.error || 'Failed to change password')
      }
    } catch (error) {
      console.error('Change password error:', error)
      toast.error('Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const handleChangeEmail = async () => {
    if (!emailData.newEmail || !emailData.newEmail.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/settings/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmail: emailData.newEmail,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Verification email sent. Please check your inbox.')
        setShowChangeEmail(false)
        setEmailData({ newEmail: '', verificationCode: '' })
      } else {
        toast.error(data.error || 'Failed to change email')
      }
    } catch (error) {
      console.error('Change email error:', error)
      toast.error('Failed to change email')
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/resend-verification', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Verification email sent. Please check your inbox.')
      } else {
        toast.error(data.error || 'Failed to send verification email')
      }
    } catch (error) {
      console.error('Resend verification error:', error)
      toast.error('Failed to send verification email')
    } finally {
      setLoading(false)
    }
  }

  const handleLogoutDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to log out this device?')) {
      return
    }

    setLoading(true)
    try {
      // Get current device ID
      const currentDeviceId = getOrCreateDeviceId()

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-device-id': currentDeviceId
      }
      
      const response = await fetch('/api/settings/active-sessions', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ deviceId }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Device logged out successfully')
        loadActiveSessions()
      } else {
        toast.error(data.error || 'Failed to logout device')
      }
    } catch (error) {
      console.error('Logout device error:', error)
      toast.error('Failed to logout device')
    } finally {
      setLoading(false)
    }
  }

  const handleLogoutAllDevices = async () => {
    if (!confirm('Are you sure you want to log out all other devices? You will remain logged in on this device.')) {
      return
    }

    setLoading(true)
    try {
      // Get current device ID
      const currentDeviceId = getOrCreateDeviceId()

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-device-id': currentDeviceId
      }
      
      const response = await fetch('/api/settings/active-sessions', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ logoutAll: true }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('All other devices logged out successfully')
        loadActiveSessions()
      } else {
        toast.error(data.error || 'Failed to logout devices')
      }
    } catch (error) {
      console.error('Logout all devices error:', error)
      toast.error('Failed to logout devices')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle2FA = async () => {
    if (twoFactorEnabled) {
      // Disable 2FA - show modal to get verification code
      setTwoFactorStep('disable')
      setShow2FAModal(true)
    } else {
      // Enable 2FA - initiate setup
      setLoading(true)
      try {
        const response = await fetch('/api/settings/two-factor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'enable' }),
        })

        const data = await response.json()

        if (response.ok) {
          // Show QR code modal
          setTwoFactorQRCode(data.qrCode)
          setTwoFactorSecret(data.manualEntryKey)
          setTwoFactorStep('setup')
          setShow2FAModal(true)
        } else {
          toast.error(data.error || 'Failed to initiate 2FA setup')
        }
      } catch (error) {
        console.error('2FA setup error:', error)
        toast.error('Failed to initiate 2FA setup')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleVerify2FA = async () => {
    if (!twoFactorVerificationCode || twoFactorVerificationCode.length < 6) {
      toast.error('Please enter a valid 6-digit code')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/settings/two-factor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: twoFactorStep === 'disable' ? 'disable' : 'verify',
          code: twoFactorVerificationCode
        }),
      })

      const data = await response.json()

      if (response.ok) {
        if (twoFactorStep === 'disable') {
          toast.success('2FA disabled successfully')
          setTwoFactorEnabled(false)
          setShow2FAModal(false)
          setTwoFactorVerificationCode('')
        } else {
          // Show backup codes
          setTwoFactorBackupCodes(data.backupCodes || [])
          setTwoFactorStep('backup')
          setTwoFactorEnabled(true)
        }
      } else {
        toast.error(data.error || 'Invalid verification code')
      }
    } catch (error) {
      console.error('2FA verification error:', error)
      toast.error('Failed to verify code')
    } finally {
      setLoading(false)
    }
  }

  const handleClose2FAModal = () => {
    setShow2FAModal(false)
    setTwoFactorQRCode(null)
    setTwoFactorSecret(null)
    setTwoFactorVerificationCode('')
    setTwoFactorBackupCodes([])
    setTwoFactorStep('setup')
  }

  const handleDeactivateAccount = async () => {
    const confirmation = prompt('Type DEACTIVATE to confirm account deactivation:')
    
    if (confirmation !== 'DEACTIVATE') {
      if (confirmation !== null) {
        toast.error('Deactivation cancelled')
      }
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/settings/deactivate-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DEACTIVATE' }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Account deactivated. You will be signed out.')
        setTimeout(() => {
          window.location.href = '/auth/signin'
        }, 2000)
      } else {
        toast.error(data.error || 'Failed to deactivate account')
      }
    } catch (error) {
      console.error('Deactivate account error:', error)
      toast.error('Failed to deactivate account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Profile Completion Indicator */}
      {profileCompletion && (
        <SettingSection
          title="Profile Completion"
          description="Complete your profile to improve matching"
        >
          <div className="p-5 rounded-xl border border-gray-200/50 bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900">Profile Completion</span>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {profileCompletion.completionPercentage}%
              </span>
            </div>
            <div className="w-full bg-gray-200/80 rounded-full h-3 mb-4 overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${profileCompletion.completionPercentage}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 h-full rounded-full shadow-lg"
              />
            </div>
            {profileCompletion.missingFields.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-600 font-medium">
                  Missing: {profileCompletion.missingFields.slice(0, 3).join(', ')}
                  {profileCompletion.missingFields.length > 3 && '...'}
                </span>
                <motion.button
                  onClick={() => router.push('/profile/edit')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 transition-colors"
                >
                  Complete Profile <span>→</span>
                </motion.button>
              </div>
            )}
          </div>
        </SettingSection>
      )}

      {/* Email Verification Status */}
      <SettingSection
        title="Email Verification"
        description="Verify your email address to secure your account"
      >
        <div className="p-4 rounded-xl border border-gray-200/50 bg-gray-50/50 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Email Status</div>
            <div className="text-xs text-gray-500 mt-1">{user?.email}</div>
          </div>
          <div className="flex items-center gap-3">
            {(user as any)?.email_confirmed_at ? (
              <span className="px-3 py-1.5 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 rounded-xl text-sm font-semibold border border-green-200/50 shadow-sm">
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  Verified
                </span>
              </span>
            ) : (
              <>
                <span className="px-3 py-1.5 bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700 rounded-xl text-sm font-semibold border border-yellow-200/50 shadow-sm">
                  <span className="flex items-center gap-1.5">
                    <X className="w-4 h-4" />
                    Not Verified
                  </span>
                </span>
                <motion.button
                  onClick={handleResendVerification}
                  disabled={loading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50 shadow-md"
                >
                  {loading ? 'Sending...' : 'Resend Verification'}
                </motion.button>
              </>
            )}
          </div>
        </div>
      </SettingSection>

      {/* Account Type/Role */}
      <SettingSection
        title="Account Type"
        description="Your current account subscription"
      >
        <div className="py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">Account Role</div>
            <div className="text-xs text-gray-500 mt-1">
              {(user as any)?.role === 'PREMIUM' ? 'Premium Account' : 'Free Account'}
            </div>
          </div>
          <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
            (user as any)?.role === 'PREMIUM' 
              ? 'bg-purple-100 text-purple-700' 
              : 'bg-gray-100 text-gray-700'
          }`}>
            {(user as any)?.role === 'PREMIUM' ? 'Premium' : 'Free'}
          </span>
        </div>
      </SettingSection>

      {/* Basic Settings */}
      <SettingSection
        title={t('accountProfile')}
        description={t('manageAccountPreferences')}
      >
        <SelectSetting
          label={t('language')}
          description={t('chooseLanguage')}
          value={settings.language || 'en'}
          options={[
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Español (Spanish)' },
          ]}
          onChange={(value) => updateSetting('language', value)}
        />
      </SettingSection>

      {/* Change Password */}
      <SettingSection
        title="Security"
        description="Manage your account security settings"
      >
        {/* Only show password change for non-OAuth users */}
        {!(user as any)?.app_metadata?.provider && (
          <div className="py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-gray-900">Password</div>
                <div className="text-xs text-gray-500 mt-1">Change your account password</div>
              </div>
              <motion.button
                onClick={() => setShowChangePassword(!showChangePassword)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-200 shadow-md"
              >
                {showChangePassword ? 'Cancel' : 'Change Password'}
              </motion.button>
            </div>
          {showChangePassword && (
            <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                />
                <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                />
              </div>
              <motion.button
                onClick={handleChangePassword}
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50 shadow-md"
              >
                {loading ? 'Changing...' : 'Change Password'}
              </motion.button>
            </div>
          )}
          </div>
        )}

        {/* Change Email */}
        <div className="py-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-gray-900">Email Address</div>
              <div className="text-xs text-gray-500 mt-1">Change your account email</div>
            </div>
            <motion.button
              onClick={() => setShowChangeEmail(!showChangeEmail)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-200 shadow-md"
            >
              {showChangeEmail ? 'Cancel' : 'Change Email'}
            </motion.button>
          </div>
          {showChangeEmail && (
            <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Email Address</label>
                <input
                  type="email"
                  value={emailData.newEmail}
                  onChange={(e) => setEmailData({ ...emailData, newEmail: e.target.value })}
                  placeholder="new@example.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                />
              </div>
              <button
                onClick={handleChangeEmail}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Verification Email'}
              </button>
            </div>
          )}
        </div>

        {/* Two-Factor Authentication */}
        <div className="py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">Two-Factor Authentication</div>
              <div className="text-xs text-gray-500 mt-1">Add an extra layer of security</div>
            </div>
            <button
              onClick={handleToggle2FA}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                twoFactorEnabled
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {loading ? 'Updating...' : twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
            </button>
          </div>
          {twoFactorEnabled && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-800">✓ Two-factor authentication is enabled</p>
            </div>
          )}
        </div>
      </SettingSection>

      {/* Active Sessions */}
      <SettingSection
        title="Active Sessions"
        description="Manage devices where you're logged in"
      >
        <div className="py-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-gray-900">Active Devices</div>
              <div className="text-xs text-gray-500 mt-1">View and manage your active sessions</div>
            </div>
            <button
              onClick={() => {
                setShowActiveSessions(!showActiveSessions)
                if (!showActiveSessions) {
                  loadActiveSessions()
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              {showActiveSessions ? 'Hide' : 'View Sessions'}
            </button>
          </div>
          {showActiveSessions && (
            <div className="mt-4 space-y-3">
              {sessionsLoading ? (
                <div className="text-center py-4">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : activeSessions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No active sessions found</p>
              ) : (
                <>
                  {activeSessions.map((session) => (
                    <div key={session.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {session.deviceType} • {session.browser}
                            </span>
                            {session.isCurrentDevice && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                Current Device
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div>IP: {session.ipAddress}</div>
                            <div>Last active: {new Date(session.lastActive).toLocaleString()}</div>
                          </div>
                        </div>
                        {!session.isCurrentDevice && (
                          <button
                            onClick={() => handleLogoutDevice(session.deviceId)}
                            disabled={loading}
                            className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                          >
                            Logout
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {activeSessions.length > 1 && (
                    <button
                      onClick={handleLogoutAllDevices}
                      disabled={loading}
                      className="w-full px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition disabled:opacity-50 font-medium"
                    >
                      Log Out All Other Devices
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </SettingSection>

      {/* Account Deactivation */}
      <SettingSection
        title="Account Management"
        description="Manage your account status"
      >
        <div className="py-3">
          <div className="p-4 border border-red-200 rounded-lg bg-red-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-sm font-medium text-red-900 mb-1">Deactivate Account</div>
                <div className="text-xs text-red-700">
                  Temporarily disable your account. You can reactivate by signing in again.
                </div>
              </div>
              <button
                onClick={handleDeactivateAccount}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {loading ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      </SettingSection>

      {/* 2FA Modal */}
      {show2FAModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            {/* Setup Step - Show QR Code */}
            {twoFactorStep === 'setup' && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Set Up Two-Factor Authentication</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>

                {twoFactorQRCode && (
                  <div className="flex justify-center mb-4">
                    <img src={twoFactorQRCode} alt="2FA QR Code" className="w-64 h-64" />
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <p className="text-xs text-gray-600 mb-2">Or enter this code manually:</p>
                  <code className="text-sm font-mono bg-white px-3 py-2 rounded border border-gray-200 block text-center">
                    {twoFactorSecret}
                  </code>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Enter 6-digit code from app
                    </label>
                    <input
                      type="text"
                      value={twoFactorVerificationCode}
                      onChange={(e) => setTwoFactorVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      maxLength={6}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleClose2FAModal}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleVerify2FA}
                      disabled={loading || twoFactorVerificationCode.length !== 6}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {loading ? 'Verifying...' : 'Verify & Enable'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Backup Codes Step */}
            {twoFactorStep === 'backup' && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Save Your Backup Codes</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.
                </p>

                <div className="bg-gray-50 p-4 rounded-lg mb-4 max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2">
                    {twoFactorBackupCodes.map((code, index) => (
                      <code key={index} className="text-sm font-mono bg-white px-3 py-2 rounded border border-gray-200 text-center">
                        {code}
                      </code>
                    ))}
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-yellow-800">
                    ⚠️ Each backup code can only be used once. Store them securely - we won't show them again!
                  </p>
                </div>

                <button
                  onClick={() => {
                    // Copy all codes to clipboard
                    navigator.clipboard.writeText(twoFactorBackupCodes.join('\n'))
                    toast.success('Backup codes copied to clipboard!')
                  }}
                  className="w-full px-4 py-2 mb-3 border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition"
                >
                  📋 Copy All Codes
                </button>

                <button
                  onClick={handleClose2FAModal}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                >
                  Done
                </button>
              </>
            )}

            {/* Disable Step - Verify with code */}
            {twoFactorStep === 'disable' && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Disable Two-Factor Authentication</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Enter a code from your authenticator app or use a backup code to disable 2FA.
                </p>

                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-red-800">
                    ⚠️ Disabling 2FA will reduce your account security.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      value={twoFactorVerificationCode}
                      onChange={(e) => setTwoFactorVerificationCode(e.target.value.toUpperCase())}
                      placeholder="000000 or BACKUP-CODE"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-center text-lg font-mono tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleClose2FAModal}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleVerify2FA}
                      disabled={loading || !twoFactorVerificationCode}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50"
                    >
                      {loading ? 'Disabling...' : 'Disable 2FA'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// Privacy Settings
function PrivacySettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  const t = useTranslations('settings')
  return (
    <>
      <SettingSection
        title={t('privacyVisibility')}
        description={t('controlWhoCanSee')}
      >
        <SelectSetting
          label={t('profileVisibility')}
          description={t('whoCanViewProfile')}
          value={settings.profileVisibility || 'EVERYONE'}
          options={[
            { value: 'EVERYONE', label: t('everyone') },
            { value: 'CONNECTIONS_ONLY', label: t('connectionsOnly') },
            { value: 'PRIVATE', label: t('privateOnlyMe') },
          ]}
          onChange={(value) => updateSetting('profileVisibility', value)}
        />
        <SelectSetting
          label={t('whoCanSeePosts')}
          description={t('controlPostVisibility')}
          value={settings.postPrivacy || 'PUBLIC'}
          options={[
            { value: 'PUBLIC', label: t('publicEveryoneCanSee') },
            { value: 'PARTNERS_ONLY', label: t('partnersOnly') },
          ]}
          onChange={(value) => updateSetting('postPrivacy', value)}
        />
        <ToggleSetting
          label={t('appearInSearch')}
          description={t('allowOthersToFind')}
          checked={settings.searchVisibility ?? true}
          onChange={(value) => updateSetting('searchVisibility', value)}
        />
        <ToggleSetting
          label={t('showOnlineStatus')}
          description={t('letOthersSeeOnline')}
          checked={settings.showOnlineStatus ?? true}
          onChange={(value) => updateSetting('showOnlineStatus', value)}
        />
        <ToggleSetting
          label={t('showLastSeen')}
          description={t('displayLastActive')}
          checked={settings.showLastSeen ?? true}
          onChange={(value) => updateSetting('showLastSeen', value)}
        />
        <SelectSetting
          label={t('whoCanSeeLocation')}
          description={t('controlLocationVisibility')}
          value={settings.locationVisibility || 'match-only'}
          options={[
            { value: 'public', label: t('publicShownOnProfile') },
            { value: 'match-only', label: t('matchOnlyRecommended') },
            { value: 'private', label: t('privateHidden') },
          ]}
          onChange={(value) => updateSetting('locationVisibility', value)}
        />
        <SelectSetting
          label={t('dataSharing')}
          description={t('howMuchInfoToShare')}
          value={settings.dataSharing || 'STANDARD'}
          options={[
            { value: 'MINIMAL', label: t('minimalBasicInfoOnly') },
            { value: 'STANDARD', label: t('standardRecommended') },
            { value: 'FULL', label: t('fullBestMatching') },
          ]}
          onChange={(value) => updateSetting('dataSharing', value)}
        />
      </SettingSection>
    </>
  )
}

// Notifications Settings
function NotificationsSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  const t = useTranslations('settings')
  const { permission, isSupported, requestPermission, isGranted } = useNotificationPermission()
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  // Load app-level notification preference on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const preference = localStorage.getItem('notifications_enabled')
      setNotificationsEnabled(preference !== 'false')
    }
  }, [])

  const handleRequestPermission = async () => {
    const granted = await requestPermission()
    if (granted) {
      localStorage.setItem('notifications_enabled', 'true')
      setNotificationsEnabled(true)
      toast.success(t('browserNotifications') + ' ' + t('enabled') + '!')
    } else {
      toast.error(t('browserNotifications') + ' ' + t('permissionDenied'))
    }
  }

  const handleToggleNotifications = (enabled: boolean) => {
    if (enabled && !isGranted) {
      // If trying to enable but no browser permission, request it
      handleRequestPermission()
    } else {
      // Toggle app-level preference
      localStorage.setItem('notifications_enabled', enabled ? 'true' : 'false')
      setNotificationsEnabled(enabled)
      toast.success(enabled ? t('notifications') + ' ' + t('enabled') : t('notifications') + ' ' + t('disabled'))
    }
  }

  return (
    <>
      <SettingSection
        title={t('browserNotifications')}
        description={t('getNotificationsWhenClosed')}
      >
        {!isSupported ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              {t('browserNotificationsNotSupported')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Main Toggle */}
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-900 cursor-pointer">
                  {t('enableBrowserNotifications')}
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  {t('receivePushNotifications')}
                </p>
              </div>
              <button
                onClick={() => handleToggleNotifications(!notificationsEnabled)}
                disabled={permission === 'denied'}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  notificationsEnabled && isGranted ? 'bg-blue-600' : 'bg-gray-300'
                } ${permission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    notificationsEnabled && isGranted ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Status Info */}
            <div className="p-4 border border-gray-300 rounded-lg bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1 text-sm">{t('notificationStatus')}</h4>
                  <p className="text-xs text-gray-600 mb-3">
                    {t('bothSettingsMustBeEnabled')}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-medium text-gray-700" title={t('browser')}>{t('browser')}:</span>
                    {permission === 'granted' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                        <span>✓</span> {t('allowed')}
                      </span>
                    ) : permission === 'denied' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                        <span>✗</span> {t('blocked')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                        <span>?</span> {t('notSet')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-medium text-gray-700" title={t('appSetting')}>{t('appSetting')}:</span>
                    {notificationsEnabled && isGranted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                        <span>✓</span> {t('enabled')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                        <span>○</span> {t('disabled')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {permission === 'denied' && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-800">
                    {t('blockedNotificationsMessage')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </SettingSection>

      <SettingSection
        title={t('inAppNotifications')}
        description={t('chooseNotifications')}
      >
        <ToggleSetting
          label={t('connectionRequests')}
          description={t('newStudyPartnerRequests')}
          checked={settings.notifyConnectionRequests ?? true}
          onChange={(value) => updateSetting('notifyConnectionRequests', value)}
        />
        <ToggleSetting
          label={t('connectionAccepted')}
          description={t('whenSomeoneAccepts')}
          checked={settings.notifyConnectionAccepted ?? true}
          onChange={(value) => updateSetting('notifyConnectionAccepted', value)}
        />
        <ToggleSetting
          label={t('studySessionInvites')}
          description={t('invitationsToJoinSessions')}
          checked={settings.notifySessionInvites ?? true}
          onChange={(value) => updateSetting('notifySessionInvites', value)}
        />
        <ToggleSetting
          label={t('groupInvites')}
          description={t('invitationsToJoinGroups')}
          checked={settings.notifyGroupInvites ?? true}
          onChange={(value) => updateSetting('notifyGroupInvites', value)}
        />
        <ToggleSetting
          label={t('messages')}
          description={t('newMessagesFromPartners')}
          checked={settings.notifyMessages ?? true}
          onChange={(value) => updateSetting('notifyMessages', value)}
        />
        <ToggleSetting
          label={t('missedCalls')}
          description={t('whenYouMissCall')}
          checked={settings.notifyMissedCalls ?? true}
          onChange={(value) => updateSetting('notifyMissedCalls', value)}
        />
        <ToggleSetting
          label={t('communityActivity')}
          description={t('likesCommentsMentions')}
          checked={settings.notifyCommunityActivity ?? true}
          onChange={(value) => updateSetting('notifyCommunityActivity', value)}
        />
        <ToggleSetting
          label={t('studyReminders')}
          description={t('remindersForScheduled')}
          checked={settings.notifySessionReminders ?? true}
          onChange={(value) => updateSetting('notifySessionReminders', value)}
        />
      </SettingSection>

      <SettingSection title={t('emailNotifications')} description={t('receiveNotificationsViaEmail')}>
        <ToggleSetting
          label={t('connectionRequests')}
          checked={settings.emailConnectionRequests ?? true}
          onChange={(value) => updateSetting('emailConnectionRequests', value)}
        />
        <ToggleSetting
          label={t('studySessionInvites')}
          checked={settings.emailSessionInvites ?? true}
          onChange={(value) => updateSetting('emailSessionInvites', value)}
        />
        <ToggleSetting
          label={t('messages')}
          checked={settings.emailMessages ?? false}
          onChange={(value) => updateSetting('emailMessages', value)}
        />
        <ToggleSetting
          label={t('weeklySummary')}
          description={t('weeklyLearningProgress')}
          checked={settings.emailWeeklySummary ?? true}
          onChange={(value) => updateSetting('emailWeeklySummary', value)}
        />
      </SettingSection>

      <SettingSection title={t('notificationPreferences')}>
        <SelectSetting
          label={t('notificationFrequency')}
          description={t('howOftenReceiveNotifications')}
          value={settings.notificationFrequency || 'REALTIME'}
          options={[
            { value: 'REALTIME', label: t('realtimeInstant') },
            { value: 'DIGEST_DAILY', label: t('dailyDigest') },
            { value: 'DIGEST_WEEKLY', label: t('weeklyDigest') },
            { value: 'OFF', label: t('offNoNotifications') },
          ]}
          onChange={(value) => updateSetting('notificationFrequency', value)}
        />
      </SettingSection>

      <SettingSection title={t('doNotDisturb')} description={t('scheduleQuietHours')}>
        <ToggleSetting
          label={t('enableDoNotDisturb')}
          checked={settings.doNotDisturbEnabled ?? false}
          onChange={(value) => updateSetting('doNotDisturbEnabled', value)}
        />
        {settings.doNotDisturbEnabled && (
          <>
            <div className="py-3 border-b border-gray-100">
              <label className="block text-sm font-medium text-gray-900 mb-1">{t('startTime')}</label>
              <input
                type="time"
                value={settings.doNotDisturbStart || '22:00'}
                onChange={(e) => updateSetting('doNotDisturbStart', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="py-3">
              <label className="block text-sm font-medium text-gray-900 mb-1">{t('endTime')}</label>
              <input
                type="time"
                value={settings.doNotDisturbEnd || '08:00'}
                onChange={(e) => updateSetting('doNotDisturbEnd', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </>
        )}
      </SettingSection>
    </>
  )
}

// Communication Settings
function CommunicationSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  const t = useTranslations('settings')
  return (
    <>
      <SettingSection title={t('messaging')} description={t('configureHowMessagesWork')}>
        <ToggleSetting
          label={t('readReceipts')}
          description={t('letOthersKnowRead')}
          checked={settings.messageReadReceipts ?? true}
          onChange={(value) => updateSetting('messageReadReceipts', value)}
        />
        <ToggleSetting
          label={t('typingIndicators')}
          description={t('showWhenTyping')}
          checked={settings.typingIndicators ?? true}
          onChange={(value) => updateSetting('typingIndicators', value)}
        />
        <ToggleSetting
          label={t('autoDownloadMedia')}
          description={t('automaticallyDownloadFiles')}
          checked={settings.autoDownloadMedia ?? true}
          onChange={(value) => updateSetting('autoDownloadMedia', value)}
        />
      </SettingSection>

      <SettingSection title={t('videoAudioCalls')} description={t('configureCallQuality')}>
        <SelectSetting
          label={t('videoQuality')}
          description={t('defaultVideoCallQuality')}
          value={settings.videoQuality || 'AUTO'}
          options={[
            { value: 'AUTO', label: t('autoRecommended') },
            { value: 'LOW', label: t('lowDataSaver') },
            { value: 'MEDIUM', label: t('medium') },
            { value: 'HIGH', label: t('highBestQuality') },
          ]}
          onChange={(value) => updateSetting('videoQuality', value)}
        />
        <SelectSetting
          label={t('audioQuality')}
          description={t('defaultAudioQuality')}
          value={settings.audioQuality || 'AUTO'}
          options={[
            { value: 'AUTO', label: t('autoRecommended') },
            { value: 'LOW', label: t('low') },
            { value: 'MEDIUM', label: t('medium') },
            { value: 'HIGH', label: t('high') },
          ]}
          onChange={(value) => updateSetting('audioQuality', value)}
        />
        <ToggleSetting
          label={t('virtualBackground')}
          description={t('enableVirtualBackground')}
          checked={settings.enableVirtualBackground ?? false}
          onChange={(value) => updateSetting('enableVirtualBackground', value)}
        />
        <ToggleSetting
          label={t('autoAnswerFromPartners')}
          description={t('automaticallyAnswerCalls')}
          checked={settings.autoAnswerFromPartners ?? false}
          onChange={(value) => updateSetting('autoAnswerFromPartners', value)}
        />
      </SettingSection>
    </>
  )
}

// Groups Settings
function GroupsSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  const t = useTranslations('settings')
  return (
    <>
      <SettingSection title={t('groupSettings')} description={t('manageGroupPreferences')}>
        <SelectSetting
          label={t('defaultGroupPrivacy')}
          description={t('privacySettingWhenCreating')}
          value={settings.defaultGroupPrivacy || 'PUBLIC'}
          options={[
            { value: 'PUBLIC', label: t('publicAnyoneCanJoin') },
            { value: 'PRIVATE', label: t('privateApprovalRequired') },
            { value: 'INVITE_ONLY', label: t('inviteOnlyMustBeInvited') },
          ]}
          onChange={(value) => updateSetting('defaultGroupPrivacy', value)}
        />
        <ToggleSetting
          label={t('groupNotifications')}
          description={t('receiveNotificationsForActivity')}
          checked={settings.groupNotifications ?? true}
          onChange={(value) => updateSetting('groupNotifications', value)}
        />
        <ToggleSetting
          label={t('autoJoinMatchingGroups')}
          description={t('automaticallyJoinMatching')}
          checked={settings.autoJoinMatchingGroups ?? false}
          onChange={(value) => updateSetting('autoJoinMatchingGroups', value)}
        />
        <SelectSetting
          label={t('whoCanInviteToGroups')}
          description={t('controlWhoCanInvite')}
          value={settings.groupInvitePrivacy || 'EVERYONE'}
          options={[
            { value: 'EVERYONE', label: t('everyone') },
            { value: 'CONNECTIONS', label: t('connectionsOnly') },
            { value: 'NOBODY', label: t('nobody') },
          ]}
          onChange={(value) => updateSetting('groupInvitePrivacy', value)}
        />
      </SettingSection>
    </>
  )
}

// Community Settings
function CommunitySettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  const t = useTranslations('settings')
  return (
    <>
      <SettingSection title={t('feedPreferences')} description={t('customizeCommunityFeed')}>
        <SelectSetting
          label={t('feedAlgorithm')}
          description={t('howPostsAreSorted')}
          value={settings.feedAlgorithm || 'RECOMMENDED'}
          options={[
            { value: 'RECOMMENDED', label: t('recommendedPersonalized') },
            { value: 'CHRONOLOGICAL', label: t('chronologicalLatestFirst') },
            { value: 'TRENDING', label: t('trendingPopularPosts') },
          ]}
          onChange={(value) => updateSetting('feedAlgorithm', value)}
        />
        <ToggleSetting
          label={t('showTrendingTopics')}
          description={t('displayTrendingHashtags')}
          checked={settings.showTrendingTopics ?? true}
          onChange={(value) => updateSetting('showTrendingTopics', value)}
        />
      </SettingSection>

      <SettingSection title={t('interactionPrivacy')} description={t('controlWhoCanInteract')}>
        <SelectSetting
          label={t('whoCanComment')}
          description={t('whoCanCommentOnPosts')}
          value={settings.commentPrivacy || 'EVERYONE'}
          options={[
            { value: 'EVERYONE', label: t('everyone') },
            { value: 'CONNECTIONS', label: t('connectionsOnly') },
            { value: 'NOBODY', label: t('nobodyCommentsDisabled') },
          ]}
          onChange={(value) => updateSetting('commentPrivacy', value)}
        />
        <SelectSetting
          label={t('whoCanTagYou')}
          description={t('whoCanMentionTag')}
          value={settings.tagPrivacy || 'EVERYONE'}
          options={[
            { value: 'EVERYONE', label: t('everyone') },
            { value: 'CONNECTIONS', label: t('connectionsOnly') },
            { value: 'NOBODY', label: t('nobody') },
          ]}
          onChange={(value) => updateSetting('tagPrivacy', value)}
        />
      </SettingSection>
    </>
  )
}

// Accessibility Settings
function AccessibilitySettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  const t = useTranslations('settings')
  const { effectiveTheme } = useTheme()
  const currentTheme = settings.theme || 'SYSTEM'
  
  const themeOptions = [
    {
      value: 'LIGHT' as const,
      label: t('light'),
      icon: Sun,
      gradient: 'from-yellow-400 via-orange-300 to-amber-200',
      bgGradient: 'from-white via-blue-50/30 to-indigo-50/20',
      previewBg: 'bg-white',
      previewText: 'text-gray-900',
      previewBorder: 'border-gray-200',
      description: 'Bright and clean interface'
    },
    {
      value: 'DARK' as const,
      label: t('dark'),
      icon: Moon,
      gradient: 'from-indigo-600 via-purple-600 to-blue-800',
      bgGradient: 'from-gray-900 via-slate-900 to-zinc-900',
      previewBg: 'bg-gray-900',
      previewText: 'text-gray-100',
      previewBorder: 'border-gray-700',
      description: 'Easy on the eyes'
    },
    {
      value: 'SYSTEM' as const,
      label: t('systemDefault'),
      icon: Monitor,
      gradient: 'from-gray-400 via-slate-500 to-gray-600',
      bgGradient: 'from-gray-100 via-slate-100 to-gray-200',
      previewBg: effectiveTheme === 'dark' ? 'bg-gray-900' : 'bg-white',
      previewText: effectiveTheme === 'dark' ? 'text-gray-100' : 'text-gray-900',
      previewBorder: effectiveTheme === 'dark' ? 'border-gray-700' : 'border-gray-200',
      description: 'Follows system preference'
    }
  ]

  return (
    <>
      <SettingSection title={t('display')} description={t('customizeHowAppLooks')}>
        {/* Beautiful Theme Selector */}
        <div className="mb-6">
          <label className={`block text-sm font-semibold mb-2 transition-colors duration-300 ${
            effectiveTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
          }`}>{t('theme')}</label>
          <p className={`text-xs mb-4 leading-relaxed transition-colors duration-300 ${
            effectiveTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>{t('chooseColorScheme')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const isSelected = currentTheme === option.value
              return (
                <motion.button
                  key={option.value}
                  onClick={() => updateSetting('theme', option.value)}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative p-5 rounded-2xl border-2 transition-all duration-300 overflow-hidden group ${
                    isSelected
                      ? 'border-blue-500 shadow-lg shadow-blue-500/20 bg-gradient-to-br ' + option.bgGradient
                      : effectiveTheme === 'dark'
                      ? 'border-gray-700 hover:border-gray-600 bg-gray-800/50 hover:bg-gray-800'
                      : 'border-gray-200 hover:border-gray-300 bg-white/50 hover:bg-white'
                  }`}
                >
                  {/* Background gradient effect */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${option.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${isSelected ? 'opacity-20' : ''}`} />
                  
                  {/* Selection indicator */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-3 right-3 w-6 h-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg"
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  )}

                  {/* Icon */}
                  <div className={`relative mb-4 flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${
                    isSelected 
                      ? 'bg-gradient-to-br ' + option.gradient + ' shadow-lg' 
                      : effectiveTheme === 'dark'
                      ? 'bg-gray-800 group-hover:bg-gray-700'
                      : 'bg-gray-100 group-hover:bg-gray-200'
                  }`}>
                    <Icon className={`w-6 h-6 transition-colors duration-300 ${
                      isSelected 
                        ? 'text-white' 
                        : effectiveTheme === 'dark'
                        ? 'text-gray-400'
                        : 'text-gray-600'
                    }`} />
                  </div>

                  {/* Label */}
                  <div className="relative mb-2">
                    <h3 className={`font-semibold text-base transition-colors duration-300 ${
                      isSelected 
                        ? effectiveTheme === 'dark' ? 'text-white' : 'text-gray-900'
                        : effectiveTheme === 'dark' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      {option.label}
                    </h3>
                    <p className={`text-xs mt-1 transition-colors duration-300 ${
                      isSelected 
                        ? effectiveTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        : effectiveTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {option.description}
                    </p>
                  </div>

                  {/* Preview - Mini UI Mockup */}
                  <div className={`relative mt-4 p-3 rounded-lg border transition-all duration-300 ${
                    option.value === 'LIGHT' 
                      ? 'bg-white border-gray-200' 
                      : option.value === 'DARK'
                      ? 'bg-gray-900 border-gray-700'
                      : effectiveTheme === 'dark'
                      ? 'bg-gray-900 border-gray-700'
                      : 'bg-white border-gray-200'
                  }`}>
                    {/* Window chrome */}
                    <div className="flex items-center gap-1.5 mb-3">
                      <div className={`w-2 h-2 rounded-full ${
                        option.value === 'LIGHT' ? 'bg-red-400' : 
                        option.value === 'DARK' ? 'bg-red-500' : 
                        effectiveTheme === 'dark' ? 'bg-red-500' : 'bg-red-400'
                      }`} />
                      <div className={`w-2 h-2 rounded-full ${
                        option.value === 'LIGHT' ? 'bg-yellow-400' : 
                        option.value === 'DARK' ? 'bg-yellow-500' : 
                        effectiveTheme === 'dark' ? 'bg-yellow-500' : 'bg-yellow-400'
                      }`} />
                      <div className={`w-2 h-2 rounded-full ${
                        option.value === 'LIGHT' ? 'bg-green-400' : 
                        option.value === 'DARK' ? 'bg-green-500' : 
                        effectiveTheme === 'dark' ? 'bg-green-500' : 'bg-green-400'
                      }`} />
                      <div className={`flex-1 h-2 rounded ${
                        option.value === 'LIGHT' ? 'bg-gray-100' : 
                        option.value === 'DARK' ? 'bg-gray-800' : 
                        effectiveTheme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                      }`} />
                    </div>
                    
                    {/* Content preview */}
                    <div className={`space-y-2 ${
                      option.value === 'LIGHT' ? 'text-gray-900' : 
                      option.value === 'DARK' ? 'text-gray-100' : 
                      effectiveTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {/* Header bar */}
                      <div className={`h-2 rounded ${
                        option.value === 'LIGHT' ? 'bg-blue-100' : 
                        option.value === 'DARK' ? 'bg-blue-900/50' : 
                        effectiveTheme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100'
                      }`} style={{ width: '100%' }} />
                      
                      {/* Content lines */}
                      <div className={`h-1.5 rounded ${
                        option.value === 'LIGHT' ? 'bg-gray-200' : 
                        option.value === 'DARK' ? 'bg-gray-700' : 
                        effectiveTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      }`} style={{ width: '85%' }} />
                      <div className={`h-1.5 rounded ${
                        option.value === 'LIGHT' ? 'bg-gray-200' : 
                        option.value === 'DARK' ? 'bg-gray-700' : 
                        effectiveTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      }`} style={{ width: '70%' }} />
                      
                      {/* Button preview */}
                      <div className={`mt-2 h-2.5 rounded ${
                        option.value === 'LIGHT' 
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500' 
                          : option.value === 'DARK'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600'
                          : effectiveTheme === 'dark'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600'
                          : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                      }`} style={{ width: '50%' }} />
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
        <SelectSetting
          label={t('fontSize')}
          description={t('adjustTextSize')}
          value={settings.fontSize || 'MEDIUM'}
          options={[
            { value: 'SMALL', label: t('small') },
            { value: 'MEDIUM', label: t('mediumDefault') },
            { value: 'LARGE', label: t('large') },
            { value: 'XLARGE', label: t('extraLarge') },
          ]}
          onChange={(value) => updateSetting('fontSize', value)}
        />
        <ToggleSetting
          label={t('highContrast')}
          description={t('increaseContrast')}
          checked={settings.highContrast ?? false}
          onChange={(value) => updateSetting('highContrast', value)}
        />
        <ToggleSetting
          label={t('reducedMotion')}
          description={t('minimizeAnimations')}
          checked={settings.reducedMotion ?? false}
          onChange={(value) => updateSetting('reducedMotion', value)}
        />
      </SettingSection>

      <SettingSection title={t('interaction')} description={t('howYouNavigate')}>
        <ToggleSetting
          label={t('keyboardShortcuts')}
          description={t('enableKeyboardShortcuts')}
          checked={settings.keyboardShortcuts ?? true}
          onChange={(value) => updateSetting('keyboardShortcuts', value)}
        />
        <SelectSetting
          label={t('colorBlindMode')}
          description={t('adjustColorsForDeficiency')}
          value={settings.colorBlindMode || 'NONE'}
          options={[
            { value: 'NONE', label: t('none') },
            { value: 'PROTANOPIA', label: t('protanopiaRedBlind') },
            { value: 'DEUTERANOPIA', label: t('deuteranopiaGreenBlind') },
            { value: 'TRITANOPIA', label: t('tritanopiaBlueBlind') },
          ]}
          onChange={(value) => updateSetting('colorBlindMode', value)}
        />
      </SettingSection>
    </>
  )
}

// Data Settings
function DataSettings({
  settings,
  updateSetting,
  handleClearCache,
  handleExportData,
  handleDeleteAccount
}: {
  settings: UserSettings
  updateSetting: any
  handleClearCache: () => void
  handleExportData: () => void
  handleDeleteAccount: () => void
}) {
  const t = useTranslations('settings')
  return (
    <>
      <SettingSection title={t('storage')} description={t('manageAppData')}>
        <ToggleSetting
          label={t('enableCache')}
          description={t('storeDataLocally')}
          checked={settings.cacheEnabled ?? true}
          onChange={(value) => updateSetting('cacheEnabled', value)}
        />
        <ToggleSetting
          label={t('autoBackup')}
          description={t('automaticallyBackupData')}
          checked={settings.autoBackup ?? true}
          onChange={(value) => updateSetting('autoBackup', value)}
        />
        <NumberSetting
          label={t('storageLimit')}
          description={t('maximumStorageForCache')}
          value={settings.storageUsageLimit || 1000}
          min={100}
          max={10000}
          suffix={t('MB')}
          onChange={(value) => updateSetting('storageUsageLimit', value)}
        />
      </SettingSection>

      <SettingSection title={t('dataManagement')}>
        <div className="space-y-3">
          <button
            onClick={handleClearCache}
            className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <div className="font-medium text-gray-900">{t('clearCache')}</div>
            <div className="text-sm text-gray-500">{t('freeUpSpace')}</div>
          </button>
          <button
            onClick={handleExportData}
            className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <div className="font-medium text-gray-900">{t('exportData')}</div>
            <div className="text-sm text-gray-500">{t('downloadDataAsJson')}</div>
          </button>
          <button
            onClick={handleDeleteAccount}
            className="w-full px-4 py-3 text-left border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
          >
            <div className="font-medium">{t('deleteAccount')}</div>
            <div className="text-sm opacity-75">{t('permanentlyDeleteAccount')}</div>
          </button>
        </div>
      </SettingSection>
    </>
  )
}

// Integrations Settings
function IntegrationsSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  const t = useTranslations('settings')
  return (
    <>
      <SettingSection
        title={t('calendarIntegration')}
        description={t('syncWithExternalCalendars')}
      >
        <ToggleSetting
          label={t('googleCalendarSync')}
          description={t('syncToGoogleCalendar')}
          checked={settings.googleCalendarSync ?? false}
          onChange={(value) => updateSetting('googleCalendarSync', value)}
        />
        {settings.googleCalendarSync && (
          <div className="py-3">
            <label className="block text-sm font-medium text-gray-900 mb-1">{t('calendarId')}</label>
            <input
              type="text"
              value={settings.googleCalendarId || ''}
              onChange={(e) => updateSetting('googleCalendarId', e.target.value)}
              placeholder="your-calendar@gmail.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">{t('enterCalendarId')}</p>
          </div>
        )}
      </SettingSection>

      <SettingSection title={t('connectedAccounts')}>
        <div className="space-y-3">
          <div className="p-4 border border-gray-300 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">🔗</span>
              </div>
              <div>
                <div className="font-medium text-gray-900">{t('googleAccount')}</div>
                <div className="text-sm text-gray-500">{t('connected')}</div>
              </div>
            </div>
            <button className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition">
              {t('disconnect')}
            </button>
          </div>
        </div>
      </SettingSection>
    </>
  )
}

// Advanced Settings
function AdvancedSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  const t = useTranslations('settings')
  return (
    <>
      <SettingSection title={t('advanced')} description={t('powerUserSettings')}>
        <ToggleSetting
          label={t('developerMode')}
          description={t('enableDeveloperTools')}
          checked={settings.developerMode ?? false}
          onChange={(value) => updateSetting('developerMode', value)}
        />
        <ToggleSetting
          label={t('betaFeatures')}
          description={t('tryNewFeatures')}
          checked={settings.betaFeatures ?? false}
          onChange={(value) => updateSetting('betaFeatures', value)}
        />
        <SelectSetting
          label={t('performanceMode')}
          description={t('optimizeAppPerformance')}
          value={settings.performanceMode || 'BALANCED'}
          options={[
            { value: 'LOW_POWER', label: t('lowPowerBatterySaver') },
            { value: 'BALANCED', label: t('balancedRecommended') },
            { value: 'PERFORMANCE', label: t('performanceBestExperience') },
          ]}
          onChange={(value) => updateSetting('performanceMode', value)}
        />
        <ToggleSetting
          label={t('analytics')}
          description={t('helpImproveClerva')}
          checked={settings.analyticsEnabled ?? true}
          onChange={(value) => updateSetting('analyticsEnabled', value)}
        />
      </SettingSection>
    </>
  )
}

// History Section
function HistorySection() {
  const t = useTranslations('settings')
  const [activeSubTab, setActiveSubTab] = useState<string>('study')
  const [loading, setLoading] = useState(false)

  const subTabs = [
    { id: 'study', label: t('studyActivity'), icon: '📚' },
    { id: 'connections', label: t('connections'), icon: '🤝' },
    { id: 'groups', label: t('groups'), icon: '👥' },
    { id: 'calls', label: t('calls'), icon: '📞' },
    { id: 'achievements', label: t('achievements'), icon: '🏆' },
    { id: 'account', label: t('accountActivity'), icon: '👤' },
    { id: 'blocked', label: t('blockedUsers'), icon: '🚫' },
    { id: 'deleted-messages', label: t('deletedMessages'), icon: '💬' },
    { id: 'deleted-groups', label: t('deletedGroups'), icon: '🗑️' },
    { id: 'deleted-posts', label: t('deletedPosts'), icon: '📝' },
    { id: 'notifications', label: t('notificationsHistory'), icon: '🔔' },
    { id: 'community', label: t('communityActivityHistory'), icon: '🌐' },
  ]

  return (
    <>
      <SettingSection
        title={t('history')}
        description={t('viewActivityHistory')}
      >
        {/* Sub-tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex flex-wrap gap-2">
            {subTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
                  activeSubTab === tab.id
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content based on active sub-tab */}
        <div className="mt-6">
          {activeSubTab === 'study' && <StudyActivityHistory />}
          {activeSubTab === 'connections' && <ConnectionsHistory />}
          {activeSubTab === 'groups' && <GroupsHistory />}
          {activeSubTab === 'calls' && <CallsHistory />}
          {activeSubTab === 'achievements' && <AchievementsHistory />}
          {activeSubTab === 'account' && <AccountActivityHistory />}
          {activeSubTab === 'blocked' && <BlockedUsersHistory />}
          {activeSubTab === 'deleted-messages' && <DeletedMessagesHistory />}
          {activeSubTab === 'deleted-groups' && <DeletedGroupsHistory />}
          {activeSubTab === 'deleted-posts' && <DeletedPostsHistory />}
          {activeSubTab === 'notifications' && <NotificationsHistory />}
          {activeSubTab === 'community' && <CommunityActivityHistory />}
        </div>
      </SettingSection>
    </>
  )
}

// Individual History Components
function StudyActivityHistory() {
  const t = useTranslations('settings')
  const [sessions, setSessions] = useState<any[]>([])
  const [statistics, setStatistics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/history/study-activity')
        if (response.ok) {
          const data = await response.json()
          setSessions(data.sessions || [])
          setStatistics(data.statistics || {})
        }
      } catch (error) {
        console.error('Error fetching study activity:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-4">
      {statistics && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{statistics.totalSessions}</div>
            <div className="text-sm text-gray-600">{t('totalSessions')}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{statistics.totalHours}h</div>
            <div className="text-sm text-gray-600">{t('totalHours')}</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{statistics.sessionsThisMonth}</div>
            <div className="text-sm text-gray-600">{t('thisMonth')}</div>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {sessions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">{t('noStudySessionsFound')}</p>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold">{session.title}</h4>
                <span className="text-sm text-gray-500">
                  {new Date(session.endedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-sm text-gray-600 mb-2">
                {session.durationMinutes} {t('minutes')} • {session.type}
              </div>
              {session.subject && (
                <div className="text-sm text-gray-500">{t('subject')}: {session.subject}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ConnectionsHistory() {
  const t = useTranslations('settings')
  const [matches, setMatches] = useState<any[]>([])
  const [statistics, setStatistics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/history/connections')
        if (response.ok) {
          const data = await response.json()
          setMatches(data.matches || [])
          setStatistics(data.statistics || {})
        }
      } catch (error) {
        console.error('Error fetching connections:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-4">
      {statistics && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="font-semibold mb-2">{t('sent')}</div>
            <div className="text-sm">{t('total')}: {statistics.sent.total}</div>
            <div className="text-sm">{t('accepted')}: {statistics.sent.accepted}</div>
            <div className="text-sm">{t('pending')}: {statistics.sent.pending}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="font-semibold mb-2">{t('received')}</div>
            <div className="text-sm">{t('total')}: {statistics.received.total}</div>
            <div className="text-sm">{t('accepted')}: {statistics.received.accepted}</div>
            <div className="text-sm">{t('pending')}: {statistics.received.pending}</div>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {matches.length === 0 ? (
          <p className="text-gray-500 text-center py-8">{t('noConnectionsFound')}</p>
        ) : (
          matches.map((match) => (
            <div key={match.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold">
                    {match.isSender ? match.receiver.name : match.sender.name}
                  </div>
                  <div className="text-sm text-gray-500">{t('status')}: {match.status}</div>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(match.createdAt).toLocaleDateString()}
                </span>
              </div>
              {match.compatibilityScore && (
                <div className="text-sm text-gray-600">
                  {t('compatibility')}: {match.compatibilityScore}%
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function GroupsHistory() {
  const t = useTranslations('settings')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/history/groups')
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Error fetching groups:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-6">
      {data?.joinedGroups && data.joinedGroups.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">{t('joinedGroups')}</h3>
          <div className="space-y-2">
            {data.joinedGroups.map((gm: any) => (
              <div key={gm.id} className="border border-gray-200 rounded-lg p-3">
                <div className="font-medium">{gm.group.name}</div>
                <div className="text-sm text-gray-500">
                  {t('joined')}: {new Date(gm.joinedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {data?.createdGroups && data.createdGroups.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">{t('createdGroups')}</h3>
          <div className="space-y-2">
            {data.createdGroups.map((group: any) => (
              <div key={group.id} className="border border-gray-200 rounded-lg p-3">
                <div className="font-medium">{group.name}</div>
                <div className="text-sm text-gray-500">
                  {t('created')}: {new Date(group.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(!data?.joinedGroups?.length && !data?.createdGroups?.length) && (
        <p className="text-gray-500 text-center py-8">{t('noGroupsFound')}</p>
      )}
    </div>
  )
}

function CallsHistory() {
  const t = useTranslations('settings')
  const [calls, setCalls] = useState<any[]>([])
  const [statistics, setStatistics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/history/calls')
        if (response.ok) {
          const data = await response.json()
          setCalls(data.calls || [])
          setStatistics(data.statistics || {})
        }
      } catch (error) {
        console.error('Error fetching calls:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-4">
      {statistics && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{statistics.totalCalls}</div>
            <div className="text-sm text-gray-600">{t('totalCalls')}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{statistics.completedCalls}</div>
            <div className="text-sm text-gray-600">{t('completed')}</div>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{statistics.missedCalls}</div>
            <div className="text-sm text-gray-600">{t('missedCalls')}</div>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {calls.length === 0 ? (
          <p className="text-gray-500 text-center py-8">{t('noCallsFound')}</p>
        ) : (
          calls.map((call) => (
            <div key={call.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold">
                    {call.callType} Call - {call.callStatus}
                  </div>
                  {call.callDuration && (
                    <div className="text-sm text-gray-600">
                      Duration: {Math.floor(call.callDuration / 60)}m {call.callDuration % 60}s
                    </div>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(call.callStartedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function AchievementsHistory() {
  const t = useTranslations('settings')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/history/achievements')
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Error fetching achievements:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-6">
      {data?.milestones && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{data.milestones.studyStreak}</div>
            <div className="text-sm text-gray-600">{t('dayStreak')}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{data.milestones.totalStudyHours}h</div>
            <div className="text-sm text-gray-600">{t('totalHours')}</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{data.badges.length}</div>
            <div className="text-sm text-gray-600">{t('badgesEarned')}</div>
          </div>
        </div>
      )}
      <div>
        <h3 className="font-semibold mb-3">{t('badges')}</h3>
        <div className="grid grid-cols-2 gap-3">
          {data?.badges?.map((badge: any) => (
            <div key={badge.id} className="border border-gray-200 rounded-lg p-3">
              <div className="font-medium">{badge.badge.name}</div>
              <div className="text-sm text-gray-500">{badge.badge.description}</div>
              <div className="text-xs text-gray-400 mt-1">
                {t('earned')}: {new Date(badge.earnedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AccountActivityHistory() {
  const t = useTranslations('settings')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/history/account-activity')
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Error fetching account activity:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-4">
      {data?.account && (
        <div className="space-y-3">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="font-semibold mb-2">Account Information</div>
            <div className="text-sm text-gray-600">Email: {data.account.email}</div>
            <div className="text-sm text-gray-600">Role: {data.account.role}</div>
            <div className="text-sm text-gray-600">
              Created: {new Date(data.account.createdAt).toLocaleDateString()}
            </div>
          </div>
          {data.activity && (
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="font-semibold mb-2">Activity</div>
              {data.activity.lastLogin && (
                <div className="text-sm text-gray-600">
                  Last Login: {new Date(data.activity.lastLogin).toLocaleString()}
                </div>
              )}
              {data.activity.lastProfileUpdate && (
                <div className="text-sm text-gray-600">
                  Last Profile Update: {new Date(data.activity.lastProfileUpdate).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BlockedUsersHistory() {
  const t = useTranslations('settings')
  const [blockedUsers, setBlockedUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/history/blocked-users')
        if (response.ok) {
          const data = await response.json()
          setBlockedUsers(data.blockedUsers || [])
        }
      } catch (error) {
        console.error('Error fetching blocked users:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-3">
      {blockedUsers.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No blocked users.</p>
      ) : (
        blockedUsers.map((bu) => (
          <div key={bu.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold">{bu.user.name}</div>
                {bu.reason && <div className="text-sm text-gray-500">{bu.reason}</div>}
              </div>
              <span className="text-sm text-gray-500">
                {new Date(bu.blockedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function DeletedMessagesHistory() {
  const t = useTranslations('settings')
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/history/deleted-messages')
        if (response.ok) {
          const data = await response.json()
          setConversations(data.conversations || [])
        }
      } catch (error) {
        console.error('Error fetching deleted messages:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleRestore = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/restore`, {
        method: 'POST',
      })
      if (response.ok) {
        toast.success(t('messageRestored'))
        // Refresh list
        const fetchData = async () => {
          const res = await fetch('/api/history/deleted-messages')
          if (res.ok) {
            const data = await res.json()
            setConversations(data.conversations || [])
          }
        }
        fetchData()
      } else {
        toast.error(t('failedToRestoreMessage'))
      }
    } catch (error) {
      console.error('Error restoring message:', error)
      toast.error(t('failedToRestoreMessage'))
    }
  }

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-4">
      {conversations.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No deleted messages.</p>
      ) : (
        conversations.map((conv) => (
          <div key={conv.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold">{conv.name}</div>
                <div className="text-sm text-gray-600">
                  {conv.type === 'group' ? 'Group' : 'DM'} • {conv.messageCount} messages
                </div>
              </div>
              <span className="text-xs text-red-600 font-medium">
                {conv.daysRemaining} days remaining
              </span>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => conv.messages[0] && handleRestore(conv.messages[0].id)}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Restore
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function DeletedGroupsHistory() {
  const t = useTranslations('settings')
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/history/deleted-groups')
        if (response.ok) {
          const data = await response.json()
          setGroups(data.groups || [])
        }
      } catch (error) {
        console.error('Error fetching deleted groups:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleRestore = async (groupId: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/restore`, {
        method: 'POST',
      })
      if (response.ok) {
        toast.success(t('groupRestored'))
        // Refresh list
        const fetchData = async () => {
          const res = await fetch('/api/history/deleted-groups')
          if (res.ok) {
            const data = await res.json()
            setGroups(data.groups || [])
          }
        }
        fetchData()
      } else {
        toast.error(t('failedToRestoreGroup'))
      }
    } catch (error) {
      console.error('Error restoring group:', error)
      toast.error(t('failedToRestoreGroup'))
    }
  }

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No deleted groups.</p>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold">{group.name}</div>
                <div className="text-sm text-gray-600">{group.subject}</div>
              </div>
              <span className="text-xs text-red-600 font-medium">
                {group.daysRemaining} days remaining
              </span>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleRestore(group.id)}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Restore
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function DeletedPostsHistory() {
  const t = useTranslations('settings')
  const [deletedPosts, setDeletedPosts] = useState<DeletedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeletedPosts, setShowDeletedPosts] = useState(true)

  useEffect(() => {
    const fetchDeletedPosts = async () => {
      try {
        const response = await fetch('/api/posts/deleted')
        if (response.ok) {
          const data = await response.json()
          setDeletedPosts(data.posts || [])
        }
      } catch (error) {
        console.error('Error fetching deleted posts:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchDeletedPosts()
  }, [])

  const handleRestorePost = async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}/restore`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        setDeletedPosts(prev => prev.filter(post => post.id !== postId))
        toast.success(data.message || 'Post restored successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to restore post')
      }
    } catch (error) {
      console.error('Error restoring post:', error)
      toast.error(t('postRestoreFailed'))
    }
  }

  const handlePermanentlyDeletePost = async (postId: string) => {
    if (!confirm(t('confirmPermanentDelete'))) {
      return
    }

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setDeletedPosts(prev => prev.filter(post => post.id !== postId))
        toast.success(t('postPermanentlyDeleted'))
      } else {
        const error = await response.json()
        toast.error(error.error || t('failedToDeletePost'))
      }
    } catch (error) {
      console.error('Error permanently deleting post:', error)
      toast.error(t('failedToDeletePost'))
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-sm text-gray-500">{t('loadingDeletedPosts')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowDeletedPosts(!showDeletedPosts)}
        className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center justify-between"
      >
        <div>
          <div className="font-medium text-gray-900">
            {showDeletedPosts ? t('hide') : t('show')} {t('deletedPosts')}
          </div>
          <div className="text-sm text-gray-500">
            {deletedPosts.length} {deletedPosts.length !== 1 ? t('deletedPostsPlural') : t('deletedPost')} {t('inHistory')}
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${showDeletedPosts ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDeletedPosts && (
        <div className="space-y-4 mt-4">
          {deletedPosts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('noDeletedPostsInHistory')}</p>
          ) : (
            deletedPosts.map((post) => (
              <div key={post.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                {/* Deleted Post Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                        {t('deleted')}
                      </span>
                      <span className="text-xs text-red-600 font-medium">
                        {post.daysRemaining} {post.daysRemaining !== 1 ? t('daysRemainingToRestorePlural') : t('daysRemainingToRestore')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {t('deletedOn')} {new Date(post.deletedAt).toLocaleDateString()} {t('at')} {new Date(post.deletedAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestorePost(post.id)}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition font-medium"
                      title={t('restorePost')}
                    >
                      {t('restore')}
                    </button>
                    <button
                      onClick={() => handlePermanentlyDeletePost(post.id)}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition font-medium"
                      title={t('permanentlyDelete')}
                    >
                      {t('deleteForever')}
                    </button>
                  </div>
                </div>

                {/* Post Content */}
                <div className="mb-3 opacity-75">
                  <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
                </div>

                {/* Post Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>❤️ {post._count?.likes || 0} likes</span>
                  <span>💬 {post._count?.comments || 0} comments</span>
                  <span>🔁 {post._count?.reposts || 0} reposts</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function NotificationsHistory() {
  const t = useTranslations('settings')
  const [notifications, setNotifications] = useState<any[]>([])
  const [statistics, setStatistics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/history/notifications')
        if (response.ok) {
          const data = await response.json()
          setNotifications(data.notifications || [])
          setStatistics(data.statistics || {})
        }
      } catch (error) {
        console.error('Error fetching notifications:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-4">
      {statistics && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{statistics.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{statistics.read}</div>
            <div className="text-sm text-gray-600">Read</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{statistics.unread}</div>
            <div className="text-sm text-gray-600">Unread</div>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No notifications found.</p>
        ) : (
          notifications.map((notif) => (
            <div key={notif.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold">{notif.title}</div>
                  <div className="text-sm text-gray-600">{notif.message}</div>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(notif.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function CommunityActivityHistory() {
  const t = useTranslations('settings')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/history/community-activity')
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Error fetching community activity:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-4">
      {data?.statistics && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{data.statistics.totalPosts}</div>
            <div className="text-sm text-gray-600">{t('posts')}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{data.statistics.totalComments}</div>
            <div className="text-sm text-gray-600">{t('comments')}</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{data.statistics.totalLikesGiven}</div>
            <div className="text-sm text-gray-600">{t('likesGiven')}</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{data.statistics.totalLikesReceived}</div>
            <div className="text-sm text-gray-600">{t('likesReceived')}</div>
          </div>
        </div>
      )}
      {data?.recentPosts && data.recentPosts.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">{t('recentPosts')}</h3>
          <div className="space-y-2">
            {data.recentPosts.map((post: any) => (
              <div key={post.id} className="border border-gray-200 rounded-lg p-3">
                <div className="text-sm">{post.content.substring(0, 100)}...</div>
                <div className="text-xs text-gray-500 mt-1">
                  {post._count.likes} {t('likes')} • {post._count.comments} {t('comments')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// About Section
function AboutSection() {
  const t = useTranslations('settings')
  return (
    <>
      <SettingSection title={t('aboutClerva')} description={t('learnMoreAboutApp')}>
        <div className="space-y-4">
          <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Clerva</h3>
            <p className="text-gray-600 mb-4">{t('socialLearningPlatform')}</p>
            <p className="text-sm text-gray-500">{t('version')}</p>
          </div>

          <div className="space-y-3">
            <button className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              <div className="font-medium text-gray-900">{t('termsOfService')}</div>
              <div className="text-sm text-gray-500">{t('readTermsAndConditions')}</div>
            </button>
            <button className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              <div className="font-medium text-gray-900">{t('privacyPolicy')}</div>
              <div className="text-sm text-gray-500">{t('howWeHandleData')}</div>
            </button>
            <button className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              <div className="font-medium text-gray-900">{t('contactSupport')}</div>
              <div className="text-sm text-gray-500">{t('getHelpWithClerva')}</div>
            </button>
            <button className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              <div className="font-medium text-gray-900">{t('reportBug')}</div>
              <div className="text-sm text-gray-500">{t('helpUsImprove')}</div>
            </button>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-center text-sm text-gray-500">
              {t('allRightsReserved')}
              <br />
              {t('madeWithLove')}
            </p>
          </div>
        </div>
      </SettingSection>
    </>
  )
}

