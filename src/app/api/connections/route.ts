import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

type MatchWithRelations = {
  id: string
  status: string
  message: string | null
  createdAt: Date
  senderId: string
  receiverId: string
  sender: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
  receiver: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
}

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

    // Get type from query params (received, sent, or all)
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'

    let receivedMatches: MatchWithRelations[] = []
    let sentMatches: MatchWithRelations[] = []

    // Fetch received connection requests (where user is the receiver)
    if (type === 'received' || type === 'all') {
      receivedMatches = await prisma.match.findMany({
        where: {
          receiverId: user.id,
          status: 'PENDING'
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    }

    // Fetch sent connection requests (where user is the sender)
    if (type === 'sent' || type === 'all') {
      sentMatches = await prisma.match.findMany({
        where: {
          senderId: user.id,
          status: 'PENDING'
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    }

    return NextResponse.json({
      success: true,
      received: receivedMatches,
      sent: sentMatches,
      receivedCount: receivedMatches.length,
      sentCount: sentMatches.length
    })
  } catch (error) {
    console.error('Fetch connections error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
