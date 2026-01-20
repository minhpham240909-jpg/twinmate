// API Route: Update User Settings
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import logger from '@/lib/logger'

// Validation schema for settings update
const updateSettingsSchema = z.object({
  // Account & Profile
  language: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),

  // Privacy & Visibility
  profileVisibility: z.enum(['EVERYONE', 'CONNECTIONS_ONLY', 'PRIVATE']).optional(),
  searchVisibility: z.boolean().optional(),
  showOnlineStatus: z.boolean().optional(),
  showLastSeen: z.boolean().optional(),
  dataSharing: z.enum(['MINIMAL', 'STANDARD', 'FULL']).optional(),

  // Notification Preferences
  notifyConnectionRequests: z.boolean().optional(),
  notifyConnectionAccepted: z.boolean().optional(),
  notifySessionInvites: z.boolean().optional(),
  notifyGroupInvites: z.boolean().optional(),
  notifyMessages: z.boolean().optional(),
  notifyMissedCalls: z.boolean().optional(),
  notifyCommunityActivity: z.boolean().optional(),
  notifySessionReminders: z.boolean().optional(),

  // Email Notifications
  emailConnectionRequests: z.boolean().optional(),
  emailSessionInvites: z.boolean().optional(),
  emailMessages: z.boolean().optional(),
  emailWeeklySummary: z.boolean().optional(),

  // Notification Frequency
  notificationFrequency: z.enum(['REALTIME', 'DIGEST_DAILY', 'DIGEST_WEEKLY', 'OFF']).optional(),

  // Do Not Disturb
  doNotDisturbEnabled: z.boolean().optional(),
  doNotDisturbStart: z.string().nullable().optional(),
  doNotDisturbEnd: z.string().nullable().optional(),

  // Study Preferences
  defaultStudyDuration: z.number().min(1).max(120).optional(),
  defaultBreakDuration: z.number().min(1).max(60).optional(),
  preferredSessionLength: z.number().min(15).max(480).optional(),
  autoGenerateQuizzes: z.boolean().optional(),
  flashcardReviewFrequency: z.enum(['DAILY', 'WEEKLY', 'CUSTOM']).nullable().optional(),

  // Communication Settings
  messageReadReceipts: z.boolean().optional(),
  typingIndicators: z.boolean().optional(),
  autoDownloadMedia: z.boolean().optional(),
  videoQuality: z.enum(['AUTO', 'LOW', 'MEDIUM', 'HIGH']).optional(),
  audioQuality: z.enum(['AUTO', 'LOW', 'MEDIUM', 'HIGH']).optional(),
  enableVirtualBackground: z.boolean().optional(),

  // Call Settings
  autoAnswerFromPartners: z.boolean().optional(),
  callRingtone: z.string().nullable().optional(),

  // Study Session Settings
  autoStartTimer: z.boolean().optional(),
  breakReminders: z.boolean().optional(),
  sessionHistoryRetention: z.number().min(1).max(365).optional(),
  sessionInvitePrivacy: z.enum(['EVERYONE', 'CONNECTIONS', 'NOBODY']).optional(),

  // Group Settings
  defaultGroupPrivacy: z.enum(['PUBLIC', 'PRIVATE', 'INVITE_ONLY']).optional(),
  groupNotifications: z.boolean().optional(),
  autoJoinMatchingGroups: z.boolean().optional(),
  groupInvitePrivacy: z.enum(['EVERYONE', 'CONNECTIONS', 'NOBODY']).optional(),

  // Content & Community
  feedAlgorithm: z.enum(['RECOMMENDED', 'CHRONOLOGICAL', 'TRENDING']).optional(),
  showTrendingTopics: z.boolean().optional(),
  commentPrivacy: z.enum(['EVERYONE', 'CONNECTIONS', 'NOBODY']).optional(),
  tagPrivacy: z.enum(['EVERYONE', 'CONNECTIONS', 'NOBODY']).optional(),
  contentFiltering: z.array(z.string()).nullable().optional().transform(val => val ?? []),

  // Accessibility
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  fontSize: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'XLARGE']).optional(),
  highContrast: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  keyboardShortcuts: z.boolean().optional(),
  colorBlindMode: z.enum(['NONE', 'PROTANOPIA', 'DEUTERANOPIA', 'TRITANOPIA']).optional(),

  // Data & Storage
  cacheEnabled: z.boolean().optional(),
  autoBackup: z.boolean().optional(),
  storageUsageLimit: z.number().min(100).max(10000).optional(),

  // Integrations
  googleCalendarSync: z.boolean().optional(),
  googleCalendarId: z.string().nullable().optional(),

  // Advanced
  developerMode: z.boolean().optional(),
  betaFeatures: z.boolean().optional(),
  performanceMode: z.enum(['LOW_POWER', 'BALANCED', 'PERFORMANCE']).optional(),
  analyticsEnabled: z.boolean().optional(),

  // Pro/Silent Mode - Minimal UI experience
  proModeEnabled: z.boolean().optional(), // Hides gamification, streaks, leaderboards
  silentModeEnabled: z.boolean().optional(), // No notifications, badges, celebrations

  // Gamification Layer Controls
  showStreakBadges: z.boolean().optional(), // Show streak fire badges
  showLeaderboards: z.boolean().optional(), // Show course/circle leaderboards
  showXPAnimations: z.boolean().optional(), // Show XP gain animations
  showAchievementPopups: z.boolean().optional(), // Show achievement unlock popups
  showStudyCaptainBadge: z.boolean().optional(), // Show Study Captain crown

  // Weekly Summary Preferences
  weeklyReflectionEnabled: z.boolean().optional(), // Enable end-of-week reflection
  weeklyReflectionDay: z.string().optional(), // Day to send reflection prompt
  weeklyReflectionTime: z.string().optional(), // Time to send (24hr format)
}).strip() // Strip unknown fields instead of rejecting them

