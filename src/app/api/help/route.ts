import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'

// Validation schema
const helpMessageSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000, 'Message too long'),
  category: z.enum(['bug', 'feature', 'account', 'billing', 'other']).optional(),
})

/**
 * POST /api/help - Submit a help/support message
 * No authentication required - anyone can submit
 * Uses Redis-based rate limiting for production scalability
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 5 requests per hour using Redis (production-ready)
    const rateLimitResult = await rateLimit(request, {
      max: 5,
      windowMs: 60 * 60 * 1000, // 1 hour
      keyPrefix: 'help',
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Get IP for logging
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'unknown'

    // Parse and validate body
    const body = await request.json()
    const validation = helpMessageSchema.safeParse(body)

    if (!validation.success) {
      const firstError = validation.error.issues[0]
      return NextResponse.json(
        { error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { name, email, subject, message, category } = validation.data

    // Try to get authenticated user (optional)
    let userId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id || null
    } catch {
      // User not authenticated, continue without userId
    }

    // Get user agent
    const userAgent = request.headers.get('user-agent') || null

    // Create help message
    const helpMessage = await prisma.helpMessage.create({
      data: {
        userId,
        name,
        email,
        subject,
        message,
        category,
        ipAddress: ip !== 'unknown' ? ip : null,
        userAgent,
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Your message has been submitted. We\'ll get back to you soon.',
        id: helpMessage.id,
      },
      { status: 201, headers: rateLimitResult.headers }
    )
  } catch (error) {
    console.error('Error submitting help message:', error)
    return NextResponse.json(
      { error: 'Failed to submit message. Please try again.' },
      { status: 500 }
    )
  }
}
