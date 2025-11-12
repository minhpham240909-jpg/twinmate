'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useTheme } from '@/contexts/ThemeContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useTranslations } from 'next-intl'
import { useNotificationPermission } from '@/hooks/useNotificationPermission'

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
    { id: 'history', label: 'History', icon: '📜' },
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
                  handleClearCache={handleClearCache}
                  handleExportData={handleExportData}
                  handleDeleteAccount={handleDeleteAccount}
                />
              )}
              {activeTab === 'history' && <HistorySection />}
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
                {t('saving')}
              </>
            ) : (
              t('save')
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
    <div className="py-3 border-b border-gray-100 last:border-0">
      <label className="block text-sm font-medium text-gray-900 mb-1">{label}</label>
      {description && <p className="text-xs text-gray-500 mb-2">{description}</p>}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value || min}
          min={min}
          max={max}
          onChange={(e) => handleChange(e.target.value)}
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {suffix && <span className="text-sm text-gray-600">{suffix}</span>}
      </div>
    </div>
  )
}

// Account Settings
function AccountSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  const t = useTranslations('settings')
  return (
    <>
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
        <SelectSetting
          label={t('timezone')}
          description={t('setTimezone')}
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

// Study Settings
function StudySettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  const t = useTranslations('settings')
  return (
    <>
      <SettingSection
        title={t('study')}
        description={t('customizeDefaultSettings')}
      >
        <NumberSetting
          label={t('defaultStudyDuration')}
          description={t('pomodoroWorkDuration')}
          value={settings.defaultStudyDuration || 25}
          min={5}
          max={120}
          suffix={t('minutes')}
          onChange={(value) => updateSetting('defaultStudyDuration', value)}
        />
        <NumberSetting
          label={t('defaultBreakDuration')}
          description={t('pomodoroBreakDuration')}
          value={settings.defaultBreakDuration || 5}
          min={1}
          max={60}
          suffix={t('minutes')}
          onChange={(value) => updateSetting('defaultBreakDuration', value)}
        />
        <NumberSetting
          label={t('preferredSessionLength')}
          description={t('howLongYouStudy')}
          value={settings.preferredSessionLength || 60}
          min={15}
          max={480}
          suffix={t('minutes')}
          onChange={(value) => updateSetting('preferredSessionLength', value)}
        />
        <ToggleSetting
          label={t('autoGenerateQuizzes')}
          description={t('automaticallyCreateQuizzes')}
          checked={settings.autoGenerateQuizzes ?? false}
          onChange={(value) => updateSetting('autoGenerateQuizzes', value)}
        />
        <SelectSetting
          label={t('flashcardReviewFrequency')}
          description={t('howOftenReviewFlashcards')}
          value={settings.flashcardReviewFrequency || 'DAILY'}
          options={[
            { value: 'DAILY', label: t('daily') },
            { value: 'WEEKLY', label: t('weekly') },
            { value: 'CUSTOM', label: t('custom') },
          ]}
          onChange={(value) => updateSetting('flashcardReviewFrequency', value)}
        />
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

// Sessions Settings
function SessionsSettings({ settings, updateSetting }: { settings: UserSettings; updateSetting: any }) {
  const t = useTranslations('settings')
  return (
    <>
      <SettingSection
        title={t('studySessionSettings')}
        description={t('configureHowSessionsWork')}
      >
        <ToggleSetting
          label={t('autoStartTimer')}
          description={t('automaticallyStartTimer')}
          checked={settings.autoStartTimer ?? false}
          onChange={(value) => updateSetting('autoStartTimer', value)}
        />
        <ToggleSetting
          label={t('breakReminders')}
          description={t('getRemindedToTakeBreaks')}
          checked={settings.breakReminders ?? true}
          onChange={(value) => updateSetting('breakReminders', value)}
        />
        <NumberSetting
          label={t('sessionHistoryRetention')}
          description={t('howLongKeepHistory')}
          value={settings.sessionHistoryRetention || 90}
          min={1}
          max={365}
          suffix={t('days')}
          onChange={(value) => updateSetting('sessionHistoryRetention', value)}
        />
        <SelectSetting
          label={t('whoCanInviteYou')}
          description={t('controlWhoCanSendInvites')}
          value={settings.sessionInvitePrivacy || 'EVERYONE'}
          options={[
            { value: 'EVERYONE', label: t('everyone') },
            { value: 'CONNECTIONS', label: t('connectionsOnly') },
            { value: 'NOBODY', label: t('nobody') },
          ]}
          onChange={(value) => updateSetting('sessionInvitePrivacy', value)}
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
  return (
    <>
      <SettingSection title={t('display')} description={t('customizeHowAppLooks')}>
        <SelectSetting
          label={t('theme')}
          description={t('chooseColorScheme')}
          value={settings.theme || 'SYSTEM'}
          options={[
            { value: 'LIGHT', label: t('light') },
            { value: 'DARK', label: t('dark') },
            { value: 'SYSTEM', label: t('systemDefault') },
          ]}
          onChange={(value) => updateSetting('theme', value)}
        />
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

