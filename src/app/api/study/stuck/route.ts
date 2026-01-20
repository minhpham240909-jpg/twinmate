/**
 * AI Study Guidance API - "I'm Stuck" Flow
 *
 * Multi-turn conversation for intelligent study guidance:
 * 1. User provides subject → AI asks diagnostic questions
 * 2. User answers questions → AI generates specific roadmap
 *
 * Features:
 * - Counselor-like questioning (1-3 smart questions)
 * - Personalized roadmap based on conversation
 * - Session-only state (no database persistence for roadmap progress)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Types
interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Question {
  id: string
  text: string
  type: 'single-select' | 'text'
  options?: string[]
}

interface StudyPlanStep {
  id: string
  order: number
  duration: number
  title: string
  description: string
  tips?: string[]
}

interface StudyPlan {
  id: string
  subject: string
  totalMinutes: number
  encouragement: string
  steps: StudyPlanStep[]
}

// Request schema
interface StuckRequest {
  action: 'ask' | 'generate'
  subject: string
  messages?: Message[]
}

export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: StuckRequest = await request.json()
    const { action, subject, messages = [] } = body

    if (!subject || typeof subject !== 'string') {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    }

    // Get user's study preferences
    const userProfile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: {
        skillLevel: true,
        studyStyle: true,
      },
    })

    const userContext = [
      userProfile?.skillLevel ? `Student level: ${userProfile.skillLevel}` : '',
      userProfile?.studyStyle ? `Study style: ${userProfile.studyStyle}` : '',
    ].filter(Boolean).join('\n')

    if (action === 'ask') {
      // Generate diagnostic questions
      const questions = await generateDiagnosticQuestions(subject, userContext, messages)

      // Determine if we can generate a plan (after 1-3 exchanges)
      const canGenerate = messages.length >= 2 // At least one Q&A exchange

      return NextResponse.json({
        success: true,
        questions,
        canGenerate,
      })
    } else if (action === 'generate') {
      // Generate personalized study plan
      const plan = await generateStudyPlan(subject, userContext, messages)

      return NextResponse.json({
        success: true,
        plan,
      })
    } else {
      // Legacy support: direct plan generation (no questions)
      const plan = await generateStudyPlan(subject, userContext, [])

      return NextResponse.json({
        success: true,
        plan,
      })
    }
  } catch (error) {
    console.error('[Study Stuck API] Error:', error)

    // Return fallback plan on any error
    const fallbackPlan: StudyPlan = {
      id: uuidv4(),
      subject: 'Your topic',
      totalMinutes: 25,
      encouragement: "You've got this! Let's work through it step by step.",
      steps: [
        {
          id: uuidv4(),
          order: 1,
          duration: 5,
          title: 'Review the basics',
          description: 'Look over the key concepts and definitions you need',
        },
        {
          id: uuidv4(),
          order: 2,
          duration: 10,
          title: 'Practice with examples',
          description: 'Work through 2-3 practice problems step by step',
        },
        {
          id: uuidv4(),
          order: 3,
          duration: 10,
          title: 'Test your understanding',
          description: 'Explain the concept in your own words or solve a new problem',
        },
      ],
    }

    return NextResponse.json({
      success: true,
      plan: fallbackPlan,
    })
  }
}

/**
 * Generate diagnostic questions like a counselor
 * Smart, targeted questions to understand the student's specific situation
 * Each question digs deeper into specifics based on previous answers
 */
