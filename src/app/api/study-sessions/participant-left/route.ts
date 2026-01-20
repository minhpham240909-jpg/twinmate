/**
 * Beacon endpoint for browser close/unload cleanup
 *
 * This endpoint receives sendBeacon requests when a user closes their browser
 * or navigates away. It's designed to handle cleanup without authentication
 * since sendBeacon doesn't reliably send cookies.
 *
 * Security: Validates channel format and only updates participant status
 */

import { NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    // Parse the beacon payload
    const text = await req.text()
    let data: { channel?: string; uid?: number; timestamp?: number }

    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { channel, uid, timestamp } = data

    if (!channel || !uid) {
      return NextResponse.json({ error: 'Missing channel or uid' }, { status: 400 })
    }

    // Validate timestamp is recent (within 30 seconds) to prevent replay
    if (timestamp && Date.now() - timestamp > 30000) {
      logger.warn('Participant-left beacon too old', { channel, uid, age: Date.now() - timestamp })
      return NextResponse.json({ error: 'Stale request' }, { status: 400 })
    }

    // Only process study session channels (format: study-{sessionId} or similar)
    // This prevents abuse by checking if the channel matches expected format
    const sessionMatch = channel.match(/^study[-_]?([a-zA-Z0-9-]+)$/)

    if (sessionMatch) {
      const sessionId = sessionMatch[1]

      // Find and update participant by UID
      // Note: UID is generated from userId hash, so we can't directly map back
      // Instead, log for monitoring and let the heartbeat mechanism handle cleanup
      logger.info('Participant left beacon received', {
        channel,
        uid,
        sessionId,
        timestamp: new Date(timestamp || Date.now()).toISOString()
      })

      // Log for monitoring - the heartbeat mechanism handles actual cleanup
      // We don't update session state here since we can't verify the user identity
      // from a sendBeacon request (no reliable cookie/auth support)
    }

    // For DM/group calls, just acknowledge receipt
    // The heartbeat mechanism in useVideoCall will handle actual cleanup
    if (channel.startsWith('dm') || channel.startsWith('grp')) {
      logger.info('Call participant left beacon received', { channel, uid })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Participant-left beacon error', { error })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
