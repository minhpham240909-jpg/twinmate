/**
 * AI Partner Service
 * Manages AI partner sessions, messages, and interactions
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  sendChatMessage,
  sendSmartChatMessage,
  moderateContent,
  buildStudyPartnerSystemPrompt,
  buildDynamicPersonaPrompt,
  generateQuizQuestion,
  generateFlashcards,
  generateFlashcardsFromChat,
  generateQuizFromChat,
  analyzeWhiteboardImage,
  generateSessionSummary,
  extractSubjectFromConversation,
  checkContentSafety,
  analyzeUploadedImage,
  sendChatMessageWithImage,
  generateEducationalImage,
  shouldSuggestImageGeneration,
  getProactiveSuggestion,
  AIMessage,
  SearchCriteria,
  ImageGenerationStyle,
  VALID_IMAGE_STYLES,
  ProactiveSuggestion,
  ProactiveSuggestionType,
  SessionState,
  SmartChatResult,
} from './openai'

// Intelligence System
import { INTELLIGENCE_VERSION, INITIAL_ADAPTIVE_STATE } from './intelligence'

// =============================================================================
// SMART ROUTING CONFIGURATION (v2.1)
// =============================================================================

/**
 * Smart Routing Feature Flags
 *
 * Controls the rollout of smart AI features:
 * - Model routing (gpt-4o-mini vs gpt-4o)
 * - Dynamic response length
 * - Response caching
 *
 * Set via environment variables for gradual rollout
 */
const SMART_ROUTING_CONFIG = {
  // Master switch for smart routing
  enabled: process.env.SMART_ROUTING_ENABLED !== 'false', // Default ON

  // Enable response caching
  cacheEnabled: process.env.SMART_CACHE_ENABLED !== 'false', // Default ON

  // Enable AI fallback for query analysis (slower but more accurate)
  useAIFallback: process.env.SMART_AI_FALLBACK === 'true', // Default OFF (use fast regex)

  // Skip analysis for very simple messages (greetings, short responses)
  skipAnalysisThreshold: 15, // Characters below which to skip analysis

  // Fallback to legacy sendChatMessage on errors
  fallbackOnError: true,

  // Log smart routing decisions for monitoring
  logDecisions: process.env.NODE_ENV === 'development' || process.env.SMART_ROUTING_DEBUG === 'true',
} as const

// Re-export proactive types for use by API routes and components
export type { ProactiveSuggestion, ProactiveSuggestionType, SessionState }

// Re-export image types for use by API routes and components
export type { ImageGenerationStyle }
export { VALID_IMAGE_STYLES }

// H8 FIX: Request deduplication cache to prevent rapid duplicate requests
const recentRequestsCache = new Map<string, { timestamp: number; content: string }>()
const REQUEST_GRACE_PERIOD_MS = 500 // 500ms grace period for duplicate requests
const CACHE_CLEANUP_INTERVAL = 60000 // Clean cache every minute

// H8 FIX: Cleanup old cache entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of recentRequestsCache.entries()) {
      if (now - value.timestamp > 5000) { // Remove entries older than 5 seconds
        recentRequestsCache.delete(key)
      }
    }
  }, CACHE_CLEANUP_INTERVAL)
}

/**
 * H8 FIX: Check if request is a duplicate within grace period
 */
function isDuplicateRequest(userId: string, sessionId: string, content: string): boolean {
  const cacheKey = `${userId}:${sessionId}`
  const cached = recentRequestsCache.get(cacheKey)
  
  if (cached) {
    const timeSinceLastRequest = Date.now() - cached.timestamp
    // Check if same content within grace period
    if (timeSinceLastRequest < REQUEST_GRACE_PERIOD_MS && cached.content === content) {
      console.log(`[AI Partner] Duplicate request detected within ${timeSinceLastRequest}ms, blocking`)
      return true
    }
  }
  
  // Update cache
  recentRequestsCache.set(cacheKey, { timestamp: Date.now(), content })
  return false
}
import {
  buildMemoryContext,
  extractMemoriesFromConversation,
  saveMemories,
  updateUserMemoryFromSession,
  getOrCreateUserMemory,
  ExtractedMemory,
} from './memory'
import type { AISessionStatus, AIMessageRole, AIMessageType, SkillLevel, StudyStyle } from '@prisma/client'

// Utility: safely truncate strings and lists to keep prompts lean
const truncateText = (value?: string | null, max = 180): string | undefined =>
  value ? value.slice(0, max) : undefined

const truncateList = (values: string[] = [], maxItems = 5, maxLen = 80): string[] =>
  values
    .filter(Boolean)
    .slice(0, maxItems)
    .map((v) => v.slice(0, maxLen))

/**
 * Build a personalized welcome instruction for the AI based on session params and user profile
 * This creates a rich context so the AI can generate a highly personalized first message
 */
