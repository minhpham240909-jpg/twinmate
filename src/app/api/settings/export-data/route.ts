// API Route: Export User Data (GDPR Compliance)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

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

    console.log(`[Export Data] Exporting data for user ${user.id}`)

    // Fetch all user data from different tables
    const [
      { data: profile },
      { data: settings },
      { data: posts },
      { data: matches },
      { data: messages },
      { data: sessions },
      { data: notifications },
    ] = await Promise.all([
      supabase.from('Profile').select('*').eq('userId', user.id).single(),
      supabase.from('UserSettings').select('*').eq('userId', user.id).single(),
      supabase.from('Post').select('*').eq('userId', user.id),
      supabase
        .from('Match')
        .select('*')
        .or(`senderId.eq.${user.id},receiverId.eq.${user.id}`),
      supabase.from('Message').select('*').eq('senderId', user.id),
      supabase.from('StudySession').select('*').eq('userId', user.id),
      supabase.from('Notification').select('*').eq('userId', user.id),
    ])

    // Create export object
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
        totalPosts: posts?.length || 0,
        totalMatches: matches?.length || 0,
        totalMessages: messages?.length || 0,
        totalSessions: sessions?.length || 0,
        totalNotifications: notifications?.length || 0,
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
