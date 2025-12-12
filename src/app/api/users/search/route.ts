import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const searchSchema = z.object({
  query: z.string().min(1).max(100), // H15 FIX: Limit query length
  limit: z.number().optional().default(10),
})

/**
 * H15 FIX: Comprehensive query sanitization for database search
 * Escapes all special characters that could affect Supabase/PostgreSQL queries
 */
function sanitizeSearchQuery(query: string): string {
  // Remove null bytes and other control characters
  let sanitized = query.replace(/[\x00-\x1F\x7F]/g, '')
  
  // Escape special characters used in LIKE patterns and SQL
  // PostgreSQL LIKE special chars: % _ 
  // Supabase filter special chars: . , ( ) [ ] { } * + ? ^ $ | \ 
  sanitized = sanitized
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/%/g, '\\%')     // Escape LIKE wildcard %
    .replace(/_/g, '\\_')     // Escape LIKE wildcard _
    .replace(/'/g, "''")      // Escape single quotes (SQL injection prevention)
    .replace(/"/g, '\\"')     // Escape double quotes
    .replace(/;/g, '')        // Remove semicolons (SQL injection prevention)
    .replace(/--/g, '')       // Remove SQL comment sequences
    .replace(/\/\*/g, '')     // Remove block comment start
    .replace(/\*\//g, '')     // Remove block comment end
    .replace(/\(/g, '\\(')    // Escape parentheses
    .replace(/\)/g, '\\)')
    .replace(/\[/g, '\\[')    // Escape brackets
    .replace(/\]/g, '\\]')
    .replace(/\{/g, '\\{')    // Escape braces
    .replace(/\}/g, '\\}')
    .replace(/\^/g, '\\^')    // Escape regex special chars
    .replace(/\$/g, '\\$')
    .replace(/\|/g, '\\|')
    .replace(/\*/g, '\\*')
    .replace(/\+/g, '\\+')
    .replace(/\?/g, '\\?')
  
  // Limit length after sanitization
  return sanitized.slice(0, 100).trim()
}

/**
 * H15 FIX: Validate search term is safe
 */
function isValidSearchTerm(term: string): boolean {
  // Must have at least 1 alphanumeric character
  if (!/[a-zA-Z0-9]/.test(term)) {
    return false
  }
  
  // Reasonable length (1-50 chars per term)
  if (term.length < 1 || term.length > 50) {
    return false
  }
  
  return true
}

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

    // H15 FIX: Sanitize and validate search query
    const sanitizedQuery = sanitizeSearchQuery(query)
    
    if (!sanitizedQuery) {
      return NextResponse.json({
        success: true,
        users: [],
      })
    }

    // Search for users by name or email using Supabase
    // Build OR conditions for name and email search
    const searchTerms = sanitizedQuery.split(/\s+/).filter(isValidSearchTerm)
    
    // H15 FIX: If no valid terms after sanitization, return empty results
    if (searchTerms.length === 0) {
      return NextResponse.json({
        success: true,
        users: [],
      })
    }
    
    // H15 FIX: Limit number of search terms to prevent DoS
    const limitedTerms = searchTerms.slice(0, 5)
    
    const conditions: string[] = []

    for (const term of limitedTerms) {
      if (term.length > 0) {
        // H15 FIX: Use sanitized terms in conditions
        conditions.push(`name.ilike.%${term}%`)
        conditions.push(`email.ilike.%${term}%`)
      }
    }

    const { data: users, error: searchError } = await supabase
      .from('User')
      .select('id, name, email, avatarUrl')
      .neq('id', user.id) // Exclude current user
      .or(conditions.join(','))
      .limit(Math.min(limit, 50)) // H15 FIX: Hard limit on results

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
