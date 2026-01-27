// API Route: Get User Settings
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserWithClient } from '@/lib/api-auth'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  // SCALABILITY: Rate limit settings fetch (lenient - frequently accessed)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Auth check - uses cached auth context (also returns supabase client)
    const { user, supabase } = await getCurrentUserWithClient()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    // Fetch user settings using Supabase RLS-protected query
    const { data: settings, error } = await supabase
      .from('UserSettings')
      .select('*')
      .eq('userId', user.id)
      .single()

    if (error) {
      console.error('[Settings] Error fetching settings:', error)

      // If settings don't exist, create default settings
      if (error.code === 'PGRST116') {
        console.log('[Settings] Settings not found, creating default settings...')
        const { data: newSettings, error: createError } = await supabase
          .from('UserSettings')
          .insert({ userId: user.id })
          .select('*')
          .single()

        if (createError) {
          console.error('[Settings] Error creating settings:', createError)

          // Check if table doesn't exist
          if (createError.code === '42P01' || createError.message?.includes('does not exist')) {
            return NextResponse.json(
              {
                error: 'Settings table not initialized',
                message: 'Database migration required. Contact support if this persists.',
              },
              { status: 500 }
            )
          }

          // SECURITY: Don't expose internal error details
          return NextResponse.json(
            { error: 'Failed to create settings' },
            { status: 500 }
          )
        }

        console.log('[Settings] Default settings created successfully')
        return NextResponse.json({ settings: newSettings })
      }

      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          {
            error: 'Settings table not initialized',
            message: 'Please run the database migration to create the UserSettings table. See SETTINGS_DEPLOYMENT_GUIDE.md'
          },
          { status: 500 }
        )
      }

      // SECURITY: Don't expose internal error details
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      )
    }

    console.log('[Settings] Fetched settings successfully')

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('[Settings] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