async function generateDiagnosticQuestions(
  subject: string,
  userContext: string,
  previousMessages: Message[]
): Promise<Question[]> {
  const conversationHistory = previousMessages.map(m =>
    `${m.role === 'user' ? 'Student' : 'Counselor'}: ${m.content}`
  ).join('\n')

  const questionNumber = Math.floor(previousMessages.length / 2) + 1

  // Define question focus based on the conversation stage
  let questionFocus = ''
  if (questionNumber === 1) {
    questionFocus = `FIRST QUESTION: Ask what GENERAL AREA or TOPIC within "${subject}" they're struggling with.
    Example: "Which part of ${subject} is giving you the most trouble?"
    Options should be main topics/units within the subject.`
  } else if (questionNumber === 2) {
    questionFocus = `SECOND QUESTION: Based on their previous answer, dig DEEPER into specifics.
    Ask about the SPECIFIC concept, problem type, or skill within that area.
    Example: If they said "derivatives", ask "What specifically about derivatives - the rules, applications, or understanding what they represent?"
    Options should be specific sub-topics or common pain points.`
  } else {
    questionFocus = `THIRD QUESTION: Get the MOST SPECIFIC detail about their struggle.
    Ask what exactly confuses them or what they've tried.
    Example: "When you try to solve these problems, where do you get stuck - setting up the problem, applying the formula, or knowing when to use which approach?"
    Options should be actionable insights about their learning gap.`
  }

  const systemPrompt = `You are an experienced academic counselor helping a student who is stuck on "${subject}".
Your job is to ask 1 smart, specific question that DIGS DEEPER with each exchange.

${questionFocus}

Rules:
- Ask ONE targeted question that progressively gets more specific
- Question ${questionNumber} of maximum 3 - each question should build on the last
- If this is question 2 or 3, REFERENCE their previous answer and ask for MORE DETAIL
- Provide 3-4 quick-select options that are SPECIFIC to their situation (not generic)
- The last option can be "Something else" or similar
- Keep the question conversational, supportive, and encouraging

${userContext ? `Context:\n${userContext}` : ''}
${conversationHistory ? `Previous conversation:\n${conversationHistory}` : ''}

Respond in this exact JSON format:
{
  "question": "Your specific follow-up question here",
  "options": ["Specific option 1", "Specific option 2", "Specific option 3", "Something else"]
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `The student is stuck on: "${subject}". Ask a diagnostic question.` },
      ],
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content || ''
    const parsed = JSON.parse(responseText)

    return [{
      id: uuidv4(),
      text: parsed.question || `What specific part of ${subject} is giving you trouble?`,
      type: 'single-select',
      options: parsed.options || [
        'Understanding the concepts',
        'Applying what I learned',
        'Practice problems',
        'Something else'
      ],
    }]
  } catch (error) {
    console.error('[Study Stuck API] Error generating questions:', error)

    // Fallback questions that get progressively more specific
    if (questionNumber === 1) {
      return [{
        id: uuidv4(),
        text: `Which topic or unit within ${subject} is giving you the most trouble?`,
        type: 'single-select',
        options: [
          'The foundational concepts',
          'A specific chapter or unit',
          'Problem-solving techniques',
          'Something else'
        ],
      }]
    } else if (questionNumber === 2) {
      // Get the last user answer to reference
      const lastAnswer = previousMessages.length > 0
        ? previousMessages[previousMessages.length - 1]?.content
        : 'that topic'
      return [{
        id: uuidv4(),
        text: `Within "${lastAnswer}", what specifically confuses you the most?`,
        type: 'single-select',
        options: [
          'The core definitions or formulas',
          'When to apply different methods',
          'Understanding the examples',
          'Something else'
        ],
      }]
    } else {
      return [{
        id: uuidv4(),
        text: `When you try to work on this, where exactly do you get stuck?`,
        type: 'single-select',
        options: [
          'Setting up the problem correctly',
          'Choosing the right approach',
          'Finishing the solution steps',
          'Something else'
        ],
      }]
    }
  }
}

/**
 * Generate a personalized study plan based on the conversation
 * Specific, flexible roadmap - not template-based
 */
async function generateStudyPlan(
  subject: string,
  userContext: string,
  messages: Message[]
): Promise<StudyPlan> {
  const conversationHistory = messages.map(m =>
    `${m.role === 'user' ? 'Student' : 'Counselor'}: ${m.content}`
  ).join('\n')

  const systemPrompt = `You are an expert tutor creating a personalized study plan.
${conversationHistory ? `Based on this conversation, you understand exactly where the student is stuck:\n${conversationHistory}\n\n` : ''}
${userContext ? `Student context:\n${userContext}\n\n` : ''}

Create a SPECIFIC, PERSONALIZED study roadmap for "${subject}".

Rules:
1. Create 3-5 steps based on what they need
2. Each step must be concrete and actionable - tell them EXACTLY what to do
3. Adapt to their specific situation - NO generic templates
4. Steps should build on each other logically
5. Total time: 20-40 minutes
6. Include specific tips when helpful
7. Write an encouraging message that acknowledges their specific struggle

DO NOT use generic patterns like "Review → Practice → Apply".
Instead, respond to their specific needs based on the conversation.

Respond in this exact JSON format:
{
  "totalMinutes": 30,
  "encouragement": "A personalized encouraging message based on their situation",
  "steps": [
    {
      "order": 1,
      "duration": 8,
      "title": "Specific step title",
      "description": "Detailed description of exactly what to do",
      "tips": ["Optional specific tip 1", "Optional tip 2"]
    }
  ]
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a study plan for: "${subject}"` },
      ],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content || ''
    const parsed = JSON.parse(responseText)

    // Validate and transform response
    const totalMinutes = Math.min(Math.max(parsed.totalMinutes || 25, 15), 45)

    const steps: StudyPlanStep[] = (parsed.steps || []).slice(0, 6).map((step: {
      order?: number
      duration?: number
      title?: string
      description?: string
      tips?: string[]
    }, index: number) => ({
      id: uuidv4(),
      order: step.order || index + 1,
      duration: Math.min(Math.max(step.duration || 5, 3), 15),
      title: step.title || `Step ${index + 1}`,
      description: step.description || 'Work on this part',
      tips: step.tips?.slice(0, 3),
    }))

    // Ensure we have at least 3 steps
    while (steps.length < 3) {
      steps.push({
        id: uuidv4(),
        order: steps.length + 1,
        duration: 5,
        title: steps.length === 0 ? 'Review key concepts' :
               steps.length === 1 ? 'Practice with examples' : 'Test your understanding',
        description: 'Focus on building your understanding step by step',
      })
    }

    return {
      id: uuidv4(),
      subject,
      totalMinutes,
      encouragement: parsed.encouragement || "You've got this! Taking it step by step is the way to go.",
      steps,
    }
  } catch (error) {
    console.error('[Study Stuck API] Error generating plan:', error)

    // Fallback plan
    return {
      id: uuidv4(),
      subject,
      totalMinutes: 25,
      encouragement: "Let's break this down into manageable steps. You can do this!",
      steps: [
        {
          id: uuidv4(),
          order: 1,
          duration: 5,
          title: 'Identify the gap',
          description: `Look at ${subject} and write down specifically what confuses you`,
        },
        {
          id: uuidv4(),
          order: 2,
          duration: 10,
          title: 'Build understanding',
          description: 'Read through one example carefully, noting each step',
        },
        {
          id: uuidv4(),
          order: 3,
          duration: 10,
          title: 'Apply and verify',
          description: 'Try a similar problem on your own, checking your work',
        },
      ],
    }
  }
}
