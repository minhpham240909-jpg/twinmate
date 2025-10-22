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

    const body = await request.json()

    // Validate request body
    const validation = validateRequest(deleteNotificationSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { notificationIds } = validation.data

    // Delete specific notifications using Prisma (only if they belong to this user)
    const deleteResult = await prisma.notification.deleteMany({
      where: {
        id: { in: notificationIds },
        userId: user.id // Security: only delete user's own notifications
      }
    })

    console.log(`Deleted ${deleteResult.count} notification(s) for user ${user.id}`)

    return NextResponse.json({
      success: true,
      message: `${deleteResult.count} notification(s) deleted`,
      deletedCount: deleteResult.count
    })
  } catch (error) {
    console.error('Error in delete notifications API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
