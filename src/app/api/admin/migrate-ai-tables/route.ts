/**
 * Admin API: Run AI Agent Tables Migration
 * POST /api/admin/migrate-ai-tables
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    // Simple auth check
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CLEANUP_API_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const sqlPath = join(process.cwd(), 'prisma/migrations/add_ai_agent_tables.sql')
    const sql = readFileSync(sqlPath, 'utf-8')

    // Execute full SQL
    const { error } = await supabase.rpc('exec_sql', { sql_string: sql })

    if (error) {
      // Fallback: Try creating tables individually
      const tables = [
        'agent_memory',
        'agent_task',
        'availability_block',
        'match_candidate',
      ]

      const results = []
      for (const table of tables) {
        const { data, error: checkError } = await supabase
          .from(table)
          .select('id')
          .limit(1)

        results.push({
          table,
          exists: !checkError,
          error: checkError?.message,
        })
      }

      return NextResponse.json({
        success: false,
        message: 'Migration had errors, but some tables may exist',
        error: error.message,
        tableStatus: results,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'AI agent tables migration completed successfully',
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST with Bearer token to run migration',
  })
}
