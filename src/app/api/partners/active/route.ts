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

    // Get all accepted partners with full profile details and presence data
    const [matches, userPresences] = await Promise.all([
      prisma.match.findMany({
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
                  location_city: true,
                  location_state: true,
                  location_country: true,
                  location_visibility: true,
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
                  location_city: true,
                  location_state: true,
                  location_country: true,
                  location_visibility: true,
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
      }),
      // Fetch presence data for all partners
      prisma.match.findMany({
        where: {
          OR: [
            { senderId: user.id, status: 'ACCEPTED' },
            { receiverId: user.id, status: 'ACCEPTED' }
          ]
        },
        select: {
          senderId: true,
          receiverId: true
        }
      }).then(async (matches) => {
        const partnerIds = matches.map(match =>
          match.senderId === user.id ? match.receiverId : match.senderId
        )
        return prisma.userPresence.findMany({
          where: {
            userId: { in: partnerIds }
          },
          select: {
            userId: true,
            status: true,
            lastSeenAt: true,
            isPrivate: true
          }
        })
      })
    ])

    // Create presence lookup map
    const presenceMap = new Map(
      userPresences.map(p => [p.userId, p])
    )

    // Extract partners (not the current user)
    const partners = matches.map(match => {
      const partner = match.senderId === user.id ? match.receiver : match.sender
      const presence = presenceMap.get(partner.id)

      // Determine online status from presence data
      let onlineStatus = 'OFFLINE'
      if (presence && !presence.isPrivate) {
        onlineStatus = presence.status === 'online' ? 'ONLINE' : 'OFFLINE'
      }

      // SECURITY: Sanitize location data based on privacy settings
      // For accepted partners, respect location_visibility:
      // - 'public': show location to everyone
      // - 'match-only': show location to accepted partners (like this endpoint)
      // - 'private': hide location even from accepted partners
      let locationCity = null
      let locationState = null
      let locationCountry = null

      if (partner.profile) {
        const locationVisibility = (partner.profile as any).location_visibility || 'private'

        // Show location if public OR if match-only (since these are accepted partners)
        if (locationVisibility === 'public' || locationVisibility === 'match-only') {
          locationCity = (partner.profile as any).location_city
          locationState = (partner.profile as any).location_state
          locationCountry = (partner.profile as any).location_country
        }
      }

      return {
        matchId: match.id,
        id: partner.id,
        name: partner.name,
        email: partner.email,
        avatarUrl: partner.avatarUrl,
        onlineStatus,
        profile: partner.profile ? {
          bio: partner.profile.bio,
          subjects: partner.profile.subjects,
          interests: partner.profile.interests,
          goals: partner.profile.goals,
          skillLevel: partner.profile.skillLevel,
          studyStyle: partner.profile.studyStyle,
          onlineStatus,
          locationCity,
          locationState,
          locationCountry,
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
