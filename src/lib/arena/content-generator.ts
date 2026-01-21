/**
 * Practice Arena - Content Generator
 *
 * Generates quiz questions from various sources:
 * - AI-generated from topic (with caching)
 * - Extracted from uploaded content (PDF/notes)
 * - From user's study history (flashcards)
 * - From existing flashcard decks
 *
 * Performance optimizations:
 * - Topic caching: Common topics are cached for 24 hours
 * - Memory fallback: In-memory cache when Redis unavailable
 * - Batch generation: Questions generated in small batches for speed
 */

import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { cacheGet, cacheSet, CacheTTL, isRedisAvailable } from '@/lib/redis'
import type { GeneratedQuestion, ArenaContentSource } from './types'

// SCALE: OpenAI request timeout (30 seconds) for 2000-3000 concurrent users
const OPENAI_REQUEST_TIMEOUT = 30000

// Initialize OpenAI client with timeout
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: OPENAI_REQUEST_TIMEOUT,
  maxRetries: 2,
})

const DEFAULT_MODEL = 'gpt-4o-mini'

// ==========================================
// TOPIC CACHING SYSTEM
// ==========================================

// In-memory cache fallback for when Redis is unavailable
const topicCache = new Map<string, { data: GeneratedQuestion[]; expiresAt: number }>()

// Normalize topic for cache key
function normalizeTopicKey(topic: string): string {
  return topic.toLowerCase().trim().replace(/\s+/g, '_').slice(0, 100)
}

// Get cache key for topic questions
function getTopicCacheKey(topic: string, difficulty: string, count: number): string {
  return `arena:questions:${normalizeTopicKey(topic)}:${difficulty}:${count}`
}

// Check memory cache
function getFromTopicCache(key: string): GeneratedQuestion[] | null {
  const cached = topicCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    console.log('[Arena Cache] Memory cache hit for:', key)
    return cached.data
  }
  if (cached) {
    topicCache.delete(key)
  }
  return null
}

// Set memory cache (with size limit to prevent memory issues)
function setTopicCache(key: string, data: GeneratedQuestion[], ttlSeconds: number): void {
  // Limit cache size
  if (topicCache.size > 200) {
    const firstKey = topicCache.keys().next().value
    if (firstKey) topicCache.delete(firstKey)
  }
  topicCache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 })
  console.log('[Arena Cache] Cached questions for:', key)
}

// Try to get cached questions (Redis first, then memory)
async function getCachedQuestions(cacheKey: string): Promise<GeneratedQuestion[] | null> {
  // Try Redis first
  if (isRedisAvailable()) {
    try {
      const cached = await cacheGet<GeneratedQuestion[] | null>(
        cacheKey,
        async () => null,
        0
      )
      if (cached && Array.isArray(cached) && cached.length > 0) {
        console.log('[Arena Cache] Redis cache hit for:', cacheKey)
        return cached
      }
    } catch (err) {
      console.error('[Arena Cache] Redis error:', err)
    }
  }

  // Try memory cache
  return getFromTopicCache(cacheKey)
}

// Cache questions in both Redis and memory
async function cacheQuestions(cacheKey: string, questions: GeneratedQuestion[]): Promise<void> {
  const ttl = CacheTTL.ARENA_TOPIC_QUESTIONS

  // Cache in Redis (fire and forget)
  if (isRedisAvailable()) {
    cacheSet(cacheKey, questions, ttl).catch(err => {
      console.error('[Arena Cache] Failed to cache in Redis:', err)
    })
  }

  // Also cache in memory
  setTopicCache(cacheKey, questions, ttl)
}

/**
 * Generate quiz questions from an AI topic
 *
 * Features:
 * - Caching: Common topics cached for 24 hours (Redis + memory)
 * - Batch generation: Questions generated in batches for quality
 * - Fallback: Placeholders if generation fails
 *
 * @param topic - The topic to generate questions about
 * @param count - Number of questions to generate
 * @param difficulty - Question difficulty level
 * @param skipCache - If true, bypass cache and generate fresh questions
 * @returns Array of generated questions
 */
