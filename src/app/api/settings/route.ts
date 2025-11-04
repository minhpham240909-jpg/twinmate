// API Route: Get User Settings
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
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
                message: 'Please run the database migration to create the UserSettings table. See SETTINGS_DEPLOYMENT_GUIDE.md',
                details: createError
              },
              { status: 500 }
            )
          }

          return NextResponse.json(
            { error: 'Failed to create settings', details: createError },
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

      return NextResponse.json(
        { error: 'Failed to fetch settings', details: error },
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

