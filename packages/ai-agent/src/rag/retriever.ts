/**
 * Vector Retriever - Semantic search over document chunks
 * Production-grade retrieval with filtering and reranking
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { EmbeddingProvider } from './embeddings'

export interface RetrievalOptions {
  limit?: number
  threshold?: number
  filters?: Record<string, any>
  rerank?: boolean
}

export interface RetrievedChunk {
  docId: string
  ord: number
  content: string
  source?: string
  similarity: number
  metadata?: Record<string, any>
}

export interface RetrievalResult {
  chunks: RetrievedChunk[]
  totalFound: number
}

export class VectorRetriever {
  private supabase: SupabaseClient
  private embedder: EmbeddingProvider

  constructor(supabaseUrl: string, supabaseKey: string, embedder: EmbeddingProvider) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
    this.embedder = embedder
  }

  /**
   * Retrieve relevant chunks for a query
   */
  async retrieve(
    query: string,
    userId: string,
    options?: RetrievalOptions
  ): Promise<RetrievalResult> {
    const limit = options?.limit || 10
    const threshold = options?.threshold || 0.7

    // 1. Generate query embedding
    const { embedding } = await this.embedder.embed(query)

    // 2. Vector search with user filter (RLS)
    const { data: chunks, error } = await this.supabase.rpc('search_chunks', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit * 2, // Get more for potential reranking
      p_user_id: userId,
    })

    if (error) {
      throw new Error(`Retrieval error: ${error.message}`)
    }

    if (!chunks || chunks.length === 0) {
      return { chunks: [], totalFound: 0 }
    }

    // 3. Apply metadata filters if provided
    let filteredChunks = chunks
    if (options?.filters) {
      filteredChunks = this.applyFilters(chunks, options.filters)
    }

    // 4. Optional reranking (placeholder - implement cross-encoder in production)
    if (options?.rerank && filteredChunks.length > 0) {
      filteredChunks = await this.rerank(query, filteredChunks, limit)
    } else {
      filteredChunks = filteredChunks.slice(0, limit)
    }

    // 5. Enrich with source information
    const enrichedChunks = await this.enrichChunks(filteredChunks)

    return {
      chunks: enrichedChunks,
      totalFound: chunks.length,
    }
  }

  /**
   * Apply metadata filters to chunks
   */
  private applyFilters(
    chunks: any[],
    filters: Record<string, any>
  ): any[] {
    return chunks.filter(chunk => {
      if (!chunk.metadata) return true

      for (const [key, value] of Object.entries(filters)) {
        if (chunk.metadata[key] !== value) {
          return false
        }
      }
      return true
    })
  }

  /**
   * Rerank chunks using cross-encoder (placeholder)
   */
  private async rerank(
    query: string,
    chunks: any[],
    topK: number
  ): Promise<any[]> {
    // TODO: Implement cross-encoder reranking
    // For now, just return top-k by similarity
    return chunks.slice(0, topK)
  }

  /**
   * Enrich chunks with source document information
   */
  private async enrichChunks(chunks: any[]): Promise<RetrievedChunk[]> {
    // Get unique doc IDs
    const docIds = [...new Set(chunks.map(c => c.doc_id))]

    // Fetch source documents
    const { data: docs, error } = await this.supabase
      .from('doc_source')
      .select('id, title, source_type, source_url')
      .in('id', docIds)

    if (error) {
      console.warn('Failed to fetch source docs:', error)
      // Continue without source enrichment
    }

    const docMap = new Map(docs?.map(d => [d.id, d]) || [])

    return chunks.map(chunk => {
      const doc = docMap.get(chunk.doc_id)
      return {
        docId: chunk.doc_id,
        ord: chunk.ord,
        content: chunk.content,
        source: doc ? `${doc.title} (${doc.source_type})` : undefined,
        similarity: chunk.similarity,
        metadata: chunk.metadata,
      }
    })
  }

  /**
   * Ingest document chunks into vector store
   */
  async ingest(
    userId: string,
    docId: string,
    chunks: Array<{ content: string; ord: number; tokenCount: number }>
  ): Promise<void> {
    // Generate embeddings for all chunks
    const texts = chunks.map(c => c.content)
    const embeddings = await this.embedder.embedBatch(texts)

    // Insert chunks with embeddings
    const records = chunks.map((chunk, i) => ({
      doc_id: docId,
      content: chunk.content,
      embedding: embeddings[i].embedding,
      token_count: chunk.tokenCount,
      ord: chunk.ord,
    }))

    const { error } = await this.supabase
      .from('doc_chunk')
      .insert(records)

    if (error) {
      throw new Error(`Ingestion error: ${error.message}`)
    }
  }

  /**
   * Delete all chunks for a document
   */
  async deleteDocument(docId: string): Promise<void> {
    const { error } = await this.supabase
      .from('doc_chunk')
      .delete()
      .eq('doc_id', docId)

    if (error) {
      throw new Error(`Deletion error: ${error.message}`)
    }
  }
}

/**
 * SQL function for vector search (add to migrations)
 *
 * This should be added to your Supabase migrations:
 *
 * create or replace function search_chunks(
 *   query_embedding vector(1536),
 *   match_threshold float,
 *   match_count int,
 *   p_user_id uuid
 * )
 * returns table (
 *   doc_id uuid,
 *   ord int,
 *   content text,
 *   metadata jsonb,
 *   similarity float
 * )
 * language plpgsql
 * as $$
 * begin
 *   return query
 *   select
 *     dc.doc_id,
 *     dc.ord,
 *     dc.content,
 *     dc.metadata,
 *     1 - (dc.embedding <=> query_embedding) as similarity
 *   from doc_chunk dc
 *   inner join doc_source ds on dc.doc_id = ds.id
 *   where ds.user_id = p_user_id
 *     and ds.status = 'ready'
 *     and 1 - (dc.embedding <=> query_embedding) > match_threshold
 *   order by dc.embedding <=> query_embedding
 *   limit match_count;
 * end;
 * $$;
 */
