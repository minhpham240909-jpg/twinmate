import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import OpenAI from 'openai'

// SCALE: OpenAI request timeout (30 seconds) for 2000-3000 concurrent users
const OPENAI_REQUEST_TIMEOUT = 30000

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: OPENAI_REQUEST_TIMEOUT,
  maxRetries: 2,
})

interface GeneratedCard {
  front: string
  back: string
  hint?: string
  explanation?: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  questionType: 'FLIP' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_IN_BLANK'
  multipleChoiceOptions?: { id: string; text: string; isCorrect: boolean }[]
}

// Study plan context from "Guide Me" flow
interface StudyPlanContext {
  subject: string
  steps: Array<{
    title: string
    description: string
    tips?: string[]
  }>
}

/**
 * POST /api/flashcards/generate - Generate flashcards from text using AI
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit - AI generation is expensive, limit to 20/hour
    const rateLimitResult = await rateLimit(request, RateLimitPresets.hourly)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many flashcard generations. Please wait before generating more.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      content,           // Text/notes to generate from
      title,             // Deck title (optional, will be generated if not provided)
      subject,           // Subject category
      cardCount = 10,    // Number of cards to generate
      difficulty = 'mixed', // 'easy', 'medium', 'hard', 'mixed'
      questionTypes = ['FLIP'], // Types of questions to generate
      createDeck = true, // Whether to create a deck with the cards
      studyPlanContext,  // Optional study plan context from "Guide Me" flow
    } = body as {
      content: string
      title?: string
      subject?: string
      cardCount?: number
      difficulty?: string
      questionTypes?: string[]
      createDeck?: boolean
      studyPlanContext?: StudyPlanContext
    }

    // Allow shorter content if study plan context is provided (the context adds value)
    const minContentLength = studyPlanContext ? 20 : 50
    if (!content || typeof content !== 'string' || content.trim().length < minContentLength) {
      return NextResponse.json(
        { error: `Content must be at least ${minContentLength} characters` },
        { status: 400 }
      )
    }

    // Build the prompt
    const questionTypeInstructions = questionTypes.includes('MULTIPLE_CHOICE')
      ? `For MULTIPLE_CHOICE cards, include a "multipleChoiceOptions" array with 4 options, exactly one marked as correct.`
      : ''

    const difficultyInstructions = difficulty === 'mixed'
      ? 'Mix difficulties (EASY, MEDIUM, HARD) appropriately based on concept complexity.'
      : `Set all cards to ${difficulty.toUpperCase()} difficulty.`

    // Build study plan context section if available
    let studyPlanSection = ''
    if (studyPlanContext && studyPlanContext.subject && studyPlanContext.steps?.length > 0) {
      const stepsText = studyPlanContext.steps
        .map((step, i) => {
          let text = `  Step ${i + 1}: ${step.title} - ${step.description}`
          if (step.tips?.length) {
            text += ` (Tips: ${step.tips.join('; ')})`
          }
          return text
        })
        .join('\n')

      studyPlanSection = `

IMPORTANT CONTEXT - The student has a personalized study plan:
Subject: ${studyPlanContext.subject}
Study Plan Steps:
${stepsText}

Use this study plan to:
- Focus flashcards on concepts mentioned in the study plan steps
- Prioritize the key topics from the student's personalized plan
- Create cards that help the student master each step of their plan
- Make the content highly relevant to their ${studyPlanContext.subject} study goals`
    }

    const systemPrompt = `You are an expert educational content creator specializing in creating effective flashcards for studying.

Your task is to analyze the provided text and create ${cardCount} high-quality flashcards.
${studyPlanSection}

Guidelines:
1. Extract the most important concepts, definitions, facts, and relationships
2. Create clear, concise questions (front) and comprehensive answers (back)
3. Include helpful hints that guide without giving away the answer
4. Add explanations that provide context and deeper understanding
5. ${difficultyInstructions}
6. Vary question types: ${questionTypes.join(', ')}
7. For TRUE_FALSE: Make "front" a statement, "back" either "True" or "False"
8. For FILL_IN_BLANK: Use "___" in the front for the blank, answer in back
${questionTypeInstructions}

Return a JSON object with this exact structure:
{
  "title": "Suggested deck title based on content",
  "description": "Brief description of the deck content",
  "subject": "Detected subject/topic",
  "cards": [
    {
      "front": "Question or term",
      "back": "Answer or definition",
      "hint": "Optional helpful hint",
      "explanation": "Optional deeper explanation",
      "difficulty": "EASY" | "MEDIUM" | "HARD",
      "questionType": "FLIP" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_IN_BLANK",
      "multipleChoiceOptions": [
        {"id": "a", "text": "Option A", "isCorrect": false},
        {"id": "b", "text": "Option B", "isCorrect": true},
        {"id": "c", "text": "Option C", "isCorrect": false},
        {"id": "d", "text": "Option D", "isCorrect": false}
      ] // Only for MULTIPLE_CHOICE
    }
  ]
}

IMPORTANT: Return ONLY valid JSON, no markdown code blocks or explanations.`

    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate flashcards from this content:\n\n${content.trim()}` },
      ],
      max_tokens: 4096,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const responseText = response.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from AI')
    }

    let generated: {
      title: string
      description: string
      subject: string
      cards: GeneratedCard[]
    }

    try {
      generated = JSON.parse(responseText)
    } catch {
      console.error('Failed to parse AI response:', responseText)
      throw new Error('Invalid AI response format')
    }

    if (!generated.cards || !Array.isArray(generated.cards) || generated.cards.length === 0) {
      throw new Error('No cards generated')
    }

    // If not creating a deck, just return the generated cards
    if (!createDeck) {
      return NextResponse.json({
        success: true,
        generated: {
          title: title || generated.title,
          description: generated.description,
          subject: subject || generated.subject,
          cards: generated.cards,
        },
      })
    }

    // Create deck with cards
    const deck = await prisma.$transaction(async (tx) => {
      // Create the deck
      const newDeck = await tx.flashcardDeck.create({
        data: {
          userId: user.id,
          title: title || generated.title,
          description: generated.description,
          subject: subject || generated.subject,
          source: 'AI_GENERATED',
          aiPrompt: content.substring(0, 5000), // Store first 5000 chars
          aiModel: 'gpt-5-mini',
          cardCount: generated.cards.length,
        },
      })

      // Create the cards
      const cardData = generated.cards.map((card, index) => ({
        deckId: newDeck.id,
        front: card.front,
        back: card.back,
        hint: card.hint || null,
        explanation: card.explanation || null,
        difficulty: card.difficulty || 'MEDIUM',
        questionType: card.questionType || 'FLIP',
        multipleChoiceOptions: card.multipleChoiceOptions ? card.multipleChoiceOptions : undefined,
        position: index,
        source: 'AI_GENERATED' as const,
      }))

      await tx.flashcardCard.createMany({
        data: cardData,
      })

      // Fetch the created cards
      const cards = await tx.flashcardCard.findMany({
        where: { deckId: newDeck.id },
        orderBy: { position: 'asc' },
      })

      return { ...newDeck, cards }
    })

    // Award XP for creating AI flashcards
    await prisma.profile.update({
      where: { userId: user.id },
      data: { totalPoints: { increment: 10 } }, // 10 XP for creating AI deck
    })

    return NextResponse.json({
      success: true,
      deck,
      xpEarned: 10,
    })
  } catch (error) {
    console.error('Generate flashcards error:', error)

    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate flashcards' },
      { status: 500 }
    )
  }
}
