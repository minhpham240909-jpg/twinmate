/**
 * Homework Guard V2 - AI-Powered Anti-Cheat System
 *
 * PURPOSE: Detect when users want answers vs want to learn
 * APPROACH: Use AI to understand intent, not just pattern matching
 *
 * PHILOSOPHY:
 * - Never give direct answers to problems
 * - Always teach and explain concepts
 * - Break down problems so users understand HOW to solve
 * - Guide users to discover answers themselves
 *
 * This is smarter than regex because:
 * - Understands rephrasing ("what's the result" = "give me answer")
 * - Handles any language
 * - Catches creative workarounds
 * - Understands context from conversation history
 */

import OpenAI from 'openai'
import { withRetry, OPENAI_RETRY_OPTIONS } from '@/lib/retry'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface HomeworkAnalysisResult {
  isAnswerRequest: boolean      // Is user trying to get a direct answer?
  confidence: number            // 0-100, how confident are we?
  intent: 'answer' | 'learn' | 'unclear'
  reasoning: string             // Why we made this decision
}

/**
 * AI-based analysis of user intent
 * Uses a small, fast model to classify the request
 *
 * @param userMessage - The user's current message
 * @param conversationHistory - Previous messages for context
 * @returns Analysis of whether this is an answer request
 */
export async function analyzeIntentWithAI(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<HomeworkAnalysisResult> {
  try {
    // Build context from last few messages
    const recentHistory = conversationHistory.slice(-4)
    const historyContext = recentHistory.length > 0
      ? `Recent conversation:\n${recentHistory.map(m => `${m.role}: ${m.content}`).join('\n')}\n\n`
      : ''

    // Use retry logic for reliability
    const result = await withRetry(
      () => openai.chat.completions.create({
        model: 'gpt-4o-mini', // Fast and efficient for classification
        messages: [
          {
            role: 'system',
            content: `You are a classifier that determines if a student wants a DIRECT ANSWER or wants to LEARN.

ANSWER REQUEST indicators (intent = "answer"):
- Asking for the solution, result, or final answer
- "What is X?" where X is a specific problem/equation
- "Solve this", "Calculate this", "What's the answer"
- Subtle variations: "What would this equal?", "Can you work this out?"
- Urgency about homework/tests/deadlines
- Asking for code that solves a specific problem
- "Just tell me", "I need the answer", "What do I put?"
- Sending a problem and expecting the solution back

LEARNING REQUEST indicators (intent = "learn"):
- "Why does this work?", "How does this concept work?"
- "Explain the steps", "Help me understand"
- "What's the approach?", "How should I think about this?"
- "I'm confused about the concept"
- Asking about methods, not specific answers
- "What am I doing wrong?" (wants to learn their mistake)

IMPORTANT: If they send a problem/question and don't explicitly ask to learn, assume they want the ANSWER.

Respond in JSON format:
{
  "isAnswerRequest": true/false,
  "confidence": 0-100,
  "intent": "answer" | "learn" | "unclear",
  "reasoning": "Brief explanation of why"
}`
          },
          {
            role: 'user',
            content: `${historyContext}Current message: "${userMessage}"

Classify this request.`
          }
        ],
        max_tokens: 200,
        temperature: 0.1, // Low temperature for consistent classification
        response_format: { type: 'json_object' }
      }),
      { ...OPENAI_RETRY_OPTIONS, context: 'Homework Guard', maxRetries: 2 }
    )

    if (!result.success || !result.data) {
      // On retry failure, default to teaching mode (safe)
      return {
        isAnswerRequest: true,
        confidence: 50,
        intent: 'unclear',
        reasoning: 'Analysis failed after retries - defaulting to teaching mode'
      }
    }

    const content = result.data.choices[0]?.message?.content
    if (!content) {
      // Default to safe (assume answer request)
      return {
        isAnswerRequest: true,
        confidence: 50,
        intent: 'unclear',
        reasoning: 'Could not analyze - defaulting to teaching mode'
      }
    }

    const parsed = JSON.parse(content)
    return {
      isAnswerRequest: parsed.isAnswerRequest ?? true,
      confidence: parsed.confidence ?? 50,
      intent: parsed.intent ?? 'unclear',
      reasoning: parsed.reasoning ?? 'No reasoning provided'
    }
  } catch (error) {
    console.error('[HomeworkGuard] AI analysis failed:', error)
    // On error, default to teaching mode (safe)
    return {
      isAnswerRequest: true,
      confidence: 50,
      intent: 'unclear',
      reasoning: 'Analysis failed - defaulting to teaching mode'
    }
  }
}

/**
 * Get the teaching-focused system prompt
 * This is ALWAYS added to ensure the AI teaches, never gives answers
 */
export function getTeachingSystemPrompt(): string {
  return `
CRITICAL INSTRUCTION - TEACHING MODE ONLY:

You are a TUTOR, not an answer machine. Your job is to help students UNDERSTAND, not to give them answers to copy.

NEVER DO:
- Give the final answer to any problem
- Solve equations/problems completely
- Write code that directly solves their homework
- Provide solutions they can copy-paste
- Calculate final numerical answers
- Complete their assignments

ALWAYS DO:
1. EXPLAIN the concept behind the problem
2. BREAK DOWN the problem into steps they can follow
3. SHOW similar examples (different numbers/variables)
4. ASK questions to check their understanding
5. GUIDE them to discover the answer themselves
6. POINT OUT where they might be going wrong

RESPONSE STRUCTURE:
1. Acknowledge what they're working on
2. Explain the relevant concept clearly
3. Break down the approach step-by-step
4. Give a similar example (NOT their exact problem)
5. Ask them to try applying this to their problem

EXAMPLE:
User: "What is 3x + 5 = 20, solve for x"
BAD: "x = 5" ❌
GOOD: "This is a linear equation! To solve for x, you need to isolate it:
1. First, subtract 5 from both sides to get the x term alone
2. Then, divide both sides by 3

Let me show you with a similar problem: 2x + 4 = 10
- Subtract 4: 2x = 6
- Divide by 2: x = 3

Now try applying these steps to your equation. What do you get when you subtract 5 from both sides?" ✓

Remember: If they learn HOW to solve it, they can solve any similar problem. If you just give answers, they learn nothing.`
}

/**
 * Get additional prompt based on AI analysis
 * Adds extra guidance when we detect answer-seeking behavior
 */
export function getAnalysisBasedPrompt(analysis: HomeworkAnalysisResult): string {
  if (!analysis.isAnswerRequest) {
    // User genuinely wants to learn - lighter guidance
    return `
Note: This student seems to genuinely want to understand the concept.
Still focus on teaching, but you can be more direct in your explanations.
Help them build real understanding.`
  }

  if (analysis.confidence >= 80) {
    // High confidence they want answer - strong teaching mode
    return `
ALERT: This request appears to be seeking a direct answer (${analysis.confidence}% confidence).
Reason: ${analysis.reasoning}

Be extra careful to:
- NOT provide the final answer
- Focus entirely on teaching the method
- Ask them to work through it with your guidance
- Be encouraging but don't solve it for them`
  }

  // Medium confidence - balanced approach
  return `
Note: This might be an answer request. Focus on teaching the concept and method.
Guide them to solve it themselves rather than giving the solution.`
}

/**
 * Quick check using patterns (no AI call) for obvious cases
 * Use this for fast pre-filtering before AI analysis
 */
export function quickPatternCheck(message: string): { isLikelyAnswer: boolean; isLikelyLearning: boolean } {
  const answerPatterns = [
    /\b(solve|calculate|compute)\s+(this|it|for)/i,
    /\bwhat\s+(is|are|'s)\s+\d/i, // "what is 5+3"
    /\bgive\s+me\s+(the\s+)?(answer|solution)/i,
    /\bjust\s+tell\s+me/i,
    /\bI\s+need\s+(the\s+)?(answer|solution|result)/i,
  ]

  const learningPatterns = [
    /\b(explain|understand|why|how\s+does)/i,
    /\b(concept|method|approach|strategy)/i,
    /\bhelp\s+me\s+(understand|learn|see)/i,
    /\bwhat\s+am\s+i\s+(doing\s+)?wrong/i,
    /\bstep\s+by\s+step/i,
  ]

  const isLikelyAnswer = answerPatterns.some(p => p.test(message))
  const isLikelyLearning = learningPatterns.some(p => p.test(message))

  return { isLikelyAnswer, isLikelyLearning }
}

/**
 * Combined analysis - uses quick check + AI for best results
 */
export async function analyzeRequest(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  options: { skipAI?: boolean } = {}
): Promise<HomeworkAnalysisResult> {
  // Quick pattern check first
  const quickCheck = quickPatternCheck(userMessage)

  // If clearly learning intent, no need for AI
  if (quickCheck.isLikelyLearning && !quickCheck.isLikelyAnswer) {
    return {
      isAnswerRequest: false,
      confidence: 70,
      intent: 'learn',
      reasoning: 'Clear learning intent detected from patterns'
    }
  }

  // If skip AI is set, use pattern-based result
  if (options.skipAI) {
    return {
      isAnswerRequest: quickCheck.isLikelyAnswer,
      confidence: quickCheck.isLikelyAnswer ? 60 : 40,
      intent: quickCheck.isLikelyAnswer ? 'answer' : 'unclear',
      reasoning: 'Pattern-based analysis (AI skipped)'
    }
  }

  // Use AI for accurate analysis
  return analyzeIntentWithAI(userMessage, conversationHistory)
}
