/**
 * AI Partner Intelligence System
 *
 * A decision-driven AI architecture that makes the AI feel smart like ChatGPT.
 *
 * Key Features:
 * - Intent Classification: Understands what the user wants
 * - Dynamic Responses: Adapts response style to context
 * - Adaptive Behavior: Tracks user signals and adjusts
 * - Memory Integration: Uses stored preferences
 * - Guardrails: Prevents overuse and ensures stability
 *
 * Usage:
 * ```typescript
 * import { makeDecision, injectDecisionIntoPrompt } from '@/lib/ai-partner/intelligence'
 *
 * // 1. Make a decision based on user input
 * const decision = await makeDecision(userMessage, sessionContext, memoryContext, adaptiveState)
 *
 * // 2. Inject decision into prompt
 * const enhancedPrompt = injectDecisionIntoPrompt(basePrompt, decision)
 *
 * // 3. Send to AI with enhanced prompt
 * const response = await sendToAI(enhancedPrompt, { maxTokens: decision.responseConfig.maxTokens })
 * ```
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Intent types
  UserIntent,
  IntentResult,

  // Input types
  InputFormat,
  ProcessedInput,

  // Response types
  ResponseStyle,
  ResponseTone,
  ResponseLength,
  ResponseConfig,

  // Adaptive types
  UserSignals,
  AdaptiveState,

  // Context types
  MemoryContext,
  SessionContext,
  SessionState,

  // Decision types
  AIAction,
  AIDecision,
  PromptInjections,
  PostActions,

  // Guardrails types
  Guardrails,
} from './types'

export {
  // Constants
  VALID_INTENTS,
  DEFAULT_RESPONSE_CONFIG,
  INITIAL_ADAPTIVE_STATE,
  DEFAULT_MEMORY_CONTEXT,
  DEFAULT_GUARDRAILS,
} from './types'

// =============================================================================
// INPUT PROCESSING
// =============================================================================

export {
  processInput,
  isShortReply,
  endsWithQuestion,
  normalizeForMatching,
  hasSubstantialContent,
  extractMainQuestion,
  isLikelyCopiedContent,
} from './input-processor'

// =============================================================================
// INTENT CLASSIFICATION
// =============================================================================

export {
  classifyIntent,
  detectUserSignals,
  isImageGenerationIntent,
  isStudyRelatedIntent,
  getIntentDescription,
  clearIntentCache,
} from './intent-classifier'

// =============================================================================
// RESPONSE MAPPING
// =============================================================================

export {
  buildResponseConfig,
  getStyleInstruction,
  getToneInstruction,
  getLengthInstruction,
  shouldIncludeQuestion,
  shouldOfferVisual,
  getMaxTokens,
} from './response-mapper'

// =============================================================================
// ADAPTIVE TRACKING
// =============================================================================

export {
  AdaptiveTracker,
  createAdaptiveTracker,
  restoreAdaptiveTracker,
  determineSessionState,
  quickDetectSignals,
} from './adaptive-tracker'

// =============================================================================
// DECISION CONTROLLER
// =============================================================================

export {
  makeDecision,
  makeQuickDecision,
  updateSessionContext,
  createDecisionTracker,
} from './decision-controller'

// =============================================================================
// RESPONSE INJECTION
// =============================================================================

export {
  injectDecisionIntoPrompt,
  buildLightweightInjection,
  buildConfusionInjection,
  buildReengagementInjection,
  buildWrapUpInjection,
  buildProgressCheckInjection,
  mergeInjections,
  createCompletePrompt,
  extractInjectionMarkers,
  validateInjectionSize,
  truncateInjection,
} from './response-injector'

// =============================================================================
// GUARDRAILS
// =============================================================================

export {
  setGuardrails,
  getGuardrails,
  resetGuardrails,
  shouldUseFallback,
  hasTokenBudget,
  enforceTokenLimit,
  enforceGuardrails,
  shouldExtractMemories,
  hasMemoryCapacity,
  estimateTokens,
  isContentSafe,
  truncateToTokenLimit,
  getFallbackTimeout,
  getSessionMetrics,
  isApproachingLimits,
  getRecommendedLength,
  withTimeout,
  checkRateLimit,
  cleanupRateLimits,
} from './guardrails'

// =============================================================================
// VERSION MANAGEMENT
// =============================================================================

export {
  INTELLIGENCE_VERSION,
  MIN_COMPATIBLE_VERSION,
  VERSION_HISTORY,
  isLegacySession,
  needsUpgrade,
  getUpgradeMessage,
  getUpgradePrompt,
  compareVersions,
  isVersionCompatible,
  getVersionInfo,
  createVersionMetadata,
  hasFeature,
  logVersionInfo,
} from './version'

// =============================================================================
// PATTERNS (for advanced usage)
// =============================================================================

export {
  INTENT_PATTERNS,
  TOPIC_EXTRACTION_PATTERNS,
  MATH_PATTERNS,
  CONFUSION_PATTERNS,
  COMPLETION_PATTERNS,
  DISENGAGEMENT_PATTERNS,
  SHORT_REPLY_THRESHOLD,
  matchesPattern,
  extractTopic,
  extractMathExpressions,
} from './intent-patterns'

// =============================================================================
// QUERY ANALYSIS & SMART ROUTING (v2.1)
// =============================================================================

export type {
  QueryComplexity,
  ResponseLength as QueryResponseLength,
  ModelTier,
  QueryAnalysis,
} from './query-analyzer'

export {
  analyzeQuery,
  analyzeQueryFast,
  fastAnalyze,
  getResponseConfig,
} from './query-analyzer'

// =============================================================================
// MODEL ROUTING (v2.1)
// =============================================================================

export type {
  ModelConfig,
  RoutingDecision,
} from './model-router'

export {
  routeQuery,
  overrideRouting,
  getModelForTier,
  getLengthInstruction as getRoutingLengthInstruction,
  estimateCost,
  shouldUpgradeModel,
  shouldDowngradeModel,
  MODELS,
  LENGTH_INSTRUCTIONS,
} from './model-router'

// =============================================================================
// RESPONSE CACHING (v2.1)
// =============================================================================

export type {
  CacheScope,
  CacheStatus,
  CacheEntry,
  CacheLookupResult,
  CacheWriteResult,
} from './response-cache'

export {
  lookupCache,
  writeCache,
  invalidateCache,
  cleanupExpiredCache,
  getCacheStats,
  determineCacheScope,
  normalizeQuery,
  hashQuery,
  checkMemoryCache,
  addToMemoryCache,
  clearMemoryCache,
  CACHE_CONFIG,
} from './response-cache'
