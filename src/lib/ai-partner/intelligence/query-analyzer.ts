/**
 * Query Complexity Analyzer
 *
 * Analyzes user queries to determine:
 * 1. Complexity level (simple, moderate, complex)
 * 2. Recommended response length (short, medium, detailed)
 * 3. Recommended model (gpt-4o-mini vs gpt-4o)
 *
 * Uses hybrid approach: Fast regex first, AI fallback for uncertain cases
 */

import OpenAI from 'openai'

// =============================================================================
// TYPES
// =============================================================================

export type QueryComplexity = 'simple' | 'moderate' | 'complex'
export type ResponseLength = 'short' | 'medium' | 'detailed'
export type ModelTier = 'fast' | 'advanced'

export interface QueryAnalysis {
  complexity: QueryComplexity
  responseLength: ResponseLength
  modelTier: ModelTier
  confidence: number // 0-1, how confident we are in the classification
  reason: string
  // Token limits based on analysis
  maxTokens: number
  temperature: number
  // Flags
  requiresReasoning: boolean
  requiresCalculation: boolean
  requiresCodeGeneration: boolean
  isFactualQuestion: boolean
  isConceptualQuestion: boolean
  isProceduralQuestion: boolean
}

// =============================================================================
// COMPLEXITY PATTERNS (Fast Regex Detection)
// =============================================================================

