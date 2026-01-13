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
const TASK_TEMPLATES: Record<string, string[]> = {
  Math: [
    'Solve 1 problem from your homework. Just one.',
    'Review one formula and write it from memory.',
    'Work through one example problem step by step.',
  ],
  Physics: [
    'Solve one physics problem completely.',
    'Draw a diagram for one concept you\'re learning.',
    'Review one formula and explain what each variable means.',
  ],
  Chemistry: [
    'Balance one chemical equation.',
    'Draw one molecular structure from memory.',
    'Review the properties of one element.',
  ],
  Biology: [
    'Label one diagram from memory.',
    'Explain one biological process in your own words.',
    'Review one system or cycle.',
  ],
  'Computer Science': [
    'Write or fix one function.',
    'Debug one small piece of code.',
    'Trace through one algorithm step by step.',
  ],
  English: [
    'Read one paragraph and write a 1-sentence summary.',
    'Find and fix one grammar mistake in your writing.',
    'Write 3 sentences using a new vocabulary word.',
  ],
  History: [
    'Summarize one historical event in 2-3 sentences.',
    'Create a mini timeline of one topic.',
    'Explain cause and effect of one event.',
  ],
  default: [
    'Open your homework and complete just one task.',
    'Review your notes for 5 minutes.',
    'Organize what\'s due tomorrow.',
    'Read one page of your study material.',
  ],
}

// Encouragement messages
const ENCOURAGEMENTS = [
  'You got this. 5 minutes of focus.',
  'Let\'s make these 5 minutes count.',
  'One small step. Let\'s go.',
  'Focus mode: activated.',
  'Just you and the task. Let\'s do it.',
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
      select: { id: true },
    })

    if (existingSession) {
      return NextResponse.json(
        { error: 'Active session exists', sessionId: existingSession.id },
        { status: 409 }
      )
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
- Very specific (not vague like "study chapter 3")
- Feel achievable and complete when done
- Written in second person ("Solve...", "Write...", "Review...")

Examples of good tasks:
- "Solve 1 problem from your homework. Just one."
- "Write a 1-sentence summary of the last paragraph you read."
- "Fix or write one function - no more."

Respond with ONLY the task text, nothing else. Keep it under 15 words.`

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
