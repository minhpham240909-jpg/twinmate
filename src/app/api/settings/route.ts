// API Route: Get User Settings
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
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
      // If settings don't exist, create default settings
      if (error.code === 'PGRST116') {
        const { data: newSettings, error: createError } = await supabase
          .from('UserSettings')
          .insert({ userId: user.id })
          .select('*')
          .single()

        if (createError) {
          console.error('[Settings] Error creating settings:', createError)
          return NextResponse.json(
            { error: 'Failed to create settings' },
            { status: 500 }
          )
        }

        return NextResponse.json({ settings: newSettings })
      }

      console.error('[Settings] Error fetching settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('[Settings] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

