// API Routes: Individual Flashcard (PATCH update, DELETE)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateFlashcardSchema = z.object({
  front: z.string().min(1).max(5000).optional(),
  back: z.string().min(1).max(5000).optional(),
  difficulty: z.number().int().min(0).max(2).optional(),
})

// PATCH /api/study-sessions/[sessionId]/flashcards/[cardId]
// Update a flashcard (content only, not spaced repetition data)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string; cardId: string }> }
) {
  try {
    const { sessionId, cardId } = await context.params

    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify the flashcard exists and belongs to the user
    const existingCard = await prisma.sessionFlashcard.findUnique({
      where: { id: cardId },
    })

    if (!existingCard) {
      return NextResponse.json(
        { error: 'Flashcard not found' },
        { status: 404 }
      )
    }

    if (existingCard.userId !== user.id) {
      return NextResponse.json(
        { error: 'You can only edit your own flashcards' },
        { status: 403 }
      )
    }

    if (existingCard.sessionId !== sessionId) {
      return NextResponse.json(
        { error: 'Flashcard does not belong to this session' },
        { status: 400 }
      )
    }

    // Validate request body
    const body = await request.json()
    const validation = updateFlashcardSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      )
    }

    const updateData = validation.data

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update flashcard
    const updatedCard = await prisma.sessionFlashcard.update({
      where: { id: cardId },
      data: updateData,
    })

    console.log(`[Flashcard PATCH] Updated flashcard ${cardId} for user ${user.id}`)

    return NextResponse.json({
      success: true,
      flashcard: updatedCard,
    })
  } catch (error) {
    console.error('[Flashcard PATCH] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update flashcard',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// DELETE /api/study-sessions/[sessionId]/flashcards/[cardId]
// Delete a flashcard
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string; cardId: string }> }
) {
  try {
    const { sessionId, cardId } = await context.params

    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify the flashcard exists and belongs to the user
    const existingCard = await prisma.sessionFlashcard.findUnique({
      where: { id: cardId },
    })

    if (!existingCard) {
      return NextResponse.json(
        { error: 'Flashcard not found' },
        { status: 404 }
      )
    }

    if (existingCard.userId !== user.id) {
      return NextResponse.json(
        { error: 'You can only delete your own flashcards' },
        { status: 403 }
      )
    }

    if (existingCard.sessionId !== sessionId) {
      return NextResponse.json(
        { error: 'Flashcard does not belong to this session' },
        { status: 400 }
      )
    }

    // Delete flashcard
    await prisma.sessionFlashcard.delete({
      where: { id: cardId },
    })

    console.log(`[Flashcard DELETE] Deleted flashcard ${cardId} for user ${user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Flashcard deleted successfully',
    })
  } catch (error) {
    console.error('[Flashcard DELETE] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete flashcard',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
