// API Route: Export User Data (GDPR Compliance)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
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

    // Fetch all user data from various tables
    const [
      { data: userData },
      { data: profileData },
      { data: postsData },
      { data: settingsData },
      { data: connectionsData },
      { data: messagesData },
      { data: notificationsData },
    ] = await Promise.all([
      supabase.from('User').select('*').eq('id', user.id).single(),
      supabase.from('Profile').select('*').eq('userId', user.id).single(),
      supabase.from('Post').select('*').eq('authorId', user.id),
      supabase.from('UserSettings').select('*').eq('userId', user.id).single(),
      supabase.from('Connection').select('*').or(`user1Id.eq.${user.id},user2Id.eq.${user.id}`),
      supabase.from('Message').select('*').eq('senderId', user.id),
      supabase.from('Notification').select('*').eq('userId', user.id),
    ])

    // Compile all data into a single object
    const exportData = {
      exportDate: new Date().toISOString(),
      userId: user.id,
      user: userData,
      profile: profileData,
      posts: postsData || [],
      settings: settingsData,
      connections: connectionsData || [],
      messages: messagesData || [],
      notifications: notificationsData || [],
    }

    // Return as JSON download
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="clerva-data-export-${user.id}-${Date.now()}.json"`,
      },
    })
  } catch (error) {
    console.error('[Export Data] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
