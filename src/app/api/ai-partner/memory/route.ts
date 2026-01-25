/**
 * AI Partner Memory API
 * GET /api/ai-partner/memory - Get user's memory context and stats
 * PUT /api/ai-partner/memory - Update user memory preferences
 * DELETE /api/ai-partner/memory - Clear specific memories
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import {
  getOrCreateUserMemory,
  getMemoryStats,
  updateUserMemoryField,
  addToUserMemoryArray,
  removeFromUserMemoryArray,
  cleanupMemories,
  getRelevantMemories,
} from '@/lib/ai-partner/memory'
import { prisma } from '@/lib/prisma'

// GET: Get user's memory and stats
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
    const includeStats = searchParams.get('stats') === 'true'
    const includeMemories = searchParams.get('memories') === 'true'

    const [userMemory, stats, memories] = await Promise.all([
      getOrCreateUserMemory(user.id),
      includeStats ? getMemoryStats(user.id) : null,
      includeMemories ? getRelevantMemories(user.id, { limit: 50 }) : null,
    ])

    return NextResponse.json({
      success: true,
      memory: userMemory,
      ...(stats ? { stats } : {}),
      ...(memories ? { memories } : {}),
    })
  } catch (error) {
    console.error('[AI Memory] Get error:', error)
    return NextResponse.json(
      { error: 'Failed to get memory' },
      { status: 500 }
    )
  }
}

// PUT: Update user memory preferences
export async function PUT(request: NextRequest) {
  try {
    // Rate limiting - moderate for memory updates
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
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

    const body = await request.json()
    const { action, field, value } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'update_field':
        if (!field) {
          return NextResponse.json(
            { error: 'Field is required for update_field action' },
            { status: 400 }
          )
        }
        await updateUserMemoryField(user.id, field, value)
        break

      case 'add_to_array':
        if (!field || !value) {
          return NextResponse.json(
            { error: 'Field and value required for add_to_array action' },
            { status: 400 }
          )
        }
        await addToUserMemoryArray(user.id, field, value)
        break

      case 'remove_from_array':
        if (!field || !value) {
          return NextResponse.json(
            { error: 'Field and value required for remove_from_array action' },
            { status: 400 }
          )
        }
        await removeFromUserMemoryArray(user.id, field, value)
        break

      case 'cleanup':
        const cleaned = await cleanupMemories(user.id)
        return NextResponse.json({
          success: true,
          message: `Cleaned up ${cleaned} old memories`,
          cleanedCount: cleaned,
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    const updatedMemory = await getOrCreateUserMemory(user.id)

    return NextResponse.json({
      success: true,
      memory: updatedMemory,
    })
  } catch (error) {
    console.error('[AI Memory] Update error:', error)
    return NextResponse.json(
      { error: 'Failed to update memory' },
      { status: 500 }
    )
  }
}

// DELETE: Clear memories
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
    const memoryId = searchParams.get('id')
    const clearAll = searchParams.get('all') === 'true'
    const category = searchParams.get('category')

    if (clearAll) {
      // Clear all memories for user
      await prisma.aIMemoryEntry.deleteMany({
        where: { userId: user.id },
      })

      // Reset user memory to defaults
      await prisma.aIUserMemory.update({
        where: { userId: user.id },
        data: {
          preferredName: null,
          preferredLearningStyle: null,
          preferredDifficulty: null,
          preferredPace: null,
          currentSubjects: [],
          masteredTopics: [],
          strugglingTopics: [],
          academicGoals: [],
          communicationStyle: null,
          motivationalNeeds: null,
          humorPreference: null,
          bestStudyTime: null,
          avgSessionLength: null,
          breakPreference: null,
          importantFacts: undefined as any, // Reset JSON field
          lastTopicDiscussed: null,
          pendingQuestions: [],
          customInstructions: null,
          // Keep session stats
        },
      })

      return NextResponse.json({
        success: true,
        message: 'All memories cleared',
      })
    }

    if (category) {
      // Clear memories by category
      const deleted = await prisma.aIMemoryEntry.deleteMany({
        where: {
          userId: user.id,
          category: category as any,
        },
      })

      return NextResponse.json({
        success: true,
        message: `Cleared ${deleted.count} memories in category ${category}`,
        deletedCount: deleted.count,
      })
    }

    if (memoryId) {
      // Delete specific memory
      await prisma.aIMemoryEntry.delete({
        where: {
          id: memoryId,
          userId: user.id, // Ensure user owns this memory
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Memory deleted',
      })
    }

    return NextResponse.json(
      { error: 'Specify id, category, or all=true' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[AI Memory] Delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete memory' },
      { status: 500 }
    )
  }
}
