/**
 * AI Partner - OpenAI Integration
 * Handles all OpenAI API calls for the AI study partner feature
 */

import OpenAI from 'openai'

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

  // Build location context
  let locationContext = ''
  if (criteria.school) {
    locationContext = criteria.school
  }
  if (criteria.locationCity) {
    locationContext += locationContext ? ` in ${criteria.locationCity}` : criteria.locationCity
  }
  if (criteria.locationState && !criteria.locationCity) {
    locationContext += locationContext ? `, ${criteria.locationState}` : criteria.locationState
  }
  if (criteria.locationCountry) {
    locationContext += locationContext ? `, ${criteria.locationCountry}` : criteria.locationCountry
  }

  // Build subject expertise
  let subjectExpertise = ''
  if (criteria.subjects && criteria.subjects.length > 0) {
    subjectExpertise = criteria.subjects.join(', ')
  }
  if (criteria.subjectDescription) {
    subjectExpertise += subjectExpertise ? ` (${criteria.subjectDescription})` : criteria.subjectDescription
  }

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
  if (criteria.skillLevel) {
    const levelDescriptions: Record<string, string> = {
      'BEGINNER': "You're at an early stage in your learning journey, which means you understand the challenges of being new to a subject and can relate to struggles with fundamentals.",
      'INTERMEDIATE': "You have solid foundational knowledge and are working on more advanced concepts. You can help bridge the gap between basics and complex topics.",
      'ADVANCED': "You have strong knowledge and experience. You can dive deep into complex topics and help others understand challenging concepts.",
      'EXPERT': "You have deep expertise and can discuss even the most complex aspects of your field. You can mentor others and share advanced insights."
    }
    parts.push(levelDescriptions[criteria.skillLevel] || '')
  }

  // Add study style
  if (criteria.studyStyle) {
    const styleDescriptions: Record<string, string> = {
      'COLLABORATIVE': "You love studying with others - bouncing ideas around, explaining concepts to each other, and working through problems together.",
      'INDEPENDENT': "You prefer focused, independent study but enjoy having a partner to discuss ideas with and check understanding.",
      'MIXED': "You're flexible - sometimes you prefer group discussions, other times you like quiet focused work."
    }
    parts.push(styleDescriptions[criteria.studyStyle] || '')
  }

  // Add interests
  if (criteria.interests && criteria.interests.length > 0) {
    parts.push(`You're interested in: ${criteria.interests.join(', ')}. These interests shape how you approach studying.`)
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

  // If user searched for a specific name and provided qualities
  if (criteria.searchedName && criteria.userDefinedQualities) {
    parts.push(`The student was looking for someone named "${criteria.searchedName}" who isn't available right now. They described wanting a partner who is: ${criteria.userDefinedQualities}. Embody these qualities naturally.`)
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
8. NEVER use quotation marks around subjects, topics, or names - just say them naturally (e.g., say "Science" not ""Science"")

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

  // If custom persona is provided, use it as base
  if (customPersona) {
    return customPersona
  }

  // Default study partner persona
  return `You are a friendly, focused AI STUDY PARTNER named "Clerva AI" helping ${userName || 'a student'} with their studies.

IMPORTANT RULES - YOU MUST FOLLOW THESE:
1. Stay strictly on-topic to study tasks. NO flirting, romance, or personal relationships.
2. If the user tries to go off-topic or asks inappropriate questions, politely redirect to studying.
3. Never pretend to be a real human. You are an AI study assistant.
4. Keep responses concise and helpful. Use short paragraphs and bullet points.
5. Be encouraging but honest about areas that need improvement.
6. If you don't know something, admit it and suggest resources.
7. NEVER use quotation marks around subjects, topics, or names - just say them naturally.

YOUR CAPABILITIES:
- Explain concepts clearly at the appropriate level
- Generate quiz questions to test understanding
- Create flashcard content for memorization
- Suggest study techniques (pomodoro, spaced repetition, etc.)
- Help break down complex problems step by step
- Provide practice problems and check answers
- Summarize topics and key points

STUDY CONTEXT:
${subject ? `- Subject: ${subject}` : '- Subject: General study support'}
${skillLevel ? `- Skill Level: ${skillLevel}` : '- Skill Level: Adaptive'}
${studyGoal ? `- Session Goal: ${studyGoal}` : ''}

Start by greeting the student warmly (1 sentence) and asking what they'd like to focus on today. Keep it brief and friendly.`
}

/**
 * Send a chat message to OpenAI and get a response
 */
export async function sendChatMessage(
  messages: AIMessage[],
  options: {
    temperature?: number
    maxTokens?: number
    model?: string
  } = {}
): Promise<ChatCompletionResult> {
  const { temperature = 0.7, maxTokens = 500, model = DEFAULT_MODEL } = options

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages,
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
  previousQuestions?: string[]
}): Promise<{
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}> {
  const { subject, topic, difficulty = 'medium', previousQuestions = [] } = params

  const systemPrompt = `You are a quiz generator for students. Generate a multiple-choice quiz question.

RULES:
- Create educational, age-appropriate questions
- Provide 4 options (A, B, C, D)
- Only one correct answer
- Include a brief explanation for the correct answer
- Make questions challenging but fair for the difficulty level

RESPOND IN THIS EXACT JSON FORMAT:
{
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 0,
  "explanation": "Brief explanation of why this is correct"
}

Note: correctAnswer is the index (0-3) of the correct option.`

  const userPrompt = `Generate a ${difficulty} difficulty question about ${subject}${topic ? ` (topic: ${topic})` : ''}.
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
 * Generate flashcard content from a topic
 */
export async function generateFlashcards(params: {
  subject: string
  topic: string
  count?: number
}): Promise<Array<{ front: string; back: string }>> {
  const { subject, topic, count = 5 } = params

  const systemPrompt = `You are a flashcard generator for students. Create flashcards for studying.

RULES:
- Front: A question or term
- Back: The answer or definition
- Keep content concise and memorable
- Focus on key concepts

RESPOND IN THIS EXACT JSON FORMAT:
{
  "flashcards": [
    {"front": "Question or term", "back": "Answer or definition"},
    ...
  ]
}`

  const userPrompt = `Generate ${count} flashcards for studying ${subject} - specifically about "${topic}".`

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
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
  count?: number
}): Promise<Array<{ front: string; back: string }>> {
  const { conversationSummary, subject, count = 5 } = params

  const systemPrompt = `You are a flashcard generator that creates study cards based on conversation context.

RULES:
- Analyze the conversation to identify key concepts, facts, and terms discussed
- Front: A question or term about something discussed in the conversation
- Back: The answer or definition based on what was covered
- Focus on the most important learning points from the discussion
- Make cards that reinforce what the student was learning about
- Keep content concise and memorable

RESPOND IN THIS EXACT JSON FORMAT:
{
  "flashcards": [
    {"front": "Question or term from conversation", "back": "Answer based on discussion"},
    ...
  ]
}`

  const userPrompt = `Generate ${count} flashcards based on this study conversation${subject ? ` about ${subject}` : ''}:

${conversationSummary}

Create flashcards that capture the key concepts and facts that were discussed or explained in this conversation.`

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
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
  userQuestion?: string
}): Promise<{
  analysis: string
  suggestions: string[]
  relatedConcepts: string[]
}> {
  const { imageBase64, subject, userQuestion } = params

  const systemPrompt = `You are a helpful study partner analyzing a student's whiteboard drawing or diagram.

Your role:
1. Describe what you see in the drawing/diagram
2. Identify any concepts, formulas, diagrams, or notes
3. Provide helpful feedback or corrections if you spot errors
4. Suggest improvements or related concepts to explore
5. Answer any specific question the student asks about their work

Be encouraging and educational. Focus on helping them learn.

RESPOND IN THIS EXACT JSON FORMAT:
{
  "analysis": "A detailed description of what you see and feedback on the content",
  "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"],
  "relatedConcepts": ["Related concept 1", "Related concept 2"]
}`

  const userPrompt = userQuestion
    ? `Here's my whiteboard${subject ? ` about ${subject}` : ''}. ${userQuestion}`
    : `Please analyze my whiteboard${subject ? ` about ${subject}` : ''} and give me feedback.`

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
      max_tokens: 800,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content || '{}'
    const result = JSON.parse(content)

    return {
      analysis: result.analysis || 'Unable to analyze the whiteboard.',
      suggestions: result.suggestions || [],
      relatedConcepts: result.relatedConcepts || [],
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
  count?: number
  difficulty?: 'easy' | 'medium' | 'hard'
}): Promise<Array<{
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}>> {
  const { conversationSummary, subject, count = 5, difficulty = 'medium' } = params

  const systemPrompt = `You are a quiz generator that creates questions based on study conversation context.

RULES:
- Create questions about topics that were actually discussed in the conversation
- Each question has 4 options (A, B, C, D)
- Only one correct answer per question
- Include a brief explanation for each correct answer
- Match the difficulty level requested
- Focus on testing understanding of key concepts from the discussion

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

  const userPrompt = `Generate ${count} ${difficulty} difficulty quiz questions based on this study conversation${subject ? ` about ${subject}` : ''}:

${conversationSummary}

Create questions that test understanding of the concepts discussed.`

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

  const systemPrompt = `You are summarizing a study session. Create a brief, helpful summary.

Include:
1. Main topics covered (bullet points)
2. Key concepts learned
3. Areas that might need more practice
4. Suggested next steps

Keep it concise (under 200 words).`

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
      max_tokens: 400,
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
  const { temperature = 0.7, maxTokens = 500, model = DEFAULT_MODEL } = options

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
