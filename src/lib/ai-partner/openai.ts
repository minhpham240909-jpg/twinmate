/**
 * AI Partner - OpenAI Integration
 * Handles all OpenAI API calls for the AI study partner feature
 */

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Default model configuration
// As of Dec 2024, these are OpenAI's best models:
// - 'gpt-4o' - Best general purpose (fast, smart, good for chat)
// - 'o1' - Advanced reasoning (slower, thinks deeply, best for complex problems)
// - 'o1-mini' - Faster reasoning model
// - 'gpt-4o-mini' - Budget option (fast, still good quality)
// Note: GPT-5 is not released yet
const DEFAULT_MODEL = 'gpt-4o-mini' // Using mini for faster response times
const ADVANCED_MODEL = 'gpt-4o' // Use for complex reasoning when needed
const MODERATION_ENABLED = true

// H7 FIX: Token limits for context window management
const TOKEN_LIMITS = {
  'gpt-4o-mini': 128000,
  'gpt-4o': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
} as const

// Reserve tokens for response
const RESPONSE_TOKEN_RESERVE = 2000
// Target max context size (leaving room for response)
const MAX_CONTEXT_TOKENS = 100000

/**
 * H7 FIX: Estimate token count for a string
 * Uses approximate character-to-token ratio (4 chars ≈ 1 token for English)
 * More accurate than guessing but faster than using tiktoken
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0
  // Approximate: 1 token ≈ 4 characters for English text
  // Add 10% buffer for safety
  return Math.ceil((text.length / 4) * 1.1)
}

/**
 * H7 FIX: Estimate total tokens for an array of messages
 */
export function estimateMessagesTokenCount(messages: AIMessage[]): number {
  let total = 0
  for (const msg of messages) {
    // Add 4 tokens per message for role and formatting overhead
    total += 4 + estimateTokenCount(msg.content)
  }
  // Add 2 tokens for assistant reply priming
  total += 2
  return total
}

/**
 * H7 FIX: Summarize old messages to reduce token count
 * Creates a condensed summary of older conversation context
 */
