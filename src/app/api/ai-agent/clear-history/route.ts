/**
 * API endpoint to clear AI agent conversation history
 * Use this to reset conversations and remove bad responses
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MemoryManager } from '@/../packages/ai-agent/src/lib/memory'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Initialize memory manager with admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const adminSupabase = createSupabaseClient(supabaseUrl, supabaseServiceKey)
    const memoryManager = new MemoryManager(adminSupabase)

    // Clear conversation history for this user
    await memoryManager.clearConversationHistory(user.id)

    console.log(`[Clear History API] Successfully cleared history for user: ${user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Conversation history cleared successfully',
      userId: user.id,
    })
  } catch (error) {
    console.error('[Clear History API] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to clear conversation history',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check if user has conversation history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const adminSupabase = createSupabaseClient(supabaseUrl, supabaseServiceKey)
    const memoryManager = new MemoryManager(adminSupabase)

    const conversation = await memoryManager.loadConversation(user.id)

    return NextResponse.json({
      hasHistory: conversation.length > 0,
      messageCount: conversation.length,
      userId: user.id,
    })
  } catch (error) {
    console.error('[Clear History API] Error checking history:', error)

    return NextResponse.json(
      {
        error: 'Failed to check conversation history',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
