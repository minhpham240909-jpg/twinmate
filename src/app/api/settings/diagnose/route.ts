/**
 * API Route: Diagnose Settings Database Setup
 *
 * SECURITY: This endpoint is DISABLED in production to prevent information disclosure.
 * In development, it helps debug database setup issues.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  // SECURITY: Disable diagnostic endpoint in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is disabled in production' },
      { status: 403 }
    )
  }

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
          diagnostics.errors.push('UserSettings table does not exist')
        } else if (error.code === 'PGRST116') {
          diagnostics.checks.tableExists = true
          diagnostics.checks.userSettingsExists = false
          diagnostics.checks.settingsData = null
        } else {
          diagnostics.checks.tableExists = 'unknown'
          // SECURITY: Don't expose raw error codes/messages
          diagnostics.errors.push('Database query failed')
        }
      } else {
        diagnostics.checks.tableExists = true
        diagnostics.checks.userSettingsExists = data !== null
        // SECURITY: Only return field names, not actual data
        diagnostics.checks.settingsData = data ? '[exists]' : null

        if (data) {
          diagnostics.checks.fieldCount = Object.keys(data).length
          diagnostics.checks.fields = Object.keys(data)
        }
      }
    } catch {
      diagnostics.errors.push('Exception checking table')
    }

    // Check if we can create settings
    if (diagnostics.checks.tableExists && !diagnostics.checks.userSettingsExists) {
      try {
        const { data: newSettings, error: createError } = await supabase
          .from('UserSettings')
          .insert({ userId: user.id })
          .select('id')
          .single()

        if (createError) {
          diagnostics.checks.canCreateSettings = false
          diagnostics.errors.push('Cannot create settings')
        } else {
          diagnostics.checks.canCreateSettings = true

          // Clean up test settings
          await supabase
            .from('UserSettings')
            .delete()
            .eq('id', newSettings.id)
        }
      } catch {
        diagnostics.errors.push('Exception creating settings')
      }
    }

    // Overall status
    diagnostics.status = diagnostics.errors.length === 0 ? 'healthy' : 'issues_detected'

    // Recommendations
    diagnostics.recommendations = []
    if (!diagnostics.checks.tableExists) {
      diagnostics.recommendations.push(
        'Run database migrations to create UserSettings table'
      )
    }

    if (diagnostics.checks.tableExists && !diagnostics.checks.userSettingsExists) {
      diagnostics.recommendations.push(
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
    // SECURITY: Don't expose internal error details
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to run diagnostics',
      },
      { status: 500 }
    )
  }
}