export async function generateQuestionsFromTopic(
  topic: string,
  count: number = 10,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  skipCache: boolean = false
): Promise<GeneratedQuestion[]> {
  const startTime = Date.now()
  const cacheKey = getTopicCacheKey(topic, difficulty, count)

  // Check cache first (unless skipped)
  if (!skipCache) {
    const cached = await getCachedQuestions(cacheKey)
    if (cached && cached.length >= count) {
      console.log(`[Arena] Cache hit for topic "${topic}" - ${Date.now() - startTime}ms`)
      // Shuffle cached questions for variety
      const shuffled = [...cached].sort(() => Math.random() - 0.5)
      return shuffled.slice(0, count)
    }
  }

  const questions: GeneratedQuestion[] = []

  // Generate in batches of 4 for faster response (slightly smaller batches)
  const batchSize = 4
  const batches = Math.ceil(count / batchSize)

  for (let batch = 0; batch < batches; batch++) {
    const remaining = count - questions.length
    const batchCount = Math.min(batchSize, remaining)

    if (batchCount <= 0) break

    try {
      const systemPrompt = `You are a quiz generator for a competitive learning game.
Generate ${batchCount} multiple choice questions about the topic.

RULES:
1. Each question must have exactly 4 options
2. Questions should be ${difficulty} difficulty
3. Include a brief explanation for each correct answer
4. Questions should be engaging and test real understanding
5. Avoid yes/no questions - make them thought-provoking
6. For math/science, use LaTeX with $..$ for inline and $$...$$ for display
7. Make questions diverse - cover different aspects of the topic

Return JSON array: [{"question":"text","options":["A","B","C","D"],"correctAnswer":0-3,"explanation":"why correct"}]`

      const previousQuestions = questions.slice(-2).map(q => q.question.slice(0, 40)).join('; ')

      const userPrompt = `Topic: ${topic}
Difficulty: ${difficulty}
${previousQuestions ? `Different from: ${previousQuestions}` : ''}

Generate ${batchCount} unique quiz questions.`

      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      })

      const content = completion.choices[0]?.message?.content || '{"questions":[]}'
      const parsed = JSON.parse(content)

      // Handle both array and object with questions key
      const newQuestions = Array.isArray(parsed) ? parsed : (parsed.questions || [])

      for (const q of newQuestions) {
        if (q.question && q.options && q.options.length === 4) {
          questions.push({
            question: q.question,
            options: q.options,
            correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
            explanation: q.explanation || 'Correct answer.',
          })
        }
      }
    } catch (error) {
      console.error('[Arena] Failed to generate batch:', error)
      // Continue with next batch
    }
  }

  // If we couldn't generate enough, pad with placeholder
  while (questions.length < count) {
    questions.push({
      question: `Question ${questions.length + 1} about ${topic}`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 0,
      explanation: 'This is a placeholder question.',
    })
  }

  const result = questions.slice(0, count)

  // Cache the generated questions (fire and forget)
  if (result.length > 0 && !result.every(q => q.question.startsWith('Question '))) {
    cacheQuestions(cacheKey, result).catch(err => {
      console.error('[Arena] Failed to cache questions:', err)
    })
  }

  console.log(`[Arena] Generated ${result.length} questions for "${topic}" in ${Date.now() - startTime}ms`)
  return result
}

/**
 * Generate quiz questions from uploaded images using vision
 *
 * @param imageDataUrls - Array of base64 image data URLs
 * @param count - Number of questions to generate
 * @returns Array of generated questions
 */
