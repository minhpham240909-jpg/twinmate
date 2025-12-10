/**
 * AI Partner Service
 * Manages AI partner sessions, messages, and interactions
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  sendChatMessage,
  moderateContent,
  buildStudyPartnerSystemPrompt,
  buildDynamicPersonaPrompt,
  generateQuizQuestion,
  generateFlashcards,
  generateFlashcardsFromChat,
  generateQuizFromChat,
  analyzeWhiteboardImage,
  generateSessionSummary,
  checkContentSafety,
  AIMessage,
  SearchCriteria,
} from './openai'
import {
  buildMemoryContext,
  extractMemoriesFromConversation,
  saveMemories,
  updateUserMemoryFromSession,
  getOrCreateUserMemory,
} from './memory'
import type { AISessionStatus, AIMessageRole, AIMessageType, SkillLevel } from '@prisma/client'

// Types
export interface CreateAISessionParams {
  userId: string
  subject?: string
  skillLevel?: SkillLevel
  studyGoal?: string
  personaId?: string
}

// Extended params for dynamic persona from search
export interface CreateAISessionFromSearchParams {
  userId: string
  searchCriteria: SearchCriteria
  studyGoal?: string
}

export interface SendMessageParams {
  sessionId: string
  userId: string
  content: string
  messageType?: AIMessageType
}

export interface AISessionWithMessages {
  id: string
  userId: string
  subject: string | null
  skillLevel: SkillLevel | null
  studyGoal: string | null
  status: AISessionStatus
  startedAt: Date
  endedAt: Date | null
  messageCount: number
  messages: Array<{
    id: string
    role: AIMessageRole
    content: string
    messageType: AIMessageType
    wasFlagged: boolean
    createdAt: Date
  }>
}

/**
 * Create a new AI partner session
 */
export async function createAISession(params: CreateAISessionParams): Promise<{
  session: AISessionWithMessages
  welcomeMessage: string
}> {
  const { userId, subject, skillLevel, studyGoal, personaId } = params

  // Get user info for personalization
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  })

  // Get persona if provided, or use default
  let persona = null
  if (personaId) {
    persona = await prisma.aIPartnerPersona.findUnique({
      where: { id: personaId },
    })
  }
  if (!persona) {
    persona = await prisma.aIPartnerPersona.findFirst({
      where: { isDefault: true, isActive: true },
    })
  }

  // Get user memory for personalization
  const userMemory = await getOrCreateUserMemory(userId)
  const memoryContext = await buildMemoryContext(userId)

  // Create study session first (for integration with existing session features)
  const studySession = await prisma.studySession.create({
    data: {
      title: `AI Study Session${subject ? `: ${subject}` : ''}`,
      type: 'AI_PARTNER',
      status: 'ACTIVE',
      createdBy: userId,
      userId: userId,
      subject: subject,
      isAISession: true,
      partnerType: 'AI',
      aiPersonaId: personaId,
      startedAt: new Date(),
    },
  })

  // Create AI session
  const aiSession = await prisma.aIPartnerSession.create({
    data: {
      userId,
      studySessionId: studySession.id,
      personaId: persona?.id,
      subject,
      skillLevel,
      studyGoal,
      status: 'ACTIVE',
    },
  })

  // Build system prompt with memory context
  let systemPrompt = buildStudyPartnerSystemPrompt({
    subject: subject || undefined,
    skillLevel: skillLevel || undefined,
    studyGoal: studyGoal || undefined,
    userName: userMemory.preferredName || user?.name || undefined,
    customPersona: persona?.systemPrompt || undefined,
  })

  // Append memory context to system prompt
  if (memoryContext) {
    systemPrompt += memoryContext
  }

  // Build welcome instruction based on memory
  let welcomeInstruction = 'Start the session with a warm greeting.'
  if (userMemory.totalSessions > 0) {
    welcomeInstruction = `This is a returning user who has had ${userMemory.totalSessions} sessions. Welcome them back warmly. ${userMemory.lastTopicDiscussed ? `Last time you discussed "${userMemory.lastTopicDiscussed}".` : ''} ${userMemory.streakDays > 1 ? `They're on a ${userMemory.streakDays}-day study streak - acknowledge it!` : ''}`
  }

  // Generate welcome message
  const welcomeResult = await sendChatMessage(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: welcomeInstruction },
    ],
    {
      temperature: persona?.temperature || 0.7,
      maxTokens: persona?.maxTokens || 300,
    }
  )

  // Save the system prompt as first message (hidden from user)
  await prisma.aIPartnerMessage.create({
    data: {
      sessionId: aiSession.id,
      studySessionId: studySession.id,
      role: 'SYSTEM',
      content: systemPrompt,
      messageType: 'CHAT',
      wasModerated: false,
    },
  })

  // Save AI welcome message
  const welcomeMsg = await prisma.aIPartnerMessage.create({
    data: {
      sessionId: aiSession.id,
      studySessionId: studySession.id,
      role: 'ASSISTANT',
      content: welcomeResult.content,
      messageType: 'CHAT',
      wasModerated: false,
      promptTokens: welcomeResult.promptTokens,
      completionTokens: welcomeResult.completionTokens,
      totalTokens: welcomeResult.totalTokens,
    },
  })

  // Update message count
  await prisma.aIPartnerSession.update({
    where: { id: aiSession.id },
    data: { messageCount: 1 },
  })

  // Update persona usage count
  if (persona) {
    await prisma.aIPartnerPersona.update({
      where: { id: persona.id },
      data: { usageCount: { increment: 1 } },
    })
  }

  return {
    session: {
      id: aiSession.id,
      userId: aiSession.userId,
      subject: aiSession.subject,
      skillLevel: aiSession.skillLevel,
      studyGoal: aiSession.studyGoal,
      status: aiSession.status,
      startedAt: aiSession.startedAt,
      endedAt: aiSession.endedAt,
      messageCount: 1,
      messages: [
        {
          id: welcomeMsg.id,
          role: welcomeMsg.role,
          content: welcomeMsg.content,
          messageType: welcomeMsg.messageType,
          wasFlagged: welcomeMsg.wasFlagged,
          createdAt: welcomeMsg.createdAt,
        },
      ],
    },
    welcomeMessage: welcomeResult.content,
  }
}

