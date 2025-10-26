/**
 * Clerva AI Agent - Core Type Definitions
 * Production-grade types for agent orchestration, tools, and RAG
 */

import { z } from 'zod'

// ============================================================================
// AGENT CONTEXT
// ============================================================================

export interface AgentContext {
  userId: string
  conversationId?: string
  traceId: string
  timestamp: Date
  userProfile?: UserProfile
  recentMemory?: MemoryItem[]
  retrievedChunks?: RetrievedChunk[]
  metadata?: Record<string, any>
}

export interface UserProfile {
  gradeLevel?: string
  subjects: string[]
  goals: any[]
  preferences: Record<string, any>
  learningStyle?: string
}

export interface MemoryItem {
  scope: 'short' | 'long' | 'preference' | 'context'
  key: string
  value: any
  expiresAt?: Date
}

export interface RetrievedChunk {
  docId: string
  ord: number
  content: string
  source?: string
  similarity?: number
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export interface Tool<TInput = any, TOutput = any> {
  name: string
  description: string
  inputSchema: z.ZodSchema<TInput>
  outputSchema: z.ZodSchema<TOutput>
  call: (input: TInput, ctx: AgentContext) => Promise<TOutput>
  category?: 'rag' | 'learning' | 'collaboration' | 'productivity' | 'system'
  estimatedLatencyMs?: number
  costEstimate?: number
}

export interface ToolRegistry {
  register<TInput, TOutput>(tool: Tool<TInput, TOutput>): void
  get(name: string): Tool | undefined
  list(): Tool[]
  listByCategory(category: Tool['category']): Tool[]
}

// ============================================================================
// TOOL INPUT/OUTPUT SCHEMAS
// ============================================================================

// --- RAG & Search ---
export const SearchNotesInputSchema = z.object({
  query: z.string().min(1).describe('Search query text'),
  courseId: z.string().uuid().optional().describe('Filter by course ID'),
  limit: z.number().int().positive().default(10).describe('Max results'),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

export type SearchNotesInput = z.infer<typeof SearchNotesInputSchema>

export const SearchNotesOutputSchema = z.object({
  chunks: z.array(z.object({
    docId: z.string().uuid(),
    ord: z.number().int(),
    text: z.string(),
    source: z.string().optional(),
    similarity: z.number().optional(),
  })),
})

export type SearchNotesOutput = z.infer<typeof SearchNotesOutputSchema>

// --- Session Summary ---
export const SummarizeSessionInputSchema = z.object({
  transcript: z.string().describe('Session transcript or chat log'),
  notes: z.array(z.string()).optional().describe('Additional notes'),
})

export type SummarizeSessionInput = z.infer<typeof SummarizeSessionInputSchema>

export const SummarizeSessionOutputSchema = z.object({
  summary: z.string().describe('Concise summary of session'),
  keyPoints: z.array(z.string()).describe('Main takeaways'),
  tasks: z.array(z.object({
    title: z.string(),
    etaMin: z.number().int(),
  })).describe('Suggested follow-up tasks'),
  flashcards: z.array(z.object({
    front: z.string(),
    back: z.string(),
  })).describe('Generated flashcards from session'),
})

export type SummarizeSessionOutput = z.infer<typeof SummarizeSessionOutputSchema>

// --- Quiz Generation ---
export const GenerateQuizInputSchema = z.object({
  topic: z.string().describe('Quiz topic or title'),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('medium'),
  n: z.number().int().positive().max(50).describe('Number of questions'),
  sources: z.array(z.object({
    docId: z.string().uuid(),
    ordRange: z.tuple([z.number().int(), z.number().int()]).optional(),
  })).optional().describe('Specific document chunks to use'),
})

export type GenerateQuizInput = z.infer<typeof GenerateQuizInputSchema>

export const QuizItemSchema = z.object({
  q: z.string().describe('Question text'),
  choices: z.tuple([z.string(), z.string(), z.string(), z.string()]).describe('Exactly 4 choices'),
  answer: z.string().describe('Correct answer (must match one of choices)'),
  explanation: z.string().describe('Brief explanation of answer'),
  source: z.string().optional().describe('Source document reference'),
})

export type QuizItem = z.infer<typeof QuizItemSchema>

export const GenerateQuizOutputSchema = z.object({
  quizId: z.string().uuid(),
  items: z.array(QuizItemSchema),
})

export type GenerateQuizOutput = z.infer<typeof GenerateQuizOutputSchema>

// --- Flashcards ---
export const AddFlashcardsInputSchema = z.object({
  cards: z.array(z.object({
    front: z.string().min(1),
    back: z.string().min(1),
    metadata: z.record(z.string(), z.any()).optional(),
  })).min(1).max(100),
  sourceDocId: z.string().uuid().optional(),
})

export type AddFlashcardsInput = z.infer<typeof AddFlashcardsInputSchema>

export const AddFlashcardsOutputSchema = z.object({
  count: z.number().int().nonnegative(),
  flashcardIds: z.array(z.string()),
})

export type AddFlashcardsOutput = z.infer<typeof AddFlashcardsOutputSchema>

// --- Study Plan ---
export const CreateStudyPlanInputSchema = z.object({
  goals: z.array(z.string()).min(1).describe('Learning goals'),
  timePerDayMin: z.number().int().positive().describe('Minutes per day'),
  daysPerWeek: z.number().int().min(1).max(7).describe('Study days per week'),
  deadline: z.string().datetime().optional().describe('ISO datetime deadline'),
  knownWeakSpots: z.array(z.string()).optional(),
})

export type CreateStudyPlanInput = z.infer<typeof CreateStudyPlanInputSchema>

export const CreateStudyPlanOutputSchema = z.object({
  planId: z.string().uuid(),
  title: z.string(),
  weekBlocks: z.array(z.object({
    week: z.number().int().positive(),
    focus: z.string().optional(),
    tasks: z.array(z.object({
      title: z.string(),
      etaMin: z.number().int(),
      link: z.string().optional(),
      completed: z.boolean().optional(),
    })),
  })),
})

export type CreateStudyPlanOutput = z.infer<typeof CreateStudyPlanOutputSchema>

// --- Learning Profile ---
export const BuildLearningProfileInputSchema = z.object({
  forceRebuild: z.boolean().optional().default(false),
})

export type BuildLearningProfileInput = z.infer<typeof BuildLearningProfileInputSchema>

export const BuildLearningProfileOutputSchema = z.object({
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendedFocus: z.array(z.string()),
  analytics: z.record(z.any()).optional(),
})

export type BuildLearningProfileOutput = z.infer<typeof BuildLearningProfileOutputSchema>

// --- Presence & Availability ---
export const GetOnlineUsersInputSchema = z.object({
  activityFilter: z.array(z.string()).optional(),
  limit: z.number().int().positive().optional().default(50),
})

export type GetOnlineUsersInput = z.infer<typeof GetOnlineUsersInputSchema>

export const GetOnlineUsersOutputSchema = z.object({
  users: z.array(z.object({
    userId: z.string(),
    currentActivity: z.string(),
    lastSeen: z.string(),
    profile: z.object({
      gradeLevel: z.string().optional(),
      subjects: z.array(z.string()),
      learningStyle: z.string().optional(),
    }).optional(),
  })),
  total: z.number(),
})

export type GetOnlineUsersOutput = z.infer<typeof GetOnlineUsersOutputSchema>

export const GetAvailabilityInputSchema = z.object({
  targetUserId: z.string().uuid().optional(),
  dow: z.number().int().min(0).max(6).optional(),
})

export type GetAvailabilityInput = z.infer<typeof GetAvailabilityInputSchema>

export const AvailabilityWindowSchema = z.object({
  dow: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(1).max(1440),
  timezone: z.string(),
})

export type AvailabilityWindow = z.infer<typeof AvailabilityWindowSchema>

export const GetAvailabilityOutputSchema = z.object({
  windows: z.array(AvailabilityWindowSchema),
})

export type GetAvailabilityOutput = z.infer<typeof GetAvailabilityOutputSchema>

// --- Partner Matching ---
export const MatchCandidatesInputSchema = z.object({
  forUserId: z.string().uuid(),
  topK: z.number().int().positive().default(10),
})

export type MatchCandidatesInput = z.infer<typeof MatchCandidatesInputSchema>

export const MatchCandidatesOutputSchema = z.object({
  candidates: z.array(z.object({
    userId: z.string().uuid(),
    score: z.number().min(0).max(1),
    facets: z.array(z.string()),
  })),
})

export type MatchCandidatesOutput = z.infer<typeof MatchCandidatesOutputSchema>

export const MatchInsightInputSchema = z.object({
  forUserId: z.string().uuid(),
  candidateId: z.string().uuid(),
})

export type MatchInsightInput = z.infer<typeof MatchInsightInputSchema>

export const MatchInsightOutputSchema = z.object({
  compatibilityScore: z.number().min(0).max(1),
  complementarySkills: z.array(z.string()),
  risks: z.array(z.string()),
  jointStudyPlan: z.array(z.string()),
  canStudyNow: z.boolean(),
  nextBestTimes: z.array(z.object({
    whenISO: z.string().datetime(),
    confidence: z.number().min(0).max(1),
  })),
})

export type MatchInsightOutput = z.infer<typeof MatchInsightOutputSchema>

// --- Nudges ---
export const SendNudgeInputSchema = z.object({
  toUserId: z.string(),
  message: z.string().min(1),
  nudgeType: z.enum(['study_invite', 'reminder', 'match_suggestion', 'plan_update']),
  metadata: z.record(z.string(), z.any()).optional(),
})

export type SendNudgeInput = z.infer<typeof SendNudgeInputSchema>

export const SendNudgeOutputSchema = z.object({
  success: z.boolean(),
  nudgeId: z.string(),
  sentAt: z.string(),
})

export type SendNudgeOutput = z.infer<typeof SendNudgeOutputSchema>

// ============================================================================
// AGENT RESPONSE
// ============================================================================

export interface AgentResponse {
  text: string
  toolsUsed?: string[]
  toolResults?: ToolResult[]
  cards?: ResponseCard[]
  citations?: Citation[]
  traceId?: string
  metadata?: Record<string, any>
}

export interface ToolResult {
  toolName: string
  input: any
  output: any
  latencyMs: number
  success: boolean
  error?: string
}

export interface ResponseCard {
  type: 'quiz' | 'flashcards' | 'plan' | 'match' | 'summary' | 'explainer'
  title: string
  content: any
  actions?: CardAction[]
}

// Alias for backward compatibility
export type AICard = ResponseCard

export interface CardAction {
  label: string
  action: 'save' | 'start' | 'schedule' | 'expand' | 'dismiss'
  href?: string
  payload?: any
}

export interface Citation {
  text: string
  docId: string
  ord?: number
  source?: string
}

// ============================================================================
// RAG TYPES
// ============================================================================

export interface EmbeddingRequest {
  text: string
  model?: string
}

export interface EmbeddingResponse {
  embedding: number[]
  tokenCount: number
}

export interface RetrievalRequest {
  query: string
  userId: string
  limit?: number
  filters?: Record<string, any>
  threshold?: number
}

export interface RetrievalResponse {
  chunks: RetrievedChunk[]
  totalFound: number
}

// ============================================================================
// LLM TYPES
// ============================================================================

export interface LLMRequest {
  messages: LLMMessage[]
  tools?: LLMTool[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  toolCallId?: string
}

export interface LLMTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: any
  }
}

export interface LLMResponse {
  content: string
  toolCalls?: LLMToolCall[]
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter'
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface LLMToolCall {
  id: string
  name: string
  arguments: any
}

export interface LLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>
}

// ============================================================================
// RAG & EMBEDDING TYPES
// ============================================================================

export interface EmbeddingProvider {
  embed(text: string): Promise<{ embedding: number[]; tokenCount: number }>
  embedBatch(texts: string[]): Promise<Array<{ embedding: number[]; tokenCount: number }>>
}

export interface RetrievalOptions {
  limit?: number
  threshold?: number
  filters?: Record<string, any>
  rerank?: boolean
}

export interface RetrievalResult {
  chunks: RetrievedChunk[]
  totalFound: number
}

export interface Chunk {
  content: string
  ord: number
  tokenCount: number
}

export interface ChunkOptions {
  maxTokens?: number
  overlapTokens?: number
}

// ============================================================================
// TELEMETRY
// ============================================================================

export interface TelemetryEvent {
  traceId: string
  userId?: string
  eventType: 'tool_call' | 'llm_call' | 'retrieval' | 'error'
  toolName?: string
  latencyMs: number
  tokenCount?: number
  costUsd?: number
  metadata?: Record<string, any>
}

// ============================================================================
// ERRORS
// ============================================================================

export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'AgentError'
  }
}

export class ToolError extends AgentError {
  constructor(toolName: string, message: string, details?: any) {
    super(`Tool '${toolName}' failed: ${message}`, 'TOOL_ERROR', { toolName, ...details })
    this.name = 'ToolError'
  }
}

export class ValidationError extends AgentError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}
