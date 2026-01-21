/**
 * Create Arena API
 *
 * POST /api/arena/create
 *
 * Creates a new arena session with generated questions.
 * For non-CUSTOM modes: Host is automatically added as a participant.
 * For CUSTOM mode: Host becomes spectator (teacher dashboard) - not a participant.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { generateQuestions, generateInviteCode } from '@/lib/arena'
import type { ArenaContentSource, CustomQuestion } from '@/lib/arena/types'

// Rate limiting (simple in-memory, use Redis in production)
const createRateLimits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10 // arenas per hour
const RATE_WINDOW = 60 * 60 * 1000 // 1 hour

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const limit = createRateLimits.get(userId)

  // Cleanup old entries occasionally
  if (Math.random() < 0.01) {
    for (const [key, value] of createRateLimits.entries()) {
      if (now > value.resetAt) {
        createRateLimits.delete(key)
      }
    }
  }

  if (!limit || now > limit.resetAt) {
    createRateLimits.set(userId, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }

  if (limit.count >= RATE_LIMIT) {
    return false
  }

  limit.count++
  return true
}

// Validate custom questions
function validateCustomQuestions(questions: unknown): questions is CustomQuestion[] {
  if (!Array.isArray(questions)) return false
  if (questions.length < 3 || questions.length > 50) return false

  return questions.every((q) => {
    if (typeof q !== 'object' || q === null) return false
    const question = q as Record<string, unknown>

    if (typeof question.question !== 'string' || question.question.trim().length === 0) return false
    if (!Array.isArray(question.options) || question.options.length !== 4) return false
    if (!question.options.every((opt: unknown) => typeof opt === 'string' && opt.trim().length > 0)) return false
    if (typeof question.correctAnswer !== 'number' || question.correctAnswer < 0 || question.correctAnswer > 3) return false

    return true
  })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limiting
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { success: false, error: 'Too many arenas created. Please wait.' },
        { status: 429 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      title,
      contentSource,
      topic,
      fileContent,
      imageData, // Array of base64 image data URLs for image upload
      deckId,
      questions: customQuestions, // For CUSTOM mode
      questionCount = 10,
      timePerQuestion = 20,
      maxPlayers = 20,
    } = body

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      )
    }

    const validSources = ['UPLOAD', 'AI_GENERATED', 'STUDY_HISTORY', 'DECK', 'CUSTOM']
    if (!contentSource || !validSources.includes(contentSource)) {
      return NextResponse.json(
        { success: false, error: 'Invalid content source' },
        { status: 400 }
      )
    }

    // Validate content source specific requirements
    if (contentSource === 'AI_GENERATED' && (!topic || typeof topic !== 'string')) {
      return NextResponse.json(
        { success: false, error: 'Topic is required for AI-generated questions' },
        { status: 400 }
      )
    }

    if (contentSource === 'UPLOAD') {
      const hasTextContent = fileContent && typeof fileContent === 'string' && fileContent.trim().length > 0
      const hasImageData = Array.isArray(imageData) && imageData.length > 0

      if (!hasTextContent && !hasImageData) {
        return NextResponse.json(
          { success: false, error: 'Content or images are required for uploaded questions' },
          { status: 400 }
        )
      }

      // Validate image data if provided
      if (hasImageData) {
        if (imageData.length > 5) {
          return NextResponse.json(
            { success: false, error: 'Maximum 5 images allowed' },
            { status: 400 }
          )
        }
        // Check each image is a valid base64 data URL
        for (const img of imageData) {
          if (typeof img !== 'string' || !img.startsWith('data:image/')) {
            return NextResponse.json(
              { success: false, error: 'Invalid image data format' },
              { status: 400 }
            )
          }
        }
      }
    }

    if (contentSource === 'DECK' && (!deckId || typeof deckId !== 'string')) {
      return NextResponse.json(
        { success: false, error: 'Deck ID is required' },
        { status: 400 }
      )
    }

    if (contentSource === 'CUSTOM' && !validateCustomQuestions(customQuestions)) {
      return NextResponse.json(
        { success: false, error: 'Invalid custom questions. Need 3-50 questions, each with 4 options.' },
        { status: 400 }
      )
    }

    // Get user info
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, avatarUrl: true },
    })

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Determine if host is spectator (CUSTOM mode)
    const isCustomMode = contentSource === 'CUSTOM'
    const hostIsSpectator = isCustomMode

    // Generate or use provided questions
    let questions: Array<{ question: string; options: string[]; correctAnswer: number; explanation?: string }>

    if (isCustomMode) {
      // Use custom questions provided by host
      questions = (customQuestions as CustomQuestion[]).map((q) => ({
        question: q.question.trim(),
        options: q.options.map((opt) => opt.trim()),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation?.trim(),
      }))
    } else {
      // Generate questions with timeout
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

        questions = await generateQuestions(contentSource as ArenaContentSource, {
          topic,
          content: fileContent,
          imageData: imageData, // Pass image data for vision-based generation
          deckId,
          userId: user.id,
          count: Math.min(questionCount, 20), // Max 20 questions
        })

        clearTimeout(timeout)
      } catch (error) {
        console.error('[Arena Create] Question generation failed:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to generate questions. Please try again.' },
          { status: 500 }
        )
      }
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No questions could be generated' },
        { status: 400 }
      )
    }

    // Generate unique invite code
    let inviteCode = generateInviteCode()
    let attempts = 0
    while (attempts < 10) {
      const existing = await prisma.arenaSession.findUnique({
        where: { inviteCode },
        select: { id: true },
      })
      if (!existing) break
      inviteCode = generateInviteCode()
      attempts++
    }

    // Create arena with questions
    // For CUSTOM mode: Host is NOT added as participant (they're spectator)
    // For other modes: Host IS added as participant
    const arena = await prisma.arenaSession.create({
      data: {
        hostId: user.id,
        title: title.trim(),
        inviteCode,
        contentSource: contentSource as ArenaContentSource,
        sourceTopic: topic || null,
        sourceFileUrl: null,
        sourceDeckId: deckId || null,
        questionCount: questions.length,
        timePerQuestion: Math.min(Math.max(timePerQuestion, 10), 60),
        maxPlayers: Math.min(Math.max(maxPlayers, 2), 50),
        hostIsSpectator, // Set spectator flag for CUSTOM mode
        status: 'LOBBY',
        currentQuestion: 0,
        // Create questions
        questions: {
          create: questions.map((q, index) => ({
            questionNumber: index + 1,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            basePoints: 1000,
          })),
        },
        // Only add host as participant if NOT spectator mode
        ...(hostIsSpectator ? {} : {
          participants: {
            create: {
              userId: user.id,
              userName: dbUser.name || 'Host',
              userAvatarUrl: dbUser.avatarUrl,
            },
          },
        }),
      },
      include: {
        questions: {
          orderBy: { questionNumber: 'asc' },
        },
        participants: true,
      },
    })

    console.log(`[Arena Create] Created ${isCustomMode ? 'CUSTOM (spectator)' : ''} arena ${arena.id} with ${questions.length} questions in ${Date.now() - startTime}ms`)

    return NextResponse.json({
      success: true,
      arena: {
        id: arena.id,
        title: arena.title,
        inviteCode: arena.inviteCode,
        contentSource: arena.contentSource,
        questionCount: arena.questionCount,
        timePerQuestion: arena.timePerQuestion,
        maxPlayers: arena.maxPlayers,
        hostIsSpectator: arena.hostIsSpectator,
        status: arena.status,
        createdAt: arena.createdAt,
      },
      inviteCode: arena.inviteCode,
      questionCount: arena.questions.length,
      hostIsSpectator,
    })
  } catch (error) {
    console.error('[Arena Create] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    })

    return NextResponse.json(
      { success: false, error: 'Failed to create arena' },
      { status: 500 }
    )
  }
}