/**
 * Create an AI partner session from search criteria
 * This creates a dynamic persona based on what the user was searching for
 */
export async function createAISessionFromSearch(params: CreateAISessionFromSearchParams): Promise<{
  session: AISessionWithMessages
  welcomeMessage: string
  personaDescription: string
}> {
  const { userId, searchCriteria, studyGoal } = params

  // Get user info for personalization
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  })

  // Get user memory for personalization
  const userMemory = await getOrCreateUserMemory(userId)
  const memoryContext = await buildMemoryContext(userId)

  // Build subject string from criteria
  const subject = searchCriteria.subjects?.join(', ') || searchCriteria.subjectDescription || null

  // Build a description of the persona for display
  const personaParts: string[] = []
  if (subject) personaParts.push(subject)
  if (searchCriteria.school) personaParts.push(searchCriteria.school)
  if (searchCriteria.locationCity) personaParts.push(searchCriteria.locationCity)
  if (searchCriteria.locationCountry && !searchCriteria.locationCity) {
    personaParts.push(searchCriteria.locationCountry)
  }
  if (searchCriteria.skillLevel) {
    personaParts.push(searchCriteria.skillLevel.charAt(0) + searchCriteria.skillLevel.slice(1).toLowerCase())
  }
  const personaDescription = personaParts.length > 0
    ? personaParts.join(' • ')
    : 'Study Partner'

  // Create study session
  const studySession = await prisma.studySession.create({
    data: {
      title: `AI Study Session: ${personaDescription}`,
      type: 'AI_PARTNER',
      status: 'ACTIVE',
      createdBy: userId,
      userId: userId,
      subject: subject,
      isAISession: true,
      partnerType: 'AI',
      startedAt: new Date(),
    },
  })

  // Determine skill level enum
  let skillLevelEnum: SkillLevel | null = null
  if (searchCriteria.skillLevel) {
    const validLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']
    if (validLevels.includes(searchCriteria.skillLevel)) {
      skillLevelEnum = searchCriteria.skillLevel as SkillLevel
    }
  }

  // Create AI session
  const aiSession = await prisma.aIPartnerSession.create({
    data: {
      userId,
      studySessionId: studySession.id,
      subject,
      skillLevel: skillLevelEnum,
      studyGoal: studyGoal || null,
      status: 'ACTIVE',
    },
  })

  // Build dynamic persona prompt from search criteria with memory
  let systemPrompt = buildDynamicPersonaPrompt(searchCriteria, userMemory.preferredName || user?.name || undefined)

  // Append memory context to system prompt
  if (memoryContext) {
    systemPrompt += memoryContext
  }

  // Build welcome instruction based on memory
  let welcomeInstruction = 'Start the session with a warm, casual greeting as yourself.'
  if (userMemory.totalSessions > 0) {
    welcomeInstruction = `This is a returning user who has had ${userMemory.totalSessions} sessions with AI partners. Welcome them back warmly and naturally. ${userMemory.lastTopicDiscussed ? `They last studied "${userMemory.lastTopicDiscussed}".` : ''} ${userMemory.streakDays > 1 ? `They're on a ${userMemory.streakDays}-day study streak!` : ''}`
  }

  // Generate welcome message with dynamic persona
  const welcomeResult = await sendChatMessage(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: welcomeInstruction },
    ],
    {
      temperature: 0.8, // Slightly higher for more natural variation
      maxTokens: 300,
    }
  )

  // Save the system prompt as first message (hidden from user)
  await prisma.aIPartnerMessage.create({
    data: {
      sessionId: aiSession.id,
      studySessionId: studySession.id,
      role: 'SYSTEM',
      content: systemPrompt,
      messageType: 'CHAT',
      wasModerated: false,
    },
  })

  // Save AI welcome message
  const welcomeMsg = await prisma.aIPartnerMessage.create({
    data: {
      sessionId: aiSession.id,
      studySessionId: studySession.id,
      role: 'ASSISTANT',
      content: welcomeResult.content,
      messageType: 'CHAT',
      wasModerated: false,
      promptTokens: welcomeResult.promptTokens,
      completionTokens: welcomeResult.completionTokens,
      totalTokens: welcomeResult.totalTokens,
    },
  })

  // Update message count
  await prisma.aIPartnerSession.update({
    where: { id: aiSession.id },
    data: { messageCount: 1 },
  })

  return {
    session: {
      id: aiSession.id,
      userId: aiSession.userId,
      subject: aiSession.subject,
      skillLevel: aiSession.skillLevel,
      studyGoal: aiSession.studyGoal,
      status: aiSession.status,
      startedAt: aiSession.startedAt,
      endedAt: aiSession.endedAt,
      messageCount: 1,
      messages: [
        {
          id: welcomeMsg.id,
          role: welcomeMsg.role,
          content: welcomeMsg.content,
          messageType: welcomeMsg.messageType,
          wasFlagged: welcomeMsg.wasFlagged,
          createdAt: welcomeMsg.createdAt,
        },
      ],
    },
    welcomeMessage: welcomeResult.content,
    personaDescription,
  }
}

