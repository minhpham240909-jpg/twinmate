import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
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

    // Get all accepted partners with full profile details
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { senderId: user.id, status: 'ACCEPTED' },
          { receiverId: user.id, status: 'ACCEPTED' }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            profile: {
              select: {
                bio: true,
                subjects: true,
                interests: true,
                goals: true,
                skillLevel: true,
                studyStyle: true,
                onlineStatus: true,
                location: true,
                timezone: true,
                availableDays: true,
                availableHours: true,
                aboutYourself: true,
                aboutYourselfItems: true
              }
            }
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            profile: {
              select: {
                bio: true,
                subjects: true,
                interests: true,
                goals: true,
                skillLevel: true,
                studyStyle: true,
                onlineStatus: true,
                location: true,
                timezone: true,
                availableDays: true,
                availableHours: true,
                aboutYourself: true,
                aboutYourselfItems: true
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    // Extract partners (not the current user)
    const partners = matches.map(match => {
      const partner = match.senderId === user.id ? match.receiver : match.sender
      return {
        matchId: match.id,
        id: partner.id,
        name: partner.name,
        email: partner.email,
        avatarUrl: partner.avatarUrl,
        profile: partner.profile ? {
          bio: partner.profile.bio,
          subjects: partner.profile.subjects,
          interests: partner.profile.interests,
          goals: partner.profile.goals,
          skillLevel: partner.profile.skillLevel,
          studyStyle: partner.profile.studyStyle,
          onlineStatus: partner.profile.onlineStatus,
          location: partner.profile.location,
          timezone: partner.profile.timezone,
          availableDays: partner.profile.availableDays,
          availableHours: partner.profile.availableHours,
          aboutYourself: partner.profile.aboutYourself,
          aboutYourselfItems: partner.profile.aboutYourselfItems
        } : null,
        connectedAt: match.updatedAt
      }
    })

    return NextResponse.json({
      success: true,
      partners
    })
  } catch (error) {
    console.error('Fetch active partners error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
