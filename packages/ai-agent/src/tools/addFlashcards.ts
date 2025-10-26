/**
 * Add Flashcards Tool - Save flashcards to user's collection
 */

import {
  Tool,
  AddFlashcardsInputSchema,
  AddFlashcardsOutputSchema,
  AddFlashcardsInput,
  AddFlashcardsOutput,
  AgentContext,
} from '../types'
import { SupabaseClient } from '@supabase/supabase-js'

export function createAddFlashcardsTool(supabase: SupabaseClient): Tool<AddFlashcardsInput, AddFlashcardsOutput> {
  return {
    name: 'addFlashcards',
    description: 'Add flashcards to the student\'s collection for spaced repetition review. Supports batch creation with optional source tracking.',
    category: 'learning',
    inputSchema: AddFlashcardsInputSchema,
    outputSchema: AddFlashcardsOutputSchema,
    estimatedLatencyMs: 500,

    async call(input: AddFlashcardsInput, ctx: AgentContext): Promise<AddFlashcardsOutput> {
      const { cards, sourceDocId } = input

      // Prepare flashcard records
      const records = cards.map(card => ({
        user_id: ctx.userId,
        front: card.front,
        back: card.back,
        metadata: card.metadata || {},
        source_doc_id: sourceDocId || null,
        mastery_level: 0, // Start at 0 for new cards
        next_review_at: new Date(), // Available for immediate review
      }))

      // Batch insert
      const { data, error } = await supabase
        .from('flashcard')
        .insert(records)
        .select('id')

      if (error) {
        throw new Error(`Failed to add flashcards: ${error.message}`)
      }

      if (!data || data.length === 0) {
        throw new Error('No flashcards were created')
      }

      return {
        count: data.length,
        flashcardIds: data.map(d => d.id),
      }
    },
  }
}