/**
 * Send a message to the AI partner and get a response
 */
export async function sendMessage(params: SendMessageParams): Promise<{
  userMessage: { id: string; content: string; wasFlagged: boolean }
  aiMessage: { id: string; content: string }
  safetyBlocked: boolean
}> {
  const { sessionId, userId, content, messageType = 'CHAT' } = params

  // Get session
  const session = await prisma.aIPartnerSession.findUnique({
    where: { id: sessionId },
    include: {
      persona: true,
      studySession: true,
    },
  })

  if (!session) {
    throw new Error('Session not found')
  }

  if (session.userId !== userId) {
    throw new Error('Unauthorized')
  }

  if (session.status !== 'ACTIVE') {
    throw new Error('Session is not active')
  }

  // Check content safety first
  const safetyCheck = await checkContentSafety(content)
  const moderation = await moderateContent(content)

  // Save user message
  const userMsg = await prisma.aIPartnerMessage.create({
    data: {
      sessionId: session.id,
      studySessionId: session.studySessionId,
      role: 'USER',
      content,
      messageType,
      wasModerated: true,
      moderationResult: moderation as unknown as Prisma.InputJsonValue,
      wasFlagged: moderation.flagged,
      flagCategories: Object.entries(moderation.categories)
        .filter(([, v]) => v)
        .map(([k]) => k),
    },
  })

  // If content is unsafe, don't process and return safety message
  if (!safetyCheck.isSafe) {
    // Update session with safety block
    await prisma.aIPartnerSession.update({
      where: { id: session.id },
      data: {
        flaggedCount: { increment: 1 },
        wasSafetyBlocked: true,
        status: 'BLOCKED',
        endedAt: new Date(),
      },
    })

    // Save AI response
    const aiMsg = await prisma.aIPartnerMessage.create({
      data: {
        sessionId: session.id,
        studySessionId: session.studySessionId,
        role: 'ASSISTANT',
        content: safetyCheck.redirectMessage || "Let's focus on studying. What would you like to learn?",
        messageType: 'CHAT',
        wasModerated: false,
      },
    })

    return {
      userMessage: { id: userMsg.id, content: userMsg.content, wasFlagged: true },
      aiMessage: { id: aiMsg.id, content: aiMsg.content },
      safetyBlocked: true,
    }
  }

  // Get conversation history (last 20 messages for context)
  const history = await prisma.aIPartnerMessage.findMany({
    where: {
      sessionId: session.id,
      role: { in: ['USER', 'ASSISTANT', 'SYSTEM'] },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  // Build messages array for OpenAI
  const messages: AIMessage[] = history.map((msg) => ({
    role: msg.role.toLowerCase() as 'system' | 'user' | 'assistant',
    content: msg.content,
  }))

  // Add the new user message
  messages.push({ role: 'user', content })

  // If content is off-topic, use redirect message but still respond
  if (!safetyCheck.isStudyRelated && safetyCheck.redirectMessage) {
    // Add a gentle redirect in the context
    messages.push({
      role: 'system',
      content: 'The user went off-topic. Gently redirect them back to studying while being friendly.',
    })
  }

  // Get AI response
  const aiResponse = await sendChatMessage(messages, {
    temperature: session.persona?.temperature || 0.7,
    maxTokens: session.persona?.maxTokens || 500,
  })

  // Save AI message
  const aiMsg = await prisma.aIPartnerMessage.create({
    data: {
      sessionId: session.id,
      studySessionId: session.studySessionId,
      role: 'ASSISTANT',
      content: aiResponse.content,
      messageType,
      wasModerated: false,
      promptTokens: aiResponse.promptTokens,
      completionTokens: aiResponse.completionTokens,
      totalTokens: aiResponse.totalTokens,
    },
  })

  // Update session message count
  await prisma.aIPartnerSession.update({
    where: { id: session.id },
    data: {
      messageCount: { increment: 2 },
      ...(moderation.flagged ? { flaggedCount: { increment: 1 } } : {}),
    },
  })

  return {
    userMessage: { id: userMsg.id, content: userMsg.content, wasFlagged: moderation.flagged },
    aiMessage: { id: aiMsg.id, content: aiResponse.content },
    safetyBlocked: false,
  }
}

/**
 * Generate a quiz question for the session
 */
export async function generateQuiz(params: {
  sessionId: string
  userId: string
  topic?: string
  difficulty?: 'easy' | 'medium' | 'hard'
}): Promise<{
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  messageId: string
}> {
  const { sessionId, userId, topic, difficulty } = params

  const session = await prisma.aIPartnerSession.findUnique({
    where: { id: sessionId },
  })

  if (!session || session.userId !== userId) {
    throw new Error('Session not found or unauthorized')
  }

  // Get previous quiz questions to avoid duplicates
  const previousQuizzes = await prisma.aIPartnerMessage.findMany({
    where: {
      sessionId,
      messageType: 'QUIZ',
    },
    select: { quizData: true },
    take: 10,
  })

  const previousQuestions = previousQuizzes
    .map((q) => (q.quizData as { question?: string })?.question)
    .filter(Boolean) as string[]

  // Generate quiz
  const quiz = await generateQuizQuestion({
    subject: session.subject || 'General',
    topic,
    difficulty,
    previousQuestions,
  })

  // Save as message
  const msg = await prisma.aIPartnerMessage.create({
    data: {
      sessionId,
      studySessionId: session.studySessionId,
      role: 'ASSISTANT',
      content: `Quiz Question:\n\n${quiz.question}\n\nA) ${quiz.options[0]}\nB) ${quiz.options[1]}\nC) ${quiz.options[2]}\nD) ${quiz.options[3]}`,
      messageType: 'QUIZ',
      quizData: quiz as unknown as Prisma.InputJsonValue,
    },
  })

  // Update quiz count
  await prisma.aIPartnerSession.update({
    where: { id: sessionId },
    data: {
      quizCount: { increment: 1 },
      messageCount: { increment: 1 },
    },
  })

  return {
    ...quiz,
    messageId: msg.id,
  }
}

/**
 * Generate flashcards for the session
 */
export async function generateFlashcardsForSession(params: {
  sessionId: string
  userId: string
  topic: string
  count?: number
}): Promise<{
  flashcards: Array<{ front: string; back: string }>
  messageId: string
}> {
  const { sessionId, userId, topic, count = 5 } = params

  const session = await prisma.aIPartnerSession.findUnique({
    where: { id: sessionId },
  })

  if (!session || session.userId !== userId) {
    throw new Error('Session not found or unauthorized')
  }

  // Generate flashcards
  const flashcards = await generateFlashcards({
    subject: session.subject || 'General',
    topic,
    count,
  })

  // Save as message
  const msg = await prisma.aIPartnerMessage.create({
    data: {
      sessionId,
      studySessionId: session.studySessionId,
      role: 'ASSISTANT',
      content: `Here are ${flashcards.length} flashcards for "${topic}":\n\n${flashcards.map((f, i) => `${i + 1}. ${f.front}`).join('\n')}`,
      messageType: 'FLASHCARD',
      flashcardData: flashcards as unknown as Prisma.InputJsonValue,
    },
  })

  // Also create actual flashcard records if studySession exists
  if (session.studySessionId) {
    for (const card of flashcards) {
      await prisma.sessionFlashcard.create({
        data: {
          sessionId: session.studySessionId,
          userId,
          front: card.front,
          back: card.back,
        },
      })
    }
  }

  // Update flashcard count
  await prisma.aIPartnerSession.update({
    where: { id: sessionId },
    data: {
      flashcardCount: { increment: flashcards.length },
      messageCount: { increment: 1 },
    },
  })

  return {
    flashcards,
    messageId: msg.id,
  }
}

/**
 * Generate flashcards from conversation context
 * Analyzes the chat history and creates flashcards based on topics discussed
 */
export async function generateFlashcardsFromConversation(params: {
  sessionId: string
  userId: string
  count?: number
}): Promise<{
  flashcards: Array<{ front: string; back: string }>
  messageId: string
}> {
  const { sessionId, userId, count = 5 } = params

  const session = await prisma.aIPartnerSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        where: { role: { in: ['USER', 'ASSISTANT'] } },
        orderBy: { createdAt: 'asc' },
        take: 30, // Last 30 messages for context
      },
    },
  })

  if (!session || session.userId !== userId) {
    throw new Error('Session not found or unauthorized')
  }

  if (session.messages.length < 2) {
    throw new Error('Not enough conversation to generate flashcards. Chat more first!')
  }

  // Build conversation summary for flashcard generation
  const conversationSummary = session.messages
    .map((m) => `${m.role === 'USER' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n')

  // Generate flashcards from conversation using OpenAI
  const flashcards = await generateFlashcardsFromChat({
    conversationSummary,
    subject: session.subject || undefined,
    count,
  })

  // Save as message
  const msg = await prisma.aIPartnerMessage.create({
    data: {
      sessionId,
      studySessionId: session.studySessionId,
      role: 'ASSISTANT',
      content: `I've created ${flashcards.length} flashcards based on our conversation:\n\n${flashcards.map((f, i) => `${i + 1}. ${f.front}`).join('\n')}`,
      messageType: 'FLASHCARD',
      flashcardData: flashcards as unknown as Prisma.InputJsonValue,
    },
  })

  // Also create actual flashcard records if studySession exists
  if (session.studySessionId) {
    for (const card of flashcards) {
      await prisma.sessionFlashcard.create({
        data: {
          sessionId: session.studySessionId,
          userId,
          front: card.front,
          back: card.back,
        },
      })
    }
  }

  // Update flashcard count
  await prisma.aIPartnerSession.update({
    where: { id: sessionId },
    data: {
      flashcardCount: { increment: flashcards.length },
      messageCount: { increment: 1 },
    },
  })

  return {
    flashcards,
    messageId: msg.id,
  }
}

