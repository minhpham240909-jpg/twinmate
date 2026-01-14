import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import logger from '@/lib/logger'
import OpenAI from 'openai'

// Schema for request
const startSmartSchema = z.object({
  durationMinutes: z.number().min(1).max(60).default(10),
  userTask: z.string().min(1).max(500).optional(),
})

// Initialize OpenAI
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

/**
 * Generate a smart, specific task - either from user input or intelligently generated
 * Super flexible, no rigid patterns, adapts naturally
 */
async function generateSmartTask(
  userTask: string | undefined,
  durationMinutes: number,
  userContext?: { subjects?: string[]; recentTasks?: string[] }
): Promise<string> {
  if (!openai) {
    return userTask
      ? generateFallbackFromUserTask(userTask, durationMinutes)
      : generateFallbackQuickTask(durationMinutes)
  }

  try {
    // Different prompts for user-provided vs auto-generated tasks
    const prompt = userTask
      ? generateUserTaskPrompt(userTask, durationMinutes)
      : generateQuickStartPrompt(durationMinutes, userContext)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8, // Higher for more variety
      max_tokens: 120,
    })

    const aiTask = completion.choices[0]?.message?.content?.trim()
    if (aiTask && aiTask.length > 10 && aiTask.length < 350) {
      return aiTask
    }
  } catch (error) {
    logger.error('Error generating task with AI', { error })
  }

  // Fallback
  return userTask
    ? generateFallbackFromUserTask(userTask, durationMinutes)
    : generateFallbackQuickTask(durationMinutes)
}

/**
 * Prompt for when user specifies their task
 * AI breaks it into ONE specific, actionable step
 */
function generateUserTaskPrompt(userTask: string, durationMinutes: number): string {
  return `You are a smart study supervisor. A student wants to work on something for ${durationMinutes} minutes.

They said: "${userTask}"

Your job: Give them ONE specific, actionable instruction to start RIGHT NOW.

Be a supervisor who actually understands the work:
- Tell them EXACTLY where to start
- Be specific: page numbers, section names, first steps
- Use direct action verbs: Open, Write, Read, Find, Start, Go to
- Adapt naturally to what they're doing - no templates
- 2-3 sentences max, clear and direct

DON'T say:
- Generic stuff like "work on your task" or "complete one section"
- Motivational fluff like "you got this" or "take your time"
- Vague instructions that could apply to anything

Examples of GOOD responses:
- "Open your textbook to the chapter. Read the first 2 pages, then write down 3 key concepts in your own words."
- "Create a new document. Write your thesis statement first - one sentence that captures your main argument."
- "Open the file causing the bug. Add a console.log at line 1 of the function to see what data is coming in."

Now give ONE specific instruction for: "${userTask}"`
}

/**
 * Prompt for Quick Start (no user input)
 * AI generates a universally useful, engaging task
 */
function generateQuickStartPrompt(
  durationMinutes: number,
  userContext?: { subjects?: string[]; recentTasks?: string[] }
): string {
  const contextHint = userContext?.subjects?.length
    ? `\nThey study: ${userContext.subjects.join(', ')}`
    : ''

  return `You are a smart study coach. A student just wants to start a ${durationMinutes}-minute focus session. They didn't specify what to work on - they just want to get started.

${contextHint}

Generate ONE specific, actionable task that would be valuable for ANY student. Be creative and practical.

Rules:
- The task should feel relevant and useful, not random
- Be specific enough to actually do, but universal enough to work for anyone
- Direct action: Tell them exactly what to do first
- 2-3 sentences max
- Vary your suggestions - don't always say the same thing

Good examples:
- "Grab your most urgent assignment. Read the instructions carefully, then write down the first 3 things you need to do."
- "Pick one concept from your current class that confuses you. Write it at the top of a page, then explain it in your own words below."
- "Open your notes from today. Highlight the 3 most important points, then quiz yourself on them without looking."
- "Find your most overdue task. Break it into 3 small steps and complete just the first one."
- "Take your hardest problem set. Attempt the first problem - write down where you get stuck."
- "Open your calendar. Block out time for your biggest project this week, then write down what you'll do in that time."

Be creative. Generate a task now:`
}

/**
 * Fallback for user-provided tasks (no AI available)
 * Still specific and actionable
 */
