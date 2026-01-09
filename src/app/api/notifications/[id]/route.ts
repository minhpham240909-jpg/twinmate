/**
 * API endpoint to get notification details by ID
 * Used by IncomingCallProvider to fetch full caller information
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch notification with related user details
    // Single query with include to avoid N+1
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        actionUrl: true,
        relatedUserId: true,
        metadata: true,
        createdAt: true,
      }
    })

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    // Verify the notification belongs to the current user
    if (notification.userId !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // If there's a related user, fetch their details
    let relatedUser = null
    if (notification.relatedUserId) {
      relatedUser = await prisma.user.findUnique({
        where: { id: notification.relatedUserId },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        }
      })
    }

    return NextResponse.json({
      notification: {
        ...notification,
        relatedUser
      }
    })

  } catch (error) {
    console.error('Error fetching notification:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification' },
      { status: 500 }
    )
  }
}