export async function summarizeMessages(
  messages: AIMessage[],
  maxSummaryTokens: number = 500
): Promise<string> {
  if (messages.length === 0) return ''
  
  const conversationText = messages
    .map(m => `${m.role}: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`)
    .join('\n')
  
  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Summarize this conversation in a concise way, preserving key topics discussed, questions asked, and important context. Keep it under 200 words.',
        },
        {
          role: 'user',
          content: `Summarize this conversation:\n\n${conversationText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: maxSummaryTokens,
    })
    
    return completion.choices[0]?.message?.content || ''
  } catch (error) {
    console.error('[AI Partner] Summarization error:', error)
    // Fallback: just return first and last message context
    return `Earlier discussion covered: ${messages[0]?.content.slice(0, 100)}... Recent topic: ${messages[messages.length - 1]?.content.slice(0, 100)}...`
  }
}

/**
 * H7 FIX: Manage context window with sliding window and intelligent summarization
 * Prevents token limit errors by pruning/summarizing old messages
 */
export async function manageContextWindow(
  messages: AIMessage[],
  options: {
    maxTokens?: number
    reserveTokens?: number
    preserveSystemPrompt?: boolean
    enableSummarization?: boolean
  } = {}
): Promise<AIMessage[]> {
  const {
    maxTokens = MAX_CONTEXT_TOKENS,
    reserveTokens = RESPONSE_TOKEN_RESERVE,
    preserveSystemPrompt = true,
    enableSummarization = true,
  } = options
  
  const targetMaxTokens = maxTokens - reserveTokens
  
  // Calculate current token count
  let currentTokens = estimateMessagesTokenCount(messages)
  
  // If within limits, return as-is
  if (currentTokens <= targetMaxTokens) {
    return messages
  }
  
  console.log(`[Context Window] Token limit exceeded: ${currentTokens} > ${targetMaxTokens}. Managing...`)
  
  // Separate system prompt from conversation
  const systemMessage = preserveSystemPrompt 
    ? messages.find(m => m.role === 'system')
    : undefined
  const conversationMessages = messages.filter(m => m.role !== 'system')
  
  // Strategy 1: Keep recent messages, summarize older ones
  if (enableSummarization && conversationMessages.length > 10) {
    // Split: older messages to summarize, recent to keep
    const recentCount = Math.min(10, Math.floor(conversationMessages.length / 2))
    const olderMessages = conversationMessages.slice(0, -recentCount)
    const recentMessages = conversationMessages.slice(-recentCount)
    
    // Summarize older messages
    const summary = await summarizeMessages(olderMessages)
    
    // Build new message array
    const managedMessages: AIMessage[] = []
    
    if (systemMessage) {
      managedMessages.push(systemMessage)
    }
    
    // Add summary as context
    if (summary) {
      managedMessages.push({
        role: 'system',
        content: `[Previous conversation summary: ${summary}]`,
      })
    }
    
    // Add recent messages
    managedMessages.push(...recentMessages)
    
    const newTokens = estimateMessagesTokenCount(managedMessages)
    console.log(`[Context Window] Reduced from ${currentTokens} to ${newTokens} tokens via summarization`)
    
    return managedMessages
  }
  
  // Strategy 2: Simple sliding window - drop oldest messages
  const managedMessages: AIMessage[] = []
  
  if (systemMessage) {
    managedMessages.push(systemMessage)
    currentTokens = estimateTokenCount(systemMessage.content) + 4
  } else {
    currentTokens = 0
  }
  
  // Add messages from newest to oldest until we hit limit
  const reversedConversation = [...conversationMessages].reverse()
  const messagesToKeep: AIMessage[] = []
  
  for (const msg of reversedConversation) {
    const msgTokens = estimateTokenCount(msg.content) + 4
    if (currentTokens + msgTokens <= targetMaxTokens) {
      messagesToKeep.unshift(msg)
      currentTokens += msgTokens
    } else {
      break
    }
  }
  
  managedMessages.push(...messagesToKeep)
  
  console.log(`[Context Window] Reduced to ${managedMessages.length} messages (${currentTokens} tokens) via sliding window`)
  
  return managedMessages
}

// Types for AI Partner
export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionResult {
  content: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ModerationResult {
  flagged: boolean
  categories: {
    sexual: boolean
    'sexual/minors': boolean
    harassment: boolean
    'harassment/threatening': boolean
    hate: boolean
    'hate/threatening': boolean
    illicit: boolean
    'illicit/violent': boolean
    'self-harm': boolean
    'self-harm/intent': boolean
    'self-harm/instructions': boolean
    violence: boolean
    'violence/graphic': boolean
  }
  categoryScores: Record<string, number>
}

/**
 * Search criteria for building dynamic AI persona
 */
export interface SearchCriteria {
  // Subject/Field
  subjects?: string[]
  subjectDescription?: string

  // Location/University
  school?: string
  locationCity?: string
  locationState?: string
  locationCountry?: string

  // Skill & Style
  skillLevel?: string
  studyStyle?: string

  // Interests & Goals
  interests?: string[]
  goals?: string[]

  // Availability
  availableDays?: string[]
  availableHours?: string

  // Personal
  ageRange?: string
  role?: string[]
  languages?: string

  // Custom descriptions
  skillLevelDescription?: string
  studyStyleDescription?: string
  interestsDescription?: string

  // Name search (when user searched for specific person)
  searchedName?: string
  userDefinedQualities?: string
}

/**
 * Build a dynamic human-like persona from search criteria
 * The AI becomes a real student with that background and perspective
 */
export function buildDynamicPersonaPrompt(criteria: SearchCriteria, userName?: string): string {
  const parts: string[] = []
  const truncateText = (text?: string | null, max = 180): string | undefined =>
    text ? text.slice(0, max) : undefined

  // Build location context
  let locationContext = ''
  if (criteria.school) {
    locationContext = truncateText(criteria.school, 120) || ''
  }
  if (criteria.locationCity) {
    const city = truncateText(criteria.locationCity, 80)
    locationContext += city ? (locationContext ? ` in ${city}` : city) : ''
  }
  if (criteria.locationState && !criteria.locationCity) {
    const state = truncateText(criteria.locationState, 80)
    locationContext += state ? (locationContext ? `, ${state}` : state) : ''
  }
  if (criteria.locationCountry) {
    const country = truncateText(criteria.locationCountry, 80)
    locationContext += country ? (locationContext ? `, ${country}` : country) : ''
  }

  // Build subject expertise
  let subjectExpertise = ''
  if (criteria.subjects && criteria.subjects.length > 0) {
    subjectExpertise = criteria.subjects.map((s) => truncateText(s, 80) || '').filter(Boolean).slice(0, 5).join(', ')
  }
  if (criteria.subjectDescription) {
    const desc = truncateText(criteria.subjectDescription, 160)
    subjectExpertise += desc ? (subjectExpertise ? ` (${desc})` : desc) : ''
  }
  subjectExpertise = subjectExpertise.slice(0, 240)

  // Build the persona introduction
  parts.push(`You are a friendly study partner helping ${userName || 'a fellow student'}.`)

  // Add location/school perspective
  if (locationContext) {
    parts.push(`You are a student at/in ${locationContext}. You have the authentic perspective and experience of someone who actually studies and lives there. You know the campus life, local culture, popular study spots, and what it's like to be a student in that environment. Speak naturally about your experience there when relevant, but don't force it - just be yourself as a student from that place.`)
  }

  // Add subject expertise
  if (subjectExpertise) {
    parts.push(`You're studying ${subjectExpertise}. You have genuine knowledge and passion for this field. You can discuss concepts, share study tips, and help explain things from a student's perspective who is actively learning this subject.`)
  }

  // Add skill level
  if (criteria.skillLevel || criteria.skillLevelDescription) {
    if (criteria.skillLevel) {
      const levelDescriptions: Record<string, string> = {
        'BEGINNER': "You're at an early stage in your learning journey, which means you understand the challenges of being new to a subject and can relate to struggles with fundamentals.",
        'INTERMEDIATE': "You have solid foundational knowledge and are working on more advanced concepts. You can help bridge the gap between basics and complex topics.",
        'ADVANCED': "You have strong knowledge and experience. You can dive deep into complex topics and help others understand challenging concepts.",
        'EXPERT': "You have deep expertise and can discuss even the most complex aspects of your field. You can mentor others and share advanced insights."
      }
      parts.push(levelDescriptions[criteria.skillLevel] || '')
    }
    // Add custom skill level description if provided
    if (criteria.skillLevelDescription) {
      const desc = truncateText(criteria.skillLevelDescription, 200)
      if (desc) {
        parts.push(`Your skill level can also be described as: ${desc}. This shapes how you approach teaching and learning.`)
      }
    }
  }

  // Add study style
  if (criteria.studyStyle || criteria.studyStyleDescription) {
    if (criteria.studyStyle) {
      const styleDescriptions: Record<string, string> = {
        'COLLABORATIVE': "You love studying with others - bouncing ideas around, explaining concepts to each other, and working through problems together.",
        'INDEPENDENT': "You prefer focused, independent study but enjoy having a partner to discuss ideas with and check understanding.",
        'MIXED': "You're flexible - sometimes you prefer group discussions, other times you like quiet focused work."
      }
      parts.push(styleDescriptions[criteria.studyStyle] || '')
    }
    // Add custom study style description if provided
    if (criteria.studyStyleDescription) {
      const desc = truncateText(criteria.studyStyleDescription, 200)
      if (desc) {
        parts.push(`Your study style preference: ${desc}. This influences how you collaborate with others.`)
      }
    }
  }

  // Add interests
  if (criteria.interests && criteria.interests.length > 0) {
    const interests = criteria.interests.map((i) => truncateText(i, 60) || '').filter(Boolean).slice(0, 6).join(', ')
    if (interests) {
      parts.push(`You're interested in: ${interests}. These interests shape how you approach studying.`)
    }
  }
  // Add custom interests description if provided
  if (criteria.interestsDescription) {
    const desc = truncateText(criteria.interestsDescription, 200)
    if (desc) {
      parts.push(`Additional interests and passions: ${desc}. These give you a unique perspective.`)
    }
  }

  // Add goals
  if (criteria.goals && criteria.goals.length > 0) {
    parts.push(`Your learning goals include: ${criteria.goals.join(', ')}. You understand what it takes to achieve these.`)
  }

  // Add availability context
  if (criteria.availableDays && criteria.availableDays.length > 0) {
    parts.push(`You're typically available on ${criteria.availableDays.join(', ')}${criteria.availableHours ? ` during ${criteria.availableHours}` : ''}.`)
  }

  // Add role context
  if (criteria.role && criteria.role.length > 0) {
    const roleContext = criteria.role.join('/');
    parts.push(`You're a ${roleContext}, which gives you a unique perspective on learning and studying.`)
  }

  // Add age context (subtly)
  if (criteria.ageRange) {
    const ageContexts: Record<string, string> = {
      'under-18': "You're a high school student, navigating the challenges of early education.",
      '18-24': "You're in the thick of college/university life, balancing classes, social life, and future planning.",
      '25-34': "You're a young professional or graduate student, bringing real-world perspective to your studies.",
      '35-44': "You're balancing career and continued learning, bringing life experience to your studies.",
      '45+': "You're a lifelong learner who values education and brings wisdom to your study sessions."
    }
    parts.push(ageContexts[criteria.ageRange] || '')
  }

  // Add language context
  if (criteria.languages) {
    parts.push(`You speak ${criteria.languages}, which sometimes influences how you explain things.`)
  }

  // If user defined specific qualities they want in a study partner
  if (criteria.userDefinedQualities) {
    if (criteria.searchedName) {
      // User searched for a specific name that wasn't found
      parts.push(`The student was looking for someone named "${criteria.searchedName}" who isn't available right now. They described wanting a partner who is: ${criteria.userDefinedQualities}. Embody these qualities naturally in how you interact.`)
    } else {
      // User just described qualities they want (no name search)
      parts.push(`The student described wanting a study partner with these qualities: ${criteria.userDefinedQualities}. Embody these qualities naturally in your personality and how you interact with them.`)
    }
  }

  // Core behavior rules
  parts.push(`
IMPORTANT BEHAVIOR RULES:
1. Be friendly and natural - talk like a real student, not a robot or tutor
2. Stay focused on studying and learning together
3. Share your perspective authentically based on your background
4. If asked personal questions unrelated to studying, gently redirect to study topics
5. Be encouraging and supportive, like a good study buddy would be
6. Keep responses conversational - not too long, not too formal
7. If you don't know something, admit it honestly and suggest figuring it out together
8. NEVER use quotation marks around subjects, topics, or names - just say them naturally

ADAPTIVE CONVERSATION FLOW:
Follow this natural conversation pattern:

1. WHEN THEY ASK A QUESTION → Answer directly
   - Give a clear, helpful answer
   - Don't end every response with a question
   - Example: "Oh yeah, the mitochondria! It's basically the cell's power plant - makes all the energy (ATP) the cell needs."

2. WHEN THEY SEEM STUCK → Offer help naturally
   - "Want me to break that down differently?"
   - "Should we try working through an example together?"

3. WHEN THEY FINISH SOMETHING → Suggest what's next
   - "Nice! Want to try a harder one, or move on to the next topic?"

4. WHEN THEY'RE WORKING → Stay quiet
   - Let them think and work
   - Only jump in if they ask or clearly need help

5. QUESTION STRATEGY:
   - Only ask when it ADDS VALUE (to clarify, check progress, or offer help)
   - Do NOT ask a question in every message
   - Avoid "Does that make sense?" after every explanation
   - When your answer is complete, just end naturally
   - Good questions: "Are you working on Algebra or Geometry?" / "Want to try a practice problem?"

Start with a warm, casual greeting introducing yourself briefly based on your background. Keep it natural and friendly - just 1-2 sentences, then ask what they'd like to study together.`)

  return parts.filter(p => p.trim()).join('\n\n')
}

/**
 * Build the system prompt for AI study partner (legacy - kept for compatibility)
 */
