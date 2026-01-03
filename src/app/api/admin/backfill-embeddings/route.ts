/**
 * Embedding Backfill API
 *
 * Generates embeddings for existing profiles and groups that don't have them.
 * This is needed after initially deploying semantic search.
 *
 * Admin-only endpoint with rate limiting to prevent overload.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import logger from '@/lib/logger'
import {
  batchGenerateProfileEmbeddings,
  batchGenerateGroupEmbeddings,
} from '@/lib/search'

// ============================================
// Configuration
// ============================================

const MAX_ITEMS_PER_REQUEST = 200 // Max items per API call

// ============================================
// Main API Handler
// ============================================

export async function POST(request: NextRequest) {
  // Strict rate limiting for this expensive operation
  const rateLimitResult = await rateLimit(request, {
    ...RateLimitPresets.strict,
    max: 2, // Only 2 requests per minute
    keyPrefix: 'backfill-embeddings'
  })

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before running backfill again.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, deactivatedAt: true }
    })

    if (!dbUser?.isAdmin || dbUser.deactivatedAt) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { type = 'all', limit = MAX_ITEMS_PER_REQUEST } = body

    const results: {
      profiles?: { processed: number; success: number; failed: number }
      groups?: { processed: number; success: number; failed: number }
    } = {}

    // Backfill profiles
    if (type === 'all' || type === 'profiles') {
      logger.info('Starting profile embedding backfill')

      // Find profiles without embeddings
      // Using raw query because Prisma doesn't support checking vector columns
      const profilesWithoutEmbeddings = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Profile"
        WHERE embedding IS NULL
        AND (
          bio IS NOT NULL OR
          school IS NOT NULL OR
          subjects IS NOT NULL OR
          interests IS NOT NULL OR
          "aboutYourself" IS NOT NULL
        )
        LIMIT ${Math.min(limit, MAX_ITEMS_PER_REQUEST)}
      `

      const profileIds = profilesWithoutEmbeddings.map(p => p.id)

      if (profileIds.length > 0) {
        const profileResult = await batchGenerateProfileEmbeddings(
          profileIds,
          (completed, total) => {
            logger.debug(`Profile embedding progress: ${completed}/${total}`)
          }
        )

        results.profiles = {
          processed: profileIds.length,
          success: profileResult.success,
          failed: profileResult.failed,
        }

        logger.info('Profile embedding backfill completed', results.profiles)
      } else {
        results.profiles = { processed: 0, success: 0, failed: 0 }
        logger.info('No profiles need embedding backfill')
      }
    }

    // Backfill groups
    if (type === 'all' || type === 'groups') {
      logger.info('Starting group embedding backfill')

      // Find groups without embeddings
      const groupsWithoutEmbeddings = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Group"
        WHERE embedding IS NULL
        AND "isDeleted" = false
        AND (
          name IS NOT NULL OR
          description IS NOT NULL OR
          subject IS NOT NULL
        )
        LIMIT ${Math.min(limit, MAX_ITEMS_PER_REQUEST)}
      `

      const groupIds = groupsWithoutEmbeddings.map(g => g.id)

      if (groupIds.length > 0) {
        const groupResult = await batchGenerateGroupEmbeddings(
          groupIds,
          (completed, total) => {
            logger.debug(`Group embedding progress: ${completed}/${total}`)
          }
        )

        results.groups = {
          processed: groupIds.length,
          success: groupResult.success,
          failed: groupResult.failed,
        }

        logger.info('Group embedding backfill completed', results.groups)
      } else {
        results.groups = { processed: 0, success: 0, failed: 0 }
        logger.info('No groups need embedding backfill')
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: 'Embedding backfill completed',
    })
  } catch (error) {
    logger.error('Embedding backfill error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// GET - Check backfill status
// ============================================

export async function GET(_request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, deactivatedAt: true }
    })

    if (!dbUser?.isAdmin || dbUser.deactivatedAt) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Count profiles with and without embeddings
    const [profilesWithEmbedding, profilesWithoutEmbedding] = await Promise.all([
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "Profile" WHERE embedding IS NOT NULL
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "Profile" WHERE embedding IS NULL
      `
    ])

    // Count groups with and without embeddings
    const [groupsWithEmbedding, groupsWithoutEmbedding] = await Promise.all([
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "Group" WHERE embedding IS NOT NULL AND "isDeleted" = false
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "Group" WHERE embedding IS NULL AND "isDeleted" = false
      `
    ])

    return NextResponse.json({
      profiles: {
        withEmbedding: Number(profilesWithEmbedding[0].count),
        withoutEmbedding: Number(profilesWithoutEmbedding[0].count),
        total: Number(profilesWithEmbedding[0].count) + Number(profilesWithoutEmbedding[0].count),
      },
      groups: {
        withEmbedding: Number(groupsWithEmbedding[0].count),
        withoutEmbedding: Number(groupsWithoutEmbedding[0].count),
        total: Number(groupsWithEmbedding[0].count) + Number(groupsWithoutEmbedding[0].count),
      },
    })
  } catch (error) {
    logger.error('Embedding status check error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
