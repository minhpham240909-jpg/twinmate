import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const searchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().optional().default(10),
})

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = searchSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { query, limit } = validation.data

    // Search for users by name or email using Supabase
    // Build OR conditions for name and email search
    const searchTerms = query.trim().split(/\s+/)
    const conditions: string[] = []

    for (const term of searchTerms) {
      if (term.length > 0) {
        conditions.push(`name.ilike.%${term}%`)
        conditions.push(`email.ilike.%${term}%`)
      }
    }

    const { data: users, error: searchError } = await supabase
      .from('User')
      .select('id, name, email, avatarUrl')
      .neq('id', user.id) // Exclude current user
      .or(conditions.join(','))
      .limit(limit)

    if (searchError) {
      console.error('Supabase search error:', searchError)
      throw new Error(`Search failed: ${searchError.message}`)
    }

    return NextResponse.json({
      success: true,
      users: users || [],
    })
  } catch (error) {
    console.error('User search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
