// API Route: Diagnose Settings Database Setup
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  // SCALABILITY: Rate limit diagnose endpoint (strict - admin/debug operation)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.strict)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
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

    console.log(`[Settings Diagnostic] Running for user ${user.id}`)

    const diagnostics: Record<string, any> = {
      userId: user.id,
      checks: {},
      errors: [],
    }

    // Check if UserSettings table exists
    try {
      const { data, error } = await supabase
        .from('UserSettings')
        .select('*')
        .eq('userId', user.id)
        .maybeSingle()

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          diagnostics.checks.tableExists = false
          diagnostics.errors.push('UserSettings table does not exist in the database')
        } else if (error.code === 'PGRST116') {
          diagnostics.checks.tableExists = true
          diagnostics.checks.userSettingsExists = false
          diagnostics.checks.settingsData = null
        } else {
          diagnostics.checks.tableExists = 'unknown'
          diagnostics.errors.push(`Supabase error: ${error.message} (${error.code})`)
        }
      } else {
        diagnostics.checks.tableExists = true
        diagnostics.checks.userSettingsExists = data !== null
        diagnostics.checks.settingsData = data

        if (data) {
          diagnostics.checks.fieldCount = Object.keys(data).length
          diagnostics.checks.fields = Object.keys(data)
        }
      }
    } catch (err: any) {
      diagnostics.errors.push(`Exception checking table: ${err.message}`)
    }

    // Check if we can create settings
    if (diagnostics.checks.tableExists && !diagnostics.checks.userSettingsExists) {
      try {
        const { data: newSettings, error: createError } = await supabase
          .from('UserSettings')
          .insert({ userId: user.id })
          .select('*')
          .single()

        if (createError) {
          diagnostics.checks.canCreateSettings = false
          diagnostics.errors.push(`Cannot create settings: ${createError.message}`)
        } else {
          diagnostics.checks.canCreateSettings = true
          diagnostics.checks.createdSettings = newSettings

          // Clean up test settings
          await supabase
            .from('UserSettings')
            .delete()
            .eq('id', newSettings.id)
        }
      } catch (err: any) {
        diagnostics.errors.push(`Exception creating settings: ${err.message}`)
      }
    }

    // Overall status
    diagnostics.status = diagnostics.errors.length === 0 ? 'healthy' : 'issues_detected'

    // Recommendations
    diagnostics.recommendations = []
    if (!diagnostics.checks.tableExists) {
      diagnostics.recommendations.push(
        'Run the database migration SQL script to create the UserSettings table',
        'Check SETTINGS_DEPLOYMENT_GUIDE.md for instructions'
      )
    }

    if (diagnostics.checks.tableExists && !diagnostics.checks.userSettingsExists) {
      diagnostics.recommendations.push(
        'Settings table exists but no settings for this user',
        'Settings will be auto-created on first save'
      )
    }

    return NextResponse.json(diagnostics, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('[Settings Diagnostic] Error:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to run diagnostics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
