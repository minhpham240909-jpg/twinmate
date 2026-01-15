import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import logger from '@/lib/logger'
import OpenAI from 'openai'

// Schema for task generation request
const generateTaskSchema = z.object({
  subject: z.string().min(1).max(200),
  taskType: z.enum(['question', 'problem', 'writing', 'reading', 'coding', 'random']),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  customPrompt: z.string().max(500).optional(),
})

// Task type descriptions for AI prompt
const taskTypeDescriptions: Record<string, string> = {
  question: 'a thought-provoking question to answer',
  problem: 'a practice problem to solve',
  writing: 'a short writing exercise or prompt',
  reading: 'a reading comprehension or analysis task',
  coding: 'a coding challenge or algorithm problem',
  random: 'any appropriate study task',
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * POST /api/focus/generate-task
 * Generate an AI-powered focus task based on user's subject and preferences
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const validation = generateTaskSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { subject, taskType, difficulty, customPrompt } = validation.data

    // Build the AI prompt
    const taskDescription = taskTypeDescriptions[taskType] || taskTypeDescriptions.random
    const difficultyGuide = {
      easy: 'suitable for beginners, straightforward and achievable in 5 minutes',
      medium: 'moderately challenging, requires some thought but doable in 5 minutes',
      hard: 'challenging, requires deeper thinking but still completable in 5 minutes',
    }

    const systemPrompt = `You are a helpful study assistant that creates focused, engaging study tasks.
Your tasks should be:
- Completable within a 5-minute focus session
- Actionable and clear, but NOT overly specific
- Educational and relevant to the subject
- Appropriately challenging based on the difficulty level
- Encouraging and motivating

IMPORTANT - DO NOT:
- Reference specific page numbers, chapters, or textbook sections
- Mention specific timestamps or exact durations
- Reference external resources the user may not have
- Be too prescriptive about HOW to complete the task

INSTEAD:
- Focus on the concept or skill to practice
- Give a clear goal the user can work toward
- Keep it general enough to apply to any learning material
- Make it about understanding, not finding specific content

Example good task: "Explain the concept of photosynthesis in your own words, including the inputs and outputs of the process."
Example bad task: "Read pages 45-47 of your biology textbook and summarize the section on photosynthesis."

Always respond with a JSON object containing:
{
  "task": "The main task or question (actionable but not overly specific)",
  "hint": "A helpful hint or tip (optional)",
  "expectedOutput": "What a good answer would include (brief description)"
}`

    const userPrompt = customPrompt
      ? `Create a study task for the subject "${subject}".
User's custom request: ${customPrompt}
Difficulty: ${difficulty} - ${difficultyGuide[difficulty]}`
      : `Create ${taskDescription} for the subject "${subject}".
Difficulty: ${difficulty} - ${difficultyGuide[difficulty]}
Make it engaging and focused on practical learning.`

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from AI')
    }

    let taskData
    try {
      taskData = JSON.parse(responseText)
    } catch {
      // If JSON parsing fails, use the raw text as the task
      taskData = { task: responseText, hint: null, expectedOutput: null }
    }

    logger.info('AI task generated', {
      userId: user.id,
      subject,
      taskType,
      difficulty,
    })

    return NextResponse.json({
      success: true,
      task: {
        prompt: taskData.task,
        hint: taskData.hint || null,
        expectedOutput: taskData.expectedOutput || null,
        subject,
        taskType,
        difficulty,
      },
    })
  } catch (error) {
    logger.error('Error generating AI task', { error })

    // Check for specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate task. Please try again.' },
      { status: 500 }
    )
  }
}