/**
 * Generate quiz questions from conversation context
 * Analyzes the chat history and creates quiz questions based on topics discussed
 */
export async function generateQuizFromConversation(params: {
  sessionId: string
  userId: string
  count?: number
  difficulty?: 'easy' | 'medium' | 'hard'
}): Promise<{
  questions: Array<{
    question: string
    options: string[]
    correctAnswer: number
    explanation: string
  }>
  messageId: string
}> {
  const { sessionId, userId, count = 5, difficulty = 'medium' } = params

  const session = await prisma.aIPartnerSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        where: { role: { in: ['USER', 'ASSISTANT'] } },
        orderBy: { createdAt: 'asc' },
        take: 30, // Last 30 messages for context
      },
    },
  })

  if (!session || session.userId !== userId) {
    throw new Error('Session not found or unauthorized')
  }

  if (session.messages.length < 2) {
    throw new Error('Not enough conversation to generate quiz. Chat more first!')
  }

  // Build conversation summary for quiz generation
  const conversationSummary = session.messages
    .map((m) => `${m.role === 'USER' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n')

  // Generate quiz from conversation using OpenAI
  const questions = await generateQuizFromChat({
    conversationSummary,
    subject: session.subject || undefined,
    count,
    difficulty,
  })

  // Format quiz content for message
  const quizContent = questions.map((q, i) =>
    `${i + 1}. ${q.question}\n   A) ${q.options[0]}\n   B) ${q.options[1]}\n   C) ${q.options[2]}\n   D) ${q.options[3]}`
  ).join('\n\n')

  // Save as message
  const msg = await prisma.aIPartnerMessage.create({
    data: {
      sessionId,
      studySessionId: session.studySessionId,
      role: 'ASSISTANT',
      content: `I've created a ${difficulty} quiz based on our conversation:\n\n${quizContent}`,
      messageType: 'QUIZ',
      quizData: questions as unknown as Prisma.InputJsonValue,
    },
  })

  // Update quiz count
  await prisma.aIPartnerSession.update({
    where: { id: sessionId },
    data: {
      quizCount: { increment: questions.length },
      messageCount: { increment: 1 },
    },
  })

  return {
    questions,
    messageId: msg.id,
  }
}

