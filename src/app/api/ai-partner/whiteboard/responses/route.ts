/**
 * AI Partner Whiteboard Responses API
 * GET /api/ai-partner/whiteboard/responses - Get all whiteboard AI responses for a session
 * DELETE /api/ai-partner/whiteboard/responses - Delete a specific whiteboard response
 *
 * Scalable design:
 * - Uses indexed queries on sessionId
 * - Batch fetches to prevent N+1
 * - Returns only necessary fields
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

// GET: Fetch all whiteboard AI responses for a session
export async function GET(request: NextRequest) {
  try {
    // Rate limiting - lenient for read operations
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Verify user owns this session - single query with indexed field
    const session = await prisma.aIPartnerSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
      select: { id: true }, // Only need to verify existence
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Fetch whiteboard responses - uses compound index on [sessionId, messageType]
    // Order by createdAt DESC to get most recent first
    const whiteboardResponses = await prisma.aIPartnerMessage.findMany({
      where: {
        sessionId,
        messageType: 'WHITEBOARD',
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20, // Limit to last 20 responses for performance
    })

    // Parse the JSON content and transform to frontend format
    // Content is stored as JSON string with analysis/suggestions data
    const responses = whiteboardResponses.map((msg: { id: string; content: string; createdAt: Date }) => {
      try {
        const parsed = JSON.parse(msg.content)
        return {
          id: msg.id,
          timestamp: msg.createdAt.getTime(),
          // Determine if it's an analysis or suggestion based on content structure
          type: parsed.analysis ? 'analysis' : 'suggestion',
          data: parsed,
        }
      } catch {
        // If content isn't JSON, treat as plain text analysis
        return {
          id: msg.id,
          timestamp: msg.createdAt.getTime(),
          type: 'analysis',
          data: {
            analysis: msg.content,
            suggestions: [],
            relatedConcepts: [],
          },
        }
      }
    })

    return NextResponse.json({
      success: true,
      responses,
    })
  } catch (error) {
    console.error('[AI Partner] Get whiteboard responses error:', error)
    return NextResponse.json(
      { error: 'Failed to get whiteboard responses' },
      { status: 500 }
    )
  }
}

// DELETE: Delete a specific whiteboard response
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting - strict for delete operations
    const rateLimitResult = await rateLimit(request, RateLimitPresets.strict)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const responseId = searchParams.get('responseId')
    const sessionId = searchParams.get('sessionId')

    if (!responseId || !sessionId) {
      return NextResponse.json(
        { error: 'Response ID and Session ID required' },
        { status: 400 }
      )
    }

    // Verify user owns this session and response exists - single optimized query
    const message = await prisma.aIPartnerMessage.findFirst({
      where: {
        id: responseId,
        sessionId,
        messageType: 'WHITEBOARD',
        session: {
          userId: user.id,
        },
      },
      select: { id: true },
    })

    if (!message) {
      return NextResponse.json(
        { error: 'Response not found or unauthorized' },
        { status: 404 }
      )
    }

    // Delete the response
    await prisma.aIPartnerMessage.delete({
      where: { id: responseId },
    })

    return NextResponse.json({
      success: true,
      message: 'Response deleted',
    })
  } catch (error) {
    console.error('[AI Partner] Delete whiteboard response error:', error)
    return NextResponse.json(
      { error: 'Failed to delete response' },
      { status: 500 }
    )
  }
}
