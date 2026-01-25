/**
 * Study Guide Generation API
 *
 * Generates a personalized, professional study guide using AI
 * based on the subject and user's last session data.
 *
 * PERFORMANCE:
 * - Uses gpt-4o-mini for efficiency
 * - Caches generated guides for 10 minutes per subject
 * - Lightweight prompt for fast response
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { cacheGet, CacheTTL } from '@/lib/redis'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import OpenAI from 'openai'

// SCALE: OpenAI request timeout (30 seconds) for 2000-3000 concurrent users
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,
  maxRetries: 2,
})

interface GuideRequest {
  subject: string
  suggestionType: 'review_needed' | 'continue' | 'new_topic' | 'streak'
}

interface SessionContext {
  daysSinceLastSession: number
  lastSessionCompleted: boolean
  lastSessionDuration: number | null
  totalSessionsOnSubject: number
}

/**
 * Generate a professional study guide prompt
 */
function buildPrompt(subject: string, suggestionType: string, context: SessionContext): string {
  const typeContext = {
    review_needed: `The student hasn't studied "${subject}" in ${context.daysSinceLastSession} days and needs to review.`,
    continue: `The student recently studied "${subject}" and wants to continue their progress.`,
    new_topic: `The student is starting to study "${subject}" for the first time.`,
    streak: `The student is on a study streak and wants to maintain momentum with "${subject}".`,
  }

  const sessionStatus = context.lastSessionCompleted
    ? `Their last session was completed successfully${context.lastSessionDuration ? ` (${context.lastSessionDuration} minutes)` : ''}.`
    : `Their last session was cut short or abandoned.`

  return `You are a professional academic mentor. Generate a brief, personalized study guide for a student.

Context:
- Subject: ${subject}
- Situation: ${typeContext[suggestionType as keyof typeof typeContext] || typeContext.continue}
- ${sessionStatus}
- Total sessions on this subject: ${context.totalSessionsOnSubject}

Requirements:
- Write 3-4 sentences maximum
- Be professional but encouraging
- Give specific, actionable advice
- Reference their previous session context naturally
- Do NOT use bullet points or numbered lists
- Do NOT use phrases like "Here's your guide" or "I recommend"
- Write in second person ("You should...", "Start by...", "Focus on...")
- End with a motivating statement

Example tone:
"Given the gap since your last session, a quick 5-minute review of key concepts will help solidify your foundation before moving forward. Focus on understanding the underlying principles rather than memorization. Your consistent effort is building real expertise."

Generate the study guide now:`
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit - AI generation is expensive
    const rateLimitResult = await rateLimit(request, RateLimitPresets.ai)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before generating more guides.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: GuideRequest = await request.json()
    const { subject, suggestionType } = body

    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    }

    // Cache key based on user + subject + type
    const cacheKey = `study_guide:${user.id}:${subject.toLowerCase().replace(/\s+/g, '_')}:${suggestionType}`

    // Try to get from cache first
    const cached = await cacheGet<{ guide: string }>(
      cacheKey,
      async () => {
        // Get user's session context for this subject
        const recentSessions = await prisma.focusSession.findMany({
          where: {
            userId: user.id,
            OR: [
              { label: { contains: subject, mode: 'insensitive' } },
              { taskSubject: { contains: subject, mode: 'insensitive' } },
            ],
          },
          select: {
            status: true,
            actualMinutes: true,
            completedAt: true,
          },
          orderBy: { completedAt: 'desc' },
          take: 10,
        })

        // Build context
        const now = new Date()
        const lastSession = recentSessions[0]
        const daysSinceLastSession = lastSession?.completedAt
          ? Math.floor((now.getTime() - new Date(lastSession.completedAt).getTime()) / (24 * 60 * 60 * 1000))
          : 0

        const context: SessionContext = {
          daysSinceLastSession,
          lastSessionCompleted: lastSession?.status === 'COMPLETED',
          lastSessionDuration: lastSession?.actualMinutes || null,
          totalSessionsOnSubject: recentSessions.length,
        }

        // Generate with AI
        const prompt = buildPrompt(subject, suggestionType, context)

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a professional academic mentor who provides concise, actionable study advice.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 200,
          temperature: 0.7,
        })

        const guide = completion.choices[0]?.message?.content?.trim() ||
          `Focus on building a strong foundation in ${subject}. Start with the fundamentals and work your way up. Consistent practice will lead to mastery.`

        return { guide }
      },
      600 // Cache for 10 minutes
    )

    return NextResponse.json({
      success: true,
      guide: cached.guide,
      subject,
    })
  } catch (error) {
    console.error('[Study Guide API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate study guide' },
      { status: 500 }
    )
  }
}
