/**
 * Cron Job: Cleanup Inactive Sessions
 * 
 * This endpoint should be called periodically (e.g., every 5 minutes) to:
 * - Clean up sessions that have timed out due to inactivity
 * - Remove stale presence records
 * 
 * Recommended cron schedule: every 5 minutes
 * 
 * Security: This endpoint requires a cron secret to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server'
import { cleanupInactiveSessions } from '@/lib/security/session-management'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    // In development, allow without secret
    return process.env.NODE_ENV === 'development'
  }
  
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false
  
  const token = authHeader.replace('Bearer ', '')
  return token === cronSecret
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  try {
    const results = {
      inactiveSessions: 0,
      stalePresence: 0,
      errors: [] as string[],
    }
    
    // 1. Clean up inactive sessions
    try {
      results.inactiveSessions = await cleanupInactiveSessions()
    } catch (error) {
      results.errors.push('Failed to cleanup sessions')
      logger.error('Session cleanup error', error instanceof Error ? error : new Error(String(error)))
    }
    
    // 2. Clean up stale presence records (offline for > 1 hour)
    try {
      const stalePresenceCutoff = new Date(Date.now() - 60 * 60 * 1000) // 1 hour
      
      const presenceResult = await prisma.userPresence.updateMany({
        where: {
          status: { not: 'offline' },
          lastActivityAt: {
            lt: stalePresenceCutoff,
          },
        },
        data: {
          status: 'offline',
        },
      })
      
      results.stalePresence = presenceResult.count
    } catch (error) {
      results.errors.push('Failed to cleanup presence')
      logger.error('Presence cleanup error', error instanceof Error ? error : new Error(String(error)))
    }
    
    // 3. Clean up expired typing indicators
    try {
      await prisma.typingIndicator.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      })
    } catch (error) {
      // Non-critical - typing indicators table may not exist
    }
    
    // Log summary
    if (results.inactiveSessions > 0 || results.stalePresence > 0) {
      logger.info('Session cleanup completed', { data: results })
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cleanup: {
        inactiveSessions: results.inactiveSessions,
        stalePresence: results.stalePresence,
      },
      errors: results.errors.length > 0 ? results.errors : undefined,
    })
  } catch (error) {
    logger.error('Cron cleanup-sessions error', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Also support POST for cron services that use POST
  return GET(request)
}