interface PersonalizedWelcomeParams {
  // Session params (from modal input)
  sessionSubject?: string
  sessionSkillLevel?: SkillLevel
  sessionStudyGoal?: string
  // User memory
  totalSessions: number
  lastTopicDiscussed?: string
  streakDays: number
  // User profile data
  userName?: string
  profileSubjects: string[]
  profileInterests: string[]
  profileGoals: string[]
  profileSkillLevel?: SkillLevel | null
  profileStudyStyle?: StudyStyle | null
  profileSchool?: string | null
  profileLocation?: string | null
  profileBio?: string | null
  profileAboutYourself?: string | null
  // Learning profile
  strengths: string[]
  weaknesses: string[]
}

function buildPersonalizedWelcomeInstruction(params: PersonalizedWelcomeParams): string {
  const parts: string[] = []

  // Start with context about this being a new session
  if (params.totalSessions > 0) {
    parts.push(`This is a returning user who has had ${params.totalSessions} sessions with AI partners.`)
    if (params.streakDays > 1) {
      parts.push(`They're on a ${params.streakDays}-day study streak - acknowledge this achievement naturally!`)
    }
    if (params.lastTopicDiscussed) {
      parts.push(`Last time they studied: ${params.lastTopicDiscussed}.`)
    }
  } else {
    parts.push(`This is a new user's first session - give them a warm welcome!`)
  }

  // Add session-specific information (what they selected in the modal)
  const sessionDetails: string[] = []
  const sessionSubject = truncateText(params.sessionSubject, 120)
  const sessionGoal = truncateText(params.sessionStudyGoal, 160)
  if (sessionSubject) {
    sessionDetails.push(`studying ${sessionSubject}`)
  }
  if (params.sessionSkillLevel) {
    const levelMap: Record<string, string> = {
      'BEGINNER': 'beginner',
      'INTERMEDIATE': 'intermediate',
      'ADVANCED': 'advanced',
      'EXPERT': 'expert'
    }
    sessionDetails.push(`at ${levelMap[params.sessionSkillLevel] || params.sessionSkillLevel.toLowerCase()} level`)
  }
  if (sessionGoal) {
    sessionDetails.push(`with the goal: "${sessionGoal}"`)
  }
  if (sessionDetails.length > 0) {
    parts.push(`\nTODAY'S SESSION: The user wants to start ${sessionDetails.join(', ')}.`)
  }

  // Add rich user profile context
  const profileContext: string[] = []

  if (params.userName) {
    profileContext.push(`Name: ${truncateText(params.userName, 80)}`)
  }
  if (params.profileSchool) {
    profileContext.push(`School: ${truncateText(params.profileSchool, 120)}`)
  }
  if (params.profileLocation) {
    profileContext.push(`Location: ${truncateText(params.profileLocation, 120)}`)
  }
  const profileSubjects = truncateList(params.profileSubjects, 5, 60)
  const profileInterests = truncateList(params.profileInterests, 5, 60)
  const profileGoals = truncateList(params.profileGoals, 3, 80)
  if (profileSubjects.length > 0) {
    profileContext.push(`Studies: ${profileSubjects.join(', ')}`)
  }
  if (profileInterests.length > 0) {
    profileContext.push(`Interests: ${profileInterests.join(', ')}`)
  }
  if (profileGoals.length > 0) {
    profileContext.push(`Goals: ${profileGoals.join(', ')}`)
  }
  if (params.profileSkillLevel) {
    profileContext.push(`Skill level: ${params.profileSkillLevel}`)
  }
  if (params.profileStudyStyle) {
    const styleMap: Record<string, string> = {
      'COLLABORATIVE': 'collaborative (enjoys group study)',
      'INDEPENDENT': 'independent (prefers solo study)',
      'MIXED': 'mixed (flexible approach)'
    }
    profileContext.push(`Study style: ${styleMap[params.profileStudyStyle] || params.profileStudyStyle}`)
  }
  if (params.strengths && params.strengths.length > 0) {
    profileContext.push(`Strengths: ${truncateList(params.strengths, 3, 80).join(', ')}`)
  }
  if (params.weaknesses && params.weaknesses.length > 0) {
    profileContext.push(`Areas to improve: ${truncateList(params.weaknesses, 3, 80).join(', ')}`)
  }
  if (params.profileBio) {
    profileContext.push(`Bio: ${truncateText(params.profileBio, 150)}`)
  }
  if (params.profileAboutYourself) {
    profileContext.push(`About themselves: ${truncateText(params.profileAboutYourself, 150)}`)
  }

  if (profileContext.length > 0) {
    parts.push(`\nUSER PROFILE CONTEXT:\n${profileContext.join('\n')}`)
  }

  // Add instruction for the AI
  parts.push(`
INSTRUCTION: Generate a warm, personalized greeting that:
1. ${params.userName ? `Uses their name (${params.userName})` : 'Greets them warmly'}
2. ${params.sessionSubject ? `Acknowledges they want to study ${params.sessionSubject}` : 'Asks what they want to study today'}
3. ${params.sessionStudyGoal ? `References their goal: "${params.sessionStudyGoal}"` : ''}
4. ${params.profileSubjects.length > 0 || params.profileInterests.length > 0 ? 'Shows you know their background/interests (mention 1-2 naturally)' : ''}
5. ${params.weaknesses.length > 0 ? 'Offers to help with areas they want to improve (mention one naturally)' : ''}
6. Keeps it conversational and friendly (2-3 sentences max)
7. Ends with either starting the study topic OR asking what specific aspect they want to focus on

Do NOT be generic. Use the specific details above to make them feel understood and ready to learn.`)

  return parts.join('\n')
}

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

  // Get user info AND full profile for personalization (single query for performance)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      profile: {
        select: {
          bio: true,
          subjects: true,
          interests: true,
          goals: true,
          skillLevel: true,
          studyStyle: true,
          school: true,
          languages: true,
          location_city: true,
          location_country: true,
          availableDays: true,
          availableHours: true,
          subjectCustomDescription: true,
          skillLevelCustomDescription: true,
          studyStyleCustomDescription: true,
          interestsCustomDescription: true,
          aboutYourself: true,
          aboutYourselfItems: true,
        }
      },
      learningProfile: {
        select: {
          strengths: true,
          weaknesses: true,
        }
      }
    },
  })

  // Extract profile data for easy access
  const profile = user?.profile
  const learningProfile = user?.learningProfile

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

  // Get user memory for personalization (pass subject for enhanced context)
  const userMemory = await getOrCreateUserMemory(userId)
  const memoryContext = await buildMemoryContext(userId, subject || undefined)

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

  // Create AI session with Intelligence System v2.0 enabled
  const aiSession = await prisma.aIPartnerSession.create({
    data: {
      userId,
      studySessionId: studySession.id,
      personaId: persona?.id,
      subject,
      skillLevel,
      studyGoal,
      status: 'ACTIVE',
      // Intelligence System v2.0
      intelligenceVersion: INTELLIGENCE_VERSION,
      adaptiveState: INITIAL_ADAPTIVE_STATE as unknown as Prisma.InputJsonValue,
      totalTokensUsed: 0,
      fallbackCallCount: 0,
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

  // Build personalized welcome instruction based on session params AND user profile
  let welcomeInstruction = buildPersonalizedWelcomeInstruction({
    // Session params (from modal input)
    sessionSubject: subject || undefined,
    sessionSkillLevel: skillLevel || undefined,
    sessionStudyGoal: studyGoal || undefined,
    // User memory
    totalSessions: userMemory.totalSessions,
    lastTopicDiscussed: userMemory.lastTopicDiscussed || undefined,
    streakDays: userMemory.streakDays,
    // User profile data
    userName: user?.name || undefined,
    profileSubjects: profile?.subjects || [],
    profileInterests: profile?.interests || [],
    profileGoals: profile?.goals || [],
    profileSkillLevel: profile?.skillLevel || undefined,
    profileStudyStyle: profile?.studyStyle || undefined,
    profileSchool: profile?.school || undefined,
    profileLocation: profile?.location_city || profile?.location_country || undefined,
    profileBio: profile?.bio || undefined,
    profileAboutYourself: profile?.aboutYourself || undefined,
    // Learning profile
    strengths: learningProfile?.strengths || [],
    weaknesses: learningProfile?.weaknesses || [],
  })

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

  // Get user info AND full profile for personalization (single query for performance)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      profile: {
        select: {
          bio: true,
          subjects: true,
          interests: true,
          goals: true,
          skillLevel: true,
          studyStyle: true,
          school: true,
          languages: true,
          location_city: true,
          location_country: true,
          aboutYourself: true,
          aboutYourselfItems: true,
        }
      },
      learningProfile: {
        select: {
          strengths: true,
          weaknesses: true,
        }
      }
    },
  })

  // Extract profile data for easy access
  const profile = user?.profile
  const learningProfile = user?.learningProfile

  // Get user memory for personalization
  const userMemory = await getOrCreateUserMemory(userId)

  // Build subject string from criteria
  const subject = searchCriteria.subjects?.join(', ') || searchCriteria.subjectDescription || null

  // Build memory context with subject for enhanced personalization
  const memoryContext = await buildMemoryContext(userId, subject || undefined)

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
    ? personaParts.join(' � ')
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

  // Create AI session with Intelligence System v2.0 enabled
  // Save full searchCriteria for "Continue Previous Topic" feature
  const aiSession = await prisma.aIPartnerSession.create({
    data: {
      userId,
      studySessionId: studySession.id,
      subject,
      skillLevel: skillLevelEnum,
      studyGoal: studyGoal || null,
      searchCriteria: searchCriteria as object, // Save all search criteria (subjects, location, interests, etc.)
      status: 'ACTIVE',
      // Intelligence System v2.0
      intelligenceVersion: INTELLIGENCE_VERSION,
      adaptiveState: INITIAL_ADAPTIVE_STATE as unknown as Prisma.InputJsonValue,
      totalTokensUsed: 0,
      fallbackCallCount: 0,
    },
  })

  // Build dynamic persona prompt from search criteria with memory
  let systemPrompt = buildDynamicPersonaPrompt(searchCriteria, userMemory.preferredName || user?.name || undefined)

  // Append memory context to system prompt
  if (memoryContext) {
    systemPrompt += memoryContext
  }

  // Build personalized welcome instruction using search criteria AND user profile
  const welcomeInstruction = buildPersonalizedWelcomeInstruction({
    // Session params from search criteria
    sessionSubject: subject || undefined,
    sessionSkillLevel: skillLevelEnum || undefined,
    sessionStudyGoal: studyGoal || undefined,
    // User memory
    totalSessions: userMemory.totalSessions,
    lastTopicDiscussed: userMemory.lastTopicDiscussed || undefined,
    streakDays: userMemory.streakDays,
    // User profile data
    userName: user?.name || undefined,
    profileSubjects: profile?.subjects || [],
    profileInterests: profile?.interests || [],
    profileGoals: profile?.goals || [],
    profileSkillLevel: profile?.skillLevel || undefined,
    profileStudyStyle: profile?.studyStyle || undefined,
    profileSchool: profile?.school || undefined,
    profileLocation: profile?.location_city || profile?.location_country || undefined,
    profileBio: profile?.bio || undefined,
    profileAboutYourself: profile?.aboutYourself || undefined,
    // Learning profile
    strengths: learningProfile?.strengths || [],
    weaknesses: learningProfile?.weaknesses || [],
  })

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
 * Detect if user is asking for image generation
 * Returns the prompt and style if image generation is requested
 */