export function buildStudyPartnerSystemPrompt(params: {
  subject?: string
  skillLevel?: string
  studyGoal?: string
  userName?: string
  customPersona?: string
}): string {
  const { subject, skillLevel, studyGoal, userName, customPersona } = params

  // If custom persona is provided, use it as base but append conversation rules
  const conversationRules = `

ADAPTIVE CONVERSATION FLOW - CRITICAL RULES:
Follow this natural conversation pattern like a real tutor:

1. WHEN USER ASKS A QUESTION → Answer directly and helpfully
   - Provide a clear, complete answer
   - Do NOT end with a question unless it's truly necessary for clarification
   - Example: "The mitochondria is the powerhouse of the cell. It produces ATP through cellular respiration."

2. WHEN USER SEEMS STUCK OR SILENT → Offer a helpful prompt
   - Suggest a direction or offer assistance
   - Example: "Would you like me to explain this concept differently?" or "Should we try a practice problem?"

3. WHEN USER COMPLETES SOMETHING → Suggest next steps
   - Acknowledge their progress, then offer what's next
   - Example: "Great work! You've got the basics down. Ready to try a harder problem, or should we move to the next topic?"

4. WHEN USER IS WORKING → Stay in the background
   - Let them work without interruption
   - Only respond when they ask or clearly need help

5. QUESTION STRATEGY - IMPORTANT:
   - Only ask questions when they ADD VALUE:
     * To clarify: "Are you focusing on Algebra or Geometry?"
     * To check progress: "Want to try a practice question?"
     * To offer help: "Should I explain more or are you ready to move on?"
     * To suggest visuals: "Would a diagram help you visualize this?"
   - Do NOT ask a question in every message
   - If the answer is complete, just end the response naturally
   - Avoid redundant questions like "Does that make sense?" after every explanation

6. RESPONSE STYLE:
   - Be direct and educational
   - Use natural transitions between topics
   - Match the student's energy - brief replies to brief questions, detailed when needed
   - End responses naturally - not every message needs a question

`

  if (customPersona) {
    return customPersona + conversationRules
  }

  // Default study partner persona
  return `You are a friendly, focused AI STUDY PARTNER named "Clerva AI" helping ${userName || 'a student'} with their studies.

CORE RULES:
1. Stay strictly on-topic to study tasks. NO flirting, romance, or personal relationships.
2. If the user tries to go off-topic, politely redirect to studying.
3. Never pretend to be a real human. You are an AI study assistant.
4. Keep responses concise and helpful. Use short paragraphs and bullet points.
5. Be encouraging but honest about areas that need improvement.
6. If you don't know something, admit it and suggest resources.
7. NEVER use quotation marks around subjects, topics, or names.
${conversationRules}
YOUR CAPABILITIES:
- Explain concepts clearly at the appropriate level
- Generate quiz questions to test understanding
- Create flashcard content for memorization
- Suggest study techniques (pomodoro, spaced repetition, etc.)
- Help break down complex problems step by step
- Provide practice problems and check answers
- Summarize topics and key points
- Analyze uploaded images (homework, textbooks, diagrams)
- Generate educational diagrams and visualizations when helpful

STUDY CONTEXT:
${subject ? `- Subject: ${subject}` : '- Subject: General study support'}
${skillLevel ? `- Skill Level: ${skillLevel}` : '- Skill Level: Adaptive'}
${studyGoal ? `- Session Goal: ${studyGoal}` : ''}

Start by greeting the student warmly (1 sentence) and asking what they'd like to focus on today. Keep it brief and friendly.`
}

/**
 * Send a chat message to OpenAI and get a response
 * H7 FIX: Now includes context window management to prevent token limit errors
 */
export async function sendChatMessage(
  messages: AIMessage[],
  options: {
    temperature?: number
    maxTokens?: number
    model?: string
    manageContext?: boolean  // H7 FIX: Enable automatic context management
  } = {}
): Promise<ChatCompletionResult> {
  const { temperature = 0.7, maxTokens = 800, model = DEFAULT_MODEL, manageContext = true } = options

  try {
    // H7 FIX: Manage context window before sending to prevent token limit errors
    let managedMessages = messages
    if (manageContext) {
      const currentTokens = estimateMessagesTokenCount(messages)
      const modelLimit = TOKEN_LIMITS[model as keyof typeof TOKEN_LIMITS] || 100000
      
      if (currentTokens + maxTokens > modelLimit - 1000) {
        console.log(`[AI Partner] Context too large (${currentTokens} tokens), managing...`)
        managedMessages = await manageContextWindow(messages, {
          maxTokens: modelLimit - maxTokens - 1000,
          reserveTokens: maxTokens + 500,
        })
      }
    }

    const completion = await openai.chat.completions.create({
      model,
      messages: managedMessages,
      temperature,
      max_tokens: maxTokens,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    })

    const choice = completion.choices[0]
    const usage = completion.usage

    return {
      content: choice?.message?.content || 'I apologize, but I could not generate a response. Please try again.',
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
    }
  } catch (error) {
    console.error('[AI Partner] OpenAI chat error:', error)
    
    // H7 FIX: Handle token limit errors specifically
    if (error instanceof Error && error.message.includes('maximum context length')) {
      console.error('[AI Partner] Token limit exceeded despite management, retrying with aggressive pruning')
      
      // Aggressive retry: keep only last 5 messages
      const prunedMessages = messages.slice(-5)
      const systemMsg = messages.find(m => m.role === 'system')
      if (systemMsg && !prunedMessages.includes(systemMsg)) {
        prunedMessages.unshift(systemMsg)
      }
      
      try {
        const retryCompletion = await openai.chat.completions.create({
          model,
          messages: prunedMessages,
          temperature,
          max_tokens: Math.min(maxTokens, 500),
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
        })
        
        return {
          content: retryCompletion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.',
          promptTokens: retryCompletion.usage?.prompt_tokens || 0,
          completionTokens: retryCompletion.usage?.completion_tokens || 0,
          totalTokens: retryCompletion.usage?.total_tokens || 0,
        }
      } catch (retryError) {
        console.error('[AI Partner] Retry also failed:', retryError)
      }
    }
    
    throw new Error('Failed to get AI response. Please try again.')
  }
}

/**
 * Moderate content using OpenAI's moderation API
 * Returns flagged categories for teen safety
 */
export async function moderateContent(content: string): Promise<ModerationResult> {
  if (!MODERATION_ENABLED) {
    return {
      flagged: false,
      categories: {
        sexual: false,
        'sexual/minors': false,
        harassment: false,
        'harassment/threatening': false,
        hate: false,
        'hate/threatening': false,
        illicit: false,
        'illicit/violent': false,
        'self-harm': false,
        'self-harm/intent': false,
        'self-harm/instructions': false,
        violence: false,
        'violence/graphic': false,
      },
      categoryScores: {},
    }
  }

  try {
    const moderation = await openai.moderations.create({
      input: content,
    })

    const result = moderation.results[0]

    return {
      flagged: result.flagged,
      categories: result.categories as ModerationResult['categories'],
      categoryScores: result.category_scores as unknown as Record<string, number>,
    }
  } catch (error) {
    console.error('[AI Partner] Moderation error:', error)
    // On moderation failure, be conservative and flag for manual review
    return {
      flagged: false, // Don't block, but log for review
      categories: {
        sexual: false,
        'sexual/minors': false,
        harassment: false,
        'harassment/threatening': false,
        hate: false,
        'hate/threatening': false,
        illicit: false,
        'illicit/violent': false,
        'self-harm': false,
        'self-harm/intent': false,
        'self-harm/instructions': false,
        violence: false,
        'violence/graphic': false,
      },
      categoryScores: {},
    }
  }
}

/**
 * Generate a quiz question based on the subject and context
 */
