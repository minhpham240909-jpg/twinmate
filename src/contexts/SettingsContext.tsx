'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from '@/lib/auth/context'

// Check if we're in production (disable verbose logging)
const isProduction = process.env.NODE_ENV === 'production'

// Settings interface matching the database schema
export interface UserSettings {
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
  theme?: 'LIGHT' | 'DARK'
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

interface SettingsContextType {
  settings: UserSettings
  loading: boolean
  refreshSettings: () => Promise<void>
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

// Default settings
const defaultSettings: UserSettings = {
  language: 'en',
  timezone: 'UTC',
  profileVisibility: 'EVERYONE',
  postPrivacy: 'PUBLIC',
  searchVisibility: true,
  showOnlineStatus: true,
  showLastSeen: true,
  dataSharing: 'STANDARD',
  notifyConnectionRequests: true,
  notifyConnectionAccepted: true,
  notifySessionInvites: true,
  notifyGroupInvites: true,
  notifyMessages: true,
  notifyMissedCalls: true,
  notifyCommunityActivity: true,
  notifySessionReminders: true,
  emailConnectionRequests: true,
  emailSessionInvites: true,
  emailMessages: false,
  emailWeeklySummary: true,
  notificationFrequency: 'REALTIME',
  doNotDisturbEnabled: false,
  doNotDisturbStart: null,
  doNotDisturbEnd: null,
  defaultStudyDuration: 25,
  defaultBreakDuration: 5,
  preferredSessionLength: 60,
  autoGenerateQuizzes: false,
  flashcardReviewFrequency: 'DAILY',
  messageReadReceipts: true,
  typingIndicators: true,
  autoDownloadMedia: true,
  videoQuality: 'AUTO',
  audioQuality: 'AUTO',
  enableVirtualBackground: false,
  autoAnswerFromPartners: false,
  callRingtone: 'default',
  autoStartTimer: false,
  breakReminders: true,
  sessionHistoryRetention: 90,
  sessionInvitePrivacy: 'EVERYONE',
  defaultGroupPrivacy: 'PUBLIC',
  groupNotifications: true,
  autoJoinMatchingGroups: false,
  groupInvitePrivacy: 'EVERYONE',
  feedAlgorithm: 'RECOMMENDED',
  showTrendingTopics: true,
  commentPrivacy: 'EVERYONE',
  tagPrivacy: 'EVERYONE',
  contentFiltering: [],
  theme: 'LIGHT',
  fontSize: 'MEDIUM',
  highContrast: false,
  reducedMotion: false,
  keyboardShortcuts: true,
  colorBlindMode: 'NONE',
  cacheEnabled: true,
  autoBackup: true,
  storageUsageLimit: 1000,
  googleCalendarSync: false,
  googleCalendarId: null,
  developerMode: false,
  betaFeatures: false,
  performanceMode: 'BALANCED',
  analyticsEnabled: true,
}

// Sanitize settings data to prevent NaN and invalid values
function sanitizeSettings(rawSettings: Partial<UserSettings>): UserSettings {
  const sanitized: any = { ...defaultSettings }

  // Process each key from rawSettings
  Object.keys(rawSettings).forEach((key) => {
    const value = (rawSettings as any)[key]
    const defaultValue = (defaultSettings as any)[key]

    // Skip undefined values
    if (value === undefined) {
      return
    }

    // Handle numbers - reject NaN and use defaults
    if (typeof defaultValue === 'number') {
      const numValue = Number(value)
      if (!isNaN(numValue) && isFinite(numValue)) {
        sanitized[key] = numValue
      } else {
        sanitized[key] = defaultValue
      }
      return
    }

    // Handle booleans
    if (typeof defaultValue === 'boolean') {
      sanitized[key] = Boolean(value)
      return
    }

    // Handle arrays
    if (Array.isArray(defaultValue)) {
      sanitized[key] = Array.isArray(value) ? value : defaultValue
      return
    }

    // For strings and enums, use the value if valid, otherwise use default
    if (value !== null && value !== '') {
      sanitized[key] = value
    } else {
      sanitized[key] = defaultValue
    }
  })

  return sanitized
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)

  // Fetch user settings
  const refreshSettings = async () => {
    if (!user) {
      setSettings(defaultSettings)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/settings')

      if (response.ok) {
        const data = await response.json()
        // Sanitize settings before setting to prevent corrupted data
        const sanitizedSettings = sanitizeSettings(data.settings || {})
        setSettings(sanitizedSettings)
      } else {
        setSettings(defaultSettings)
      }
    } catch (error) {
      if (!isProduction) {
        console.error('Error fetching settings:', error)
      }
      setSettings(defaultSettings)
    } finally {
      setLoading(false)
    }
  }

  // Update settings
  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!user) return

    // Optimistically update local state with sanitized data
    const sanitizedUpdates = sanitizeSettings({ ...settings, ...updates })
    setSettings(sanitizedUpdates)

    try {
      const response = await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const data = await response.json()
        // Sanitize response before setting to state
        const sanitizedSettings = sanitizeSettings(data.settings || {})
        setSettings(sanitizedSettings)
      } else {
        // Revert on error
        await refreshSettings()
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      // Revert on error
      await refreshSettings()
    }
  }

  // Load settings when user changes
  useEffect(() => {
    if (!authLoading) {
      refreshSettings()
    }
  }, [user, authLoading])

  // Apply accessibility settings to document
  useEffect(() => {
    const root = document.documentElement

    // Apply font size
    const fontSizeMap = {
      SMALL: '14px',
      MEDIUM: '16px',
      LARGE: '18px',
      XLARGE: '20px',
    }
    if (settings.fontSize) {
      root.style.setProperty('--base-font-size', fontSizeMap[settings.fontSize])
      root.style.fontSize = fontSizeMap[settings.fontSize]
    }

    // Apply high contrast
    if (settings.highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }

    // Apply reduced motion
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion')
    } else {
      root.classList.remove('reduced-motion')
    }

    // Apply color blind mode
    if (settings.colorBlindMode && settings.colorBlindMode !== 'NONE') {
      root.classList.remove('protanopia', 'deuteranopia', 'tritanopia')
      root.classList.add(settings.colorBlindMode.toLowerCase())
    } else {
      root.classList.remove('protanopia', 'deuteranopia', 'tritanopia')
    }
  }, [settings.fontSize, settings.highContrast, settings.reducedMotion, settings.colorBlindMode])

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
