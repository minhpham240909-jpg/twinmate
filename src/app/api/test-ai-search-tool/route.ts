/**
 * Test endpoint: Simulate AI agent calling searchUsers tool
 * GET /api/test-ai-search-tool?query=Gia
 * 
 * This helps debug why AI agent might not find users
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('query') || 'Gia'
    
    const supabase = await createClient()
    
    // Get current authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    const currentUserId = user?.id || null
    
    console.log('[TEST-AI-TOOL] Query:', query, 'CurrentUserId:', currentUserId)
    
    // Simulate what searchUsers tool does
    const searchTerms = query.trim().split(/\s+/)
    const conditions: string[] = []
    
    for (const term of searchTerms) {
      if (term.length > 0) {
        conditions.push(`name.ilike.%${term}%`)
        conditions.push(`email.ilike.%${term}%`)
      }
    }
    
    // Query WITH filter (like AI agent does)
    let userQueryWithFilter = supabase
      .from('User')
      .select('id, name, email, createdAt')
      .limit(20)
    
    if (currentUserId) {
      userQueryWithFilter = userQueryWithFilter.neq('id', currentUserId)
      console.log('[TEST-AI-TOOL] Filtering out current user:', currentUserId)
    }
    
    if (conditions.length > 0) {
      userQueryWithFilter = userQueryWithFilter.or(conditions.join(','))
    }
    
    const { data: usersWithFilter, error: errorWithFilter } = await userQueryWithFilter
    
    console.log('[TEST-AI-TOOL] With filter results:', {
      found: usersWithFilter?.length || 0,
      users: usersWithFilter?.map(u => u.name)
    })
    
    // Query WITHOUT filter to see what's being hidden
    let userQueryNoFilter = supabase
      .from('User')
      .select('id, name, email')
      .limit(20)
    
    if (conditions.length > 0) {
      userQueryNoFilter = userQueryNoFilter.or(conditions.join(','))
    }
    
    const { data: usersNoFilter } = await userQueryNoFilter
    
    // Find which users were filtered out
    const filteredOutUsers = usersNoFilter?.filter(u => 
      !usersWithFilter?.find(uf => uf.id === u.id)
    ) || []
    
    return NextResponse.json({
      success: true,
      query,
      searchTerms,
      currentUser: currentUserId ? {
        id: currentUserId,
        note: 'This user is automatically filtered out from search results'
      } : null,
      
      searchResults: {
        withCurrentUserFilter: {
          found: usersWithFilter?.length || 0,
          users: usersWithFilter?.map(u => ({ 
            id: u.id, 
            name: u.name, 
            email: u.email 
          })) || []
        },
        
        withoutFilter: {
          found: usersNoFilter?.length || 0,
          users: usersNoFilter?.map(u => ({ 
            id: u.id, 
            name: u.name, 
            email: u.email 
          })) || []
        },
        
        filteredOut: {
          count: filteredOutUsers.length,
          users: filteredOutUsers.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            reason: u.id === currentUserId ? 'Current logged-in user' : 'Unknown'
          }))
        }
      },
      
      diagnosis: {
        isSearchingForYourself: filteredOutUsers.some(u => u.id === currentUserId),
        message: filteredOutUsers.some(u => u.id === currentUserId)
          ? '⚠️ You are searching for YOURSELF! The AI agent filters out the current user. Try searching for a different user.'
          : usersWithFilter?.length
            ? `✅ Search works! Found ${usersWithFilter.length} user(s).`
            : '❌ No users found. Check if user exists in database.'
      }
    })
    
  } catch (error: any) {
    console.error('[TEST-AI-TOOL] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

