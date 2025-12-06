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
const DEFAULT_MODEL = 'gpt-4o-mini' // Cost-effective for chat
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
 * Build the system prompt for AI study partner
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