function generateFallbackFromUserTask(userTask: string, durationMinutes: number): string {
  const task = userTask.toLowerCase()

  // Detect context and respond naturally
  if (task.includes('read') || task.includes('chapter') || task.includes('book')) {
    return `Open your reading. Read for ${Math.min(durationMinutes, 15)} minutes straight, then write down 3 things you learned.`
  }

  if (task.includes('write') || task.includes('essay') || task.includes('paper')) {
    return `Open your document. Start with the first sentence of the next paragraph you need to write. Don't edit, just write.`
  }

  if (task.includes('math') || task.includes('problem') || task.includes('calc')) {
    return `Open your assignment. Pick the first unsolved problem. Work through it step by step - write out every step.`
  }

  if (task.includes('code') || task.includes('program') || task.includes('bug')) {
    return `Open your code. Find the specific file or function you need to work on. Make one small change or fix.`
  }

  if (task.includes('study') || task.includes('exam') || task.includes('test')) {
    return `Get your study material. Pick one topic. Write down everything you know about it without looking.`
  }

  if (task.includes('homework') || task.includes('assignment')) {
    return `Open your assignment. Start with question 1. Complete it fully before moving on.`
  }

  // Default - still specific
  return `Start "${userTask}" now. Do the smallest first step. When done, write down what you accomplished.`
}

/**
 * Fallback for Quick Start (no AI, no user input)
 * Universally useful tasks
 */
function generateFallbackQuickTask(durationMinutes: number): string {
  const tasks = [
    `Grab your most pressing assignment. Read the instructions, then complete the first section only.`,
    `Pick one thing from your to-do list. Work on it for ${durationMinutes} minutes without switching.`,
    `Find your hardest current task. Break it into 3 steps and do just step 1.`,
    `Open your notes from today. Summarize the key points in your own words on a fresh page.`,
    `Choose one concept you're struggling with. Write an explanation as if teaching a friend.`,
    `Look at your upcoming deadlines. Pick the most urgent one and make progress on it now.`,
  ]

  return tasks[Math.floor(Math.random() * tasks.length)]
}

/**
 * POST /api/focus/start-smart
 *
 * Creates a focus session with smart task generation
 * - With userTask: AI breaks it into specific action
 * - Without userTask: AI generates universally useful task
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

    const { durationMinutes, userTask } = validation.data

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
      const startTime = new Date(existingSession.startedAt).getTime()
      const durationMs = existingSession.durationMinutes * 60 * 1000
      const elapsed = Date.now() - startTime
      const remainingMs = durationMs - elapsed

      if (remainingMs <= 0) {
        // Auto-complete expired session
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
        return NextResponse.json(
          { error: 'Active session exists', sessionId: existingSession.id },
          { status: 409 }
        )
      }
    }

    // Get user context for smarter task generation (optional)
    let userContext: { subjects?: string[]; recentTasks?: string[] } | undefined
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId: user.id },
        select: { subjects: true },
      })
      if (profile?.subjects) {
        userContext = { subjects: profile.subjects }
      }
    } catch {
      // Ignore - context is optional
    }

    // Generate smart task
    const taskLabel = userTask || 'Quick focus'
    const taskPrompt = await generateSmartTask(userTask, durationMinutes, userContext)

    // Create the focus session
    const session = await prisma.focusSession.create({
      data: {
        userId: user.id,
        durationMinutes,
        status: 'ACTIVE',
        startedAt: new Date(),
        mode: userTask ? 'ai_guided' : 'solo',
        label: taskLabel,
        taskSubject: taskLabel,
        taskPrompt,
        taskDifficulty: 'medium',
      },
      select: {
        id: true,
        durationMinutes: true,
        startedAt: true,
        status: true,
        mode: true,
        label: true,
        taskSubject: true,
        taskPrompt: true,
      },
    })

    logger.info('Focus session started', {
      sessionId: session.id,
      userId: user.id,
      task: taskLabel,
      duration: durationMinutes,
      hasUserTask: !!userTask,
    })

    return NextResponse.json({
      success: true,
      session,
    })
  } catch (error) {
    logger.error('Error starting focus session', { error })
    return NextResponse.json(
      { error: 'Failed to start focus session' },
      { status: 500 }
    )
  }
}
