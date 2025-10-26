/**
 * RAG (Retrieval Augmented Generation) Pipeline
 *
 * Exports chunking, embedding, and retrieval components
 */

export { DocumentChunker } from './chunker'
export type { Chunk, ChunkOptions } from './chunker'

export { OpenAIEmbeddingProvider, MockEmbeddingProvider } from './embeddings'
export type { EmbeddingProvider } from './embeddings'

export { VectorRetriever } from './retriever'
export type {
  RetrievalOptions,
  RetrievedChunk,
  RetrievalResult,
} from './retriever'
