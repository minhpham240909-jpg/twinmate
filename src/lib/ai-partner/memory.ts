/**
 * AI Memory System
 * Enables the AI to remember users across sessions
 *
 * Features:
 * - Long-term user memory storage
 * - Memory extraction from conversations
 * - Memory retrieval for context injection
 * - Memory importance scoring and decay
 */

import { prisma } from '@/lib/prisma'
import { AIMemoryCategory } from '@prisma/client'
import OpenAI from 'openai'

// Types
export interface UserMemory {
  preferredName?: string
  preferredLearningStyle?: string
  preferredDifficulty?: string
  preferredPace?: string
  currentSubjects: string[]
  masteredTopics: string[]
  strugglingTopics: string[]
  upcomingExams?: Array<{ subject: string; date: string; notes?: string }>
  academicGoals: string[]
  communicationStyle?: string
  motivationalNeeds?: string
  humorPreference?: string
  bestStudyTime?: string
  avgSessionLength?: number
  breakPreference?: string
  totalSessions: number
  totalStudyMinutes: number
  lastSessionDate?: Date
  streakDays: number
  importantFacts?: Array<{ fact: string; category: string; extractedAt: string }>
  lastTopicDiscussed?: string
  pendingQuestions: string[]
  customInstructions?: string
}

export interface MemoryEntry {
  id: string
  category: AIMemoryCategory
  importance: number
  content: string
  context?: string
  createdAt: Date
}

export interface ExtractedMemory {
  category: AIMemoryCategory
  content: string
  importance: number
  context?: string
}

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Default empty memory for when database tables don't exist yet
const DEFAULT_USER_MEMORY: UserMemory = {
  currentSubjects: [],
  masteredTopics: [],
  strugglingTopics: [],
  academicGoals: [],
  pendingQuestions: [],
  totalSessions: 0,
  totalStudyMinutes: 0,
  streakDays: 0,
}

/**
 * Get or create user memory
 * Gracefully returns default memory if database tables don't exist yet
 */
export async function getOrCreateUserMemory(userId: string): Promise<UserMemory> {
  try {
    let memory = await prisma.aIUserMemory.findUnique({
      where: { userId },
    })

    if (!memory) {
      // Create new memory for user
      memory = await prisma.aIUserMemory.create({
        data: {
          userId,
          currentSubjects: [],
          masteredTopics: [],
          strugglingTopics: [],
          academicGoals: [],
          pendingQuestions: [],
          totalSessions: 0,
          totalStudyMinutes: 0,
          streakDays: 0,
          longestStreak: 0,
        },
      })
    }

    return {
      preferredName: memory.preferredName || undefined,
      preferredLearningStyle: memory.preferredLearningStyle || undefined,
      preferredDifficulty: memory.preferredDifficulty || undefined,
      preferredPace: memory.preferredPace || undefined,
      currentSubjects: memory.currentSubjects,
      masteredTopics: memory.masteredTopics,
      strugglingTopics: memory.strugglingTopics,
      upcomingExams: memory.upcomingExams as UserMemory['upcomingExams'],
      academicGoals: memory.academicGoals,
      communicationStyle: memory.communicationStyle || undefined,
      motivationalNeeds: memory.motivationalNeeds || undefined,
      humorPreference: memory.humorPreference || undefined,
      bestStudyTime: memory.bestStudyTime || undefined,
      avgSessionLength: memory.avgSessionLength || undefined,
      breakPreference: memory.breakPreference || undefined,
      totalSessions: memory.totalSessions,
      totalStudyMinutes: memory.totalStudyMinutes,
      lastSessionDate: memory.lastSessionDate || undefined,
      streakDays: memory.streakDays,
      importantFacts: memory.importantFacts as UserMemory['importantFacts'],
      lastTopicDiscussed: memory.lastTopicDiscussed || undefined,
      pendingQuestions: memory.pendingQuestions,
      customInstructions: memory.customInstructions || undefined,
    }
  } catch (error) {
    // If table doesn't exist yet, return default empty memory
    console.warn('[Memory] AI memory table not available, using defaults:', error instanceof Error ? error.message : 'Unknown error')
    return DEFAULT_USER_MEMORY
  }
}

