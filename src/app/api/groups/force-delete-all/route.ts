import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[FORCE DELETE] Finding all groups owned by user:', user.id)

    // Find all groups owned by the user
    const yourGroups = await prisma.group.findMany({
      where: {
        ownerId: user.id,
      },
      select: {
        id: true,
        name: true,
      },
    })

    console.log(`[FORCE DELETE] Found ${yourGroups.length} groups to delete`)

    if (yourGroups.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        message: 'No groups to delete',
      })
    }

    // Delete each group
    const deletedGroups = []
    const failedGroups = []

    for (const group of yourGroups) {
      try {
        console.log(`[FORCE DELETE] Deleting group: ${group.id} (${group.name})`)

        await prisma.group.delete({
          where: { id: group.id },
        })

        // Verify deletion
        const stillExists = await prisma.group.findUnique({
          where: { id: group.id },
        })

        if (stillExists) {
          console.error(`[FORCE DELETE] Group ${group.id} still exists after deletion!`)
          failedGroups.push(group)
        } else {
          console.log(`[FORCE DELETE] Successfully deleted group: ${group.id}`)
          deletedGroups.push(group)
        }
      } catch (error) {
        console.error(`[FORCE DELETE] Error deleting group ${group.id}:`, error)
        failedGroups.push({ ...group, error: String(error) })
      }
    }

    return NextResponse.json({
      success: failedGroups.length === 0,
      deletedCount: deletedGroups.length,
      failedCount: failedGroups.length,
      deletedGroups,
      failedGroups,
      message: failedGroups.length === 0
        ? `Successfully deleted all ${deletedGroups.length} groups permanently`
        : `Deleted ${deletedGroups.length} groups, ${failedGroups.length} failed`,
    })
  } catch (error) {
    console.error('[FORCE DELETE] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete groups' },
      { status: 500 }
    )
  }
}
