/**
 * Embeddings Module - Enterprise-Level Semantic Search
 *
 * This module provides Supabase Vector Search with OpenAI embeddings
 * for YouTube-level search that understands meaning, not just keywords.
 *
 * Features:
 * - OpenAI text-embedding-3-small (1536 dimensions)
 * - IVFFlat indexing for fast approximate nearest neighbor search
 * - Hybrid search combining vector similarity + text matching
 * - Rate limiting and caching for cost optimization
 * - N+1 query prevention with batch fetching
 *
 * Usage:
 * ```typescript
 * import { searchPartnersHybrid, searchGroupsHybrid } from '@/lib/embeddings'
 *
 * // Search for study partners
 * const { results } = await searchPartnersHybrid({
 *   query: 'computer science machine learning',
 *   excludeUserId: currentUserId,
 *   skillLevel: 'INTERMEDIATE',
 * })
 *
 * // Search for study groups
 * const { results } = await searchGroupsHybrid({
 *   query: 'calculus study group',
 *   skillLevel: 'BEGINNER',
 * })
 * ```
 */

// Core embedding functions
export {
  generateEmbedding,
  generateEmbeddingsBatch,
  normalizeText,
  buildProfileSearchText,
  buildGroupSearchText,
  cosineSimilarity,
  EMBEDDING_CONFIG,
} from './openai-embeddings'

// Hybrid search functions
export {
  searchPartnersHybrid,
  searchGroupsHybrid,
  updateProfileEmbedding,
  updateGroupEmbedding,
  HYBRID_SEARCH_CONFIG,
} from './hybrid-search'

// Types
export type {
  PartnerSearchParams,
  GroupSearchParams,
  SearchResult,
} from './hybrid-search'

export type {
  EmbeddingResult,
  BatchEmbeddingResult,
} from './openai-embeddings'