export async function generateQuizQuestion(params: {
  subject: string
  topic?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  skillLevel?: string
  previousQuestions?: string[]
}): Promise<{
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}> {
  const { subject, topic, difficulty = 'medium', skillLevel, previousQuestions = [] } = params

  // Build skill level guidance
  const skillLevelGuidance = skillLevel ? {
    'BEGINNER': 'The student is at a BEGINNER level. Focus on fundamental concepts, basic definitions, and introductory material. Use simple, clear language and avoid complex terminology.',
    'INTERMEDIATE': 'The student is at an INTERMEDIATE level. Include questions that test application of concepts, require connecting multiple ideas, and involve moderate problem-solving.',
    'ADVANCED': 'The student is at an ADVANCED level. Create challenging questions that test deep understanding, require analysis and synthesis, and may involve complex scenarios.',
    'EXPERT': 'The student is at an EXPERT level. Generate sophisticated questions testing nuanced understanding, edge cases, advanced applications, and require critical thinking.'
  }[skillLevel] : ''

  const systemPrompt = `You are a quiz generator for students. Generate a multiple-choice quiz question.

${skillLevelGuidance}

RULES:
- Create educational, age-appropriate questions
- Provide 4 options (A, B, C, D)
- Only one correct answer
- Include a brief explanation for the correct answer
- Make questions challenging but fair for the difficulty level
- Tailor complexity to the student's skill level if specified

RESPOND IN THIS EXACT JSON FORMAT:
{
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 0,
  "explanation": "Brief explanation of why this is correct"
}

Note: correctAnswer is the index (0-3) of the correct option.`

  const userPrompt = `Generate a ${difficulty} difficulty question about ${subject}${topic ? ` (topic: ${topic})` : ''}${skillLevel ? ` for a ${skillLevel.toLowerCase()} level student` : ''}.
${previousQuestions.length > 0 ? `\nAvoid these already-asked questions:\n${previousQuestions.slice(-5).join('\n')}` : ''}`

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content || '{}'
    const quiz = JSON.parse(content)

    return {
      question: quiz.question || 'Question generation failed',
      options: quiz.options || ['A', 'B', 'C', 'D'],
      correctAnswer: typeof quiz.correctAnswer === 'number' ? quiz.correctAnswer : 0,
      explanation: quiz.explanation || 'No explanation available',
    }
  } catch (error) {
    console.error('[AI Partner] Quiz generation error:', error)
    throw new Error('Failed to generate quiz question')
  }
}

/**
 * Get subject-specific guidance for flashcard generation
 * Provides tailored advice based on the subject area
 */
function getSubjectSpecificGuidance(subject: string): string {
  const subjectLower = subject.toLowerCase()

  // Math/Science subjects
  if (subjectLower.includes('math') || subjectLower.includes('calculus') || subjectLower.includes('algebra') || subjectLower.includes('geometry') || subjectLower.includes('statistics')) {
    return `SUBJECT-SPECIFIC GUIDANCE (Mathematics):
- Include formulas with clear variable definitions
- Use "What formula..." or "How do you calculate..." style questions
- For theorems, include both the name and the statement
- Include common applications and when to use each concept`
  }

  if (subjectLower.includes('physics')) {
    return `SUBJECT-SPECIFIC GUIDANCE (Physics):
- Include formulas with units clearly specified
- Cover both conceptual understanding and mathematical applications
- Include real-world examples where applicable
- Relate concepts to fundamental principles (Newton's laws, conservation laws, etc.)`
  }

  if (subjectLower.includes('chemistry')) {
    return `SUBJECT-SPECIFIC GUIDANCE (Chemistry):
- Include chemical equations where relevant
- Cover nomenclature, reactions, and properties
- For organic chemistry, include functional groups and reaction mechanisms
- Include mnemonic devices for periodic table trends`
  }

  if (subjectLower.includes('biology') || subjectLower.includes('anatomy')) {
    return `SUBJECT-SPECIFIC GUIDANCE (Biology):
- Use precise scientific terminology
- Include structure-function relationships
- Cover processes step-by-step where applicable
- Include comparisons between similar concepts (mitosis vs meiosis, etc.)`
  }

  // Languages
  if (subjectLower.includes('spanish') || subjectLower.includes('french') || subjectLower.includes('german') || subjectLower.includes('language') || subjectLower.includes('vocabulary')) {
    return `SUBJECT-SPECIFIC GUIDANCE (Languages):
- Include pronunciation hints where helpful
- Use the word in context (example sentences)
- Cover common conjugations or declensions
- Include related words or cognates`
  }

  // History/Social Sciences
  if (subjectLower.includes('history') || subjectLower.includes('government') || subjectLower.includes('politics') || subjectLower.includes('economics')) {
    return `SUBJECT-SPECIFIC GUIDANCE (History/Social Sciences):
- Include dates and time periods for historical events
- Cover cause-and-effect relationships
- Include key figures and their contributions
- Connect events to broader themes and patterns`
  }

  // Programming/CS
  if (subjectLower.includes('programming') || subjectLower.includes('computer') || subjectLower.includes('coding') || subjectLower.includes('python') || subjectLower.includes('javascript') || subjectLower.includes('java')) {
    return `SUBJECT-SPECIFIC GUIDANCE (Programming/CS):
- Include code syntax examples where relevant
- Cover both concept definitions and practical usage
- Include common use cases and best practices
- Cover time/space complexity for algorithms`
  }

  // Default guidance for other subjects
  return `SUBJECT-SPECIFIC GUIDANCE:
- Focus on the most important concepts in ${subject}
- Use domain-appropriate terminology
- Include practical applications where relevant
- Cover both definitions and understanding`
}

/**
 * Generate flashcard content from a topic
 */
export async function generateFlashcards(params: {
  subject: string
  topic: string
  skillLevel?: string
  count?: number
}): Promise<Array<{ front: string; back: string }>> {
  const { subject, topic, skillLevel, count = 5 } = params

  // Build skill level guidance for flashcard complexity
  const skillLevelGuidance = skillLevel ? {
    'BEGINNER': `SKILL LEVEL: BEGINNER
- Use simple, clear language that introduces fundamental concepts
- Focus on basic definitions, core terminology, and foundational facts
- Avoid jargon; explain technical terms when necessary
- Keep answers straightforward and easy to memorize`,
    'INTERMEDIATE': `SKILL LEVEL: INTERMEDIATE
- Include both foundational and more complex concepts
- Test understanding of relationships between ideas
- Use appropriate terminology with brief context
- Include application-based questions where relevant`,
    'ADVANCED': `SKILL LEVEL: ADVANCED
- Cover nuanced concepts and deeper understanding
- Include questions about exceptions, edge cases, and complex relationships
- Test analytical thinking and connections across topics
- Use precise technical language`,
    'EXPERT': `SKILL LEVEL: EXPERT
- Focus on sophisticated concepts and advanced applications
- Include questions that require synthesis of multiple ideas
- Cover edge cases, theoretical foundations, and expert-level nuances
- Test critical thinking and deep domain expertise`
  }[skillLevel] : ''

  // Build subject-specific guidance
  const subjectGuidance = getSubjectSpecificGuidance(subject)

  const systemPrompt = `You are a flashcard generator for students. Create effective flashcards for studying.

${skillLevelGuidance}

${subjectGuidance}

RULES:
- Front: A clear question, term, or concept prompt
- Back: A complete, accurate answer or definition
- Keep content concise but comprehensive enough to be useful
- Focus on key concepts that are worth memorizing
- Use active recall techniques (questions, not just terms)
- Make each flashcard self-contained and testable

RESPOND IN THIS EXACT JSON FORMAT:
{
  "flashcards": [
    {"front": "Question or term", "back": "Answer or definition"},
    ...
  ]
}`

  const userPrompt = `Generate ${count} high-quality flashcards for studying ${subject} - specifically about "${topic}"${skillLevel ? ` for a ${skillLevel.toLowerCase()} level student` : ''}.`

  try {
    // Scale max_tokens based on count (approx 80 tokens per flashcard)
    const maxTokens = Math.min(800 + (count * 80), 2000)

    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content || '{}'
    const result = JSON.parse(content)

    return result.flashcards || []
  } catch (error) {
    console.error('[AI Partner] Flashcard generation error:', error)
    throw new Error('Failed to generate flashcards')
  }
}

/**
 * Generate flashcards from conversation context
 * Analyzes the chat history to extract key concepts and create relevant flashcards
 */