export async function POST(request: NextRequest) {
  // SCALABILITY: Rate limit settings updates (moderate - prevent spam saves)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Verify authentication with Supabase
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()

    logger.info('[Settings Update] Received body', { body })

    const validation = updateSettingsSchema.safeParse(body)

    if (!validation.success) {
      logger.error('[Settings Update] Validation failed', { issues: validation.error.issues })
      return NextResponse.json(
        {
          error: 'Invalid data',
          details: validation.error.issues,
          message: 'Settings validation failed. Check console for details.'
        },
        { status: 400 }
      )
    }

    const updates = validation.data

    // First, check if settings exist for this user
    const { data: existingSettings, error: checkError } = await supabase
      .from('UserSettings')
      .select('id')
      .eq('userId', user.id)
      .maybeSingle()

    if (checkError) {
      logger.error('[Settings Update] Error checking existing settings', {
        error: checkError,
        code: checkError.code,
        message: checkError.message,
        details: checkError.details
      })
      return NextResponse.json(
        { error: 'Failed to check settings', details: checkError.message },
        { status: 500 }
      )
    }

    let finalSettings

    if (existingSettings) {
      // Settings exist - update them
      const { data: updatedSettings, error: updateError } = await supabase
        .from('UserSettings')
        .update({
          ...updates,
          updatedAt: new Date().toISOString(),
        })
        .eq('userId', user.id)
        .select('*')
        .single()

      if (updateError) {
        logger.error('[Settings Update] Error updating settings', {
          error: updateError,
          code: updateError.code,
          message: updateError.message,
          details: updateError.details
        })
        return NextResponse.json(
          { error: 'Failed to update settings', details: updateError.message },
          { status: 500 }
        )
      }

      finalSettings = updatedSettings
    } else {
      // Settings don't exist - create them
      const { data: newSettings, error: createError } = await supabase
        .from('UserSettings')
        .insert({
          userId: user.id,
          ...updates,
        })
        .select('*')
        .single()

      if (createError) {
        logger.error('[Settings Update] Error creating settings', {
          error: createError,
          code: createError.code,
          message: createError.message,
          details: createError.details
        })
        return NextResponse.json(
          { error: 'Failed to create settings', details: createError.message },
          { status: 500 }
        )
      }

      finalSettings = newSettings
    }

    return NextResponse.json({
      success: true,
      settings: finalSettings,
      message: existingSettings ? 'Settings updated successfully' : 'Settings created successfully',
    })
  } catch (error) {
    logger.error('[Settings Update] Error', { error: error instanceof Error ? error : String(error) })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

