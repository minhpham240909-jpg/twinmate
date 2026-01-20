/**
 * RAG (Retrieval Augmented Generation) System
 * Searches study materials, flashcards, and conversation history to provide context
 *
 * Features:
 * - Search user's flashcards for relevant content
 * - Search conversation history for context
 * - Search study session notes
 * - Combine with AI for enhanced responses
 * - SEMANTIC SEARCH: Uses OpenAI embeddings for intelligent matching
 *
 * SCALABILITY: Designed for 1000-3000 concurrent users with:
 * - Parallel query execution (Promise.all)
 * - Embedding caching (24hr TTL)
 * - Fallback to keyword search on failures
 * - No N+1 queries
 */

import { prisma } from '@/lib/prisma'
import {
  generateEmbedding,
  cosineSimilarity,
  normalizeText,
} from '@/lib/embeddings/openai-embeddings'

// =============================================================================
// SEMANTIC SEARCH CONFIGURATION
// =============================================================================

/**
 * SCALABILITY: Feature flags for gradual rollout
 */
const RAG_CONFIG = {
  // Enable semantic search (embeddings-based)
  useSemanticSearch: process.env.RAG_SEMANTIC_SEARCH !== 'false', // Default ON

  // Minimum similarity threshold for semantic matches (0-1)
  minSemanticSimilarity: 0.65,

  // Weight for semantic vs keyword score (0-1)
  semanticWeight: 0.7,
  keywordWeight: 0.3,

  // Fallback to keyword search on embedding errors
  fallbackOnError: true,

  // Max items to embed per search (for rate limiting)
  maxEmbeddingBatchSize: 50,

  // Enable debug logging
  debug: process.env.NODE_ENV === 'development' || process.env.RAG_DEBUG === 'true',
} as const

// Types
export interface RAGSearchResult {
  type: 'flashcard' | 'conversation' | 'note' | 'session_goal'
  content: string
  metadata: {
    id: string
    source: string
    relevanceScore?: number
    createdAt?: Date
  }
}

export interface RAGContext {
  results: RAGSearchResult[]
  totalResults: number
  searchQuery: string
  contextText: string
}

/**
 * Search user's flashcards for relevant content
 * ENHANCED: Uses semantic search with embeddings for better matching
 */
