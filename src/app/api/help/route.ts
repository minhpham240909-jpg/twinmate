import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Rate limiting - max 5 messages per hour per IP
// Prevents spam and abuse while allowing legitimate users to submit multiple issues
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX = 5

// In-memory rate limit store
// NOTE: For production with multiple server instances, use Redis instead:
// import { Redis } from '@upstash/redis' or similar
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const record = rateLimitStore.get(ip)

  if (!record || now > record.resetAt) {
    // Reset or create new record
    const resetAt = now + RATE_LIMIT_WINDOW
    rateLimitStore.set(ip, { count: 1, resetAt })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt }
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt }
  }

  record.count++
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count, resetAt: record.resetAt }
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of rateLimitStore) {
    if (now > record.resetAt) {
      rateLimitStore.delete(ip)
    }
  }
}, 60 * 1000) // Clean every minute

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
 */
export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'unknown'

    // Check rate limit
    const rateLimit = checkRateLimit(ip)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
          }
        }
      )
    }

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
      {
        status: 201,
        headers: {
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
        }
      }
    )
  } catch (error) {
    console.error('Error submitting help message:', error)
    return NextResponse.json(
      { error: 'Failed to submit message. Please try again.' },
      { status: 500 }
    )
  }
}
