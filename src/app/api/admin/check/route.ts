// Admin Check API - Verify if current user is an admin
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { isAdmin: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        isAdmin: true,
        name: true,
        email: true,
        avatarUrl: true,
        adminGrantedAt: true,
        deactivatedAt: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json(
        { isAdmin: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // User must be admin and not deactivated
    const isAdmin = dbUser.isAdmin === true && dbUser.deactivatedAt === null

    return NextResponse.json({
      isAdmin,
      user: isAdmin ? {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        avatarUrl: dbUser.avatarUrl,
        adminGrantedAt: dbUser.adminGrantedAt,
      } : null,
    })
  } catch (error) {
    console.error('[Admin Check] Error:', error)
    return NextResponse.json(
      { isAdmin: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
