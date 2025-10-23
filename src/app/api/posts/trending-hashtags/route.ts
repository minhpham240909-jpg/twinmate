import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query params
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const days = parseInt(searchParams.get('days') || '7')

    // Calculate date threshold
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - days)

    // Get accepted partners for privacy filtering
    const matches = await prisma.match.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: user.id }, { receiverId: user.id }],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
    })

    const partnerIds = matches.map((match) =>
      match.senderId === user.id ? match.receiverId : match.senderId
    )
    partnerIds.push(user.id)

    // Fetch posts with hashtags
    const posts = await prisma.post.findMany({
      where: {
        createdAt: {
          gte: dateThreshold,
        },
        content: {
          contains: '#',
        },
        OR: [
          {
            user: {
              profile: {
                postPrivacy: 'PUBLIC',
              },
            },
          },
          {
            userId: { in: partnerIds },
            user: {
              profile: {
                postPrivacy: 'PARTNERS_ONLY',
              },
            },
          },
          {
            userId: user.id,
          },
        ],
      },
      select: {
        content: true,
      },
    })

    // Extract hashtags from posts
    const hashtagCounts: { [key: string]: number } = {}

    posts.forEach((post) => {
      // Regex to match hashtags: # followed by alphanumeric characters
      const hashtags = post.content.match(/#[\w]+/g)
      if (hashtags) {
        hashtags.forEach((hashtag) => {
          const normalized = hashtag.toLowerCase()
          hashtagCounts[normalized] = (hashtagCounts[normalized] || 0) + 1
        })
      }
    })

    // Convert to array and sort by count
    const trending = Object.entries(hashtagCounts)
      .map(([hashtag, count]) => ({
        hashtag,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    return NextResponse.json({
      trending,
      metadata: {
        days,
        total: trending.length,
        totalPosts: posts.length,
      },
    })
  } catch (error) {
    console.error('Error fetching trending hashtags:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trending hashtags' },
      { status: 500 }
    )
  }
}