// Simple questions - factual, short answers expected
const SIMPLE_PATTERNS = {
  // Definition questions
  definitions: [
    /^what is (a |an |the )?[\w\s]{1,30}\??$/i,
    /^what('s| is) the definition of/i,
    /^define\s+[\w\s]{1,30}\??$/i,
    /^what does [\w\s]{1,30} mean\??$/i,
  ],
  // Yes/No questions
  yesNo: [
    /^(is|are|was|were|do|does|did|can|could|will|would|should|has|have|had)\s+/i,
  ],
  // Simple factual
  factual: [
    /^who (is|was|invented|discovered|created)/i,
    /^when (was|did|is)/i,
    /^where (is|was|are|were)/i,
    /^how many/i,
    /^how much/i,
    /^what year/i,
    /^what color/i,
    /^what type of/i,
    /^name (the|a|an)/i,
    /^list (the|some|\d+)/i,
  ],
  // Quick clarifications
  clarifications: [
    /^what's the difference between [\w\s]+ and [\w\s]+\??$/i,
    /^is it true that/i,
    /^quick question/i,
    /^just wondering/i,
    /^real quick/i,
  ],
}

// Complex questions - require deep reasoning, multi-step solutions
const COMPLEX_PATTERNS = {
  // Multi-step problems
  multiStep: [
    /solve (this|the) (problem|equation|system)/i,
    /step by step/i,
    /walk me through/i,
    /show (me )?your (work|reasoning|steps)/i,
    /derive|derivation/i,
    /prove|proof/i,
  ],
  // Deep explanations
  deepExplanation: [
    /explain (in detail|thoroughly|completely)/i,
    /why does .+ (work|happen|occur)/i,
    /how does .+ (work|function|operate) (in detail)?/i,
    /what('s| is) the (relationship|connection) between/i,
    /analyze|analysis/i,
    /compare and contrast/i,
    /evaluate|evaluation/i,
    /critically/i,
  ],
  // Complex math/science
  advancedSubjects: [
    /integral|derivative|differential equation/i,
    /linear algebra|matrix|matrices|eigenvalue/i,
    /quantum|thermodynamics|electromagnetic/i,
    /algorithm|complexity|big o/i,
    /recursion|dynamic programming/i,
    /neural network|machine learning|deep learning/i,
    /organic chemistry|biochemistry/i,
    /calculus|multivariable/i,
  ],
  // Code generation
  codeGeneration: [
    /write (a |an |the )?(code|program|function|script|class)/i,
    /implement|implementation/i,
    /create (a |an )?(function|class|module|api)/i,
    /debug|fix (this |the )?(code|bug|error)/i,
    /refactor/i,
    /optimize (this |the )?(code|algorithm)/i,
  ],
  // Essay/long-form
  longForm: [
    /write (a |an )?(essay|report|summary|analysis)/i,
    /discuss (the |in detail)?/i,
    /comprehensive/i,
    /in-depth/i,
    /elaborate/i,
  ],
  // Multi-part questions
  multiPart: [
    /\d+\.\s+/g, // numbered list in question
    /first.+then.+finally/i,
    /and also|additionally|furthermore|moreover/i,
    /multiple (questions|parts|aspects)/i,
  ],
}

// Moderate complexity indicators
const MODERATE_PATTERNS = {
  explanations: [
    /^explain\s+/i,
    /^how (do|does|can|should)/i,
    /^why (do|does|is|are|did)/i,
    /^what (causes|happens when|would happen)/i,
  ],
  examples: [
    /give (me )?(an? )?(example|examples)/i,
    /for example/i,
    /such as/i,
    /show me how/i,
  ],
  comparisons: [
    /compare/i,
    /versus|vs\.?/i,
    /difference between/i,
    /similarities/i,
    /pros and cons/i,
  ],
  procedures: [
    /how (do|can) (i|you|we)/i,
    /what are the steps/i,
    /guide me/i,
    /teach me/i,
    /help me understand/i,
  ],
}

// =============================================================================
// SUBJECT COMPLEXITY MAPPING
// =============================================================================

const COMPLEX_SUBJECTS = new Set([
  'calculus', 'differential equations', 'linear algebra',
  'quantum mechanics', 'quantum physics', 'quantum computing',
  'organic chemistry', 'biochemistry',
  'machine learning', 'deep learning', 'neural networks',
  'algorithms', 'data structures',
  'thermodynamics', 'electromagnetism',
  'topology', 'abstract algebra', 'real analysis',
  'compiler design', 'operating systems',
  'cryptography', 'distributed systems',
])

const SIMPLE_SUBJECTS = new Set([
  'basic math', 'arithmetic', 'fractions',
  'spelling', 'vocabulary', 'grammar',
  'geography facts', 'capitals', 'countries',
  'basic biology', 'basic chemistry',
  'history dates', 'historical events',
])

// =============================================================================
// FAST ANALYSIS (Regex-based)
// =============================================================================

function countPatternMatches(text: string, patterns: RegExp[]): number {
  let count = 0
  for (const pattern of patterns) {
    if (pattern.test(text)) count++
  }
  return count
}

function detectSubjectComplexity(text: string): 'simple' | 'complex' | 'unknown' {
  const lowerText = text.toLowerCase()

  for (const subject of COMPLEX_SUBJECTS) {
    if (lowerText.includes(subject)) return 'complex'
  }

  for (const subject of SIMPLE_SUBJECTS) {
    if (lowerText.includes(subject)) return 'simple'
  }

  return 'unknown'
}

function fastAnalyze(query: string): {
  complexity: QueryComplexity
  confidence: number
  signals: {
    simpleScore: number
    moderateScore: number
    complexScore: number
    subjectComplexity: 'simple' | 'complex' | 'unknown'
    wordCount: number
    hasQuestionMark: boolean
    hasMultipleSentences: boolean
  }
} {
  const lowerQuery = query.toLowerCase().trim()
  const wordCount = query.split(/\s+/).length
  const hasQuestionMark = query.includes('?')
  const hasMultipleSentences = (query.match(/[.!?]/g) || []).length > 1

  // Calculate scores for each complexity level
  let simpleScore = 0
  let moderateScore = 0
  let complexScore = 0

  // Simple patterns
  for (const patterns of Object.values(SIMPLE_PATTERNS)) {
    simpleScore += countPatternMatches(lowerQuery, patterns)
  }

  // Complex patterns
  for (const patterns of Object.values(COMPLEX_PATTERNS)) {
    complexScore += countPatternMatches(lowerQuery, patterns)
  }

  // Moderate patterns
  for (const patterns of Object.values(MODERATE_PATTERNS)) {
    moderateScore += countPatternMatches(lowerQuery, patterns)
  }

  // Subject complexity
  const subjectComplexity = detectSubjectComplexity(query)
  if (subjectComplexity === 'complex') complexScore += 2
  if (subjectComplexity === 'simple') simpleScore += 2

  // Word count heuristics
  if (wordCount <= 5) simpleScore += 2
  else if (wordCount <= 15) moderateScore += 1
  else if (wordCount > 30) complexScore += 1

  // Multiple sentences suggest complexity
  if (hasMultipleSentences) complexScore += 1

  // Determine complexity and confidence
  const totalScore = simpleScore + moderateScore + complexScore
  let complexity: QueryComplexity
  let confidence: number

  if (complexScore > simpleScore && complexScore > moderateScore) {
    complexity = 'complex'
    confidence = Math.min(0.9, 0.5 + (complexScore - Math.max(simpleScore, moderateScore)) * 0.1)
  } else if (simpleScore > complexScore && simpleScore >= moderateScore) {
    complexity = 'simple'
    confidence = Math.min(0.9, 0.5 + (simpleScore - Math.max(complexScore, moderateScore)) * 0.1)
  } else {
    complexity = 'moderate'
    confidence = totalScore === 0 ? 0.3 : Math.min(0.7, 0.4 + moderateScore * 0.1)
  }

  return {
    complexity,
    confidence,
    signals: {
      simpleScore,
      moderateScore,
      complexScore,
      subjectComplexity,
      wordCount,
      hasQuestionMark,
      hasMultipleSentences,
    },
  }
}

// =============================================================================
// AI FALLBACK ANALYSIS (for uncertain cases)
// =============================================================================

async function aiAnalyze(
  query: string,
  openai: OpenAI,
  subject?: string
): Promise<{
  complexity: QueryComplexity
  requiresReasoning: boolean
  requiresCalculation: boolean
  requiresCodeGeneration: boolean
  isFactualQuestion: boolean
}> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a query complexity analyzer. Analyze the student's question and respond with ONLY a JSON object (no markdown, no explanation):
{
  "complexity": "simple" | "moderate" | "complex",
  "requiresReasoning": boolean,
  "requiresCalculation": boolean,
  "requiresCodeGeneration": boolean,
  "isFactualQuestion": boolean
}

Guidelines:
- simple: factual questions, definitions, yes/no, quick lookups (1-2 sentence answer)
- moderate: explanations, how-to, comparisons, examples needed (paragraph answer)
- complex: multi-step problems, proofs, deep analysis, code, essays (detailed answer)`,
        },
        {
          role: 'user',
          content: `${subject ? `Subject: ${subject}\n` : ''}Question: ${query}`,
        },
      ],
      temperature: 0,
      max_tokens: 100,
    })

    const content = response.choices[0]?.message?.content || ''
    const parsed = JSON.parse(content)

    return {
      complexity: parsed.complexity || 'moderate',
      requiresReasoning: parsed.requiresReasoning || false,
      requiresCalculation: parsed.requiresCalculation || false,
      requiresCodeGeneration: parsed.requiresCodeGeneration || false,
      isFactualQuestion: parsed.isFactualQuestion || false,
    }
  } catch (error) {
    console.error('[QueryAnalyzer] AI analysis failed:', error)
    // Return moderate as safe default
    return {
      complexity: 'moderate',
      requiresReasoning: false,
      requiresCalculation: false,
      requiresCodeGeneration: false,
      isFactualQuestion: false,
    }
  }
}

// =============================================================================
// RESPONSE LENGTH & MODEL MAPPING
// =============================================================================

function getResponseConfig(
  complexity: QueryComplexity,
  flags: {
    requiresReasoning?: boolean
    requiresCalculation?: boolean
    requiresCodeGeneration?: boolean
  }
): {
  responseLength: ResponseLength
  modelTier: ModelTier
  maxTokens: number
  temperature: number
} {
  // Check if advanced model is needed
  const needsAdvancedModel =
    complexity === 'complex' ||
    flags.requiresReasoning ||
    flags.requiresCalculation ||
    flags.requiresCodeGeneration

  switch (complexity) {
    case 'simple':
      return {
        responseLength: 'short',
        modelTier: 'fast',
        maxTokens: 150, // ~100-150 words
        temperature: 0.5, // More deterministic for factual
      }

    case 'moderate':
      return {
        responseLength: 'medium',
        modelTier: needsAdvancedModel ? 'advanced' : 'fast',
        maxTokens: 400, // ~250-350 words
        temperature: 0.6,
      }

    case 'complex':
      return {
        responseLength: 'detailed',
        modelTier: 'advanced',
        maxTokens: 800, // ~500-700 words
        temperature: 0.7, // More creative for complex explanations
      }

    default:
      return {
        responseLength: 'medium',
        modelTier: 'fast',
        maxTokens: 400,
        temperature: 0.6,
      }
  }
}

// =============================================================================
// MAIN ANALYZER FUNCTION
// =============================================================================

/**
 * Analyze a query to determine complexity, response length, and model tier
 *
 * Uses hybrid approach:
 * 1. Fast regex analysis first
 * 2. If confidence < 0.6, use AI fallback
 *
 * @param query - The user's question/message
 * @param options - Optional configuration
 * @returns QueryAnalysis with all recommendations
 */
export async function analyzeQuery(
  query: string,
  options: {
    subject?: string
    forceAI?: boolean
    openai?: OpenAI
    confidenceThreshold?: number
  } = {}
): Promise<QueryAnalysis> {
  const {
    subject,
    forceAI = false,
    confidenceThreshold = 0.6,
  } = options

  // Step 1: Fast regex analysis
  const fastResult = fastAnalyze(query)

  let complexity = fastResult.complexity
  let confidence = fastResult.confidence
  let requiresReasoning = false
  let requiresCalculation = false
  let requiresCodeGeneration = false
  let isFactualQuestion = fastResult.signals.simpleScore > 0

  // Step 2: AI fallback if confidence is low or forced
  if ((confidence < confidenceThreshold || forceAI) && options.openai) {
    console.log(`[QueryAnalyzer] Low confidence (${confidence.toFixed(2)}), using AI fallback`)

    const aiResult = await aiAnalyze(query, options.openai, subject)

    // Merge AI results with fast analysis
    complexity = aiResult.complexity
    requiresReasoning = aiResult.requiresReasoning
    requiresCalculation = aiResult.requiresCalculation
    requiresCodeGeneration = aiResult.requiresCodeGeneration
    isFactualQuestion = aiResult.isFactualQuestion
    confidence = 0.85 // AI analysis is more reliable
  }

  // Step 3: Get response configuration
  const responseConfig = getResponseConfig(complexity, {
    requiresReasoning,
    requiresCalculation,
    requiresCodeGeneration,
  })

  // Step 4: Determine question type
  const isConceptualQuestion = /why|how does|explain|understand/i.test(query)
  const isProceduralQuestion = /how (do|can|should)|steps|guide|process/i.test(query)

  // Build reason string
  const reasons: string[] = []
  if (fastResult.signals.complexScore > 0) reasons.push('complex patterns detected')
  if (fastResult.signals.subjectComplexity === 'complex') reasons.push('advanced subject')
  if (requiresReasoning) reasons.push('requires reasoning')
  if (requiresCalculation) reasons.push('requires calculation')
  if (requiresCodeGeneration) reasons.push('requires code')
  if (isFactualQuestion) reasons.push('factual question')
  if (reasons.length === 0) reasons.push('standard query')

  return {
    complexity,
    responseLength: responseConfig.responseLength,
    modelTier: responseConfig.modelTier,
    confidence,
    reason: reasons.join(', '),
    maxTokens: responseConfig.maxTokens,
    temperature: responseConfig.temperature,
    requiresReasoning,
    requiresCalculation,
    requiresCodeGeneration,
    isFactualQuestion,
    isConceptualQuestion,
    isProceduralQuestion,
  }
}

/**
 * Quick synchronous analysis without AI fallback
 * Use when you need instant results and can accept lower accuracy
 */
export function analyzeQueryFast(query: string): QueryAnalysis {
  const fastResult = fastAnalyze(query)
  const responseConfig = getResponseConfig(fastResult.complexity, {})

  return {
    complexity: fastResult.complexity,
    responseLength: responseConfig.responseLength,
    modelTier: responseConfig.modelTier,
    confidence: fastResult.confidence,
    reason: `fast analysis (scores: simple=${fastResult.signals.simpleScore}, moderate=${fastResult.signals.moderateScore}, complex=${fastResult.signals.complexScore})`,
    maxTokens: responseConfig.maxTokens,
    temperature: responseConfig.temperature,
    requiresReasoning: false,
    requiresCalculation: false,
    requiresCodeGeneration: fastResult.signals.complexScore > 0 && /code|program|function/i.test(query),
    isFactualQuestion: fastResult.signals.simpleScore > 0,
    isConceptualQuestion: /why|how does|explain|understand/i.test(query),
    isProceduralQuestion: /how (do|can|should)|steps|guide|process/i.test(query),
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  fastAnalyze,
  getResponseConfig,
}
