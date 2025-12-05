import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { clearAllCaches } from '@/lib/cache'

/**
 * POST /api/admin/cache/clear
 * Clear all platform caches - Admin only
 */
export async function POST() {
  try {
    // Check authentication using Supabase
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin status
    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    // Clear all caches
    const result = await clearAllCaches()

    // Log this action for audit
    await prisma.adminAuditLog.create({
      data: {
        adminId: user.id,
        action: 'CACHE_CLEAR',
        targetType: 'system',
        targetId: 'cache',
        details: { cleared: result.cleared, message: result.message },
        ipAddress: null,
      },
    })

    return NextResponse.json({
      success: result.success,
      cleared: result.cleared,
      message: result.message,
    })
  } catch (error) {
    console.error('Error clearing caches:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to clear caches' },
      { status: 500 }
    )
  }
}
