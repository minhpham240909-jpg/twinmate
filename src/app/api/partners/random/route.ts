import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
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

    // Get all existing matches (sent or received) for this user
    const existingMatches = await prisma.match.findMany({
      where: {
        OR: [
          { senderId: user.id },
          { receiverId: user.id }
        ]
      },
      select: {
        senderId: true,
        receiverId: true,
        status: true
      }
    })

    // Separate ACCEPTED partners from pending/other connections
    const acceptedPartnerIds = new Set<string>()
    const pendingOrOtherUserIds = new Set<string>()

    existingMatches.forEach(match => {
      const otherUserId = match.senderId === user.id ? match.receiverId : match.senderId

      if (match.status === 'ACCEPTED') {
        // These are confirmed partners - include them in results with special status
        acceptedPartnerIds.add(otherUserId)
      } else {
        // PENDING, REJECTED, CANCELLED - exclude from results
        pendingOrOtherUserIds.add(otherUserId)
      }
    })

    // Get random partners excluding current user and pending/rejected connections (but include ACCEPTED partners)
    const randomPartners = await prisma.profile.findMany({
      where: {
        AND: [
          { userId: { not: user.id } },
          { userId: { notIn: Array.from(pendingOrOtherUserIds) } }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            role: true,
            createdAt: true,
          }
        }
      },
      take: 100 // Get more to randomize from
    })

    // Add isAlreadyPartner flag to each profile
    const partnersWithStatus = randomPartners.map(profile => ({
      ...profile,
      isAlreadyPartner: acceptedPartnerIds.has(profile.userId)
    }))

    // Shuffle and take 3-5 random partners
    const shuffled = partnersWithStatus.sort(() => 0.5 - Math.random())
    const randomCount = Math.min(Math.max(3, Math.floor(Math.random() * 3) + 3), shuffled.length, 5)
    const selectedPartners = shuffled.slice(0, randomCount)

    return NextResponse.json({
      success: true,
      partners: selectedPartners,
      count: selectedPartners.length
    })
  } catch (error) {
    console.error('Random partners error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
