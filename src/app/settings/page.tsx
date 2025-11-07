'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useTheme } from '@/contexts/ThemeContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useTranslations } from 'next-intl'

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
  timezone?: string
  // Privacy & Visibility
  profileVisibility?: 'EVERYONE' | 'CONNECTIONS_ONLY' | 'PRIVATE'
  searchVisibility?: boolean
  showOnlineStatus?: boolean
  showLastSeen?: boolean
  dataSharing?: 'MINIMAL' | 'STANDARD' | 'FULL'
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
  // Study Preferences
  defaultStudyDuration?: number
  defaultBreakDuration?: number
  preferredSessionLength?: number
  autoGenerateQuizzes?: boolean
  flashcardReviewFrequency?: 'DAILY' | 'WEEKLY' | 'CUSTOM'
  // Communication Settings
  messageReadReceipts?: boolean
  typingIndicators?: boolean
  autoDownloadMedia?: boolean
  videoQuality?: 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH'
  audioQuality?: 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH'
  enableVirtualBackground?: boolean
  autoAnswerFromPartners?: boolean
  callRingtone?: string
  // Study Session Settings
  autoStartTimer?: boolean
  breakReminders?: boolean
  sessionHistoryRetention?: number
  sessionInvitePrivacy?: 'EVERYONE' | 'CONNECTIONS' | 'NOBODY'
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
  | 'study'
  | 'communication'
  | 'sessions'
  | 'groups'
  | 'community'
  | 'accessibility'
  | 'data'
  | 'integrations'
  | 'advanced'
  | 'about'