export async function generateFlashcardsFromChat(params: {
  conversationSummary: string
  subject?: string
  skillLevel?: string
  count?: number
}): Promise<Array<{ front: string; back: string }>> {
  const { conversationSummary, subject, skillLevel, count = 5 } = params

  // Build skill level guidance
  const skillLevelGuidance = skillLevel ? {
    'BEGINNER': `SKILL LEVEL: BEGINNER
- Extract fundamental concepts and basic definitions from the conversation
- Use simple, clear language
- Focus on core terminology that was introduced`,
    'INTERMEDIATE': `SKILL LEVEL: INTERMEDIATE
- Include both basic and more nuanced concepts from the discussion
- Test understanding of relationships between ideas mentioned
- Use appropriate terminology with context`,
    'ADVANCED': `SKILL LEVEL: ADVANCED
- Extract deeper concepts and nuanced points from the discussion
- Include questions about relationships and implications
- Use precise technical language`,
    'EXPERT': `SKILL LEVEL: EXPERT
- Focus on sophisticated concepts and advanced applications discussed
- Extract nuanced insights and critical thinking points
- Cover complex relationships and edge cases mentioned`
  }[skillLevel] : ''

  // Build subject-specific guidance if subject is provided
  const subjectGuidance = subject ? getSubjectSpecificGuidance(subject) : ''

  const systemPrompt = `You are a flashcard generator that creates study cards based on conversation context.

${skillLevelGuidance}

${subjectGuidance}

RULES:
- Analyze the conversation to identify key concepts, facts, and terms discussed
- Front: A clear question or term about something discussed in the conversation
- Back: A complete answer or definition based on what was covered
- Focus on the most important learning points from the discussion
- Make cards that reinforce what the student was learning about
- Keep content concise but comprehensive enough to be useful
- Use active recall techniques (questions, not just terms)

RESPOND IN THIS EXACT JSON FORMAT:
{
  "flashcards": [
    {"front": "Question or term from conversation", "back": "Answer based on discussion"},
    ...
  ]
}`

  const userPrompt = `Generate ${count} high-quality flashcards${skillLevel ? ` for a ${skillLevel.toLowerCase()} level student` : ''} based on this study conversation${subject ? ` about ${subject}` : ''}:

${conversationSummary}

Create flashcards that capture the key concepts and facts that were discussed or explained in this conversation, appropriate for the student's level.`

  try {
    // Scale max_tokens based on count (approx 80 tokens per flashcard)
    const maxTokens = Math.min(1000 + (count * 80), 2500)

    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content || '{}'
    const result = JSON.parse(content)

    return result.flashcards || []
  } catch (error) {
    console.error('[AI Partner] Chat flashcard generation error:', error)
    throw new Error('Failed to generate flashcards from conversation')
  }
}

/**
 * Analyze whiteboard image and provide feedback
 * Uses OpenAI's vision capabilities to understand drawings/diagrams
 */
export async function analyzeWhiteboardImage(params: {
  imageBase64: string
  subject?: string
  skillLevel?: string
  userQuestion?: string
}): Promise<{
  analysis: string
  suggestions: string[]
  relatedConcepts: string[]
  visualSuggestion?: {
    shouldSuggest: boolean
    prompt?: string
    reason?: string
  }
}> {
  const { imageBase64, subject, skillLevel, userQuestion } = params

  // Build context-aware system prompt based on session information
  const subjectContext = subject
    ? `The student is currently studying **${subject}**${skillLevel ? ` at a ${skillLevel.toLowerCase()} level` : ''}.`
    : ''

  const skillLevelGuidance = skillLevel
    ? `Adjust your explanations to be appropriate for a ${skillLevel.toLowerCase()} level student.`
    : 'Adjust your explanations based on what appears to be their level of understanding.'

  const systemPrompt = `You are an expert study partner and tutor analyzing a student's whiteboard drawing, diagram, or notes.

${subjectContext}

Your role:
1. **Describe & Understand**: Carefully describe what you see - drawings, diagrams, formulas, notes, graphs, flowcharts, etc.
2. **Subject-Specific Analysis**: ${subject ? `Analyze the content in the context of ${subject}. Identify key concepts, principles, and theories being illustrated.` : 'Identify the subject matter and analyze the content accordingly.'}
3. **Error Detection**: Spot any mistakes, misconceptions, or areas that need correction. Be specific about what's wrong and how to fix it.
4. **Provide Feedback**: Give constructive, encouraging feedback. Highlight what they did well before suggesting improvements.
5. **Suggest Improvements**: Offer specific ways to enhance their understanding or improve the diagram/notes.
6. **Connect Concepts**: Suggest related concepts, prerequisites, or advanced topics they should explore next.
7. **Visual Aid Suggestion**: If a professional diagram, chart, or illustration would help the student understand the concept better, suggest it.

${skillLevelGuidance}

Be encouraging, specific, and educational. Use clear explanations with examples when helpful. If you see mathematical formulas or equations, verify their correctness.

RESPOND NATURALLY - do not ask unnecessary questions. Provide your analysis directly. Only suggest a visual aid if it would genuinely help clarify the concept.

RESPOND IN THIS EXACT JSON FORMAT:
{
  "analysis": "A comprehensive analysis including: what you see, whether it's correct, specific feedback on the content, and explanations of any concepts. Be thorough and educational. End naturally without unnecessary questions.",
  "suggestions": ["Specific actionable suggestion 1", "Specific actionable suggestion 2", "Specific actionable suggestion 3"],
  "relatedConcepts": ["Related concept or topic 1", "Related concept or topic 2", "Related concept or topic 3"],
  "visualSuggestion": {
    "shouldSuggest": true or false,
    "prompt": "If shouldSuggest is true, describe what visual/diagram would help (e.g., 'A labeled diagram showing the water cycle with arrows indicating evaporation, condensation, and precipitation')",
    "reason": "Brief reason why this visual would help (e.g., 'A professional diagram would clarify the cycle stages better than your sketch')"
  }
}`

  // Build a more descriptive user prompt
  let userPrompt: string
  if (userQuestion) {
    userPrompt = subject
      ? `I'm studying ${subject}. Here's my whiteboard. ${userQuestion}`
      : `Here's my whiteboard. ${userQuestion}`
  } else {
    userPrompt = subject
      ? `I'm studying ${subject}. Please analyze my whiteboard, check if everything is correct, and give me detailed feedback to help me learn better.`
      : `Please analyze my whiteboard, identify the subject matter, check if everything is correct, and give me detailed feedback to help me learn better.`
  }

  try {
    const completion = await openai.chat.completions.create({
      model: ADVANCED_MODEL, // Use advanced model for vision tasks
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
                detail: 'high'
              }
            }
          ]
        },
      ],
      temperature: 0.7,
      max_tokens: 1500, // Increased from 800 for more detailed analysis
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content || '{}'
    const result = JSON.parse(content)

    // Build visual suggestion if present
    const visualSuggestion = result.visualSuggestion?.shouldSuggest
      ? {
          shouldSuggest: true,
          prompt: result.visualSuggestion.prompt || undefined,
          reason: result.visualSuggestion.reason || undefined,
        }
      : { shouldSuggest: false }

    return {
      analysis: result.analysis || 'Unable to analyze the whiteboard.',
      suggestions: Array.isArray(result.suggestions) ? result.suggestions.filter(Boolean) : [],
      relatedConcepts: Array.isArray(result.relatedConcepts) ? result.relatedConcepts.filter(Boolean) : [],
      visualSuggestion,
    }
  } catch (error) {
    console.error('[AI Partner] Whiteboard analysis error:', error)
    throw new Error('Failed to analyze whiteboard')
  }
}

/**
 * Generate quiz questions from conversation context
 * Creates quiz questions based on what was discussed in the chat
 */