/**
 * Get relevant memory entries for context
 * Returns empty array if database tables don't exist yet
 */
export async function getRelevantMemories(
  userId: string,
  options: {
    categories?: AIMemoryCategory[]
    limit?: number
    minImportance?: number
  } = {}
): Promise<MemoryEntry[]> {
  try {
    const { categories, limit = 20, minImportance = 3 } = options

    const entries = await prisma.aIMemoryEntry.findMany({
      where: {
        userId,
        isActive: true,
        importance: { gte: minImportance },
        ...(categories ? { category: { in: categories } } : {}),
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: [
        { importance: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    })

    // Update access count for retrieved memories
    if (entries.length > 0) {
      await prisma.aIMemoryEntry.updateMany({
        where: { id: { in: entries.map(e => e.id) } },
        data: {
          lastAccessed: new Date(),
          accessCount: { increment: 1 },
        },
      })
    }

    return entries.map(e => ({
      id: e.id,
      category: e.category,
      importance: e.importance,
      content: e.content,
      context: e.context || undefined,
      createdAt: e.createdAt,
    }))
  } catch (error) {
    // If table doesn't exist yet, return empty array
    console.warn('[Memory] AI memory entries table not available:', error instanceof Error ? error.message : 'Unknown error')
    return []
  }
}

/**
 * Build memory context string for AI prompt
 * Loads comprehensive history including past session topics for ChatGPT-like memory
 */
export async function buildMemoryContext(userId: string, currentSubject?: string): Promise<string> {
  const [userMemory, memoryEntries, pastSessions] = await Promise.all([
    getOrCreateUserMemory(userId),
    getRelevantMemories(userId, { limit: 30 }), // Increased limit for more context
    // Get past session topics for comprehensive history
    prisma.aIPartnerSession.findMany({
      where: {
        userId,
        status: 'COMPLETED',
      },
      orderBy: { endedAt: 'desc' },
      take: 10, // Last 10 sessions for context
      select: {
        subject: true,
        messageCount: true,
        endedAt: true,
        rating: true,
      },
    }).catch(() => []), // Graceful fallback if table doesn't exist
  ])

  const contextParts: string[] = []

  // User preferences
  if (userMemory.preferredName) {
    contextParts.push(`- They prefer to be called "${userMemory.preferredName}"`)
  }
  if (userMemory.preferredLearningStyle) {
    contextParts.push(`- Their learning style is ${userMemory.preferredLearningStyle}`)
  }
  if (userMemory.preferredDifficulty) {
    contextParts.push(`- They prefer ${userMemory.preferredDifficulty} difficulty`)
  }
  if (userMemory.preferredPace) {
    contextParts.push(`- They like a ${userMemory.preferredPace} pace`)
  }
  if (userMemory.communicationStyle) {
    contextParts.push(`- They prefer ${userMemory.communicationStyle} communication`)
  }

  // Academic context
  if (userMemory.currentSubjects.length > 0) {
    contextParts.push(`- Currently studying: ${userMemory.currentSubjects.join(', ')}`)
  }
  if (userMemory.masteredTopics.length > 0) {
    contextParts.push(`- Has mastered: ${userMemory.masteredTopics.slice(0, 5).join(', ')}`)
  }
  if (userMemory.strugglingTopics.length > 0) {
    contextParts.push(`- Struggles with: ${userMemory.strugglingTopics.join(', ')}`)
  }
  if (userMemory.academicGoals.length > 0) {
    contextParts.push(`- Goals: ${userMemory.academicGoals.slice(0, 3).join(', ')}`)
  }

  // Study habits
  if (userMemory.bestStudyTime) {
    contextParts.push(`- Studies best in the ${userMemory.bestStudyTime}`)
  }
  if (userMemory.breakPreference) {
    contextParts.push(`- Prefers ${userMemory.breakPreference} study sessions`)
  }

  // Session history
  if (userMemory.totalSessions > 0) {
    contextParts.push(`- Has had ${userMemory.totalSessions} sessions (${Math.round(userMemory.totalStudyMinutes / 60)} hours total)`)
  }
  if (userMemory.streakDays > 0) {
    contextParts.push(`- Currently on a ${userMemory.streakDays}-day study streak!`)
  }

  // Last topic for continuity
  if (userMemory.lastTopicDiscussed) {
    contextParts.push(`- Last studied: "${userMemory.lastTopicDiscussed}"`)
  }

  // Pending questions
  if (userMemory.pendingQuestions.length > 0) {
    contextParts.push(`- Has pending questions: ${userMemory.pendingQuestions.slice(0, 2).join('; ')}`)
  }

  // Important facts from memory entries
  const importantFacts = memoryEntries
    .filter(e => e.category === 'PERSONAL_FACT' || e.category === 'ACHIEVEMENT')
    .slice(0, 5)
    .map(e => `- ${e.content}`)

  if (importantFacts.length > 0) {
    contextParts.push(...importantFacts)
  }

  // Study habits and feedback insights
  const studyInsights = memoryEntries
    .filter(e => e.category === 'STUDY_HABIT' || e.category === 'FEEDBACK')
    .slice(0, 3)
    .map(e => `- ${e.content}`)

  if (studyInsights.length > 0) {
    contextParts.push('\nStudy insights:')
    contextParts.push(...studyInsights)
  }

  // Past session history for comprehensive memory (like ChatGPT)
  if (pastSessions.length > 0) {
    const sessionHistory = pastSessions
      .filter(s => s.subject) // Only sessions with subjects
      .slice(0, 5)
      .map(s => {
        const date = s.endedAt ? new Date(s.endedAt).toLocaleDateString() : 'recently'
        return `  • ${s.subject} (${s.messageCount} messages, ${date})`
      })

    if (sessionHistory.length > 0) {
      contextParts.push('\nPrevious study sessions:')
      contextParts.push(...sessionHistory)
    }

    // If continuing same subject, add special note
    if (currentSubject) {
      const sameTopic = pastSessions.filter(s =>
        s.subject?.toLowerCase().includes(currentSubject.toLowerCase()) ||
        currentSubject.toLowerCase().includes(s.subject?.toLowerCase() || '')
      )
      if (sameTopic.length > 0) {
        contextParts.push(`\n⚡ Note: User is continuing with "${currentSubject}" - they've studied this ${sameTopic.length} time(s) before. Build on previous knowledge.`)
      }
    }
  }

  // Custom instructions
  if (userMemory.customInstructions) {
    contextParts.push(`\nUser's custom instructions: ${userMemory.customInstructions}`)
  }

  if (contextParts.length === 0) {
    return '' // No memory yet
  }

  return `\n\n## What I Remember About This User:\n${contextParts.join('\n')}\n\nUse this information to personalize the conversation. Reference past topics naturally when relevant. Be encouraging about their progress. If they're returning to a previous topic, acknowledge their dedication and help them build on what they learned before.`
}

/**
 * Extract memories from a conversation using AI
 */
export async function extractMemoriesFromConversation(params: {
  userId: string
  sessionId: string
  messages: Array<{ role: string; content: string; id?: string }>
}): Promise<ExtractedMemory[]> {
  const { messages } = params

  // Only process if we have enough messages
  if (messages.length < 3) {
    return []
  }

  // Build conversation text
  const conversationText = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-20) // Last 20 messages
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
    .join('\n')

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are a memory extraction system. Analyze the conversation and extract important facts about the user that should be remembered for future sessions.

Extract ONLY facts that are:
1. Personally relevant (preferences, struggles, goals)
2. Academically relevant (subjects, topics, exams)
3. Behavioral patterns (study habits, communication preferences)

Output as JSON array. Each item should have:
- category: One of PREFERENCE, ACADEMIC, PERSONAL_FACT, STUDY_HABIT, ACHIEVEMENT, STRUGGLE, GOAL, FEEDBACK
- content: The fact to remember (concise, 1-2 sentences)
- importance: 1-10 (10 = extremely important to remember)
- context: Brief context of when this was mentioned

If no notable facts found, return empty array [].
Be selective - only extract truly memorable information.`,
        },
        {
          role: 'user',
          content: `Extract memories from this conversation:\n\n${conversationText}`,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const result = response.choices[0]?.message?.content
    if (!result) return []

    const parsed = JSON.parse(result)
    const memories: ExtractedMemory[] = (parsed.memories || parsed || [])
      .filter((m: ExtractedMemory) => m.category && m.content && m.importance)
      .map((m: ExtractedMemory) => ({
        category: m.category as AIMemoryCategory,
        content: m.content,
        importance: Math.min(10, Math.max(1, m.importance)),
        context: m.context,
      }))

    return memories
  } catch (error) {
    console.error('[Memory] Failed to extract memories:', error)
    return []
  }
}

/**
 * Save extracted memories to database
 * Returns 0 if database tables don't exist yet
 */
export async function saveMemories(params: {
  userId: string
  sessionId: string
  memories: ExtractedMemory[]
  messageId?: string
}): Promise<number> {
  const { userId, sessionId, memories, messageId } = params

  if (memories.length === 0) return 0

  try {
    // Check for duplicates by comparing content similarity
    const existingMemories = await prisma.aIMemoryEntry.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        content: true,
        category: true,
      },
    })

    const existingContentLower = existingMemories.map(m => m.content.toLowerCase())

    // Filter out duplicates
    const newMemories = memories.filter(m => {
      const contentLower = m.content.toLowerCase()
      return !existingContentLower.some(existing =>
        existing.includes(contentLower) || contentLower.includes(existing)
      )
    })

    if (newMemories.length === 0) return 0

    // Save new memories
    await prisma.aIMemoryEntry.createMany({
      data: newMemories.map(m => ({
        userId,
        sessionId,
        messageId,
        category: m.category,
        content: m.content,
        importance: m.importance,
        context: m.context,
        isActive: true,
      })),
    })

    return newMemories.length
  } catch (error) {
    console.warn('[Memory] Failed to save memories (table may not exist):', error instanceof Error ? error.message : 'Unknown error')
    return 0
  }
}

/**
 * Update user memory from session data
 * Silently fails if database tables don't exist yet
 */
export async function updateUserMemoryFromSession(params: {
  userId: string
  sessionId: string
  subject?: string
  durationMinutes: number
  topicsDiscussed?: string[]
}): Promise<void> {
  const { userId, subject, durationMinutes, topicsDiscussed } = params

  try {
    const memory = await getOrCreateUserMemory(userId)

    // If we got default memory (tables don't exist), skip update
    if (memory === DEFAULT_USER_MEMORY) {
      return
    }

    // Calculate streak
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let newStreakDays = memory.streakDays
    if (memory.lastSessionDate) {
      const lastDate = new Date(memory.lastSessionDate)
      lastDate.setHours(0, 0, 0, 0)

      const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysDiff === 1) {
        // Consecutive day - increase streak
        newStreakDays = memory.streakDays + 1
      } else if (daysDiff > 1) {
        // Streak broken
        newStreakDays = 1
      }
      // If daysDiff === 0, same day, keep streak as is
    } else {
      // First session ever
      newStreakDays = 1
    }

    // Update memory
    await prisma.aIUserMemory.update({
      where: { userId },
      data: {
        totalSessions: { increment: 1 },
        totalStudyMinutes: { increment: durationMinutes },
        lastSessionDate: new Date(),
        streakDays: newStreakDays,
        longestStreak: Math.max(memory.streakDays, newStreakDays),
        lastTopicDiscussed: subject || topicsDiscussed?.[0] || memory.lastTopicDiscussed,
        // Add subject to current subjects if new
        ...(subject && !memory.currentSubjects.includes(subject) ? {
          currentSubjects: [...memory.currentSubjects, subject].slice(-10),
        } : {}),
      },
    })
  } catch (error) {
    console.warn('[Memory] Failed to update user memory (table may not exist):', error instanceof Error ? error.message : 'Unknown error')
  }
}

/**
 * Update specific user memory field
 * Silently fails if database tables don't exist yet
 */
export async function updateUserMemoryField(
  userId: string,
  field: keyof UserMemory,
  value: unknown
): Promise<void> {
  try {
    await prisma.aIUserMemory.upsert({
      where: { userId },
      create: {
        userId,
        [field]: value,
        currentSubjects: [],
        masteredTopics: [],
        strugglingTopics: [],
        academicGoals: [],
        pendingQuestions: [],
        totalSessions: 0,
        totalStudyMinutes: 0,
        streakDays: 0,
        longestStreak: 0,
      },
      update: {
        [field]: value,
      },
    })
  } catch (error) {
    console.warn('[Memory] Failed to update memory field (table may not exist):', error instanceof Error ? error.message : 'Unknown error')
  }
}

/**
 * Add to array field in user memory
 */
export async function addToUserMemoryArray(
  userId: string,
  field: 'currentSubjects' | 'masteredTopics' | 'strugglingTopics' | 'academicGoals' | 'pendingQuestions',
  value: string
): Promise<void> {
  const memory = await getOrCreateUserMemory(userId)
  const currentArray = memory[field] as string[]

  if (!currentArray.includes(value)) {
    await updateUserMemoryField(userId, field, [...currentArray, value])
  }
}

/**
 * Remove from array field in user memory
 */
export async function removeFromUserMemoryArray(
  userId: string,
  field: 'currentSubjects' | 'masteredTopics' | 'strugglingTopics' | 'academicGoals' | 'pendingQuestions',
  value: string
): Promise<void> {
  const memory = await getOrCreateUserMemory(userId)
  const currentArray = memory[field] as string[]

  await updateUserMemoryField(userId, field, currentArray.filter(v => v !== value))
}

/**
 * Deactivate old or low-importance memories (memory cleanup)
 * Returns 0 if database tables don't exist yet
 */
export async function cleanupMemories(userId: string): Promise<number> {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Deactivate old, low-importance, rarely accessed memories
    const result = await prisma.aIMemoryEntry.updateMany({
      where: {
        userId,
        isActive: true,
        importance: { lte: 3 },
        accessCount: { lte: 2 },
        createdAt: { lt: thirtyDaysAgo },
      },
      data: {
        isActive: false,
      },
    })

    return result.count
  } catch (error) {
    console.warn('[Memory] Failed to cleanup memories (table may not exist):', error instanceof Error ? error.message : 'Unknown error')
    return 0
  }
}

/**
 * Get memory stats for user
 * Returns default stats if database tables don't exist yet
 */
export async function getMemoryStats(userId: string): Promise<{
  totalMemories: number
  activeMemories: number
  categoryCounts: Record<string, number>
  totalStudyMinutes: number
  streakDays: number
}> {
  try {
    const [memoryCount, categoryAggregation, userMemory] = await Promise.all([
      prisma.aIMemoryEntry.count({
        where: { userId },
      }),
      prisma.aIMemoryEntry.groupBy({
        by: ['category'],
        where: { userId, isActive: true },
        _count: { category: true },
      }),
      getOrCreateUserMemory(userId),
    ])

    const activeCount = await prisma.aIMemoryEntry.count({
      where: { userId, isActive: true },
    })

    const categoryCounts: Record<string, number> = {}
    categoryAggregation.forEach(cat => {
      categoryCounts[cat.category] = cat._count.category
    })

    return {
      totalMemories: memoryCount,
      activeMemories: activeCount,
      categoryCounts,
      totalStudyMinutes: userMemory.totalStudyMinutes,
      streakDays: userMemory.streakDays,
    }
  } catch (error) {
    console.warn('[Memory] Failed to get memory stats (table may not exist):', error instanceof Error ? error.message : 'Unknown error')
    return {
      totalMemories: 0,
      activeMemories: 0,
      categoryCounts: {},
      totalStudyMinutes: 0,
      streakDays: 0,
    }
  }
}