async function searchFlashcards(
  userId: string,
  query: string,
  limit: number = 5
): Promise<RAGSearchResult[]> {
  // Get user's flashcards
  const flashcards = await prisma.sessionFlashcard.findMany({
    where: { userId },
    select: {
      id: true,
      front: true,
      back: true,
      createdAt: true,
      session: {
        select: { subject: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: RAG_CONFIG.maxEmbeddingBatchSize, // Limit for embedding batch size
  })

  if (flashcards.length === 0) return []

  // Try semantic search first
  if (RAG_CONFIG.useSemanticSearch) {
    try {
      return await searchFlashcardsWithEmbeddings(flashcards, query, limit)
    } catch (error) {
      if (RAG_CONFIG.debug) {
        console.warn('[RAG] Semantic flashcard search failed, falling back to keyword:', error)
      }
      if (!RAG_CONFIG.fallbackOnError) throw error
      // Fall through to keyword search
    }
  }

  // Fallback: Keyword-based search
  return searchFlashcardsWithKeywords(flashcards, query, limit)
}

/**
 * SEMANTIC SEARCH: Search flashcards using embeddings
 * SCALABILITY: Uses cached embeddings, rate-limited API calls
 */
async function searchFlashcardsWithEmbeddings(
  flashcards: Array<{
    id: string
    front: string
    back: string
    createdAt: Date
    session: { subject: string | null } | null
  }>,
  query: string,
  limit: number
): Promise<RAGSearchResult[]> {
  // Generate query embedding (uses cache)
  const { embedding: queryEmbedding } = await generateEmbedding(
    normalizeText(query),
    'rag-flashcard-search'
  )

  // Calculate semantic similarity for each flashcard
  const scoredFlashcards = await Promise.all(
    flashcards.map(async (fc) => {
      const cardText = normalizeText(`${fc.front} ${fc.back}`)

      // Generate embedding for flashcard (uses cache)
      const { embedding: cardEmbedding } = await generateEmbedding(
        cardText,
        'rag-flashcard-content'
      )

      // Calculate cosine similarity
      const semanticScore = cosineSimilarity(queryEmbedding, cardEmbedding)

      // Also calculate keyword score for hybrid ranking
      const keywordScore = calculateKeywordScore(query, cardText)

      // Hybrid score: weighted combination
      const hybridScore =
        semanticScore * RAG_CONFIG.semanticWeight +
        keywordScore * RAG_CONFIG.keywordWeight

      return { flashcard: fc, semanticScore, keywordScore, hybridScore }
    })
  )

  // Filter by minimum similarity and sort by hybrid score
  const relevant = scoredFlashcards
    .filter((f) => f.semanticScore >= RAG_CONFIG.minSemanticSimilarity || f.keywordScore > 0)
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, limit)

  return relevant.map(({ flashcard, hybridScore }) => ({
    type: 'flashcard' as const,
    content: `Q: ${flashcard.front}\nA: ${flashcard.back}`,
    metadata: {
      id: flashcard.id,
      source: flashcard.session?.subject || 'Flashcard',
      relevanceScore: hybridScore,
      createdAt: flashcard.createdAt,
    },
  }))
}

/**
 * FALLBACK: Keyword-based flashcard search
 */
function searchFlashcardsWithKeywords(
  flashcards: Array<{
    id: string
    front: string
    back: string
    createdAt: Date
    session: { subject: string | null } | null
  }>,
  query: string,
  limit: number
): RAGSearchResult[] {
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2)

  const scoredFlashcards = flashcards.map((fc) => {
    const frontLower = fc.front.toLowerCase()
    const backLower = fc.back.toLowerCase()
    const combined = `${frontLower} ${backLower}`

    // Calculate relevance score
    let score = 0
    queryWords.forEach((word) => {
      if (combined.includes(word)) score += 1
      if (frontLower.includes(word)) score += 0.5 // Bonus for front match
    })

    // Exact phrase match bonus
    if (combined.includes(queryLower)) score += 3

    return { flashcard: fc, score }
  })

  // Filter and sort by score
  const relevant = scoredFlashcards
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return relevant.map(({ flashcard, score }) => ({
    type: 'flashcard' as const,
    content: `Q: ${flashcard.front}\nA: ${flashcard.back}`,
    metadata: {
      id: flashcard.id,
      source: flashcard.session?.subject || 'Flashcard',
      relevanceScore: score,
      createdAt: flashcard.createdAt,
    },
  }))
}

/**
 * Calculate keyword match score (for hybrid search)
 */
function calculateKeywordScore(query: string, text: string): number {
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2)

  if (queryWords.length === 0) return 0

  let matchCount = 0
  queryWords.forEach((word) => {
    if (textLower.includes(word)) matchCount++
  })

  // Normalize to 0-1 range
  const wordMatchRatio = matchCount / queryWords.length

  // Exact phrase match bonus
  const exactMatchBonus = textLower.includes(queryLower) ? 0.3 : 0

  return Math.min(1, wordMatchRatio + exactMatchBonus)
}

/**
 * Search conversation history for relevant messages
 * ENHANCED: Uses semantic search with embeddings for better matching
 */
