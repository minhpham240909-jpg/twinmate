/**
 * Tool Factory - Create and register all AI agent tools
 * This is the main entry point for initializing the tool ecosystem
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { LLMProvider } from '../types'
import { VectorRetriever } from '../rag/retriever'
import { ToolRegistry } from '../lib/tool-registry'

// Import all tool creators
import { createSearchNotesTool } from './searchNotes'
import { createSummarizeSessionTool } from './summarizeSession'
import { createGenerateQuizTool } from './generateQuiz'
import { createMatchInsightTool } from './matchInsight'
import { createAddFlashcardsTool } from './addFlashcards'
import { createGetOnlineUsersTool } from './getOnlineUsers'
import { createGetAvailabilityTool } from './getAvailability'
import { createSendNudgeTool } from './sendNudge'
import { createCreateStudyPlanTool } from './createStudyPlan'
import { createBuildLearningProfileTool } from './buildLearningProfile'
import { createMatchCandidatesTool } from './matchCandidates'

export interface ToolFactoryDependencies {
  supabase: SupabaseClient
  llmProvider: LLMProvider
  retriever: VectorRetriever
}

/**
 * Create all tools and register them with the registry
 */
export function createAndRegisterTools(
  registry: ToolRegistry,
  deps: ToolFactoryDependencies
): void {
  const { supabase, llmProvider, retriever } = deps

  // RAG Tools
  registry.register(createSearchNotesTool(retriever))

  // Learning Tools
  registry.register(createSummarizeSessionTool(llmProvider))
  registry.register(createGenerateQuizTool(llmProvider, retriever, supabase))
  registry.register(createAddFlashcardsTool(supabase))
  registry.register(createBuildLearningProfileTool(llmProvider, supabase))

  // Collaboration Tools
  registry.register(createMatchInsightTool(supabase))
  registry.register(createMatchCandidatesTool(supabase))
  registry.register(createGetOnlineUsersTool(supabase))
  registry.register(createGetAvailabilityTool(supabase))
  registry.register(createSendNudgeTool(supabase))

  // Productivity Tools
  registry.register(createCreateStudyPlanTool(llmProvider, supabase))
}

/**
 * Initialize a fully configured tool registry
 */
export function initializeToolRegistry(deps: ToolFactoryDependencies): ToolRegistry {
  const registry = ToolRegistry.getInstance()
  createAndRegisterTools(registry, deps)
  return registry
}

// Re-export individual tool creators for flexibility
export {
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
}