export async function generateQuestionsFromImages(
  imageDataUrls: string[],
  count: number = 10
): Promise<GeneratedQuestion[]> {
  try {
    const systemPrompt = `You are a quiz generator. Analyze the provided images (notes, textbook pages, slides) and create quiz questions based on the content you see.

RULES:
1. Questions MUST be based on what you can see in the images
2. Each question has exactly 4 options
3. Mix difficulty (some easy recall, some require understanding)
4. Include explanation for each answer
5. For math/science, use LaTeX with $..$ or $$..$$
6. Be thorough - extract as much testable content as possible

Return JSON: {"questions":[{"question":"text","options":["A","B","C","D"],"correctAnswer":0-3,"explanation":"why"}]}`

    // Build the content array with images
    const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
      { type: 'text', text: `Analyze these ${imageDataUrls.length} image(s) and generate ${count} quiz questions based on the content.` },
    ]

    // Add each image
    for (const imageDataUrl of imageDataUrls) {
      content.push({
        type: 'image_url',
        image_url: { url: imageDataUrl },
      })
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Use gpt-4o for vision capabilities
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    })

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{"questions":[]}')
    const questions = parsed.questions || []

    return questions
      .filter((q: GeneratedQuestion) => q.question && q.options?.length === 4)
      .slice(0, count)
      .map((q: GeneratedQuestion) => ({
        question: q.question,
        options: q.options,
        correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
        explanation: q.explanation || 'Correct!',
      }))
  } catch (error) {
    console.error('[Arena] Failed to generate from images:', error)
    throw new Error('Failed to generate questions from images')
  }
}

/**
 * Generate quiz questions from uploaded content (text extracted from PDF/notes)
 *
 * @param content - The text content to generate questions from
 * @param count - Number of questions to generate
 * @returns Array of generated questions
 */
