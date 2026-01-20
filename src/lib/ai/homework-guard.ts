/**
 * Homework Guard - Anti-Cheat Detection System
 *
 * Purpose: Detect when users are trying to get direct homework answers
 * instead of learning the concepts. AI should explain and break down,
 * NOT give complete answers.
 *
 * Scalable: No database calls, pure logic-based detection
 */

// Patterns that suggest homework answer requests (not learning)
const HOMEWORK_ANSWER_PATTERNS = [
  // Direct answer requests
  /\b(give|tell|what is|what's)\s+(me\s+)?(the\s+)?(answer|solution|result)/i,
  /\bsolve\s+(this|it|the)\s+(for|problem)/i,
  /\b(do|complete|finish)\s+(my|this)\s+(homework|assignment|problem)/i,
  /\bjust\s+(give|tell)\s+me\s+the\s+answer/i,

  // Exam/test cheating patterns
  /\b(exam|test|quiz)\s+(question|answer|solution)/i,
  /\b(this|here'?s?)\s+(is\s+)?(my|the)\s+(exam|test|quiz)/i,
  /\bhelp\s+(me\s+)?(with|on)\s+(this|my)\s+(exam|test|quiz)/i,

  // Copy patterns
  /\b(copy|paste|write)\s+(this|it)\s+(for|into)/i,
  /\bgive\s+me\s+(something|answer)\s+to\s+(copy|submit)/i,

  // Urgency patterns that suggest cheating
  /\b(hurry|quick|fast|asap|urgent)\s+.*(answer|solution|homework)/i,
  /\b(deadline|due)\s+(in|is)\s+\d+\s*(min|hour|minute)/i,
]

// Patterns that suggest genuine learning intent
const LEARNING_INTENT_PATTERNS = [
  // Understanding requests
  /\b(explain|understand|help me understand|why|how does)/i,
  /\b(break down|break it down|step by step)/i,
  /\b(what does|what do)\s+.*(mean|represent)/i,
  /\b(concept|theory|principle|idea|logic)/i,

  // Learning-focused requests
  /\b(learn|study|practice|improve)/i,
  /\b(example|demonstrate|show me how)/i,
  /\b(why is|why does|why do)/i,
  /\b(confused|don't understand|struggling)/i,

  // Method requests (how to approach, not just answer)
  /\bhow\s+(do|would|should|can)\s+i\s+(approach|solve|think about)/i,
  /\bwhat\s+(approach|method|strategy|technique)/i,
  /\b(guide|walk)\s+me\s+through/i,
]

export interface HomeworkGuardResult {
  isHomeworkAnswerRequest: boolean
  confidence: 'high' | 'medium' | 'low'
  suggestedResponse?: string
  detectedPatterns: string[]
}

/**
 * Analyze user input to detect homework answer requests
 * Returns guidance for the AI on how to respond
 */
export function analyzeHomeworkIntent(userMessage: string): HomeworkGuardResult {
  const detectedAnswerPatterns: string[] = []
  const detectedLearningPatterns: string[] = []

  // Check for answer-seeking patterns
  for (const pattern of HOMEWORK_ANSWER_PATTERNS) {
    if (pattern.test(userMessage)) {
      detectedAnswerPatterns.push(pattern.source)
    }
  }

  // Check for learning intent patterns
  for (const pattern of LEARNING_INTENT_PATTERNS) {
    if (pattern.test(userMessage)) {
      detectedLearningPatterns.push(pattern.source)
    }
  }

  // Calculate scores
  const answerScore = detectedAnswerPatterns.length
  const learningScore = detectedLearningPatterns.length

  // Determine if this is a homework answer request
  // Learning patterns can override answer patterns (user might say "help me understand this exam question")
  const isHomeworkAnswerRequest = answerScore > 0 && learningScore === 0

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (answerScore >= 2 && learningScore === 0) {
    confidence = 'high'
  } else if (answerScore >= 1 && learningScore === 0) {
    confidence = 'medium'
  }

  // Generate suggested response if this is a homework answer request
  let suggestedResponse: string | undefined

  if (isHomeworkAnswerRequest) {
    if (confidence === 'high') {
      suggestedResponse =
        "I can help you understand this concept better, but I won't give you the direct answer. " +
        "Let me break it down and explain the approach so you can solve it yourself. " +
        "What part would you like me to explain first?"
    } else if (confidence === 'medium') {
      suggestedResponse =
        "I'd be happy to help you learn! Instead of giving you the answer directly, " +
        "let me explain the concept and show you how to approach this type of problem. " +
        "Would you like me to break it down step by step?"
    }
  }

  return {
    isHomeworkAnswerRequest,
    confidence,
    suggestedResponse,
    detectedPatterns: detectedAnswerPatterns,
  }
}

/**
 * Get the AI system prompt modifier based on homework guard analysis
 * This should be added to the AI system prompt to guide its response
 */
export function getHomeworkGuardPrompt(analysis: HomeworkGuardResult): string {
  if (!analysis.isHomeworkAnswerRequest) {
    return ''
  }

  if (analysis.confidence === 'high') {
    return `
CRITICAL INSTRUCTION: The user appears to be asking for a direct homework/test answer.
DO NOT provide the complete solution or answer.
Instead:
1. Acknowledge their need for help
2. Explain the underlying concept or theory
3. Break down the problem-solving approach step by step
4. Give a similar example (NOT the exact problem)
5. Guide them to discover the answer themselves
6. Ask what specific part they're confused about

Be encouraging but firm. Learning happens through understanding, not copying answers.`
  }

  if (analysis.confidence === 'medium') {
    return `
INSTRUCTION: The user may be looking for a direct answer rather than understanding.
Focus your response on:
1. Explaining the concept clearly
2. Breaking down the approach
3. Asking clarifying questions to understand what they're confused about
4. Providing guidance rather than direct answers

Help them learn to solve it themselves.`
  }

  return ''
}

/**
 * Check if content (image/text) appears to be a test or assignment
 * that should be handled with extra care
 */
export function detectTestContent(content: string): boolean {
  const testIndicators = [
    /\b(question\s+)?\d+\s*[\.\):\-]/i, // "Question 1." or "1." numbered items
    /\b(points?|marks?)\s*[\(\[:]?\s*\d+/i, // "Points: 10" or "(5 marks)"
    /\b(answer|choose|select)\s+(the\s+)?(correct|best|right)/i,
    /\b(true\s+or\s+false|multiple\s+choice)/i,
    /\b(fill\s+in\s+the\s+blank|complete\s+the\s+(sentence|equation))/i,
    /\b(exam|test|quiz|assignment|homework)\b/i,
    /\b(show\s+your\s+work|explain\s+your\s+(answer|reasoning))/i,
  ]

  return testIndicators.some((pattern) => pattern.test(content))
}
