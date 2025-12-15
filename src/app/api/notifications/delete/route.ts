import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteNotificationSchema, validateRequest } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Validate request body
    const validation = validateRequest(deleteNotificationSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { notificationIds } = validation.data

    // First, verify the notifications exist and belong to this user
    const existingNotifications = await prisma.notification.findMany({
      where: {
        id: { in: notificationIds },
        userId: user.id,
      },
      select: { id: true },
    })

    if (existingNotifications.length === 0) {
      // No notifications found - either they don't exist or don't belong to user
      // This is still a success case (nothing to delete)
      return NextResponse.json({
        success: true,
        message: 'No notifications found to delete',
        deletedCount: 0,
      })
    }

    // Delete only the verified notifications
    const deleteResult = await prisma.notification.deleteMany({
      where: {
        id: { in: existingNotifications.map(n => n.id) },
        userId: user.id, // Security: only delete user's own notifications
      },
    })

    console.log(`Deleted ${deleteResult.count} notification(s) for user ${user.id}`)

    return NextResponse.json({
      success: true,
      message: `${deleteResult.count} notification(s) deleted`,
      deletedCount: deleteResult.count,
    })
  } catch (error) {
    console.error('Error in delete notifications API:', error)
    // Log more details for debugging
    if (error instanceof Error) {
      console.error('Error details:', error.message, error.stack)
    }
    return NextResponse.json(
      {
        error: 'Failed to delete notifications',
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : undefined,
      },
      { status: 500 }
    )
  }
}