export async function generateQuestionsFromContent(
  content: string,
  count: number = 10
): Promise<GeneratedQuestion[]> {
  // Truncate content if too long (leave room for response)
  const maxContentLength = 8000
  const truncatedContent = content.length > maxContentLength
    ? content.slice(0, maxContentLength) + '...'
    : content

  try {
    const systemPrompt = `You are a quiz generator. Create questions based ONLY on the provided content.
Generate ${count} multiple choice questions that test understanding of the material.

RULES:
1. Questions MUST be answerable from the provided content
2. Each question has exactly 4 options
3. Mix difficulty (some easy recall, some require understanding)
4. Include explanation referencing the content
5. For math/science, use LaTeX with $..$ or $$..$$

Return JSON: {"questions":[{"question":"text","options":["A","B","C","D"],"correctAnswer":0-3,"explanation":"why"}]}`

    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Content:\n${truncatedContent}\n\nGenerate ${count} quiz questions from this content.` },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    })

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{"questions":[]}')
    const questions = parsed.questions || []

    return questions
      .filter((q: GeneratedQuestion) => q.question && q.options?.length === 4)
      .slice(0, count)
      .map((q: GeneratedQuestion) => ({
        question: q.question,
        options: q.options,
        correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
        explanation: q.explanation || 'Correct!',
      }))
  } catch (error) {
    console.error('[Arena] Failed to generate from content:', error)
    throw new Error('Failed to generate questions from content')
  }
}

/**
 * Generate quiz questions from user's study history
 *
 * Pulls flashcards and converts them to multiple choice questions
 *
 * @param userId - The user's ID
 * @param count - Number of questions to generate
 * @returns Array of generated questions
 */
export async function generateQuestionsFromHistory(
  userId: string,
  count: number = 10
): Promise<GeneratedQuestion[]> {
  try {
    // Fetch user's recent flashcards
    const flashcards = await prisma.flashcardCard.findMany({
      where: {
        deck: { userId },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        front: true,
        back: true,
        explanation: true,
      },
    })

    if (flashcards.length === 0) {
      throw new Error('No flashcards found in study history')
    }

    // Shuffle and select
    const shuffled = flashcards.sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, count)

    // Convert flashcards to quiz questions
    const questions: GeneratedQuestion[] = []

    for (const card of selected) {
      // Generate distractors (wrong answers) from other flashcards
      const distractors = shuffled
        .filter(c => c.id !== card.id && c.back !== card.back)
        .map(c => c.back)
        .slice(0, 3)

      // Pad with generic distractors if needed
      while (distractors.length < 3) {
        distractors.push(`Not the correct answer ${distractors.length + 1}`)
      }

      // Create options with correct answer at random position
      const correctIndex = Math.floor(Math.random() * 4)
      const options = [...distractors.slice(0, 3)]
      options.splice(correctIndex, 0, card.back)

      questions.push({
        question: card.front,
        options: options.slice(0, 4),
        correctAnswer: correctIndex,
        explanation: card.explanation || `The answer is: ${card.back}`,
      })
    }

    return questions
  } catch (error) {
    console.error('[Arena] Failed to generate from history:', error)
    throw new Error('Failed to generate questions from study history')
  }
}

/**
 * Get quiz questions from an existing flashcard deck
 *
 * @param deckId - The flashcard deck ID
 * @param count - Number of questions to generate
 * @returns Array of generated questions
 */
export async function getQuestionsFromDeck(
  deckId: string,
  count: number = 10
): Promise<GeneratedQuestion[]> {
  try {
    // Fetch deck and cards
    const deck = await prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      include: {
        cards: {
          orderBy: { position: 'asc' },
        },
      },
    })

    if (!deck) {
      throw new Error('Flashcard deck not found')
    }

    if (deck.cards.length === 0) {
      throw new Error('Flashcard deck is empty')
    }

    // Shuffle and select cards
    const shuffled = [...deck.cards].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, count)

    // Convert to quiz questions
    const questions: GeneratedQuestion[] = []

    for (const card of selected) {
      // Generate distractors from other cards in deck
      const distractors = shuffled
        .filter(c => c.id !== card.id && c.back !== card.back)
        .map(c => c.back)
        .slice(0, 3)

      // Pad with generic distractors if needed
      while (distractors.length < 3) {
        distractors.push(`Option ${distractors.length + 1}`)
      }

      // Randomize correct answer position
      const correctIndex = Math.floor(Math.random() * 4)
      const options = [...distractors.slice(0, 3)]
      options.splice(correctIndex, 0, card.back)

      questions.push({
        question: card.front,
        options: options.slice(0, 4),
        correctAnswer: correctIndex,
        explanation: card.explanation || `The answer is: ${card.back}`,
      })
    }

    return questions
  } catch (error) {
    console.error('[Arena] Failed to get questions from deck:', error)
    throw new Error('Failed to get questions from flashcard deck')
  }
}

/**
 * Main function to generate questions based on content source
 *
 * @param source - The content source type
 * @param options - Source-specific options
 * @returns Array of generated questions
 */
export async function generateQuestions(
  source: ArenaContentSource,
  options: {
    topic?: string
    content?: string
    imageData?: string[] // Array of base64 image data URLs
    deckId?: string
    userId?: string
    count?: number
    difficulty?: 'easy' | 'medium' | 'hard'
  }
): Promise<GeneratedQuestion[]> {
  const count = options.count || 10

  switch (source) {
    case 'AI_GENERATED':
      if (!options.topic) {
        throw new Error('Topic is required for AI-generated questions')
      }
      return generateQuestionsFromTopic(options.topic, count, options.difficulty)

    case 'UPLOAD':
      // Check if we have image data (uploaded images)
      if (options.imageData && options.imageData.length > 0) {
        return generateQuestionsFromImages(options.imageData, count)
      }
      // Otherwise use text content
      if (!options.content) {
        throw new Error('Content or images are required for uploaded questions')
      }
      return generateQuestionsFromContent(options.content, count)

    case 'STUDY_HISTORY':
      if (!options.userId) {
        throw new Error('User ID is required for study history questions')
      }
      return generateQuestionsFromHistory(options.userId, count)

    case 'DECK':
      if (!options.deckId) {
        throw new Error('Deck ID is required for deck questions')
      }
      return getQuestionsFromDeck(options.deckId, count)

    default:
      throw new Error(`Unknown content source: ${source}`)
  }
}
