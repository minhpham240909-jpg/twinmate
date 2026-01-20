/**
 * AI Explain API - Study Materials Analysis
 *
 * Purpose: Analyze uploaded content (screenshots, PDFs, text) and provide
 * educational explanations. NEVER gives direct homework answers.
 *
 * Features:
 * - Image analysis (screenshots, photos of textbooks/notes)
 * - Text analysis (pasted content)
 * - Multiple explanation modes: Explain, Break Down, Quiz Me, Connect to Plan
 * - Anti-cheat: Detects and refuses homework answer requests
 *
 * Performance:
 * - No database writes (stateless)
 * - Single API call to OpenAI
 * - Auth check only (no N+1)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import {
  analyzeHomeworkIntent,
  getHomeworkGuardPrompt,
  detectTestContent,
} from '@/lib/ai/homework-guard'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Types
type ExplainMode = 'explain' | 'breakdown' | 'quiz' | 'connect'

interface ExplainRequest {
  mode: ExplainMode
  content: string // Text content or description of what they're studying
  imageBase64?: string // Base64 encoded image (screenshot, photo)
  imageType?: string // MIME type: 'image/png', 'image/jpeg', etc.
  studyPlanContext?: {
    subject: string
    currentStep?: string
    steps?: Array<{ title: string; description: string }>
  }
}

// System prompts for each mode
const MODE_PROMPTS: Record<ExplainMode, string> = {
  explain: `You are a patient and encouraging tutor helping a student understand a concept.

Your role is to EXPLAIN, not to give direct answers.

Guidelines:
1. Start with a brief overview of what this content is about
2. Explain the key concepts in simple, clear language
3. Use analogies and real-world examples when helpful
4. If there are formulas or steps, explain WHY they work, not just WHAT they are
5. Break complex ideas into digestible pieces
6. End with a summary of the main takeaways

IMPORTANT: If this appears to be homework, a test, or an assignment:
- DO NOT provide the direct answer
- Instead, explain the underlying concept
- Guide the student toward understanding
- Ask what specific part confuses them`,

  breakdown: `You are an expert at breaking down complex topics into simple, digestible steps.

Your role is to BREAK DOWN the content step by step.

Guidelines:
1. Identify the main topic or problem
2. List out each component or step clearly (use numbered lists)
3. Explain each step in simple terms
4. Show how the steps connect to each other
5. Highlight any prerequisites or foundational concepts needed
6. Use visual descriptions (e.g., "Think of it like a ladder where...")

IMPORTANT: If this is a problem to solve:
- Break down the APPROACH, not the solution
- Explain the TYPE of problem and general strategy
- DO NOT solve it for them
- Guide them to solve it themselves`,

  quiz: `You are an engaging quiz master creating practice questions to test understanding.

Your role is to create QUIZ questions based on the content.

Guidelines:
1. Generate 3-4 questions of varying difficulty
2. Mix question types: conceptual, application, and "why" questions
3. For each question, provide a helpful hint (but not the answer)
4. Questions should test UNDERSTANDING, not just memorization
5. After listing questions, offer to check their answers

Format:
Q1: [Question]
💡 Hint: [Small hint to guide thinking]

Q2: [Question]
💡 Hint: [Small hint]

...

Ready to check your answers? Just share them with me!`,

  connect: `You are helping a student connect new material to their existing study plan.

Your role is to show how this content CONNECTS to their learning goals.

Guidelines:
1. Identify what concept or topic this content covers
2. Explain how it relates to their current study plan/subject
3. Show prerequisite knowledge needed
4. Suggest how mastering this helps with their overall goals
5. Recommend what to study next based on this content
6. Keep it encouraging and focused on progress`,
}

export async function POST(request: NextRequest) {
  try {
    // Auth check (single query, no N+1)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: ExplainRequest = await request.json()
    const { mode, content, imageBase64, imageType, studyPlanContext } = body

    // Validate mode
    if (!mode || !['explain', 'breakdown', 'quiz', 'connect'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be: explain, breakdown, quiz, or connect' },
        { status: 400 }
      )
    }

    // Validate content
    if (!content && !imageBase64) {
      return NextResponse.json(
        { error: 'Either content text or image is required' },
        { status: 400 }
      )
    }

    // Analyze for homework answer requests (anti-cheat)
    const homeworkAnalysis = analyzeHomeworkIntent(content || '')
    const isTestContent = content ? detectTestContent(content) : false

    // Build system prompt
    let systemPrompt = MODE_PROMPTS[mode]

    // Add homework guard if needed
    const homeworkGuardPrompt = getHomeworkGuardPrompt(homeworkAnalysis)
    if (homeworkGuardPrompt) {
      systemPrompt = homeworkGuardPrompt + '\n\n' + systemPrompt
    }

    // Add test content warning if detected
    if (isTestContent && !homeworkAnalysis.isHomeworkAnswerRequest) {
      systemPrompt +=
        '\n\nNote: This appears to be from a test or assignment. Focus on helping the student UNDERSTAND the concept, not on giving the answer.'
    }

    // Add study plan context if available
    if (studyPlanContext && mode === 'connect') {
      systemPrompt += `\n\nStudent's Study Plan Context:
Subject: ${studyPlanContext.subject}
${studyPlanContext.currentStep ? `Current Step: ${studyPlanContext.currentStep}` : ''}
${
  studyPlanContext.steps
    ? `Plan Overview: ${studyPlanContext.steps.map((s) => s.title).join(' → ')}`
    : ''
}`
    }

    // Build messages for OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ]

    // Build user message content
    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []

    // Add text content
    if (content) {
      userContent.push({
        type: 'text',
        text: content,
      })
    }

    // Add image if provided
    if (imageBase64 && imageType) {
      // Validate image type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(imageType)) {
        return NextResponse.json(
          { error: 'Invalid image type. Supported: PNG, JPEG, GIF, WebP' },
          { status: 400 }
        )
      }

      // Validate image size (rough estimate: base64 is ~33% larger than original)
      // Limit to ~10MB original = ~13MB base64
      if (imageBase64.length > 13 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Image too large. Maximum size is 10MB' },
          { status: 400 }
        )
      }

      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${imageType};base64,${imageBase64}`,
          detail: 'high', // High detail for better text recognition
        },
      })

      // If no text content, add a prompt for the image
      if (!content) {
        userContent.push({
          type: 'text',
          text: `Please analyze this image and ${mode === 'explain' ? 'explain the concepts shown' : mode === 'breakdown' ? 'break down what is shown step by step' : mode === 'quiz' ? 'create quiz questions based on this content' : 'help me understand how this connects to my studies'}.`,
        })
      }
    }

    messages.push({
      role: 'user',
      content: userContent,
    })

    // Call OpenAI (single API call)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Using GPT-4o for vision capabilities
      messages,
      max_tokens: 1500,
      temperature: 0.7,
    })

    const responseText =
      response.choices[0]?.message?.content ||
      "I couldn't analyze that content. Could you try again with a clearer image or more context?"

    // Add a helpful note if homework was detected
    let finalResponse = responseText
    if (homeworkAnalysis.isHomeworkAnswerRequest && homeworkAnalysis.confidence === 'high') {
      finalResponse +=
        '\n\n💡 *Remember: Understanding the concept will help you solve similar problems in the future!*'
    }

    return NextResponse.json({
      success: true,
      response: finalResponse,
      mode,
      metadata: {
        hasImage: !!imageBase64,
        contentLength: content?.length || 0,
        isTestContent,
        homeworkDetected: homeworkAnalysis.isHomeworkAnswerRequest,
      },
    })
  } catch (error) {
    console.error('[AI Explain API] Error:', error)

    // Check for specific errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          {
            error: 'AI service not configured',
            response: 'The AI assistant is not available right now. Please try again later.',
          },
          { status: 500 }
        )
      }
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          {
            error: 'Rate limited',
            response: "I'm getting a lot of requests right now. Please wait a moment and try again.",
          },
          { status: 429 }
        )
      }
    }

    return NextResponse.json({ error: 'Failed to analyze content' }, { status: 500 })
  }
}
