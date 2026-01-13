import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import logger from '@/lib/logger'
import OpenAI from 'openai'

// Schema for request
const startSmartSchema = z.object({
  durationMinutes: z.number().min(1).max(60).default(5),
})

// Task templates for quick generation (fallback if AI fails)
// Based on user requirements: warm, low-pressure, focus on "just one" and "for the next X minutes"
const TASK_TEMPLATES: Record<string, string[]> = {
  Math: [
    'For the next 5 minutes: Open your math homework and complete just one problem.',
    'Just one problem from today\'s math homework. You don\'t need to rush.',
    'Pick one math problem you\'re stuck on. Work through it slowly.',
  ],
  Physics: [
    'For the next 5 minutes: Work on one physics problem from your homework.',
    'Just one problem. Draw the diagram first, then solve.',
    'Open your physics homework and complete just one small task.',
  ],
  Chemistry: [
    'For the next 5 minutes: Balance one chemical equation from your homework.',
    'Just one equation. Take your time.',
    'Pick one chemistry problem and work through it step by step.',
  ],
  Biology: [
    'For the next 5 minutes: Label one diagram from your notes.',
    'Just one concept. Read it and write it in your own words.',
    'Open your biology homework and complete just one small task.',
  ],
  'Computer Science': [
    'For the next 5 minutes: Write or fix just one function.',
    'Just one bug. Take your time to understand it.',
    'Open your coding assignment and complete just one small task.',
  ],
  English: [
    'For the next 5 minutes: Read one paragraph and write what it means.',
    'Just one paragraph. No pressure.',
    'Open your reading assignment and read just one page.',
  ],
  History: [
    'For the next 5 minutes: Summarize one event from today\'s reading.',
    'Just one event. Write 2-3 sentences.',
    'Open your history homework and complete just one small task.',
  ],
  default: [
    'For the next 5 minutes: Open your homework and complete just one small task.',
    'Just one. Pick the easiest thing on your to-do list.',
    'You don\'t need to rush. Just start with one thing.',
    'Open your assignment and do just one part of it.',
  ],
}

// Encouragement messages - warm, reassuring, low-pressure
const ENCOURAGEMENTS = [
  'I\'ll keep time. You just focus.',
  'No pressure. Just 5 minutes.',
  'You\'ve got this. One step at a time.',
  'Let\'s make progress together.',
  'I\'m here. Take your time.',
]

// Initialize OpenAI (optional - for personalized tasks)
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

/**
 * POST /api/focus/start-smart
 *
 * Analyzes user's profile and creates a focus session with a personalized task.
 * - Reads subjects from profile
 * - Considers skill level
 * - Generates ONE tiny, completable task
 * - No friction, no choices - just start
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const validation = startSmartSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { durationMinutes } = validation.data

    // Check for existing active session
    const existingSession = await prisma.focusSession.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        startedAt: true,
        durationMinutes: true,
      },
    })

    if (existingSession) {
      // Calculate if session has expired (time ran out)
      const startTime = new Date(existingSession.startedAt).getTime()
      const durationMs = existingSession.durationMinutes * 60 * 1000
      const elapsed = Date.now() - startTime
      const remainingMs = durationMs - elapsed

      // If session has expired (no time left), auto-complete it
      if (remainingMs <= 0) {
        await prisma.focusSession.update({
          where: { id: existingSession.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            actualMinutes: existingSession.durationMinutes,
          },
        })
        logger.info('Auto-completed expired focus session', {
          sessionId: existingSession.id,
          userId: user.id,
        })
      } else {
        // Session still has time - return conflict
        return NextResponse.json(
          { error: 'Active session exists', sessionId: existingSession.id },
          { status: 409 }
        )
      }
    }

    // Get user's profile to personalize the task
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: {
        subjects: true,
        skillLevel: true,
        goals: true,
        user: {
          select: { name: true }
        }
      },
    })

    // Determine subject and difficulty from profile
    const subjects = profile?.subjects || []
    const skillLevel = profile?.skillLevel || 'INTERMEDIATE'
    const userName = profile?.user?.name?.split(' ')[0] || 'there'

    // Pick a subject (random from user's subjects, or default)
    const subject = subjects.length > 0
      ? subjects[Math.floor(Math.random() * subjects.length)]
      : 'default'

    // Get difficulty based on skill level
    const difficulty = skillLevel === 'BEGINNER' ? 'easy'
      : skillLevel === 'ADVANCED' ? 'hard'
      : 'medium'

    // Generate the task
    let taskPrompt: string
    let encouragement: string

    // Try AI generation for more personalized task (if available)
    if (openai && subjects.length > 0) {
      try {
        const aiPrompt = `Generate ONE tiny study task for a ${skillLevel.toLowerCase()} level student studying ${subject}.
The task must be:
- Completable in exactly 5 minutes or less
- SAME concept as their current homework (not new material)
- Very specific (not vague like "study chapter 3")
- Feel achievable and low-pressure
- Use warm, reassuring language
- Include phrases like "For the next 5 minutes:" or "Just one" or "You don't need to rush"
- Written in second person

Examples of PERFECT tasks:
- "For the next 5 minutes: Open your ${subject} homework and complete just one problem."
- "Just one ${subject} problem from today's homework. You don't need to rush."
- "Pick one problem you're stuck on. Work through it slowly."

Respond with ONLY the task text, nothing else. Keep it warm and under 20 words.`

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: aiPrompt }],
          temperature: 0.8,
          max_tokens: 50,
        })

        const aiTask = completion.choices[0]?.message?.content?.trim()
        if (aiTask && aiTask.length > 5 && aiTask.length < 100) {
          taskPrompt = aiTask
        } else {
          throw new Error('Invalid AI response')
        }
      } catch {
        // Fallback to templates
        const templates = TASK_TEMPLATES[subject] || TASK_TEMPLATES.default
        taskPrompt = templates[Math.floor(Math.random() * templates.length)]
      }
    } else {
      // Use templates
      const templates = TASK_TEMPLATES[subject] || TASK_TEMPLATES.default
      taskPrompt = templates[Math.floor(Math.random() * templates.length)]
    }

    // Pick encouragement
    encouragement = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]

    // Create the focus session
    const session = await prisma.focusSession.create({
      data: {
        userId: user.id,
        durationMinutes,
        status: 'ACTIVE',
        startedAt: new Date(),
        mode: 'ai_guided',
        taskSubject: subject === 'default' ? 'General' : subject,
        taskPrompt,
        taskDifficulty: difficulty,
      },
      select: {
        id: true,
        durationMinutes: true,
        startedAt: true,
        status: true,
        mode: true,
        taskSubject: true,
        taskPrompt: true,
        taskDifficulty: true,
      },
    })

    logger.info('Smart focus session started', {
      sessionId: session.id,
      userId: user.id,
      subject: session.taskSubject,
      difficulty,
    })

    return NextResponse.json({
      success: true,
      session: {
        ...session,
        encouragement,
        userName,
      },
    })
  } catch (error) {
    logger.error('Error starting smart focus session', { error })
    return NextResponse.json(
      { error: 'Failed to start focus session' },
      { status: 500 }
    )
  }
}