export default function SettingsPage() {
  const { user, loading } = useAuth()
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

  // Post History state
  const [deletedPosts, setDeletedPosts] = useState<DeletedPost[]>([])
  const [showDeletedPosts, setShowDeletedPosts] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  // Sync with global settings from context
  useEffect(() => {
    setSettings(globalSettings)
    setInitialSettings(globalSettings)
  }, [globalSettings])

  // Fetch deleted posts for Post History
  useEffect(() => {
    const fetchDeletedPosts = async () => {
      if (!user || activeTab !== 'data') return

      setLoadingPosts(true)
      try {
        const response = await fetch('/api/posts/deleted')
        if (response.ok) {
          const data = await response.json()
          setDeletedPosts(data.posts || [])
        }
      } catch (error) {
        console.error('Error fetching deleted posts:', error)
      } finally {
        setLoadingPosts(false)
      }
    }

    fetchDeletedPosts()
  }, [user, activeTab])

  // Handle restore post
  const handleRestorePost = async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}/restore`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        setDeletedPosts(prev => prev.filter(post => post.id !== postId))
        toast.success(data.message || t('postRestored'))
      } else {
        const error = await response.json()
        toast.error(error.error || t('postRestoreFailed'))
      }
    } catch (error) {
      console.error('Error restoring post:', error)
      toast.error(t('postRestoreFailed'))
    }
  }

  // Handle permanently delete post
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
        toast.error(error.error || t('postDeleteFailed'))
      }
    } catch (error) {
      console.error('Error permanently deleting post:', error)
      toast.error(t('postDeleteFailed'))
    }
  }

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
      'Are you absolutely sure you want to delete your account?\n\n' +
      'This will permanently delete:\n' +
      '- Your profile and all personal data\n' +
      '- All your posts and comments\n' +
      '- All your connections\n' +
      '- All your messages\n' +
      '- All your study sessions\n\n' +
      'This action CANNOT be undone!\n\n' +
      'Type DELETE (in capital letters) to confirm:'
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
        ...settingsToSave
      } = settings as any

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

        // Update local state
        setSettings(data.settings)
        setInitialSettings(data.settings)
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
            toast.error(`Validation error: ${firstError.path?.join('.')} - ${firstError.message}`)
          } else {
            toast.error(error.message || 'Invalid data format')
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

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'account', label: t('account'), icon: '👤' },
    { id: 'privacy', label: t('privacy'), icon: '🔒' },
    { id: 'notifications', label: t('notifications'), icon: '🔔' },
    { id: 'study', label: t('study'), icon: '📚' },
    { id: 'communication', label: t('communication'), icon: '💬' },
    { id: 'sessions', label: t('sessions'), icon: '⏱️' },
    { id: 'groups', label: t('groups'), icon: '👥' },
    { id: 'community', label: t('community'), icon: '🌐' },
    { id: 'accessibility', label: t('accessibility'), icon: '♿' },
    { id: 'data', label: t('data'), icon: '💾' },
    { id: 'integrations', label: t('integrations'), icon: '🔗' },
    { id: 'advanced', label: t('advanced'), icon: '⚙️' },
    { id: 'about', label: t('about'), icon: 'ℹ️' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          </div>
          {hasChanges && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                disabled={saving}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {tCommon('loading')}
                  </>
                ) : (
                  tCommon('save')
                )}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8 max-w-7xl mx-auto">
          {/* Sidebar Navigation */}
          <aside className="w-64 flex-shrink-0">
            <nav className="bg-white rounded-xl shadow-sm p-2 sticky top-24">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            <div className="bg-white rounded-xl shadow-sm p-8">
              {/* Render active tab content */}
              {activeTab === 'account' && (
                <AccountSettings settings={settings} updateSetting={updateSetting} />
              )}
              {activeTab === 'privacy' && (
                <PrivacySettings settings={settings} updateSetting={updateSetting} />
              )}
              {activeTab === 'notifications' && (
                <NotificationsSettings settings={settings} updateSetting={updateSetting} />
              )}
              {activeTab === 'study' && (
                <StudySettings settings={settings} updateSetting={updateSetting} />
              )}
              {activeTab === 'communication' && (
                <CommunicationSettings settings={settings} updateSetting={updateSetting} />
              )}
              {activeTab === 'sessions' && (
                <SessionsSettings settings={settings} updateSetting={updateSetting} />
              )}
              {activeTab === 'groups' && (
                <GroupsSettings settings={settings} updateSetting={updateSetting} />
              )}
              {activeTab === 'community' && (
                <CommunitySettings settings={settings} updateSetting={updateSetting} />
              )}
              {activeTab === 'accessibility' && (
                <AccessibilitySettings settings={settings} updateSetting={updateSetting} />
              )}
              {activeTab === 'data' && (
                <DataSettings
                  settings={settings}
                  updateSetting={updateSetting}
                  deletedPosts={deletedPosts}
                  showDeletedPosts={showDeletedPosts}
                  setShowDeletedPosts={setShowDeletedPosts}
                  loadingPosts={loadingPosts}
                  handleRestorePost={handleRestorePost}
                  handlePermanentlyDeletePost={handlePermanentlyDeletePost}
                  handleClearCache={handleClearCache}
                  handleExportData={handleExportData}
                  handleDeleteAccount={handleDeleteAccount}
                />
              )}
              {activeTab === 'integrations' && (
                <IntegrationsSettings settings={settings} updateSetting={updateSetting} />
              )}
              {activeTab === 'advanced' && (
                <AdvancedSettings settings={settings} updateSetting={updateSetting} />
              )}
              {activeTab === 'about' && <AboutSection />}
            </div>
          </main>
        </div>
      </div>

      {/* Floating Save Button for Mobile */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 md:hidden">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// ==========================================
// SETTINGS SECTION COMPONENTS
// ==========================================

// Reusable Components
function SettingSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 last:mb-0">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
      {description && <p className="text-gray-600 text-sm mb-4">{description}</p>}
      <div className="space-y-4">{children}</div>
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
  return (
    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <label className="text-sm font-medium text-gray-900 cursor-pointer">{label}</label>
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
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
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <label className="block text-sm font-medium text-gray-900 mb-1">{label}</label>
      {description && <p className="text-xs text-gray-500 mb-2">{description}</p>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
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
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <label className="block text-sm font-medium text-gray-900 mb-1">{label}</label>
      {description && <p className="text-xs text-gray-500 mb-2">{description}</p>}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(parseInt(e.target.value) || min)}
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {suffix && <span className="text-sm text-gray-600">{suffix}</span>}
      </div>
    </div>
  )
}

// Account Settings
function AccountSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  return (
    <>
      <SettingSection
        title="Account & Profile"
        description="Manage your account preferences and regional settings"
      >
        <SelectSetting
          label="Language"
          description="Choose your preferred language | Elige tu idioma preferido"
          value={settings.language || 'en'}
          options={[
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Español (Spanish)' },
          ]}
          onChange={(value) => updateSetting('language', value)}
        />
        <SelectSetting
          label="Timezone"
          description="Set your local timezone for accurate scheduling"
          value={settings.timezone || 'UTC'}
          options={[
            { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
            { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
            { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
            { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
            { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
            { value: 'Europe/London', label: 'London' },
            { value: 'Europe/Paris', label: 'Paris' },
            { value: 'Asia/Tokyo', label: 'Tokyo' },
            { value: 'Asia/Shanghai', label: 'Shanghai' },
            { value: 'Australia/Sydney', label: 'Sydney' },
          ]}
          onChange={(value) => updateSetting('timezone', value)}
        />
      </SettingSection>
    </>
  )
}

// Privacy Settings
function PrivacySettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  return (
    <>
      <SettingSection
        title="Privacy & Visibility"
        description="Control who can see your information and how you appear to others"
      >
        <SelectSetting
          label="Profile Visibility"
          description="Who can view your profile"
          value={settings.profileVisibility || 'EVERYONE'}
          options={[
            { value: 'EVERYONE', label: 'Everyone' },
            { value: 'CONNECTIONS_ONLY', label: 'Connections Only' },
            { value: 'PRIVATE', label: 'Private (Only Me)' },
          ]}
          onChange={(value) => updateSetting('profileVisibility', value)}
        />
        <ToggleSetting
          label="Appear in Search Results"
          description="Allow others to find you when searching for study partners"
          checked={settings.searchVisibility ?? true}
          onChange={(value) => updateSetting('searchVisibility', value)}
        />
        <ToggleSetting
          label="Show Online Status"
          description="Let others see when you're online"
          checked={settings.showOnlineStatus ?? true}
          onChange={(value) => updateSetting('showOnlineStatus', value)}
        />
        <ToggleSetting
          label="Show Last Seen"
          description="Display your last active time"
          checked={settings.showLastSeen ?? true}
          onChange={(value) => updateSetting('showLastSeen', value)}
        />
        <SelectSetting
          label="Data Sharing"
          description="How much information to share for better matching"
          value={settings.dataSharing || 'STANDARD'}
          options={[
            { value: 'MINIMAL', label: 'Minimal - Basic info only' },
            { value: 'STANDARD', label: 'Standard - Recommended' },
            { value: 'FULL', label: 'Full - Best matching experience' },
          ]}
          onChange={(value) => updateSetting('dataSharing', value)}
        />
      </SettingSection>
    </>
  )
}

// Notifications Settings
function NotificationsSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  return (
    <>
      <SettingSection
        title="In-App Notifications"
        description="Choose what notifications you'd like to receive in the app"
      >
        <ToggleSetting
          label="Connection Requests"
          description="New study partner requests"
          checked={settings.notifyConnectionRequests ?? true}
          onChange={(value) => updateSetting('notifyConnectionRequests', value)}
        />
        <ToggleSetting
          label="Connection Accepted"
          description="When someone accepts your request"
          checked={settings.notifyConnectionAccepted ?? true}
          onChange={(value) => updateSetting('notifyConnectionAccepted', value)}
        />
        <ToggleSetting
          label="Study Session Invites"
          description="Invitations to join study sessions"
          checked={settings.notifySessionInvites ?? true}
          onChange={(value) => updateSetting('notifySessionInvites', value)}
        />
        <ToggleSetting
          label="Group Invites"
          description="Invitations to join study groups"
          checked={settings.notifyGroupInvites ?? true}
          onChange={(value) => updateSetting('notifyGroupInvites', value)}
        />
        <ToggleSetting
          label="Messages"
          description="New messages from partners and groups"
          checked={settings.notifyMessages ?? true}
          onChange={(value) => updateSetting('notifyMessages', value)}
        />
        <ToggleSetting
          label="Missed Calls"
          description="When you miss a voice or video call"
          checked={settings.notifyMissedCalls ?? true}
          onChange={(value) => updateSetting('notifyMissedCalls', value)}
        />
        <ToggleSetting
          label="Community Activity"
          description="Likes, comments, and mentions on your posts"
          checked={settings.notifyCommunityActivity ?? true}
          onChange={(value) => updateSetting('notifyCommunityActivity', value)}
        />
        <ToggleSetting
          label="Study Reminders"
          description="Reminders for scheduled study sessions"
          checked={settings.notifySessionReminders ?? true}
          onChange={(value) => updateSetting('notifySessionReminders', value)}
        />
      </SettingSection>

      <SettingSection title="Email Notifications" description="Receive notifications via email">
        <ToggleSetting
          label="Connection Requests"
          checked={settings.emailConnectionRequests ?? true}
          onChange={(value) => updateSetting('emailConnectionRequests', value)}
        />
        <ToggleSetting
          label="Study Session Invites"
          checked={settings.emailSessionInvites ?? true}
          onChange={(value) => updateSetting('emailSessionInvites', value)}
        />
        <ToggleSetting
          label="Messages"
          checked={settings.emailMessages ?? false}
          onChange={(value) => updateSetting('emailMessages', value)}
        />
        <ToggleSetting
          label="Weekly Summary"
          description="Your weekly learning progress report"
          checked={settings.emailWeeklySummary ?? true}
          onChange={(value) => updateSetting('emailWeeklySummary', value)}
        />
      </SettingSection>

      <SettingSection title="Notification Preferences">
        <SelectSetting
          label="Notification Frequency"
          description="How often you receive notifications"
          value={settings.notificationFrequency || 'REALTIME'}
          options={[
            { value: 'REALTIME', label: 'Real-time (Instant)' },
            { value: 'DIGEST_DAILY', label: 'Daily Digest' },
            { value: 'DIGEST_WEEKLY', label: 'Weekly Digest' },
            { value: 'OFF', label: 'Off (No notifications)' },
          ]}
          onChange={(value) => updateSetting('notificationFrequency', value)}
        />
      </SettingSection>

      <SettingSection title="Do Not Disturb" description="Schedule quiet hours when notifications are muted">
        <ToggleSetting
          label="Enable Do Not Disturb"
          checked={settings.doNotDisturbEnabled ?? false}
          onChange={(value) => updateSetting('doNotDisturbEnabled', value)}
        />
        {settings.doNotDisturbEnabled && (
          <>
            <div className="py-3 border-b border-gray-100">
              <label className="block text-sm font-medium text-gray-900 mb-1">Start Time</label>
              <input
                type="time"
                value={settings.doNotDisturbStart || '22:00'}
                onChange={(e) => updateSetting('doNotDisturbStart', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="py-3">
              <label className="block text-sm font-medium text-gray-900 mb-1">End Time</label>
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

// Study Settings
function StudySettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  return (
    <>
      <SettingSection
        title="Study Preferences"
        description="Customize your default study session settings"
      >
        <NumberSetting
          label="Default Study Duration"
          description="Pomodoro work duration"
          value={settings.defaultStudyDuration || 25}
          min={5}
          max={120}
          suffix="minutes"
          onChange={(value) => updateSetting('defaultStudyDuration', value)}
        />
        <NumberSetting
          label="Default Break Duration"
          description="Pomodoro break duration"
          value={settings.defaultBreakDuration || 5}
          min={1}
          max={60}
          suffix="minutes"
          onChange={(value) => updateSetting('defaultBreakDuration', value)}
        />
        <NumberSetting
          label="Preferred Session Length"
          description="How long you typically study"
          value={settings.preferredSessionLength || 60}
          min={15}
          max={480}
          suffix="minutes"
          onChange={(value) => updateSetting('preferredSessionLength', value)}
        />
        <ToggleSetting
          label="Auto-Generate Quizzes"
          description="Automatically create quizzes from study materials"
          checked={settings.autoGenerateQuizzes ?? false}
          onChange={(value) => updateSetting('autoGenerateQuizzes', value)}
        />
        <SelectSetting
          label="Flashcard Review Frequency"
          description="How often to review flashcards"
          value={settings.flashcardReviewFrequency || 'DAILY'}
          options={[
            { value: 'DAILY', label: 'Daily' },
            { value: 'WEEKLY', label: 'Weekly' },
            { value: 'CUSTOM', label: 'Custom' },
          ]}
          onChange={(value) => updateSetting('flashcardReviewFrequency', value)}
        />
      </SettingSection>
    </>
  )
}

// Communication Settings
function CommunicationSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  return (
    <>
      <SettingSection title="Messaging" description="Configure how messages work">
        <ToggleSetting
          label="Read Receipts"
          description="Let others know when you've read their messages"
          checked={settings.messageReadReceipts ?? true}
          onChange={(value) => updateSetting('messageReadReceipts', value)}
        />
        <ToggleSetting
          label="Typing Indicators"
          description="Show when you're typing a message"
          checked={settings.typingIndicators ?? true}
          onChange={(value) => updateSetting('typingIndicators', value)}
        />
        <ToggleSetting
          label="Auto-Download Media"
          description="Automatically download images and files"
          checked={settings.autoDownloadMedia ?? true}
          onChange={(value) => updateSetting('autoDownloadMedia', value)}
        />
      </SettingSection>

      <SettingSection title="Video & Audio Calls" description="Configure call quality and features">
        <SelectSetting
          label="Video Quality"
          description="Default video call quality"
          value={settings.videoQuality || 'AUTO'}
          options={[
            { value: 'AUTO', label: 'Auto (Recommended)' },
            { value: 'LOW', label: 'Low (Data Saver)' },
            { value: 'MEDIUM', label: 'Medium' },
            { value: 'HIGH', label: 'High (Best Quality)' },
          ]}
          onChange={(value) => updateSetting('videoQuality', value)}
        />
        <SelectSetting
          label="Audio Quality"
          description="Default audio quality"
          value={settings.audioQuality || 'AUTO'}
          options={[
            { value: 'AUTO', label: 'Auto (Recommended)' },
            { value: 'LOW', label: 'Low' },
            { value: 'MEDIUM', label: 'Medium' },
            { value: 'HIGH', label: 'High' },
          ]}
          onChange={(value) => updateSetting('audioQuality', value)}
        />
        <ToggleSetting
          label="Virtual Background"
          description="Enable virtual background for video calls"
          checked={settings.enableVirtualBackground ?? false}
          onChange={(value) => updateSetting('enableVirtualBackground', value)}
        />
        <ToggleSetting
          label="Auto-Answer from Partners"
          description="Automatically answer calls from accepted partners"
          checked={settings.autoAnswerFromPartners ?? false}
          onChange={(value) => updateSetting('autoAnswerFromPartners', value)}
        />
      </SettingSection>
    </>
  )
}

// Sessions Settings
function SessionsSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  return (
    <>
      <SettingSection
        title="Study Session Settings"
        description="Configure how study sessions work for you"
      >
        <ToggleSetting
          label="Auto-Start Timer"
          description="Automatically start timer when joining a session"
          checked={settings.autoStartTimer ?? false}
          onChange={(value) => updateSetting('autoStartTimer', value)}
        />
        <ToggleSetting
          label="Break Reminders"
          description="Get reminded to take breaks during study sessions"
          checked={settings.breakReminders ?? true}
          onChange={(value) => updateSetting('breakReminders', value)}
        />
        <NumberSetting
          label="Session History Retention"
          description="How long to keep session history"
          value={settings.sessionHistoryRetention || 90}
          min={1}
          max={365}
          suffix="days"
          onChange={(value) => updateSetting('sessionHistoryRetention', value)}
        />
        <SelectSetting
          label="Who Can Invite You"
          description="Control who can send you session invites"
          value={settings.sessionInvitePrivacy || 'EVERYONE'}
          options={[
            { value: 'EVERYONE', label: 'Everyone' },
            { value: 'CONNECTIONS', label: 'Connections Only' },
            { value: 'NOBODY', label: 'Nobody' },
          ]}
          onChange={(value) => updateSetting('sessionInvitePrivacy', value)}
        />
      </SettingSection>
    </>
  )
}

// Groups Settings
function GroupsSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  return (
    <>
      <SettingSection title="Group Settings" description="Manage study group preferences">
        <SelectSetting
          label="Default Group Privacy"
          description="Privacy setting when creating new groups"
          value={settings.defaultGroupPrivacy || 'PUBLIC'}
          options={[
            { value: 'PUBLIC', label: 'Public - Anyone can join' },
            { value: 'PRIVATE', label: 'Private - Approval required' },
            { value: 'INVITE_ONLY', label: 'Invite Only - Must be invited' },
          ]}
          onChange={(value) => updateSetting('defaultGroupPrivacy', value)}
        />
        <ToggleSetting
          label="Group Notifications"
          description="Receive notifications for group activity"
          checked={settings.groupNotifications ?? true}
          onChange={(value) => updateSetting('groupNotifications', value)}
        />
        <ToggleSetting
          label="Auto-Join Matching Groups"
          description="Automatically join groups that match your interests"
          checked={settings.autoJoinMatchingGroups ?? false}
          onChange={(value) => updateSetting('autoJoinMatchingGroups', value)}
        />
        <SelectSetting
          label="Who Can Invite You to Groups"
          description="Control who can invite you to groups"
          value={settings.groupInvitePrivacy || 'EVERYONE'}
          options={[
            { value: 'EVERYONE', label: 'Everyone' },
            { value: 'CONNECTIONS', label: 'Connections Only' },
            { value: 'NOBODY', label: 'Nobody' },
          ]}
          onChange={(value) => updateSetting('groupInvitePrivacy', value)}
        />
      </SettingSection>
    </>
  )
}

// Community Settings
function CommunitySettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  return (
    <>
      <SettingSection title="Feed Preferences" description="Customize your community feed">
        <SelectSetting
          label="Feed Algorithm"
          description="How posts are sorted in your feed"
          value={settings.feedAlgorithm || 'RECOMMENDED'}
          options={[
            { value: 'RECOMMENDED', label: 'Recommended (Personalized)' },
            { value: 'CHRONOLOGICAL', label: 'Chronological (Latest First)' },
            { value: 'TRENDING', label: 'Trending (Popular Posts)' },
          ]}
          onChange={(value) => updateSetting('feedAlgorithm', value)}
        />
        <ToggleSetting
          label="Show Trending Topics"
          description="Display trending hashtags and topics"
          checked={settings.showTrendingTopics ?? true}
          onChange={(value) => updateSetting('showTrendingTopics', value)}
        />
      </SettingSection>

      <SettingSection title="Interaction Privacy" description="Control who can interact with your posts">
        <SelectSetting
          label="Who Can Comment"
          description="Who can comment on your posts"
          value={settings.commentPrivacy || 'EVERYONE'}
          options={[
            { value: 'EVERYONE', label: 'Everyone' },
            { value: 'CONNECTIONS', label: 'Connections Only' },
            { value: 'NOBODY', label: 'Nobody (Comments Disabled)' },
          ]}
          onChange={(value) => updateSetting('commentPrivacy', value)}
        />
        <SelectSetting
          label="Who Can Tag You"
          description="Who can mention/tag you in posts"
          value={settings.tagPrivacy || 'EVERYONE'}
          options={[
            { value: 'EVERYONE', label: 'Everyone' },
            { value: 'CONNECTIONS', label: 'Connections Only' },
            { value: 'NOBODY', label: 'Nobody' },
          ]}
          onChange={(value) => updateSetting('tagPrivacy', value)}
        />
      </SettingSection>
    </>
  )
}

// Accessibility Settings
function AccessibilitySettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  return (
    <>
      <SettingSection title="Display" description="Customize how the app looks">
        <SelectSetting
          label="Theme"
          description="Choose your preferred color scheme"
          value={settings.theme || 'SYSTEM'}
          options={[
            { value: 'LIGHT', label: 'Light' },
            { value: 'DARK', label: 'Dark' },
            { value: 'SYSTEM', label: 'System Default' },
          ]}
          onChange={(value) => updateSetting('theme', value)}
        />
        <SelectSetting
          label="Font Size"
          description="Adjust text size for better readability"
          value={settings.fontSize || 'MEDIUM'}
          options={[
            { value: 'SMALL', label: 'Small' },
            { value: 'MEDIUM', label: 'Medium (Default)' },
            { value: 'LARGE', label: 'Large' },
            { value: 'XLARGE', label: 'Extra Large' },
          ]}
          onChange={(value) => updateSetting('fontSize', value)}
        />
        <ToggleSetting
          label="High Contrast"
          description="Increase contrast for better visibility"
          checked={settings.highContrast ?? false}
          onChange={(value) => updateSetting('highContrast', value)}
        />
        <ToggleSetting
          label="Reduced Motion"
          description="Minimize animations and transitions"
          checked={settings.reducedMotion ?? false}
          onChange={(value) => updateSetting('reducedMotion', value)}
        />
      </SettingSection>

      <SettingSection title="Interaction" description="How you navigate the app">
        <ToggleSetting
          label="Keyboard Shortcuts"
          description="Enable keyboard shortcuts for faster navigation"
          checked={settings.keyboardShortcuts ?? true}
          onChange={(value) => updateSetting('keyboardShortcuts', value)}
        />
        <SelectSetting
          label="Color Blind Mode"
          description="Adjust colors for color vision deficiency"
          value={settings.colorBlindMode || 'NONE'}
          options={[
            { value: 'NONE', label: 'None' },
            { value: 'PROTANOPIA', label: 'Protanopia (Red-Blind)' },
            { value: 'DEUTERANOPIA', label: 'Deuteranopia (Green-Blind)' },
            { value: 'TRITANOPIA', label: 'Tritanopia (Blue-Blind)' },
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
  deletedPosts,
  showDeletedPosts,
  setShowDeletedPosts,
  loadingPosts,
  handleRestorePost,
  handlePermanentlyDeletePost,
  handleClearCache,
  handleExportData,
  handleDeleteAccount
}: {
  settings: UserSettings
  updateSetting: any
  deletedPosts: DeletedPost[]
  showDeletedPosts: boolean
  setShowDeletedPosts: (show: boolean) => void
  loadingPosts: boolean
  handleRestorePost: (postId: string) => void
  handlePermanentlyDeletePost: (postId: string) => void
  handleClearCache: () => void
  handleExportData: () => void
  handleDeleteAccount: () => void
}) {
  return (
    <>
      <SettingSection title="Storage" description="Manage app data and cache">
        <ToggleSetting
          label="Enable Cache"
          description="Store data locally for faster loading"
          checked={settings.cacheEnabled ?? true}
          onChange={(value) => updateSetting('cacheEnabled', value)}
        />
        <ToggleSetting
          label="Auto-Backup"
          description="Automatically back up your data"
          checked={settings.autoBackup ?? true}
          onChange={(value) => updateSetting('autoBackup', value)}
        />
        <NumberSetting
          label="Storage Limit"
          description="Maximum storage for cached data"
          value={settings.storageUsageLimit || 1000}
          min={100}
          max={10000}
          suffix="MB"
          onChange={(value) => updateSetting('storageUsageLimit', value)}
        />
      </SettingSection>

      {/* Post History Section */}
      <SettingSection title="Post History" description="Manage deleted posts (restorable for 30 days)">
        <div className="space-y-4">
          <button
            onClick={() => setShowDeletedPosts(!showDeletedPosts)}
            className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center justify-between"
          >
            <div>
              <div className="font-medium text-gray-900">
                {showDeletedPosts ? 'Hide' : 'Show'} Deleted Posts
              </div>
              <div className="text-sm text-gray-500">
                {deletedPosts.length} deleted post{deletedPosts.length !== 1 ? 's' : ''} in history
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
              {loadingPosts ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Loading deleted posts...</p>
                </div>
              ) : deletedPosts.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No deleted posts in history.</p>
              ) : (
                deletedPosts.map((post) => (
                  <div key={post.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                    {/* Deleted Post Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                            DELETED
                          </span>
                          <span className="text-xs text-red-600 font-medium">
                            {post.daysRemaining} day{post.daysRemaining !== 1 ? 's' : ''} remaining to restore
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Deleted on {new Date(post.deletedAt).toLocaleDateString()} at {new Date(post.deletedAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestorePost(post.id)}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition font-medium"
                          title="Restore post"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => handlePermanentlyDeletePost(post.id)}
                          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition font-medium"
                          title="Permanently delete"
                        >
                          Delete Forever
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
      </SettingSection>

      <SettingSection title="Data Management">
        <div className="space-y-3">
          <button
            onClick={handleClearCache}
            className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <div className="font-medium text-gray-900">Clear Cache</div>
            <div className="text-sm text-gray-500">Free up space by clearing cached data</div>
          </button>
          <button
            onClick={handleExportData}
            className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <div className="font-medium text-gray-900">Export Data</div>
            <div className="text-sm text-gray-500">Download your data as JSON (GDPR compliant)</div>
          </button>
          <button
            onClick={handleDeleteAccount}
            className="w-full px-4 py-3 text-left border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
          >
            <div className="font-medium">Delete Account</div>
            <div className="text-sm opacity-75">Permanently delete your account and all data</div>
          </button>
        </div>
      </SettingSection>
    </>
  )
}

// Integrations Settings
function IntegrationsSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  return (
    <>
      <SettingSection
        title="Calendar Integration"
        description="Sync your study sessions with external calendars"
      >
        <ToggleSetting
          label="Google Calendar Sync"
          description="Sync sessions to your Google Calendar"
          checked={settings.googleCalendarSync ?? false}
          onChange={(value) => updateSetting('googleCalendarSync', value)}
        />
        {settings.googleCalendarSync && (
          <div className="py-3">
            <label className="block text-sm font-medium text-gray-900 mb-1">Calendar ID</label>
            <input
              type="text"
              value={settings.googleCalendarId || ''}
              onChange={(e) => updateSetting('googleCalendarId', e.target.value)}
              placeholder="your-calendar@gmail.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Enter your Google Calendar ID to enable sync</p>
          </div>
        )}
      </SettingSection>

      <SettingSection title="Connected Accounts">
        <div className="space-y-3">
          <div className="p-4 border border-gray-300 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">🔗</span>
              </div>
              <div>
                <div className="font-medium text-gray-900">Google Account</div>
                <div className="text-sm text-gray-500">Connected</div>
              </div>
            </div>
            <button className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition">
              Disconnect
            </button>
          </div>
        </div>
      </SettingSection>
    </>
  )
}

// Advanced Settings
function AdvancedSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  return (
    <>
      <SettingSection title="Advanced" description="Power user settings">
        <ToggleSetting
          label="Developer Mode"
          description="Enable developer tools and debug features"
          checked={settings.developerMode ?? false}
          onChange={(value) => updateSetting('developerMode', value)}
        />
        <ToggleSetting
          label="Beta Features"
          description="Try new features before they're released"
          checked={settings.betaFeatures ?? false}
          onChange={(value) => updateSetting('betaFeatures', value)}
        />
        <SelectSetting
          label="Performance Mode"
          description="Optimize app performance"
          value={settings.performanceMode || 'BALANCED'}
          options={[
            { value: 'LOW_POWER', label: 'Low Power (Battery Saver)' },
            { value: 'BALANCED', label: 'Balanced (Recommended)' },
            { value: 'PERFORMANCE', label: 'Performance (Best Experience)' },
          ]}
          onChange={(value) => updateSetting('performanceMode', value)}
        />
        <ToggleSetting
          label="Analytics"
          description="Help improve Clerva by sharing anonymous usage data"
          checked={settings.analyticsEnabled ?? true}
          onChange={(value) => updateSetting('analyticsEnabled', value)}
        />
      </SettingSection>
    </>
  )
}

// About Section
function AboutSection() {
  return (
    <>
      <SettingSection title="About Clerva" description="Learn more about the app">
        <div className="space-y-4">
          <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Clerva</h3>
            <p className="text-gray-600 mb-4">Social Learning & Study Partners Platform</p>
            <p className="text-sm text-gray-500">Version 2.0.0</p>
          </div>

          <div className="space-y-3">
            <button className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              <div className="font-medium text-gray-900">Terms of Service</div>
              <div className="text-sm text-gray-500">Read our terms and conditions</div>
            </button>
            <button className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              <div className="font-medium text-gray-900">Privacy Policy</div>
              <div className="text-sm text-gray-500">How we handle your data</div>
            </button>
            <button className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              <div className="font-medium text-gray-900">Contact Support</div>
              <div className="text-sm text-gray-500">Get help with Clerva</div>
            </button>
            <button className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              <div className="font-medium text-gray-900">Report a Bug</div>
              <div className="text-sm text-gray-500">Help us improve the app</div>
            </button>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-center text-sm text-gray-500">
              © 2025 Clerva. All rights reserved.
              <br />
              Made with ❤️ for learners everywhere
            </p>
          </div>
        </div>
      </SettingSection>
    </>
  )
}

