/**
 * Clerva AI Agent - Main Entry Point
 *
 * This package provides a production-grade AI agent system with:
 * - RAG (Retrieval Augmented Generation) with pgvector
 * - Multi-tool support (11+ tools)
 * - Real-time collaboration features
 * - Learning analytics
 * - Study planning
 *
 * @example
 * ```typescript
 * import { AgentOrchestrator, initializeToolRegistry } from '@clerva/ai-agent'
 *
 * const registry = initializeToolRegistry({ supabase, llmProvider, retriever })
 * const orchestrator = new AgentOrchestrator({ llmProvider, retriever, registry, supabase })
 *
 * const response = await orchestrator.handle(userId, "Help me study calculus")
 * console.log(response.text)
 * ```
 */

// Core orchestrator
export { AgentOrchestrator } from './lib/orchestrator'
export { ToolRegistry } from './lib/tool-registry'

// Tool system
export {
  initializeToolRegistry,
  createAndRegisterTools,
  // Individual tool creators
  createSearchNotesTool,
  createSummarizeSessionTool,
  createGenerateQuizTool,
  createMatchInsightTool,
  createAddFlashcardsTool,
  createGetOnlineUsersTool,
  createGetAvailabilityTool,
  createSendNudgeTool,
  createCreateStudyPlanTool,
  createBuildLearningProfileTool,
  createMatchCandidatesTool,
} from './tools'

// RAG pipeline
export { DocumentChunker } from './rag/chunker'
export { OpenAIEmbeddingProvider, MockEmbeddingProvider } from './rag/embeddings'
export { VectorRetriever } from './rag/retriever'

// Types
export type {
  // Core types
  Tool,
  AgentContext,
  AgentResponse,
  ToolResult,
  AICard,

  // LLM types
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMMessage,
  LLMToolCall,

  // RAG types
  EmbeddingProvider,
  RetrievalOptions,
  RetrievedChunk,
  RetrievalResult,
  Chunk,
  ChunkOptions,

  // Tool input/output types
  SearchNotesInput,
  SearchNotesOutput,
  SummarizeSessionInput,
  SummarizeSessionOutput,
  GenerateQuizInput,
  GenerateQuizOutput,
  MatchInsightInput,
  MatchInsightOutput,
  AddFlashcardsInput,
  AddFlashcardsOutput,
  GetOnlineUsersInput,
  GetOnlineUsersOutput,
  GetAvailabilityInput,
  GetAvailabilityOutput,
  SendNudgeInput,
  SendNudgeOutput,
  CreateStudyPlanInput,
  CreateStudyPlanOutput,
  BuildLearningProfileInput,
  BuildLearningProfileOutput,
  MatchCandidatesInput,
  MatchCandidatesOutput,

  // Error types
  AgentError,
  ToolError,
  ValidationError,
} from './types'

// Zod schemas (for external validation)
export {
  SearchNotesInputSchema,
  SearchNotesOutputSchema,
  SummarizeSessionInputSchema,
  SummarizeSessionOutputSchema,
  GenerateQuizInputSchema,
  GenerateQuizOutputSchema,
  MatchInsightInputSchema,
  MatchInsightOutputSchema,
  AddFlashcardsInputSchema,
  AddFlashcardsOutputSchema,
  GetOnlineUsersInputSchema,
  GetOnlineUsersOutputSchema,
  GetAvailabilityInputSchema,
  GetAvailabilityOutputSchema,
  SendNudgeInputSchema,
  SendNudgeOutputSchema,
  CreateStudyPlanInputSchema,
  CreateStudyPlanOutputSchema,
  BuildLearningProfileInputSchema,
  BuildLearningProfileOutputSchema,
  MatchCandidatesInputSchema,
  MatchCandidatesOutputSchema,
} from './types'

// Re-export for convenience
export * as Tools from './tools'
export * as RAG from './rag'
export * as Lib from './lib'
