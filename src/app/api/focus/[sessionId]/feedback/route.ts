import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import logger from '@/lib/logger'
import OpenAI from 'openai'

// Schema for feedback request
const feedbackSchema = z.object({
  userResponse: z.string().min(1).max(5000),
})

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * POST /api/focus/[sessionId]/feedback
 * Get AI feedback on user's response to the focus task
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const body = await request.json().catch(() => ({}))
    const validation = feedbackSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { userResponse } = validation.data

    // Get the session with task details
    const session = await prisma.focusSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
      select: {
        id: true,
        taskPrompt: true,
        taskSubject: true,
        taskType: true,
        taskDifficulty: true,
        mode: true,
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.mode !== 'ai_guided' || !session.taskPrompt) {
      return NextResponse.json(
        { error: 'This session does not have an AI task' },
        { status: 400 }
      )
    }

    // Generate AI feedback
    const systemPrompt = `You are a helpful, encouraging study tutor providing feedback on a student's work.
Your feedback should be:
- Constructive and positive
- Specific about what was done well
- Clear about areas for improvement (if any)
- Brief (2-3 sentences max)
- Encouraging to continue learning

Respond with a JSON object:
{
  "feedback": "Your constructive feedback here",
  "score": "excellent" | "good" | "needs_work",
  "encouragement": "A brief encouraging message"
}`

    const userPrompt = `Subject: ${session.taskSubject}
Task: ${session.taskPrompt}
Student's Response: ${userResponse}

Please provide brief, constructive feedback on this response.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from AI')
    }

    let feedbackData
    try {
      feedbackData = JSON.parse(responseText)
    } catch {
      feedbackData = {
        feedback: 'Great effort! Keep practicing to improve.',
        score: 'good',
        encouragement: 'Every session counts towards your learning journey!',
      }
    }

    // Save the response and feedback to the session
    await prisma.focusSession.update({
      where: { id: sessionId },
      data: {
        userResponse,
        aiFeedback: JSON.stringify(feedbackData),
        taskCompleted: true,
      },
    })

    logger.info('AI feedback generated', {
      sessionId,
      userId: user.id,
      score: feedbackData.score,
    })

    return NextResponse.json({
      success: true,
      feedback: feedbackData,
    })
  } catch (error) {
    logger.error('Error generating AI feedback', { error })

    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate feedback. Please try again.' },
      { status: 500 }
    )
  }
}
