import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
      // Delete specific notifications (only if they belong to this user)
      const { error } = await supabase
        .from('Notification')
        .delete()
        .eq('userId', user.id)
        .in('id', notificationIds)

      if (error) {
        console.error('Error deleting notifications:', error)
        return NextResponse.json({ error: 'Failed to delete notifications', details: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: `${notificationIds.length} notification(s) deleted` })
    } else {
      return NextResponse.json({ error: 'Invalid request - notificationIds must be a non-empty array' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in delete notifications API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