async function searchConversations(
  userId: string,
  query: string,
  limit: number = 5
): Promise<RAGSearchResult[]> {
  // Get user's AI partner messages
  const messages = await prisma.aIPartnerMessage.findMany({
    where: {
      session: { userId },
      role: { in: ['USER', 'ASSISTANT'] },
      messageType: { in: ['CHAT', 'QUIZ', 'FLASHCARD'] },
    },
    select: {
      id: true,
      content: true,
      role: true,
      messageType: true,
      createdAt: true,
      session: {
        select: { subject: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: RAG_CONFIG.maxEmbeddingBatchSize, // Limit for embedding performance
  })

  if (messages.length === 0) return []

  // Try semantic search first
  if (RAG_CONFIG.useSemanticSearch) {
    try {
      return await searchConversationsWithEmbeddings(messages, query, limit)
    } catch (error) {
      if (RAG_CONFIG.debug) {
        console.warn('[RAG] Semantic conversation search failed, falling back to keyword:', error)
      }
      if (!RAG_CONFIG.fallbackOnError) throw error
      // Fall through to keyword search
    }
  }

  // Fallback: Keyword-based search
  return searchConversationsWithKeywords(messages, query, limit)
}

/**
 * SEMANTIC SEARCH: Search conversations using embeddings
 */
async function searchConversationsWithEmbeddings(
  messages: Array<{
    id: string
    content: string
    role: string
    messageType: string
    createdAt: Date
    session: { subject: string | null } | null
  }>,
  query: string,
  limit: number
): Promise<RAGSearchResult[]> {
  // Generate query embedding (uses cache)
  const { embedding: queryEmbedding } = await generateEmbedding(
    normalizeText(query),
    'rag-conversation-search'
  )

  // Calculate semantic similarity for each message
  const scoredMessages = await Promise.all(
    messages.map(async (msg) => {
      const msgText = normalizeText(msg.content.slice(0, 1000)) // Limit content length

      // Generate embedding for message (uses cache)
      const { embedding: msgEmbedding } = await generateEmbedding(
        msgText,
        'rag-conversation-content'
      )

      // Calculate cosine similarity
      const semanticScore = cosineSimilarity(queryEmbedding, msgEmbedding)

      // Also calculate keyword score for hybrid ranking
      const keywordScore = calculateKeywordScore(query, msgText)

      // Boost assistant messages (more informative)
      const roleBoost = msg.role === 'ASSISTANT' ? 1.1 : 1.0

      // Hybrid score: weighted combination with role boost
      const hybridScore =
        (semanticScore * RAG_CONFIG.semanticWeight +
          keywordScore * RAG_CONFIG.keywordWeight) *
        roleBoost

      return { message: msg, semanticScore, keywordScore, hybridScore }
    })
  )

  // Filter by minimum similarity and sort by hybrid score
  const relevant = scoredMessages
    .filter((m) => m.semanticScore >= RAG_CONFIG.minSemanticSimilarity || m.keywordScore > 0)
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, limit)

  return relevant.map(({ message, hybridScore }) => ({
    type: 'conversation' as const,
    content: message.content.slice(0, 500), // Truncate long messages
    metadata: {
      id: message.id,
      source: message.session?.subject || 'Conversation',
      relevanceScore: hybridScore,
      createdAt: message.createdAt,
    },
  }))
}

/**
 * FALLBACK: Keyword-based conversation search
 */
function searchConversationsWithKeywords(
  messages: Array<{
    id: string
    content: string
    role: string
    messageType: string
    createdAt: Date
    session: { subject: string | null } | null
  }>,
  query: string,
  limit: number
): RAGSearchResult[] {
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2)

  const scoredMessages = messages.map((msg) => {
    const contentLower = msg.content.toLowerCase()

    let score = 0
    queryWords.forEach((word) => {
      if (contentLower.includes(word)) score += 1
    })

    // Exact phrase match bonus
    if (contentLower.includes(queryLower)) score += 2

    // Boost assistant messages (more informative)
    if (msg.role === 'ASSISTANT') score *= 1.2

    return { message: msg, score }
  })

  const relevant = scoredMessages
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return relevant.map(({ message, score }) => ({
    type: 'conversation' as const,
    content: message.content.slice(0, 500), // Truncate long messages
    metadata: {
      id: message.id,
      source: message.session?.subject || 'Conversation',
      relevanceScore: score,
      createdAt: message.createdAt,
    },
  }))
}

/**
 * Search session notes
 */
async function searchNotes(
  userId: string,
  query: string,
  limit: number = 3
): Promise<RAGSearchResult[]> {
  // Get user's session notes
  const notes = await prisma.sessionNote.findMany({
    where: {
      session: { userId },
      content: { not: null },
    },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      session: {
        select: { subject: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  if (notes.length === 0) return []

  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)

  const scoredNotes = notes.map(note => {
    const contentLower = (note.content || '').toLowerCase()
    const titleLower = note.title.toLowerCase()

    let score = 0
    queryWords.forEach(word => {
      if (contentLower.includes(word)) score += 1
      if (titleLower.includes(word)) score += 2 // Title match is more important
    })

    if (contentLower.includes(queryLower)) score += 3

    return { note, score }
  })

  const relevant = scoredNotes
    .filter(n => n.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return relevant.map(({ note, score }) => ({
    type: 'note' as const,
    content: `${note.title}: ${(note.content || '').slice(0, 400)}`,
    metadata: {
      id: note.id,
      source: note.session?.subject || 'Note',
      relevanceScore: score,
      createdAt: note.createdAt,
    },
  }))
}

/**
 * Search session goals
 */
async function searchGoals(
  userId: string,
  query: string,
  limit: number = 3
): Promise<RAGSearchResult[]> {
  const goals = await prisma.sessionGoal.findMany({
    where: {
      session: { userId },
    },
    select: {
      id: true,
      title: true,
      description: true,
      isCompleted: true,
      createdAt: true,
      session: {
        select: { subject: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  if (goals.length === 0) return []

  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)

  const scoredGoals = goals.map(goal => {
    const titleLower = goal.title.toLowerCase()
    const descLower = (goal.description || '').toLowerCase()

    let score = 0
    queryWords.forEach(word => {
      if (titleLower.includes(word)) score += 2
      if (descLower.includes(word)) score += 1
    })

    return { goal, score }
  })

  const relevant = scoredGoals
    .filter(g => g.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return relevant.map(({ goal, score }) => ({
    type: 'session_goal' as const,
    content: `Goal: ${goal.title}${goal.description ? ` - ${goal.description}` : ''} (${goal.isCompleted ? 'Completed' : 'In Progress'})`,
    metadata: {
      id: goal.id,
      source: goal.session?.subject || 'Goal',
      relevanceScore: score,
      createdAt: goal.createdAt,
    },
  }))
}

/**
 * Main RAG search function - searches all sources
 */
export async function searchForContext(
  userId: string,
  query: string,
  options: {
    includeFlashcards?: boolean
    includeConversations?: boolean
    includeNotes?: boolean
    includeGoals?: boolean
    maxResults?: number
  } = {}
): Promise<RAGContext> {
  const {
    includeFlashcards = true,
    includeConversations = true,
    includeNotes = true,
    includeGoals = true,
    maxResults = 10,
  } = options

  // Search all sources in parallel
  const searchPromises: Promise<RAGSearchResult[]>[] = []

  if (includeFlashcards) {
    searchPromises.push(searchFlashcards(userId, query, 5))
  }
  if (includeConversations) {
    searchPromises.push(searchConversations(userId, query, 5))
  }
  if (includeNotes) {
    searchPromises.push(searchNotes(userId, query, 3))
  }
  if (includeGoals) {
    searchPromises.push(searchGoals(userId, query, 3))
  }

  const results = await Promise.all(searchPromises)
  const allResults = results.flat()

  // Sort by relevance score and take top results
  const sortedResults = allResults
    .sort((a, b) => (b.metadata.relevanceScore || 0) - (a.metadata.relevanceScore || 0))
    .slice(0, maxResults)

  // Build context text for AI
  let contextText = ''
  if (sortedResults.length > 0) {
    contextText = '\n\n## Relevant Context from User\'s Study History:\n'
    sortedResults.forEach((result, i) => {
      contextText += `\n[${result.type.toUpperCase()}] ${result.content}\n`
    })
    contextText += '\nUse this context to provide more personalized and relevant responses.'
  }

  return {
    results: sortedResults,
    totalResults: sortedResults.length,
    searchQuery: query,
    contextText,
  }
}

/**
 * Extract search intent from user message
 * Uses AI to understand what the user is asking about
 */
export async function extractSearchIntent(message: string): Promise<{
  shouldSearch: boolean
  searchQuery: string
  intent: 'question' | 'review' | 'practice' | 'general'
}> {
  // Quick heuristic checks first
  const questionPatterns = [
    /what (is|are|was|were|does|do)/i,
    /how (do|does|can|to)/i,
    /why (is|are|do|does)/i,
    /explain/i,
    /tell me about/i,
    /can you help/i,
    /remind me/i,
    /what did (we|i) (learn|study|cover)/i,
  ]

  const reviewPatterns = [
    /review/i,
    /go over/i,
    /let's practice/i,
    /quiz me/i,
    /test me/i,
    /flashcard/i,
  ]

  const isQuestion = questionPatterns.some(p => p.test(message))
  const isReview = reviewPatterns.some(p => p.test(message))

  // For short messages or greetings, don't search
  if (message.length < 15 || /^(hi|hello|hey|thanks|ok|sure)/i.test(message)) {
    return {
      shouldSearch: false,
      searchQuery: '',
      intent: 'general',
    }
  }

  // Determine intent and search query
  let intent: 'question' | 'review' | 'practice' | 'general' = 'general'
  let searchQuery = message

  if (isQuestion) {
    intent = 'question'
    // Extract key terms for search
    searchQuery = message
      .replace(/^(what|how|why|can you|please|could you|tell me|explain)/gi, '')
      .replace(/[?.,!]/g, '')
      .trim()
  } else if (isReview) {
    intent = 'review'
    searchQuery = message
      .replace(/^(let's|can we|please|i want to)/gi, '')
      .replace(/(review|practice|quiz|test|flashcard)/gi, '')
      .trim()
  }

  return {
    shouldSearch: (isQuestion || isReview) && searchQuery.length > 3,
    searchQuery: searchQuery || message.slice(0, 50),
    intent,
  }
}

/**
 * Enhance AI prompt with RAG context
 */
export async function enhancePromptWithRAG(
  userId: string,
  userMessage: string,
  currentSubject?: string
): Promise<{
  contextAdded: boolean
  ragContext: RAGContext | null
  enhancedSystemAddition: string
}> {
  // Check if we should search
  const { shouldSearch, searchQuery, intent } = await extractSearchIntent(userMessage)

  if (!shouldSearch) {
    return {
      contextAdded: false,
      ragContext: null,
      enhancedSystemAddition: '',
    }
  }

  // Search for relevant context
  const ragContext = await searchForContext(userId, searchQuery, {
    includeFlashcards: true,
    includeConversations: intent === 'question',
    includeNotes: true,
    includeGoals: intent === 'review',
    maxResults: 8,
  })

  if (ragContext.totalResults === 0) {
    return {
      contextAdded: false,
      ragContext,
      enhancedSystemAddition: '',
    }
  }

  return {
    contextAdded: true,
    ragContext,
    enhancedSystemAddition: ragContext.contextText,
  }
}

/**
 * Get study recommendations based on user's history
 */
export async function getStudyRecommendations(userId: string): Promise<{
  topicsToReview: string[]
  strugglingAreas: string[]
  recentTopics: string[]
  suggestedNextSteps: string[]
}> {
  // Get user's study data
  const [flashcards, sessions, memory] = await Promise.all([
    prisma.sessionFlashcard.findMany({
      where: { userId },
      select: {
        front: true,
        difficulty: true,
        correctCount: true,
        incorrectCount: true,
        session: { select: { subject: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    prisma.aIPartnerSession.findMany({
      where: { userId },
      select: { subject: true },
      orderBy: { startedAt: 'desc' },
      take: 20,
    }),
    prisma.aIUserMemory.findUnique({
      where: { userId },
      select: {
        currentSubjects: true,
        strugglingTopics: true,
        masteredTopics: true,
        academicGoals: true,
      },
    }),
  ])

  // Extract topics
  const recentTopics = [...new Set(sessions.map(s => s.subject).filter(Boolean) as string[])].slice(0, 5)

  // Find struggling areas from flashcards
  const strugglingFlashcards = flashcards
    .filter(f => f.incorrectCount > f.correctCount && f.incorrectCount >= 2)
    .map(f => f.session?.subject)
    .filter(Boolean) as string[]

  const strugglingAreas = [...new Set([
    ...(memory?.strugglingTopics || []),
    ...strugglingFlashcards,
  ])].slice(0, 5)

  // Topics needing review (not studied recently)
  const topicsToReview = (memory?.currentSubjects || [])
    .filter(s => !recentTopics.includes(s))
    .slice(0, 5)

  // Generate suggestions
  const suggestedNextSteps: string[] = []
  if (strugglingAreas.length > 0) {
    suggestedNextSteps.push(`Review ${strugglingAreas[0]} - you've had some difficulty here`)
  }
  if (topicsToReview.length > 0) {
    suggestedNextSteps.push(`Practice ${topicsToReview[0]} - it's been a while`)
  }
  if (memory?.academicGoals?.[0]) {
    suggestedNextSteps.push(`Work toward your goal: ${memory.academicGoals[0]}`)
  }

  return {
    topicsToReview,
    strugglingAreas,
    recentTopics,
    suggestedNextSteps,
  }
}