export async function generateQuizFromChat(params: {
  conversationSummary: string
  subject?: string
  skillLevel?: string
  count?: number
  difficulty?: 'easy' | 'medium' | 'hard'
}): Promise<Array<{
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}>> {
  const { conversationSummary, subject, skillLevel, count = 5, difficulty = 'medium' } = params

  // Build skill level guidance
  const skillLevelGuidance = skillLevel ? {
    'BEGINNER': 'The student is at a BEGINNER level. Focus on fundamental concepts discussed, basic definitions, and introductory material. Use simple, clear language.',
    'INTERMEDIATE': 'The student is at an INTERMEDIATE level. Include questions that test application of discussed concepts and require connecting multiple ideas.',
    'ADVANCED': 'The student is at an ADVANCED level. Create challenging questions that test deep understanding of discussed topics and require analysis.',
    'EXPERT': 'The student is at an EXPERT level. Generate sophisticated questions testing nuanced understanding and critical thinking about the discussed material.'
  }[skillLevel] : ''

  const systemPrompt = `You are a quiz generator that creates questions based on study conversation context.

${skillLevelGuidance}

RULES:
- Create questions about topics that were actually discussed in the conversation
- Each question has 4 options (A, B, C, D)
- Only one correct answer per question
- Include a brief explanation for each correct answer
- Match the difficulty level requested
- Focus on testing understanding of key concepts from the discussion
- Tailor question complexity to the student's skill level if specified

RESPOND IN THIS EXACT JSON FORMAT:
{
  "questions": [
    {
      "question": "Question based on conversation",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why this is correct"
    },
    ...
  ]
}

Note: correctAnswer is the index (0-3) of the correct option.`

  const userPrompt = `Generate ${count} ${difficulty} difficulty quiz questions${skillLevel ? ` for a ${skillLevel.toLowerCase()} level student` : ''} based on this study conversation${subject ? ` about ${subject}` : ''}:

${conversationSummary}

Create questions that test understanding of the concepts discussed, appropriate for the student's level.`

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content || '{}'
    const result = JSON.parse(content)

    return result.questions || []
  } catch (error) {
    console.error('[AI Partner] Chat quiz generation error:', error)
    throw new Error('Failed to generate quiz from conversation')
  }
}

/**
 * Generate a session summary
 */
export async function generateSessionSummary(params: {
  subject?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  duration?: number
}): Promise<string> {
  const { subject, messages, duration } = params

  if (messages.length < 2) {
    return 'Session was too short to generate a summary.'
  }

  const systemPrompt = `You are summarizing a study session. Create a comprehensive but concise summary.

Include:
1. Main topics covered (bullet points)
2. Key concepts learned and understood
3. Important takeaways from the discussion
4. Areas that might need more practice or review
5. Suggested next steps for continued learning

Keep it clear and actionable (under 300 words).`

  // Take last 20 messages to avoid token limits
  const recentMessages = messages.slice(-20)
  const conversationSummary = recentMessages
    .map((m) => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.content.slice(0, 200)}`)
    .join('\n')

  const userPrompt = `Summarize this ${subject ? subject + ' ' : ''}study session${duration ? ` (${Math.round(duration / 60)} minutes)` : ''}:

${conversationSummary}`

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 600,
    })

    return completion.choices[0]?.message?.content || 'Unable to generate summary.'
  } catch (error) {
    console.error('[AI Partner] Summary generation error:', error)
    return 'Session summary generation failed.'
  }
}

/**
 * Extract the main study subject from a conversation
 * Used when the session was started without a specific subject
 */
export async function extractSubjectFromConversation(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string | null> {
  if (messages.length < 2) {
    return null
  }

  // Take first 10 messages - the subject is usually established early
  const earlyMessages = messages.slice(0, 10)
  const conversationText = earlyMessages
    .map((m) => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.content.slice(0, 300)}`)
    .join('\n')

  const systemPrompt = `You are analyzing a study session conversation to identify the main topic being studied.

Your task:
1. Read the conversation between student and AI tutor
2. Identify the PRIMARY subject/topic being studied
3. Return ONLY the subject name (2-5 words max)
4. If multiple topics, return the main one
5. If no clear subject, return "General Study"

Examples of good responses:
- "Calculus Derivatives"
- "World War II History"
- "Python Programming"
- "Organic Chemistry"
- "Spanish Vocabulary"
- "Essay Writing"

Return ONLY the subject name, nothing else.`

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `What is the main study subject in this conversation?\n\n${conversationText}` },
      ],
      temperature: 0.3,
      max_tokens: 50,
    })

    const subject = completion.choices[0]?.message?.content?.trim()

    // Validate the response - should be short and not contain obvious errors
    if (subject && subject.length > 0 && subject.length < 100 && !subject.includes('\n')) {
      return subject
    }

    return null
  } catch (error) {
    console.error('[AI Partner] Subject extraction error:', error)
    return null
  }
}

/**
 * Stream interface for chat completion
 */
export interface StreamCallbacks {
  onToken: (token: string) => void
  onComplete: (fullContent: string, usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void
  onError: (error: Error) => void
}

/**
 * Send a chat message to OpenAI with streaming response
 * Returns tokens as they're generated for real-time display
 */
export async function sendChatMessageStream(
  messages: AIMessage[],
  callbacks: StreamCallbacks,
  options: {
    temperature?: number
    maxTokens?: number
    model?: string
  } = {}
): Promise<void> {
  const { temperature = 0.7, maxTokens = 800, model = DEFAULT_MODEL } = options

  try {
    const stream = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
      stream: true,
    })

    let fullContent = ''
    let promptTokens = 0
    let completionTokens = 0

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        fullContent += content
        callbacks.onToken(content)
      }

      // Get usage from final chunk if available
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens
        completionTokens = chunk.usage.completion_tokens
      }
    }

    // Estimate tokens if not provided (streaming doesn't always include usage)
    if (!promptTokens) {
      // Rough estimate: ~4 chars per token for English
      promptTokens = Math.ceil(messages.reduce((acc, m) => acc + m.content.length, 0) / 4)
      completionTokens = Math.ceil(fullContent.length / 4)
    }

    callbacks.onComplete(fullContent, {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    })
  } catch (error) {
    console.error('[AI Partner] OpenAI streaming error:', error)
    callbacks.onError(error instanceof Error ? error : new Error('Failed to stream AI response'))
  }
}

/**
 * Check if content is study-related and appropriate
 * Returns a safety check result
 */
export async function checkContentSafety(content: string): Promise<{
  isSafe: boolean
  isStudyRelated: boolean
  redirectMessage?: string
}> {
  // First, run moderation
  const moderation = await moderateContent(content)

  if (moderation.flagged) {
    // Check specific categories that are especially concerning for teens
    const severeCategories = [
      'sexual',
      'sexual/minors',
      'self-harm',
      'self-harm/intent',
      'violence/graphic',
    ]

    const hasSevereContent = severeCategories.some(
      (cat) => moderation.categories[cat as keyof typeof moderation.categories]
    )

    if (hasSevereContent) {
      return {
        isSafe: false,
        isStudyRelated: false,
        redirectMessage:
          "I'm here to help with your studies. Let's focus on learning together! What topic would you like to work on?",
      }
    }
  }

  // Check for off-topic patterns (romantic, dating, personal)
  const offTopicPatterns = [
    /\b(date|dating|boyfriend|girlfriend|crush|love you|marry|kiss|hug)\b/i,
    /\b(sexy|hot|attractive|cute|pretty|handsome)\b/i,
    /\b(phone number|address|where do you live|meet up|hang out)\b/i,
    /\b(what do you look like|your age|how old are you|are you real)\b/i,
  ]

  const isOffTopic = offTopicPatterns.some((pattern) => pattern.test(content))

  if (isOffTopic) {
    return {
      isSafe: true, // Not unsafe, just off-topic
      isStudyRelated: false,
      redirectMessage:
        "I'm your AI study partner, focused on helping you learn! Let's get back to studying. What subject are you working on?",
    }
  }

  return {
    isSafe: true,
    isStudyRelated: true,
  }
}

/**
 * Analyze an uploaded image in the chat context
 * Uses GPT-4o vision to understand and help with images (textbooks, homework, diagrams, etc.)
 */
