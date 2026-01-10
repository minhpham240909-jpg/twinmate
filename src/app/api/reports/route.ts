import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { ReportType } from '@prisma/client'

// SECURITY: Content limits for report submissions
const MAX_DESCRIPTION_LENGTH = 2000 // Reasonable limit for report descriptions

// POST /api/reports - Create a new report
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
    const { contentType, contentId, reportedUserId, type, types, description } = body

    // Validate required fields
    if (!contentType || !contentId || (!type && !types)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: contentType, contentId, type' },
        { status: 400 }
      )
    }

    // Validate content type
    const validContentTypes = ['user', 'post', 'message', 'group', 'comment']
    if (!validContentTypes.includes(contentType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid content type' },
        { status: 400 }
      )
    }

    // Validate report type - handle both single type and multiple types (from frontend)
    const validTypes: ReportType[] = ['SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'FAKE_ACCOUNT', 'SCAM', 'HATE_SPEECH', 'VIOLENCE', 'OTHER']

    // Handle multiple types: use array if provided, otherwise parse comma-separated string
    let reportTypes: string[] = []
    if (Array.isArray(types) && types.length > 0) {
      reportTypes = types
    } else if (typeof type === 'string') {
      reportTypes = type.includes(',') ? type.split(',').map(t => t.trim()) : [type]
    }

    // Validate all types
    const invalidTypes = reportTypes.filter(t => !validTypes.includes(t as ReportType))
    if (reportTypes.length === 0 || invalidTypes.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid report type' },
        { status: 400 }
      )
    }

    // Use the first type as the primary type (database stores single type)
    // Store all types in description for reference
    const primaryType = reportTypes[0] as ReportType

    // SECURITY: Validate and sanitize description
    let sanitizedDescription: string | null = null
    if (description) {
      if (typeof description !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Description must be a string' },
          { status: 400 }
        )
      }
      const trimmedDescription = description.trim()
      if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
        return NextResponse.json(
          { success: false, error: `Description too long (max ${MAX_DESCRIPTION_LENGTH} characters)` },
          { status: 400 }
        )
      }
      sanitizedDescription = trimmedDescription.length > 0 ? trimmedDescription : null
    }

    // Get the database user
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { id: true },
    })

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Prevent self-reporting
    if (contentType === 'user' && contentId === dbUser.id) {
      return NextResponse.json(
        { success: false, error: 'You cannot report yourself' },
        { status: 400 }
      )
    }

    // Check if user already reported this content
    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: dbUser.id,
        contentType,
        contentId,
        status: 'PENDING',
      },
    })

    if (existingReport) {
      return NextResponse.json(
        { success: false, error: 'You have already reported this content' },
        { status: 400 }
      )
    }

    // Validate the content exists based on type
    let validContent = false
    let actualReportedUserId = reportedUserId

    switch (contentType) {
      case 'user':
        const reportedUser = await prisma.user.findUnique({
          where: { id: contentId },
          select: { id: true },
        })
        validContent = !!reportedUser
        actualReportedUserId = contentId
        break

      case 'post':
        const post = await prisma.post.findUnique({
          where: { id: contentId },
          select: { id: true, userId: true },
        })
        validContent = !!post
        actualReportedUserId = post?.userId
        break

      case 'message':
        // Messages can be DM or group messages (same model)
        const message = await prisma.message.findUnique({
          where: { id: contentId },
          select: { id: true, senderId: true },
        })
        if (message) {
          validContent = true
          actualReportedUserId = message.senderId
        }
        break

      case 'group':
        const group = await prisma.group.findUnique({
          where: { id: contentId },
          select: { id: true, ownerId: true },
        })
        validContent = !!group
        actualReportedUserId = group?.ownerId
        break

      case 'comment':
        const comment = await prisma.postComment.findUnique({
          where: { id: contentId },
          select: { id: true, userId: true },
        })
        validContent = !!comment
        actualReportedUserId = comment?.userId
        break

      default:
        validContent = false
    }

    if (!validContent) {
      return NextResponse.json(
        { success: false, error: 'Content not found' },
        { status: 404 }
      )
    }

    // Create the report (use sanitized description)
    // If multiple types were selected, append them to the description for reference
    let finalDescription = sanitizedDescription
    if (reportTypes.length > 1) {
      const additionalTypes = reportTypes.slice(1).join(', ')
      finalDescription = sanitizedDescription
        ? `${sanitizedDescription}\n\n[Additional report reasons: ${additionalTypes}]`
        : `[Report reasons: ${reportTypes.join(', ')}]`
    }

    const report = await prisma.report.create({
      data: {
        reporterId: dbUser.id,
        reportedUserId: actualReportedUserId,
        contentType,
        contentId,
        type: primaryType,
        description: finalDescription,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Report submitted successfully',
      reportId: report.id,
    })
  } catch (error) {
    console.error('Error creating report:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create report' },
      { status: 500 }
    )
  }
}

// GET /api/reports - Get user's own reports
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

    const reports = await prisma.report.findMany({
      where: { reporterId: dbUser.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        contentType: true,
        type: true,
        status: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      reports,
    })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}
