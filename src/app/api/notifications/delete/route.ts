import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationIds } = body

    if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
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
    } else {
      return NextResponse.json({ error: 'Invalid request - notificationIds must be a non-empty array' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in delete notifications API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