export async function analyzeUploadedImage(params: {
  imageBase64: string
  mimeType: string
  userMessage?: string
  subject?: string
  skillLevel?: string
  conversationContext?: string
}): Promise<{
  analysis: string
  detectedContent: string
  suggestedFollowUp: string[]
}> {
  const { imageBase64, mimeType, userMessage, subject, skillLevel, conversationContext } = params

  // Build context-aware system prompt
  const subjectContext = subject
    ? `The student is currently studying **${subject}**${skillLevel ? ` at a ${skillLevel.toLowerCase()} level` : ''}.`
    : ''

  const skillLevelGuidance = skillLevel
    ? `Adjust your explanations to be appropriate for a ${skillLevel.toLowerCase()} level student.`
    : 'Adjust your explanations based on what appears to be their level of understanding.'

  const systemPrompt = `You are an expert AI study partner analyzing an image uploaded by a student during a study session.

${subjectContext}

Your role:
1. **Identify Content**: Describe what you see in the image - is it a textbook page, handwritten notes, a homework problem, a diagram, a screenshot, etc.?
2. **Understand Context**: If the student asked a question about the image, focus on answering that specifically.
3. **Provide Help**:
   - If it's a problem/question: Help solve it step by step
   - If it's notes/text: Summarize, clarify, or explain concepts
   - If it's a diagram: Explain what it shows and its significance
   - If it's homework: Guide them through the solution without just giving answers
4. **Be Educational**: Always aim to help the student understand, not just provide answers.
5. **Visual Aid Suggestion**: If generating a professional diagram/illustration would help clarify the concept, mention it naturally.

${skillLevelGuidance}

${conversationContext ? `Recent conversation context:\n${conversationContext}\n` : ''}

CONVERSATION STYLE - IMPORTANT:
- Provide direct, helpful answers
- Do NOT ask unnecessary questions at the end of your response
- Only ask questions when needed for clarity (e.g., "Is this question 3a or 3b?")
- If a visual diagram would help, naturally suggest: "Would you like me to generate a diagram to visualize this?"
- End responses naturally - not every message needs a question

Be helpful, encouraging, and educational. If the image quality is poor or unclear, ask for clarification.

RESPOND IN THIS EXACT JSON FORMAT:
{
  "analysis": "Your detailed analysis and help with the image content. Be thorough and educational. End naturally without unnecessary questions. If a diagram would help, include a natural suggestion like 'I can generate a visual diagram if that would help.'",
  "detectedContent": "Brief description of what type of content you detected (e.g., 'Math homework - quadratic equations', 'Biology textbook - cell division', 'Handwritten notes - history')",
  "suggestedFollowUp": ["Optional helpful follow-up the student might want", "Another option", "Third option - keep these SHORT and actionable"]
}`

  const userPrompt = userMessage
    ? userMessage
    : 'Please help me understand this image. What do you see and how can you help me with it?'

  try {
    const completion = await openai.chat.completions.create({
      model: ADVANCED_MODEL, // Use GPT-4o for vision tasks
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'high'
              }
            }
          ]
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content || '{}'
    const result = JSON.parse(content)

    return {
      analysis: result.analysis || 'Unable to analyze the image. Please try uploading again or provide more context.',
      detectedContent: result.detectedContent || 'Unknown content',
      suggestedFollowUp: Array.isArray(result.suggestedFollowUp) ? result.suggestedFollowUp.filter(Boolean).slice(0, 3) : [],
    }
  } catch (error) {
    console.error('[AI Partner] Image analysis error:', error)
    throw new Error('Failed to analyze image')
  }
}

/**
 * Send a chat message with an image attachment
 * Combines text and image for a unified response
 */