function detectImageGenerationRequest(content: string): {
  isImageRequest: boolean
  prompt?: string
  style?: ImageGenerationStyle
} {
  const lowerContent = content.toLowerCase()

  // ==========================================================================
  // SMART IMAGE DETECTION - Uses patterns instead of exact phrases
  // ==========================================================================

  // Action verbs that indicate creation/generation
  const actionVerbs = [
    'generate', 'create', 'make', 'draw', 'design', 'build', 'produce',
    'render', 'illustrate', 'visualize', 'sketch', 'paint', 'show'
  ]

  // Visual content types (what the user wants created)
  const visualTypes = [
    'image', 'images', 'picture', 'pictures', 'photo', 'photos',
    'diagram', 'diagrams', 'illustration', 'illustrations',
    'chart', 'charts', 'graph', 'graphs',
    'flowchart', 'flowcharts', 'flow chart', 'flow charts',
    'infographic', 'infographics',
    'mindmap', 'mindmaps', 'mind map', 'mind maps',
    'timeline', 'timelines', 'time line', 'time lines',
    'concept map', 'concept maps', 'conceptmap', 'conceptmaps',
    'visual', 'visuals', 'visualization', 'visualizations',
    'logo', 'logos', 'icon', 'icons',
    'poster', 'posters', 'banner', 'banners',
    'sketch', 'sketches', 'drawing', 'drawings',
    'graphic', 'graphics', 'artwork', 'art',
    'figure', 'figures', 'representation', 'depiction'
  ]

  // Request patterns (how users ask)
  const requestPatterns = [
    'can you', 'could you', 'would you', 'will you',
    'please', 'i want', 'i need', 'i would like',
    'help me', 'show me', 'give me', 'get me',
    'let me see', 'i\'d like', 'id like'
  ]

  // ==========================================================================
  // DETECTION LOGIC
  // ==========================================================================

  let isImageRequest = false

  // Method 1: Check for action verb + visual type combination
  // e.g., "generate a diagram", "create an illustration", "make me an image"
  for (const verb of actionVerbs) {
    if (lowerContent.includes(verb)) {
      for (const visualType of visualTypes) {
        if (lowerContent.includes(visualType)) {
          isImageRequest = true
          break
        }
      }
      if (isImageRequest) break
    }
  }

  // Method 2: Check for request pattern + visual type
  // e.g., "can you show me a diagram", "i need an illustration"
  if (!isImageRequest) {
    for (const pattern of requestPatterns) {
      if (lowerContent.includes(pattern)) {
        for (const visualType of visualTypes) {
          if (lowerContent.includes(visualType)) {
            isImageRequest = true
            break
          }
        }
        if (isImageRequest) break
      }
    }
  }

  // Method 3: Direct visual type mentions with context clues
  // e.g., "diagram of...", "illustration showing...", "a flowchart for..."
  if (!isImageRequest) {
    const directPatterns = [
      /\b(diagram|illustration|flowchart|mindmap|infographic|chart|graph|timeline|poster|logo|icon|sketch)\s+(of|for|about|showing|depicting|explaining|representing)/i,
      /\b(a|an|the)\s+(diagram|illustration|flowchart|mindmap|infographic|chart|graph|timeline|poster|logo|icon|sketch)\b/i,
      /(show|display|render|depict|portray)\s+(this|it|that)?\s*(visually|graphically|as an? (image|picture|diagram))/i,
    ]

    for (const pattern of directPatterns) {
      if (pattern.test(lowerContent)) {
        isImageRequest = true
        break
      }
    }
  }

  // Method 4: Explicit image/visual requests
  // e.g., "visually explain", "pictorial representation", "graphical view"
  if (!isImageRequest) {
    const explicitPatterns = [
      'visually explain', 'visual explanation', 'pictorial', 'graphical',
      'in picture form', 'as an image', 'as a picture', 'with a diagram',
      'with an illustration', 'draw it', 'picture this', 'visualise', 'visualize this'
    ]

    for (const pattern of explicitPatterns) {
      if (lowerContent.includes(pattern)) {
        isImageRequest = true
        break
      }
    }
  }

  if (!isImageRequest) {
    return { isImageRequest: false }
  }

  // ==========================================================================
  // DETERMINE STYLE based on keywords in the request
  // ==========================================================================
  let style: ImageGenerationStyle = 'illustration' // default

  // Check for specific style keywords (order matters - more specific first)
  if (lowerContent.includes('flowchart') || lowerContent.includes('flow chart')) {
    style = 'flowchart'
  } else if (lowerContent.includes('mindmap') || lowerContent.includes('mind map')) {
    style = 'mindmap'
  } else if (lowerContent.includes('concept map') || lowerContent.includes('conceptmap')) {
    style = 'concept-map'
  } else if (lowerContent.includes('infographic')) {
    style = 'infographic'
  } else if (lowerContent.includes('timeline') || lowerContent.includes('time line')) {
    style = 'timeline'
  } else if (lowerContent.includes('diagram')) {
    style = 'diagram'
  } else if (lowerContent.includes('chart') || lowerContent.includes('graph')) {
    style = 'chart'
  } else if (lowerContent.includes('logo')) {
    style = 'logo'
  } else if (lowerContent.includes('poster') || lowerContent.includes('banner')) {
    style = 'poster'
  } else if (lowerContent.includes('icon')) {
    style = 'icon'
  } else if (lowerContent.includes('cartoon')) {
    style = 'cartoon'
  } else if (lowerContent.includes('sketch') || lowerContent.includes('drawing')) {
    style = 'sketch'
  } else if (lowerContent.includes('technical') || lowerContent.includes('blueprint')) {
    style = 'technical'
  } else if (lowerContent.includes('realistic') || lowerContent.includes('photo') || lowerContent.includes('picture')) {
    style = 'picture'
  } else if (lowerContent.includes('illustration')) {
    style = 'illustration'
  }

  // ==========================================================================
  // EXTRACT THE PROMPT - Smart extraction of what user wants visualized
  // ==========================================================================
  let prompt = content

  // Remove action verbs and request patterns
  const removePatterns = [
    // Action verbs with articles
    /\b(generate|create|make|draw|design|build|produce|render|illustrate|visualize|sketch|paint|show)\s+(me\s+)?(a|an|the)?\s*/gi,
    // Request patterns
    /\b(can you|could you|would you|will you|please|i want|i need|i would like|help me|show me|give me|get me|let me see)\s*/gi,
    // Visual type words (we already captured the style)
    /\b(image|images|picture|pictures|photo|photos|diagram|diagrams|illustration|illustrations|chart|charts|graph|graphs|flowchart|flowcharts|infographic|infographics|mindmap|mindmaps|mind map|mind maps|timeline|timelines|concept map|concept maps|visual|visuals|visualization|visualizations|logo|logos|icon|icons|poster|posters|banner|banners|sketch|sketches|drawing|drawings|graphic|graphics|artwork|art|figure|figures)\s*/gi,
    // Common filler words at start/end
    /^(of|about|for|showing|depicting|with|that shows|that depicts|explaining|representing)\s+/i,
    /\s+(of|about|for|showing|depicting|with)\s*$/i,
  ]

  for (const pattern of removePatterns) {
    prompt = prompt.replace(pattern, ' ')
  }

  // Clean up punctuation and extra spaces
  prompt = prompt
    .replace(/^\s*[,.:;?!]\s*/, '')
    .replace(/\s*[,.:;?!]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()

  // If prompt is too short after cleaning, use intelligent extraction
  if (prompt.length < 5) {
    // Try to extract the subject matter using regex
    const subjectMatch = content.match(/(?:of|about|for|showing|depicting|explaining|on)\s+(.+?)(?:\.|$)/i)
    if (subjectMatch && subjectMatch[1]) {
      prompt = subjectMatch[1].trim()
    } else {
      // Last resort: use original content
      prompt = content
    }
  }

  return { isImageRequest: true, prompt, style }
}

/**
 * Send a message to the AI partner and get a response
 * H8 FIX: Includes duplicate request detection to prevent rapid navigation exhausting quota
 * IMAGE FIX: Automatically detects image generation requests and generates images
 */
export async function sendMessage(params: SendMessageParams): Promise<{
  userMessage: { id: string; content: string; wasFlagged: boolean }
  aiMessage: { id: string; content: string; imageUrl?: string }
  safetyBlocked: boolean
  wasDuplicate?: boolean  // H8 FIX: Indicate if request was blocked as duplicate
  generatedImage?: { imageUrl: string; revisedPrompt: string }  // Image generation result
}> {
  const { sessionId, userId, content, messageType = 'CHAT' } = params

  // H8 FIX: Check for duplicate requests within grace period
  if (isDuplicateRequest(userId, sessionId, content)) {
    // Return cached/dummy response for duplicates to prevent quota exhaustion
    throw new Error('Duplicate request detected. Please wait a moment before sending again.')
  }

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

  // IMAGE GENERATION: Check if user is asking for an image
  const imageRequest = detectImageGenerationRequest(content)

  if (imageRequest.isImageRequest && imageRequest.prompt) {
    console.log('[AI Partner] Image generation request detected:', imageRequest)

    try {
      // Generate the image using DALL-E
      const imageResult = await generateEducationalImage({
        prompt: imageRequest.prompt,
        subject: session.subject || undefined,
        skillLevel: session.skillLevel || undefined,
        style: imageRequest.style || 'illustration',
      })

      // Create a friendly response about the generated image
      const imageDescription = `I've created a ${imageRequest.style || 'illustration'} for you! Here's what I visualized based on your request: "${imageRequest.prompt}"`

      // Save AI message with image
      const aiMsg = await prisma.aIPartnerMessage.create({
        data: {
          sessionId: session.id,
          studySessionId: session.studySessionId,
          role: 'ASSISTANT',
          content: imageDescription,
          messageType: 'IMAGE',
          imageUrl: imageResult.imageUrl,
          imageType: 'generated',
          imagePrompt: imageRequest.prompt,
          wasModerated: false,
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
        aiMessage: { id: aiMsg.id, content: imageDescription, imageUrl: imageResult.imageUrl },
        safetyBlocked: false,
        generatedImage: {
          imageUrl: imageResult.imageUrl,
          revisedPrompt: imageResult.revisedPrompt,
        },
      }
    } catch (imageError) {
      console.error('[AI Partner] Image generation failed:', imageError)
      // If image generation fails, fall back to text response
      // Continue with normal text response below
    }
  }

  // Get pinned system/persona prompts (keep all) and latest user/assistant messages
  const systemMessages = await prisma.aIPartnerMessage.findMany({
    where: { sessionId: session.id, role: 'SYSTEM' },
    orderBy: { createdAt: 'asc' },
  })

  const conversationMessages = await prisma.aIPartnerMessage.findMany({
    where: { sessionId: session.id, role: { in: ['USER', 'ASSISTANT'] } },
    orderBy: { createdAt: 'desc' },
    take: 20, // keep recent turns but don't drop system prompts
  })

  const limitedHistory = [
    ...systemMessages,
    ...conversationMessages.reverse(), // chronological
  ]

  // Build messages array for OpenAI
  const messages: AIMessage[] = limitedHistory.map((msg) => ({
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

  // ==========================================================================
  // SMART ROUTING: Use intelligent model selection and caching
  // ==========================================================================
  let aiResponse: SmartChatResult | { content: string; promptTokens: number; completionTokens: number; totalTokens: number }
  let smartRoutingUsed = false
  let modelUsed: string | undefined
  let wasCacheHit = false
  let routingReason: string | undefined

  // Determine if we should use smart routing
  const shouldUseSmartRouting =
    SMART_ROUTING_CONFIG.enabled &&
    content.length >= SMART_ROUTING_CONFIG.skipAnalysisThreshold

  if (shouldUseSmartRouting) {
    try {
      // Use smart routing with caching and model selection
      const smartResult = await sendSmartChatMessage(content, messages, {
        userId,
        subject: session.subject || undefined,
        skillLevel: session.skillLevel || undefined,
        enableCache: SMART_ROUTING_CONFIG.cacheEnabled,
        useAIFallback: SMART_ROUTING_CONFIG.useAIFallback,
        skipAnalysis: content.length < 30, // Very short messages get fast analysis
        manageContext: true,
      })

      aiResponse = smartResult
      smartRoutingUsed = true
      modelUsed = smartResult.modelUsed
      wasCacheHit = smartResult.cacheHit
      routingReason = smartResult.routingDecision?.reason

      // Log routing decision for monitoring
      if (SMART_ROUTING_CONFIG.logDecisions) {
        console.log('[Smart Routing] Decision:', {
          model: modelUsed,
          cached: wasCacheHit,
          complexity: smartResult.queryAnalysis?.complexity,
          responseLength: smartResult.queryAnalysis?.responseLength,
          reason: routingReason,
          totalTimeMs: smartResult.totalTimeMs,
        })
      }
    } catch (smartError) {
      // Fallback to legacy sendChatMessage on error
      console.error('[Smart Routing] Error, falling back to legacy:', smartError)

      if (SMART_ROUTING_CONFIG.fallbackOnError) {
        aiResponse = await sendChatMessage(messages, {
          temperature: session.persona?.temperature || 0.7,
          maxTokens: session.persona?.maxTokens || 500,
        })
      } else {
        throw smartError
      }
    }
  } else {
    // Use legacy sendChatMessage for very short messages or when disabled
    aiResponse = await sendChatMessage(messages, {
      temperature: session.persona?.temperature || 0.7,
      maxTokens: session.persona?.maxTokens || 500,
    })
  }

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
    aiMessage: {
      id: aiMsg.id,
      content: aiResponse.content,
      // Include smart routing info for frontend (optional)
      ...(smartRoutingUsed ? {
        modelUsed,
        wasCacheHit,
      } : {}),
    },
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

  // Generate quiz with skill level context
  const quiz = await generateQuizQuestion({
    subject: session.subject || 'General',
    topic,
    difficulty,
    skillLevel: session.skillLevel || undefined,
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

  // Generate flashcards with skill level context
  const flashcards = await generateFlashcards({
    subject: session.subject || 'General',
    topic,
    skillLevel: session.skillLevel || undefined,
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
  // N+1 FIX: Use createMany instead of loop to batch insert all flashcards
  if (session.studySessionId && flashcards.length > 0) {
    await prisma.sessionFlashcard.createMany({
      data: flashcards.map(card => ({
        sessionId: session.studySessionId!,
        userId,
        front: card.front,
        back: card.back,
      })),
    })
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

  // Generate flashcards from conversation using OpenAI with skill level context
  const flashcards = await generateFlashcardsFromChat({
    conversationSummary,
    subject: session.subject || undefined,
    skillLevel: session.skillLevel || undefined,
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
  // N+1 FIX: Use createMany instead of loop to batch insert all flashcards
  if (session.studySessionId && flashcards.length > 0) {
    await prisma.sessionFlashcard.createMany({
      data: flashcards.map(card => ({
        sessionId: session.studySessionId!,
        userId,
        front: card.front,
        back: card.back,
      })),
    })
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

  // Generate quiz from conversation using OpenAI with skill level context
  const questions = await generateQuizFromChat({
    conversationSummary,
    subject: session.subject || undefined,
    skillLevel: session.skillLevel || undefined,
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

  // Analyze whiteboard using OpenAI vision with full session context
  const result = await analyzeWhiteboardImage({
    imageBase64,
    subject: session.subject || undefined,
    skillLevel: session.skillLevel || undefined,
    userQuestion,
  })

  // Format response content
  let responseContent = `**Whiteboard Analysis**\n\n${result.analysis}`

  if (result.suggestions.length > 0) {
    responseContent += `\n\n**Suggestions:**\n${result.suggestions.map(s => `� ${s}`).join('\n')}`
  }

  if (result.relatedConcepts.length > 0) {
    responseContent += `\n\n**Related Concepts to Explore:**\n${result.relatedConcepts.map(c => `� ${c}`).join('\n')}`
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

  // Prepare message data once (reused by multiple operations)
  const messagesForExtraction = session.messages.map((m) => ({
    role: m.role.toLowerCase(),
    content: m.content,
    id: m.id,
  }))

  const messagesForSummary = session.messages.map((m) => ({
    role: m.role.toLowerCase() as 'user' | 'assistant',
    content: m.content,
  }))

  // Extract subject from conversation if not already set
  // This is important for "new topic" sessions where AI asks what to study
  let extractedSubject: string | null = null
  if (!session.subject && messagesForSummary.length >= 2) {
    extractedSubject = await extractSubjectFromConversation(messagesForSummary).catch((error) => {
      console.error('[AI Partner] Subject extraction failed:', error)
      return null
    })
  }

  // Use either existing subject or extracted one
  const finalSubject = session.subject || extractedSubject

  // Run memory extraction and summary generation IN PARALLEL for speed
  // This is the main performance optimization - these were running sequentially before
  const [extractedMemoriesResult, summary] = await Promise.all([
    // Memory extraction (non-blocking, catches its own errors)
    extractMemoriesFromConversation({
      userId,
      sessionId,
      messages: messagesForExtraction,
    }).catch((error) => {
      console.error('[AI Partner] Memory extraction failed:', error)
      return [] as ExtractedMemory[]
    }),
    // Summary generation (runs in parallel with memory extraction)
    generateSessionSummary({
      subject: finalSubject || undefined,
      messages: messagesForSummary,
      duration,
    }),
  ])

  // Save extracted memories (fast, runs after extraction completes)
  let memoriesExtracted = 0
  if (extractedMemoriesResult.length > 0) {
    try {
      memoriesExtracted = await saveMemories({
        userId,
        sessionId,
        memories: extractedMemoriesResult,
      })
    } catch (error) {
      console.error('[AI Partner] Memory save failed:', error)
    }
  }

  // Update user memory stats (fast database operation, non-blocking)
  updateUserMemoryFromSession({
    userId,
    sessionId,
    subject: finalSubject || undefined,
    durationMinutes,
  }).catch((error) => {
    console.error('[AI Partner] User memory update failed:', error)
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

  // Update session - include extracted subject if we found one
  await prisma.aIPartnerSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      endedAt,
      totalDuration: duration,
      rating,
      feedback,
      // Save extracted subject if session didn't have one
      ...(extractedSubject && !session.subject ? { subject: extractedSubject } : {}),
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

/**
 * Send a message with an uploaded image
 * Analyzes the image and provides AI response
 */
export async function sendMessageWithImage(params: {
  sessionId: string
  userId: string
  content: string
  imageBase64: string
  imageMimeType: string
}): Promise<{
  userMessage: { id: string; content: string; imageUrl?: string }
  aiMessage: { id: string; content: string }
  imageAnalysis?: { detectedContent: string; suggestedFollowUp: string[] }
}> {
  const { sessionId, userId, content, imageBase64, imageMimeType } = params

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

  // Get conversation history for context
  const history = await prisma.aIPartnerMessage.findMany({
    where: {
      sessionId: session.id,
      role: { in: ['USER', 'ASSISTANT', 'SYSTEM'] },
    },
    orderBy: { createdAt: 'asc' },
    take: 15,
  })

  // Build messages array for OpenAI
  const messages: AIMessage[] = history.map((msg) => ({
    role: msg.role.toLowerCase() as 'system' | 'user' | 'assistant',
    content: msg.content,
  }))

  // Save user message with image
  const userMsg = await prisma.aIPartnerMessage.create({
    data: {
      sessionId: session.id,
      studySessionId: session.studySessionId,
      role: 'USER',
      content: content || 'Uploaded an image',
      messageType: 'IMAGE',
      imageBase64: imageBase64,
      imageMimeType: imageMimeType,
      imageType: 'uploaded',
      wasModerated: false,
    },
  })

  // Get AI response with image analysis
  const aiResponse = await sendChatMessageWithImage({
    messages,
    imageBase64,
    mimeType: imageMimeType,
    userMessage: content || 'Please help me with this image.',
    subject: session.subject || undefined,
    skillLevel: session.skillLevel || undefined,
  })

  // Also get structured analysis for follow-up suggestions
  let imageAnalysis
  try {
    const analysisResult = await analyzeUploadedImage({
      imageBase64,
      mimeType: imageMimeType,
      userMessage: content,
      subject: session.subject || undefined,
      skillLevel: session.skillLevel || undefined,
    })
    imageAnalysis = {
      detectedContent: analysisResult.detectedContent,
      suggestedFollowUp: analysisResult.suggestedFollowUp,
    }
  } catch {
    // Analysis is optional, continue without it
  }

  // Save AI response
  const aiMsg = await prisma.aIPartnerMessage.create({
    data: {
      sessionId: session.id,
      studySessionId: session.studySessionId,
      role: 'ASSISTANT',
      content: aiResponse.content,
      messageType: 'IMAGE',
      imageAnalysis: imageAnalysis as unknown as Prisma.InputJsonValue,
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
    },
  })

  return {
    userMessage: {
      id: userMsg.id,
      content: userMsg.content,
    },
    aiMessage: {
      id: aiMsg.id,
      content: aiResponse.content,
    },
    imageAnalysis,
  }
}

/**
 * Generate an educational image for the session
 * Creates diagrams, charts, visualizations, logos, illustrations, and more
 */
export async function generateImageForSession(params: {
  sessionId: string
  userId: string
  prompt: string
  style?: ImageGenerationStyle
}): Promise<{
  imageUrl: string
  messageId: string
  revisedPrompt: string
}> {
  const { sessionId, userId, prompt, style = 'diagram' } = params

  const session = await prisma.aIPartnerSession.findUnique({
    where: { id: sessionId },
  })

  if (!session || session.userId !== userId) {
    throw new Error('Session not found or unauthorized')
  }

  if (session.status !== 'ACTIVE') {
    throw new Error('Session is not active')
  }

  // Generate the image
  const result = await generateEducationalImage({
    prompt,
    subject: session.subject || undefined,
    skillLevel: session.skillLevel || undefined,
    style,
  })

  // Save as message
  const msg = await prisma.aIPartnerMessage.create({
    data: {
      sessionId,
      studySessionId: session.studySessionId,
      role: 'ASSISTANT',
      content: `I've created a ${style} to help visualize: "${prompt}"`,
      messageType: 'IMAGE',
      imageUrl: result.imageUrl,
      imageType: 'generated',
      imagePrompt: prompt,
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
    imageUrl: result.imageUrl,
    messageId: msg.id,
    revisedPrompt: result.revisedPrompt,
  }
}

/**
 * Check if AI should suggest generating a visual for the current conversation
 */
export async function checkImageSuggestion(params: {
  sessionId: string
  userId: string
}): Promise<{
  shouldSuggest: boolean
  suggestedPrompt?: string
  reason?: string
}> {
  const { sessionId, userId } = params

  const session = await prisma.aIPartnerSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        where: { role: { in: ['USER', 'ASSISTANT'] } },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { role: true, content: true },
      },
    },
  })

  if (!session || session.userId !== userId) {
    return { shouldSuggest: false }
  }

  // Reverse to get chronological order
  const recentMessages = session.messages.reverse().map(m => ({
    role: m.role.toLowerCase(),
    content: m.content,
  }))

  return shouldSuggestImageGeneration({
    recentMessages,
    subject: session.subject || undefined,
  })
}
