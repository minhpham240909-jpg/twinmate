import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET /api/posts/[postId]/comments/[commentId]/replies - Get replies for a comment
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId, commentId } = await params

    // OPTIMIZATION: Fetch replies and partner connections in parallel
    const [replies, partnerConnections] = await Promise.all([
      prisma.postComment.findMany({
        where: {
          postId,
          parentId: commentId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              presence: {
                select: {
                  status: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),
      // Get user's partner connections
      prisma.match.findMany({
        where: {
          OR: [
            { senderId: user.id, status: 'ACCEPTED' },
            { receiverId: user.id, status: 'ACCEPTED' },
          ],
        },
        select: {
          senderId: true,
          receiverId: true,
        },
      }),
    ])

    const partnerIds = new Set(partnerConnections.map(match =>
      match.senderId === user.id ? match.receiverId : match.senderId
    ))

    // Add onlineStatus and partner status to reply authors
    const repliesWithStatus = replies.map((reply: any) => ({
      ...reply,
      user: {
        ...reply.user,
        onlineStatus: partnerIds.has(reply.user.id) ? reply.user.presence?.status : null,
        isPartner: partnerIds.has(reply.user.id),
      },
    }))

    return NextResponse.json({ replies: repliesWithStatus })
  } catch (error) {
    console.error('Error fetching replies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch replies' },
      { status: 500 }
    )
  }
}