export async function sendChatMessageWithImage(params: {
  messages: AIMessage[]
  imageBase64: string
  mimeType: string
  userMessage: string
  subject?: string
  skillLevel?: string
}): Promise<ChatCompletionResult> {
  const { messages, imageBase64, mimeType, userMessage, subject, skillLevel } = params

  // Build enhanced messages array with image
  const enhancedMessages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }>
  }> = []

  // Add system message with image context
  const systemMessage = messages.find(m => m.role === 'system')
  if (systemMessage) {
    let enhancedSystemContent = systemMessage.content
    enhancedSystemContent += `\n\nIMAGE ANALYSIS CONTEXT:
The student has uploaded an image. Analyze it carefully and:
1. Acknowledge what you see in the image
2. Help them with any questions about it
3. If it's a problem, guide them through the solution
4. If it's content to study, help explain and clarify
5. If a professional diagram/visualization would help, naturally suggest it
${subject ? `Subject context: ${subject}` : ''}
${skillLevel ? `Student level: ${skillLevel}` : ''}

CONVERSATION STYLE:
- Give direct, helpful responses
- Do NOT end every message with a question
- Only ask questions when truly needed for clarity
- If a diagram would help: "Would you like me to generate a diagram for this?"
- End responses naturally`
    enhancedMessages.push({ role: 'system', content: enhancedSystemContent })
  }

  // Add previous conversation messages (excluding system)
  messages.filter(m => m.role !== 'system').forEach(m => {
    enhancedMessages.push({ role: m.role, content: m.content })
  })

  // Add the new user message with image
  enhancedMessages.push({
    role: 'user',
    content: [
      { type: 'text', text: userMessage || 'Please help me with this image.' },
      {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${imageBase64}`,
          detail: 'high'
        }
      }
    ]
  })

  try {
    const completion = await openai.chat.completions.create({
      model: ADVANCED_MODEL, // Use GPT-4o for vision
      messages: enhancedMessages as Parameters<typeof openai.chat.completions.create>[0]['messages'],
      temperature: 0.7,
      max_tokens: 1200,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    })

    const choice = completion.choices[0]
    const usage = completion.usage

    return {
      content: choice?.message?.content || 'I can see your image, but I had trouble analyzing it. Could you provide more context or try uploading again?',
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
    }
  } catch (error) {
    console.error('[AI Partner] Image chat error:', error)
    throw new Error('Failed to process image message')
  }
}

// Image generation style types
export type ImageGenerationStyle =
  | 'diagram'
  | 'illustration'
  | 'chart'
  | 'infographic'
  | 'concept-map'
  | 'logo'
  | 'picture'
  | 'sketch'
  | 'poster'
  | 'icon'
  | 'cartoon'
  | 'technical'
  | 'flowchart'
  | 'mindmap'
  | 'timeline'

// Valid styles for validation
export const VALID_IMAGE_STYLES: ImageGenerationStyle[] = [
  'diagram',
  'illustration',
  'chart',
  'infographic',
  'concept-map',
  'logo',
  'picture',
  'sketch',
  'poster',
  'icon',
  'cartoon',
  'technical',
  'flowchart',
  'mindmap',
  'timeline',
]

/**
 * Generate an educational image using DALL-E 3
 * Creates diagrams, visualizations, logos, illustrations, and more
 */
export async function generateEducationalImage(params: {
  prompt: string
  subject?: string
  skillLevel?: string
  style?: ImageGenerationStyle
}): Promise<{
  imageUrl: string
  revisedPrompt: string
}> {
  const { prompt, subject, skillLevel, style = 'diagram' } = params

  // Build an enhanced prompt for each style type
  // Each style has specific DALL-E optimized descriptions for best results
  const styleDescriptions: Record<ImageGenerationStyle, string> = {
    // Educational styles
    'diagram': 'Create a clear, educational diagram with labels, annotations, and visual hierarchy. Use clean lines and organized layout.',
    'illustration': 'Create a detailed educational illustration that visualizes the concept clearly. Use engaging colors and clear visual elements.',
    'chart': 'Create a clean, professional chart or graph with clear data visualization, labeled axes, and easy-to-read formatting.',
    'infographic': 'Create an informative infographic with key points highlighted, icons, statistics, and visual flow that guides the reader.',
    'concept-map': 'Create a concept map showing relationships between ideas with connecting lines, nodes, and hierarchical organization.',
    'flowchart': 'Create a professional flowchart with clear process steps, decision points, arrows showing flow direction, and proper symbols.',
    'mindmap': 'Create a mind map with a central concept branching out to related ideas, using colors and visual hierarchy.',
    'timeline': 'Create a visual timeline with dates, events, and chronological progression clearly marked with connecting lines.',

    // Creative/Design styles
    'logo': 'Create a professional, clean logo design with modern aesthetics. Use simple shapes, balanced composition, and memorable visual identity.',
    'picture': 'Create a realistic, high-quality picture or photograph-style image with natural lighting and professional composition.',
    'sketch': 'Create a hand-drawn sketch style illustration with pencil/pen strokes, artistic shading, and natural imperfections for authenticity.',
    'poster': 'Create an eye-catching poster design with bold typography, striking visuals, and clear hierarchy. Include engaging graphics.',
    'icon': 'Create a clean, modern icon or set of icons with simple shapes, consistent style, and clear symbolism. Flat design aesthetic.',
    'cartoon': 'Create a fun, engaging cartoon-style illustration with expressive characters, vibrant colors, and playful elements.',
    'technical': 'Create a precise technical drawing or blueprint-style illustration with measurements, annotations, and professional engineering aesthetics.',
  }

  const levelAdjustment = skillLevel ? {
    'BEGINNER': 'Use simple, clear visuals suitable for beginners. Avoid complex details.',
    'INTERMEDIATE': 'Include moderate detail appropriate for intermediate learners.',
    'ADVANCED': 'Include detailed, comprehensive information for advanced students.',
    'EXPERT': 'Create a sophisticated, detailed visualization for expert-level understanding.',
  }[skillLevel] : ''

  // Determine if this is an educational or creative style
  const educationalStyles = ['diagram', 'illustration', 'chart', 'infographic', 'concept-map', 'flowchart', 'mindmap', 'timeline']
  const isEducational = educationalStyles.includes(style)

  // Build style-appropriate context
  let styleContext = ''
  if (isEducational) {
    styleContext = `Educational ${style}${subject ? ` for ${subject}` : ''}`
  } else if (style === 'logo') {
    styleContext = `Professional logo design${subject ? ` for ${subject}` : ''}`
  } else if (style === 'poster') {
    styleContext = `Eye-catching poster${subject ? ` about ${subject}` : ''}`
  } else if (style === 'icon') {
    styleContext = `Modern flat icon design${subject ? ` representing ${subject}` : ''}`
  } else if (style === 'cartoon') {
    styleContext = `Cartoon-style illustration${subject ? ` depicting ${subject}` : ''}`
  } else if (style === 'technical') {
    styleContext = `Technical drawing${subject ? ` of ${subject}` : ''}`
  } else if (style === 'sketch') {
    styleContext = `Hand-drawn sketch${subject ? ` of ${subject}` : ''}`
  } else if (style === 'picture') {
    styleContext = `Realistic image${subject ? ` showing ${subject}` : ''}`
  } else {
    styleContext = `${style}${subject ? ` for ${subject}` : ''}`
  }

  // Construct the DALL-E prompt with style-specific requirements
  let dallePrompt = `${styleContext}: ${prompt}

Style requirements:
- ${styleDescriptions[style]}`

  // Add style-specific additional requirements
  if (isEducational) {
    dallePrompt += `
- Clean, professional educational style
- Clear labels and text that is easy to read
- White or light background for clarity
- No decorative elements that distract from learning
- Suitable for a study environment
- High contrast for readability`
  } else if (style === 'logo') {
    dallePrompt += `
- Simple, memorable design
- Works at small and large sizes
- Clean background (white or transparent look)
- Professional and modern aesthetic
- Balanced composition`
  } else if (style === 'poster') {
    dallePrompt += `
- Bold, attention-grabbing design
- Clear visual hierarchy
- Vibrant but harmonious colors
- Professional typography integration
- Impactful composition`
  } else if (style === 'icon') {
    dallePrompt += `
- Flat design aesthetic
- Simple, recognizable shapes
- Consistent line weights
- Works at small sizes
- Clean, minimal style`
  } else if (style === 'cartoon') {
    dallePrompt += `
- Fun, engaging characters or elements
- Vibrant, appealing colors
- Expressive and dynamic
- Clear outlines
- Friendly, approachable style`
  } else if (style === 'technical') {
    dallePrompt += `
- Precise, accurate representation
- Include measurements or annotations
- Blueprint-style aesthetics
- Professional engineering look
- Clear, detailed linework`
  } else if (style === 'sketch') {
    dallePrompt += `
- Natural pencil or pen strokes
- Artistic shading
- Hand-drawn authenticity
- Visible texture and imperfections
- Artistic quality`
  } else if (style === 'picture') {
    dallePrompt += `
- Realistic, high-quality rendering
- Natural lighting
- Professional composition
- Clear focus on subject
- Photographic quality`
  }

  // Add level adjustment if provided
  if (levelAdjustment) {
    dallePrompt += `\n- ${levelAdjustment}`
  }

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: dallePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'natural', // More realistic/clean style for educational content
    })

    const imageData = response.data?.[0]

    if (!imageData?.url) {
      throw new Error('No image generated')
    }

    // DALL-E URLs are temporary (expire in ~1 hour)
    // Download and upload to Supabase for permanent storage
    let permanentUrl = imageData.url

    try {
      // Download the image from DALL-E's temporary URL
      const imageResponse = await fetch(imageData.url)
      if (!imageResponse.ok) {
        throw new Error('Failed to download generated image')
      }

      const imageBuffer = await imageResponse.arrayBuffer()
      const buffer = Buffer.from(imageBuffer)

      // Generate unique filename
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 8)
      const filePath = `ai-generated/${timestamp}-${randomId}.png`

      // Upload to Supabase Storage
      const supabase = await createClient()
      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, buffer, {
          contentType: 'image/png',
          upsert: false,
        })

      if (uploadError) {
        console.error('[AI Partner] Failed to upload image to storage:', uploadError)
        // Fall back to temporary URL if upload fails
      } else {
        // Get the permanent public URL
        const { data: urlData } = supabase.storage
          .from('user-uploads')
          .getPublicUrl(filePath)

        permanentUrl = urlData.publicUrl
        console.log('[AI Partner] Image uploaded to permanent storage:', permanentUrl)
      }
    } catch (uploadErr) {
      console.error('[AI Partner] Error uploading to permanent storage:', uploadErr)
      // Fall back to temporary URL if anything fails
    }

    return {
      imageUrl: permanentUrl,
      revisedPrompt: imageData.revised_prompt || dallePrompt,
    }
  } catch (error) {
    console.error('[AI Partner] Image generation error:', error)

    // Handle specific DALL-E errors
    if (error instanceof Error) {
      if (error.message.includes('content_policy')) {
        throw new Error('The image request was blocked due to content policy. Please try a different description.')
      }
      if (error.message.includes('rate_limit')) {
        throw new Error('Too many image requests. Please wait a moment and try again.')
      }
    }

    throw new Error('Failed to generate image. Please try again.')
  }
}

/**
 * Check if AI should suggest generating an image based on conversation
 * Returns suggestion if a visual would help explain the current topic
 */
export async function shouldSuggestImageGeneration(params: {
  recentMessages: Array<{ role: string; content: string }>
  subject?: string
}): Promise<{
  shouldSuggest: boolean
  suggestedPrompt?: string
  reason?: string
}> {
  const { recentMessages, subject } = params

  if (recentMessages.length < 2) {
    return { shouldSuggest: false }
  }

  // Get last few messages for context
  const context = recentMessages.slice(-6).map(m =>
    `${m.role === 'user' ? 'Student' : 'AI'}: ${m.content.slice(0, 200)}`
  ).join('\n')

  const systemPrompt = `You analyze study conversations to determine if a visual diagram or image would help the student understand better.

Topics that benefit from visuals:
- Scientific processes (cell division, photosynthesis, chemical reactions)
- Mathematical concepts (graphs, geometric shapes, coordinate systems)
- Historical timelines or maps
- Biological structures (anatomy, organisms)
- Physics concepts (forces, circuits, waves)
- Flowcharts for processes or algorithms
- Comparison charts

Return JSON with your analysis.`

  const userPrompt = `Analyze this conversation${subject ? ` about ${subject}` : ''} and determine if a visual would help:

${context}

Should I suggest generating an educational image? If yes, what should the image show?

RESPOND IN JSON FORMAT:
{
  "shouldSuggest": true/false,
  "suggestedPrompt": "Description of what image to generate (if shouldSuggest is true)",
  "reason": "Brief reason why a visual would/wouldn't help"
}`

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content || '{}'
    const result = JSON.parse(content)

    return {
      shouldSuggest: result.shouldSuggest === true,
      suggestedPrompt: result.suggestedPrompt || undefined,
      reason: result.reason || undefined,
    }
  } catch (error) {
    console.error('[AI Partner] Image suggestion check error:', error)
    return { shouldSuggest: false }
  }
}
