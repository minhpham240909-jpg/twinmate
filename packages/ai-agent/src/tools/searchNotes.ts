/**
 * Search Notes Tool - Semantic search over user's documents
 */

import { Tool, SearchNotesInputSchema, SearchNotesOutputSchema, SearchNotesInput, SearchNotesOutput, AgentContext } from '../types'
import { VectorRetriever } from '../rag/retriever'

export function createSearchNotesTool(retriever: VectorRetriever): Tool<SearchNotesInput, SearchNotesOutput> {
  return {
    name: 'searchNotes',
    description: 'Search through the student\'s notes, documents, and uploaded materials for relevant information. Use this when the student asks questions about their content or requests information from their materials.',
    category: 'rag',
    inputSchema: SearchNotesInputSchema,
    outputSchema: SearchNotesOutputSchema,
    estimatedLatencyMs: 500,

    async call(input: SearchNotesInput, ctx: AgentContext): Promise<SearchNotesOutput> {
      const { query, courseId, limit = 10, filters } = input

      // Build filters
      const retrievalFilters: Record<string, any> = {}
      if (courseId) {
        retrievalFilters.courseId = courseId
      }
      if (filters) {
        Object.assign(retrievalFilters, filters)
      }

      // Retrieve relevant chunks
      const result = await retriever.retrieve(query, ctx.userId, {
        limit,
        threshold: 0.7,
        filters: retrievalFilters,
        rerank: true, // Enable reranking for better results
      })

      // Format output
      return {
        chunks: result.chunks.map(chunk => ({
          docId: chunk.docId,
          ord: chunk.ord,
          text: chunk.content,
          source: chunk.source,
          similarity: chunk.similarity,
        })),
      }
    },
  }
}
