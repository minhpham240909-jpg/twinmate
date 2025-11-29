import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// POST /api/feedback - Submit feedback
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { rating, message, screenshots } = body

    // Validate required fields
    if (!rating || !message) {
      return NextResponse.json(
        { success: false, error: 'Rating and message are required' },
        { status: 400 }
      )
    }

    // Validate rating
    const ratingNum = parseInt(rating)
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { success: false, error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Validate message length
    if (message.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Message must be at least 10 characters' },
        { status: 400 }
      )
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Message must be less than 5000 characters' },
        { status: 400 }
      )
    }

    // Get the database user
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { id: true },
    })

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Rate limit: max 3 feedback per day
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const feedbackCount = await prisma.feedback.count({
      where: {
        userId: dbUser.id,
        createdAt: { gte: today },
      },
    })

    if (feedbackCount >= 3) {
      return NextResponse.json(
        { success: false, error: 'You can only submit 3 feedback per day' },
        { status: 429 }
      )
    }

    // Validate screenshots if provided
    let screenshotUrls: string[] = []
    if (screenshots && Array.isArray(screenshots)) {
      // Max 5 screenshots
      if (screenshots.length > 5) {
        return NextResponse.json(
          { success: false, error: 'Maximum 5 screenshots allowed' },
          { status: 400 }
        )
      }
      // Validate each URL
      screenshotUrls = screenshots.filter(
        (url: string) => typeof url === 'string' && url.startsWith('http')
      )
    }

    // Create the feedback
    const feedback = await prisma.feedback.create({
      data: {
        userId: dbUser.id,
        rating: ratingNum,
        message: message.trim(),
        screenshots: screenshotUrls,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully. Thank you for your input!',
      feedbackId: feedback.id,
    })
  } catch (error) {
    console.error('Error creating feedback:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}

// GET /api/feedback - Get user's own feedback history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { id: true },
    })

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const feedback = await prisma.feedback.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        rating: true,
        message: true,
        status: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      feedback,
    })
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feedback' },
      { status: 500 }
    )
  }
}
