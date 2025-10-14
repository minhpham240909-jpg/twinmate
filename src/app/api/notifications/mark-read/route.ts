import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const markReadSchema = z.object({
  notificationId: z.string().optional(),
  markAll: z.boolean().optional()
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

    // Parse request body
    const body = await request.json()
    const validation = markReadSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { notificationId, markAll } = validation.data

    if (markAll) {
      // Mark all notifications as read
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          isRead: false
        },
        data: {
          isRead: true
        }
      })

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read'
      })
    } else if (notificationId) {
      // Mark specific notification as read
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId }
      })

      if (!notification) {
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404 }
        )
      }

      if (notification.userId !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true }
      })

      return NextResponse.json({
        success: true,
        message: 'Notification marked as read'
      })
    } else {
      return NextResponse.json(
        { error: 'Must provide notificationId or markAll' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Mark notification as read error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