/**
 * Analyze whiteboard image with AI
 * Sends the whiteboard drawing to AI for analysis and feedback
 */
export async function analyzeWhiteboard(params: {
  sessionId: string
  userId: string
  imageBase64: string
  userQuestion?: string
}): Promise<{
  analysis: string
  suggestions: string[]
  relatedConcepts: string[]
  messageId: string
}> {
  const { sessionId, userId, imageBase64, userQuestion } = params

  const session = await prisma.aIPartnerSession.findUnique({
    where: { id: sessionId },
  })

  if (!session || session.userId !== userId) {
    throw new Error('Session not found or unauthorized')
  }

  // Analyze whiteboard using OpenAI vision
  const result = await analyzeWhiteboardImage({
    imageBase64,
    subject: session.subject || undefined,
    userQuestion,
  })

  // Format response content
  let responseContent = `**Whiteboard Analysis**\n\n${result.analysis}`

  if (result.suggestions.length > 0) {
    responseContent += `\n\n**Suggestions:**\n${result.suggestions.map(s => `• ${s}`).join('\n')}`
  }

  if (result.relatedConcepts.length > 0) {
    responseContent += `\n\n**Related Concepts to Explore:**\n${result.relatedConcepts.map(c => `• ${c}`).join('\n')}`
  }

  // Save as message
  const msg = await prisma.aIPartnerMessage.create({
    data: {
      sessionId,
      studySessionId: session.studySessionId,
      role: 'ASSISTANT',
      content: responseContent,
      messageType: 'WHITEBOARD',
    },
  })

  // Update message count
  await prisma.aIPartnerSession.update({
    where: { id: sessionId },
    data: {
      messageCount: { increment: 1 },
    },
  })

  return {
    ...result,
    messageId: msg.id,
  }
}

