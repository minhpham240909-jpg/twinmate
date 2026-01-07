// API Route: Export User Data (GDPR Compliance)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import logger from '@/lib/logger'

// SCALABILITY: Limits to prevent memory spikes for heavy users
const EXPORT_LIMITS = {
  posts: 1000,           // Most recent 1000 posts
  matches: 500,          // Most recent 500 matches
  messages: 5000,        // Most recent 5000 messages (GDPR requires recent data)
  sessions: 500,         // Most recent 500 study sessions
  notifications: 1000,   // Most recent 1000 notifications
} as const

export async function GET(request: NextRequest) {
  // SCALABILITY: Rate limit data export (hourly - very expensive operation with 7 parallel DB queries)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.hourly)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many export requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    logger.info('[Export Data] Exporting data', { userId: user.id })

    // PERFORMANCE FIX: Fetch user data with limits to prevent memory spikes
    // Order by createdAt DESC to get most recent records first
    const [
      { data: profile },
      { data: settings },
      { data: posts, count: totalPosts },
      { data: matches, count: totalMatches },
      { data: messages, count: totalMessages },
      { data: sessions, count: totalSessions },
      { data: notifications, count: totalNotifications },
    ] = await Promise.all([
      supabase.from('Profile').select('*').eq('userId', user.id).single(),
      supabase.from('UserSettings').select('*').eq('userId', user.id).single(),
      supabase
        .from('Post')
        .select('*', { count: 'exact' })
        .eq('userId', user.id)
        .order('createdAt', { ascending: false })
        .limit(EXPORT_LIMITS.posts),
      supabase
        .from('Match')
        .select('*', { count: 'exact' })
        .or(`senderId.eq.${user.id},receiverId.eq.${user.id}`)
        .order('createdAt', { ascending: false })
        .limit(EXPORT_LIMITS.matches),
      supabase
        .from('Message')
        .select('*', { count: 'exact' })
        .eq('senderId', user.id)
        .order('createdAt', { ascending: false })
        .limit(EXPORT_LIMITS.messages),
      supabase
        .from('StudySession')
        .select('*', { count: 'exact' })
        .eq('userId', user.id)
        .order('createdAt', { ascending: false })
        .limit(EXPORT_LIMITS.sessions),
      supabase
        .from('Notification')
        .select('*', { count: 'exact' })
        .eq('userId', user.id)
        .order('createdAt', { ascending: false })
        .limit(EXPORT_LIMITS.notifications),
    ])

    // Create export object with accurate counts
    // Note: We export limited records but show total counts so users know if data was truncated
    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
      },
      profile: profile || null,
      settings: settings || null,
      posts: posts || [],
      matches: matches || [],
      messages: messages || [],
      studySessions: sessions || [],
      notifications: notifications || [],
      metadata: {
        // Total records in database
        totalPosts: totalPosts || 0,
        totalMatches: totalMatches || 0,
        totalMessages: totalMessages || 0,
        totalSessions: totalSessions || 0,
        totalNotifications: totalNotifications || 0,
        // Records included in this export (may be less due to limits)
        exportedPosts: posts?.length || 0,
        exportedMatches: matches?.length || 0,
        exportedMessages: messages?.length || 0,
        exportedSessions: sessions?.length || 0,
        exportedNotifications: notifications?.length || 0,
        // Export limits applied
        limits: EXPORT_LIMITS,
        note: 'If exported counts are less than totals, older records were excluded. Contact support for full export.',
      },
    }

    // Convert to JSON and return as downloadable file
    const jsonData = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonData], { type: 'application/json' })

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="clerva-data-export-${user.id}-${Date.now()}.json"`,
      },
    })
  } catch (error) {
    console.error('[Export Data] Error:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}