/**
 * End an AI partner session
 */
export async function endSession(params: {
  sessionId: string
  userId: string
  rating?: number
  feedback?: string
}): Promise<{
  summary: string
  duration: number
  memoriesExtracted: number
}> {
  const { sessionId, userId, rating, feedback } = params

  const session = await prisma.aIPartnerSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        where: { role: { in: ['USER', 'ASSISTANT'] } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!session || session.userId !== userId) {
    throw new Error('Session not found or unauthorized')
  }

  const endedAt = new Date()
  const duration = Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000)
  const durationMinutes = Math.round(duration / 60)

  // Extract memories from the conversation (async, non-blocking)
  let memoriesExtracted = 0
  try {
    const extractedMemories = await extractMemoriesFromConversation({
      userId,
      sessionId,
      messages: session.messages.map((m) => ({
        role: m.role.toLowerCase(),
        content: m.content,
        id: m.id,
      })),
    })

    if (extractedMemories.length > 0) {
      memoriesExtracted = await saveMemories({
        userId,
        sessionId,
        memories: extractedMemories,
      })
    }
  } catch (error) {
    console.error('[AI Partner] Memory extraction failed:', error)
    // Don't fail the session end if memory extraction fails
  }

  // Update user memory stats
  try {
    await updateUserMemoryFromSession({
      userId,
      sessionId,
      subject: session.subject || undefined,
      durationMinutes,
    })
  } catch (error) {
    console.error('[AI Partner] User memory update failed:', error)
  }

  // Generate session summary
  const summary = await generateSessionSummary({
    subject: session.subject || undefined,
    messages: session.messages.map((m) => ({
      role: m.role.toLowerCase() as 'user' | 'assistant',
      content: m.content,
    })),
    duration,
  })

  // Save summary as message
  await prisma.aIPartnerMessage.create({
    data: {
      sessionId,
      studySessionId: session.studySessionId,
      role: 'ASSISTANT',
      content: summary,
      messageType: 'SUMMARY',
    },
  })

  // Update session
  await prisma.aIPartnerSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      endedAt,
      totalDuration: duration,
      rating,
      feedback,
    },
  })

  // Update study session if linked
  if (session.studySessionId) {
    await prisma.studySession.update({
      where: { id: session.studySessionId },
      data: {
        status: 'COMPLETED',
        endedAt,
        durationMinutes: Math.round(duration / 60),
      },
    })
  }

  // Update persona rating if provided
  if (session.personaId && rating) {
    const persona = await prisma.aIPartnerPersona.findUnique({
      where: { id: session.personaId },
      select: { avgRating: true, usageCount: true },
    })

    if (persona) {
      const newAvg = persona.avgRating
        ? (persona.avgRating * (persona.usageCount - 1) + rating) / persona.usageCount
        : rating

      await prisma.aIPartnerPersona.update({
        where: { id: session.personaId },
        data: { avgRating: newAvg },
      })
    }
  }

  return { summary, duration, memoriesExtracted }
}

/**
 * Get session by ID with messages
 */
export async function getSession(sessionId: string, userId: string): Promise<AISessionWithMessages | null> {
  const session = await prisma.aIPartnerSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        where: { role: { in: ['USER', 'ASSISTANT'] } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!session || session.userId !== userId) {
    return null
  }

  return {
    id: session.id,
    userId: session.userId,
    subject: session.subject,
    skillLevel: session.skillLevel,
    studyGoal: session.studyGoal,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    messageCount: session.messageCount,
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      messageType: m.messageType,
      wasFlagged: m.wasFlagged,
      createdAt: m.createdAt,
    })),
  }
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(
  userId: string,
  options: { limit?: number; status?: AISessionStatus } = {}
): Promise<Array<{
  id: string
  subject: string | null
  status: AISessionStatus
  startedAt: Date
  endedAt: Date | null
  messageCount: number
  rating: number | null
}>> {
  const { limit = 20, status } = options

  const sessions = await prisma.aIPartnerSession.findMany({
    where: {
      userId,
      ...(status ? { status } : {}),
    },
    select: {
      id: true,
      subject: true,
      status: true,
      startedAt: true,
      endedAt: true,
      messageCount: true,
      rating: true,
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
  })

  return sessions
}

/**
 * Get or create default persona
 */
export async function getDefaultPersona() {
  let persona = await prisma.aIPartnerPersona.findFirst({
    where: { isDefault: true, isActive: true },
  })

  if (!persona) {
    // Create default persona
    persona = await prisma.aIPartnerPersona.create({
      data: {
        name: 'Study Buddy',
        description: 'A friendly and encouraging AI study partner that helps you learn effectively.',
        systemPrompt: buildStudyPartnerSystemPrompt({}),
        temperature: 0.7,
        maxTokens: 500,
        subjects: [],
        studyMethods: ['explanation', 'quiz', 'flashcards', 'pomodoro'],
        tone: 'friendly',
        isDefault: true,
        isActive: true,
      },
    })
  }

  return persona
}

/**
 * Pause an AI partner session
 * Used when user switches to a real human partner
 */
export async function pauseSession(params: {
  sessionId: string
  userId: string
}): Promise<{ success: boolean }> {
  const { sessionId, userId } = params

  const session = await prisma.aIPartnerSession.findUnique({
    where: { id: sessionId },
  })

  if (!session || session.userId !== userId) {
    throw new Error('Session not found or unauthorized')
  }

  if (session.status !== 'ACTIVE') {
    throw new Error('Session is not active')
  }

  // Calculate duration so far
  const now = new Date()
  const durationSoFar = Math.round((now.getTime() - session.startedAt.getTime()) / 1000)

  // Update session to PAUSED
  await prisma.aIPartnerSession.update({
    where: { id: sessionId },
    data: {
      status: 'PAUSED',
      totalDuration: durationSoFar,
    },
  })

  // Note: StudySession doesn't have PAUSED status, so we only update AIPartnerSession

  return { success: true }
}

/**
 * Resume a paused AI partner session
 */
export async function resumeSession(params: {
  sessionId: string
  userId: string
}): Promise<{ success: boolean; welcomeBackMessage: string }> {
  const { sessionId, userId } = params

  const session = await prisma.aIPartnerSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        where: { role: { in: ['USER', 'ASSISTANT'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })

  if (!session || session.userId !== userId) {
    throw new Error('Session not found or unauthorized')
  }

  if (session.status !== 'PAUSED') {
    throw new Error('Session is not paused')
  }

  // Update session to ACTIVE
  await prisma.aIPartnerSession.update({
    where: { id: sessionId },
    data: {
      status: 'ACTIVE',
    },
  })

  // Note: StudySession status is managed separately, so we only update AIPartnerSession

  // Generate a welcome back message
  const lastTopics = session.messages
    .filter(m => m.role === 'USER')
    .map(m => m.content.slice(0, 50))
    .slice(0, 2)

  const welcomeBackMessage = lastTopics.length > 0
    ? `Welcome back! Ready to continue where we left off? We were discussing: "${lastTopics[0]}..."`
    : `Welcome back! Ready to continue studying${session.subject ? ` ${session.subject}` : ''}?`

  // Save welcome back message
  await prisma.aIPartnerMessage.create({
    data: {
      sessionId,
      studySessionId: session.studySessionId,
      role: 'ASSISTANT',
      content: welcomeBackMessage,
      messageType: 'CHAT',
      wasModerated: false,
    },
  })

  // Increment message count
  await prisma.aIPartnerSession.update({
    where: { id: sessionId },
    data: {
      messageCount: { increment: 1 },
    },
  })

  return { success: true, welcomeBackMessage }
}

/**
 * Check if user has any AI Partner sessions (for dashboard widget visibility)
 */
export async function hasAIPartnerSessions(userId: string): Promise<boolean> {
  const count = await prisma.aIPartnerSession.count({
    where: { userId },
  })
  return count > 0
}

/**
 * Get user's active or paused AI session for dashboard
 */
export async function getActiveOrPausedSession(userId: string): Promise<{
  id: string
  subject: string | null
  status: 'ACTIVE' | 'PAUSED'
  messageCount: number
  startedAt: Date
} | null> {
  const session = await prisma.aIPartnerSession.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'PAUSED'] },
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      subject: true,
      status: true,
      messageCount: true,
      startedAt: true,
    },
  })

  if (!session) return null

  return {
    id: session.id,
    subject: session.subject,
    status: session.status as 'ACTIVE' | 'PAUSED',
    messageCount: session.messageCount,
    startedAt: session.startedAt,
  }
}
