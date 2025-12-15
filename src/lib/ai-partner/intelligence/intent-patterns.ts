/**
 * AI Partner Intelligence System - Intent Patterns
 *
 * Regex patterns for fast-path intent classification.
 * These patterns are designed to catch common user message formats
 * without requiring an API call.
 */

import type { UserIntent } from './types'

/**
 * Intent patterns for fast classification
 * Each intent has an array of regex patterns that indicate that intent
 */
export const INTENT_PATTERNS: Record<UserIntent, RegExp[]> = {
  // ==========================================================================
  // LEARNING INTENTS
  // ==========================================================================

  EXPLAIN: [
    // Question words + verb forms
    /^(what|who|where|when|why|how)\s+(is|are|was|were|does|do|did|can|could|would|should)/i,
    /^(what|who|where|when|why|how)\s+.{3,}/i, // Any question starting with these
    // Explicit explain requests
    /explain\s+(to me\s+)?(what|how|why|the|this|that|a|an)?/i,
    /tell me (about|what|how|why)/i,
    /what does .+ mean/i,
    /what('s| is) (the |a |an )?(meaning|definition)/i,
    /define\s+/i,
    /meaning of/i,
    /can you (explain|tell me|describe)/i,
    /help me understand/i,
    /i('m| am) (not sure|confused about) (what|how|why)/i,
    /what exactly is/i,
    /break down/i,
  ],

  SOLVE: [
    // Math/problem solving
    /solve\s+(this|the|for|equation|problem|x|y)/i,
    /calculate\s+/i,
    /find\s+(the\s+)?(value|answer|solution|result|x|y)/i,
    /what\s+is\s+\d+\s*[\+\-\*\/\^]/i, // Math expression
    /\d+\s*[\+\-\*\/\^]\s*\d+/i, // Math expression anywhere
    /work out/i,
    /figure out/i,
    /compute/i,
    /evaluate\s+(this|the)?/i,
    /simplify/i,
    /factor/i,
    /derive/i,
    /integrate/i,
    /differentiate/i,
    /what('s| is) the (answer|solution|result)/i,
    /how do (i|you) solve/i,
    /solve for/i,
  ],

  SUMMARIZE: [
    /summarize/i,
    /summary\s+(of|for)/i,
    /give me (a\s+)?summary/i,
    /tldr/i,
    /tl;dr/i,
    /main points/i,
    /key (points|takeaways|ideas|concepts)/i,
    /in (short|brief|a nutshell)/i,
    /quick (overview|summary|recap)/i,
    /recap/i,
    /overview of/i,
    /bullet points/i,
    /cliff notes/i,
  ],

  COMPARE: [
    /difference\s+between/i,
    /differences?\s+(of|in)/i,
    /compare\s+(and\s+contrast)?/i,
    /\bvs\.?\s/i,
    /versus/i,
    /how\s+(is|are|does)\s+.+\s+(different|similar|compare)/i,
    /what.+(distinguishes|separates)/i,
    /similarities\s+(between|and)/i,
    /contrast\s+(between|with)/i,
    /which (is|one is) (better|faster|more)/i,
    /pros and cons/i,
    /.+ or .+\?$/i, // "X or Y?" pattern
  ],

  // ==========================================================================
  // INTERACTIVE INTENTS
  // ==========================================================================

  QUIZ_ME: [
    /quiz\s+me/i,
    /test\s+me/i,
    /ask\s+me\s+(a\s+)?question/i,
    /give\s+me\s+(a\s+)?(quiz|test|question)/i,
    /practice\s+questions?/i,
    /can you (quiz|test) me/i,
    /i want (a|to be) quiz(zed)?/i,
    /let('s| us) (do a|have a) quiz/i,
    /challenge me/i,
    /ready (to be |for )?(tested|quizzed)/i,
  ],

  CHECK_ANSWER: [
    /is\s+(this|my|that)\s+(answer|solution|work)\s+(correct|right|wrong)/i,
    /check\s+(my|this)\s+(answer|work|solution)/i,
    /did\s+i\s+(get|do)\s+(this|it)\s+(right|correctly|wrong)/i,
    /am\s+i\s+(right|correct|wrong)/i,
    /correct\s+(my|this)/i,
    /is this (right|correct|wrong)/i,
    /my answer (is|was|:)/i,
    /i (got|think|believe|said) .+ (is that (right|correct)|right\?|correct\?)/i,
    /verify my/i,
    /grade (my|this)/i,
  ],

  PRACTICE: [
    /give me (a\s+)?(practice|more) (problems?|questions?|exercises?)/i,
    /more (practice|problems|questions|exercises)/i,
    /another (problem|question|example)/i,
    /practice (problems?|exercises?|questions?)/i,
    /let('s| me) practice/i,
    /i (want|need) (to |more )?practice/i,
    /drill me/i,
    /more examples/i,
    /keep going/i,
    /next (one|problem|question)/i,
  ],

  // ==========================================================================
  // CLARIFICATION INTENTS
  // ==========================================================================

  CONFUSED: [
    /i\s+(don'?t|do not|still don'?t)\s+(understand|get|follow|see)/i,
    /(still\s+)?(confused|lost|stuck)/i,
    /makes?\s+no\s+sense/i,
    /doesn'?t\s+make\s+sense/i,
    /^huh\??$/i,
    /^what\??$/i,
    /lost\s+me/i,
    /explain\s+(it\s+)?(again|differently|another way)/i,
    /come\s+again/i,
    /run\s+that\s+by\s+me\s+again/i,
    /i'?m\s+(so\s+)?lost/i,
    /not (following|getting it|understanding)/i,
    /can you (say that|explain|rephrase) (again|differently)/i,
    /too (fast|confusing|complicated|complex)/i,
    /over my head/i,
    /went (right )?over my head/i,
    /wait,?\s+what/i,
    /you lost me/i,
  ],

  FOLLOW_UP: [
    /^(and|but|so|also|what about|how about)/i,
    /^(ok|okay|alright|got it|i see),?\s+(but|and|so|now|what|how)/i,
    /following\s+up/i,
    /related\s+to\s+that/i,
    /speaking\s+of/i,
    /on that note/i,
    /going back to/i,
    /^one more (thing|question)/i,
    /^also,?/i,
    /^additionally/i,
    /^furthermore/i,
    /^moreover/i,
    /what if/i,
  ],

  ELABORATE: [
    /tell\s+me\s+more/i,
    /go\s+(on|deeper|further|into more detail)/i,
    /elaborate/i,
    /more\s+details?/i,
    /expand\s+on/i,
    /can you (explain|go into) (more|further|greater)/i,
    /dig deeper/i,
    /in (more |greater )?detail/i,
    /keep going/i,
    /continue/i,
    /and(\?|\.\.\.?)$/i, // Ends with "and?" or "and..."
    /go on/i,
    /what else/i,
    /is there more/i,
  ],

  // ==========================================================================
  // SPECIAL INTENTS
  // ==========================================================================

  GENERATE_IMAGE: [
    // Generate/create/make + image/picture/diagram
    /(generate|create|make|draw|show)\s+(me\s+)?(an?\s+|the\s+)?(image|picture|diagram|illustration|visual|chart|graph|flowchart|infographic|mindmap|logo|poster)/i,
    // Can/could/please + generate/create/make
    /(can|could|would|please)\s+(you\s+)?(generate|create|make|draw|show)\s+(me\s+)?(an?\s+|the\s+)?(image|picture|diagram|illustration|visual)/i,
    // I want/need + image
    /i\s+(want|need)\s+(an?\s+|the\s+)?(image|picture|diagram|illustration|visual)/i,
    // Visualize/illustrate
    /visualize/i,
    /\billustrate\b/i,
    /illustration (of|for)/i,
    // Design
    /design\s+(a|an|the)\s+(logo|poster|infographic|diagram)/i,
    // Show me visually
    /show\s+(me\s+)?visually/i,
  ],

  FLASHCARDS: [
    /flashcards?/i,
    /flash cards?/i,
    /make\s+(me\s+)?(study\s+)?cards/i,
    /create\s+(study\s+)?cards/i,
    /study cards/i,
    /vocabulary cards/i,
    /note cards/i,
  ],

  PLAN_STUDY: [
    /help\s+me\s+(plan|organize|schedule|prepare)/i,
    /study\s+(plan|schedule|strategy)/i,
    /how\s+should\s+i\s+(study|prepare|review)/i,
    /prepare\s+for\s+(the\s+)?(exam|test|quiz|final)/i,
    /exam\s+prep/i,
    /study\s+guide/i,
    /learning\s+(plan|path|roadmap)/i,
    /what should i (study|focus on|review)/i,
    /best way to (study|learn|prepare)/i,
    /study tips/i,
    /how (can|do) i (prepare|study) for/i,
  ],

  // ==========================================================================
  // OTHER INTENTS
  // ==========================================================================

  CASUAL_CHAT: [
    /^(hi|hey|hello|howdy|sup|yo|hiya)!?$/i,
    /^(hi|hey|hello|howdy),?\s+.{0,20}$/i, // Short greeting with name
    /^good\s+(morning|afternoon|evening|night)!?$/i,
    /how\s+(are|r)\s+(you|u|ya)/i,
    /what'?s?\s+up/i,
    /^thanks?(\s+you)?!?$/i,
    /^thank you( so much)?!?$/i,
    /^(ok|okay|cool|nice|great|awesome|perfect|got it|understood|i see)!?$/i,
    /^(bye|goodbye|see you|later|cya|ttyl)!?$/i,
    /^lol!?$/i,
    /^haha!?$/i,
    /^:[\)\(DPp]$/i, // Emoticons
    /^(yes|no|yeah|yep|nope|nah|sure|maybe)!?$/i,
  ],

  OFF_TOPIC: [
    // This is primarily detected by content safety system
    // These are backup patterns for obvious off-topic
    /let'?s\s+(talk|chat)\s+about\s+(something else|other things)/i,
    /forget\s+(about\s+)?(studying|school|homework)/i,
    /i don'?t want to (study|learn|do homework)/i,
    /this is boring/i,
    /can we talk about something else/i,
  ],

  UNCLEAR: [
    // This is the fallback - no patterns, determined by elimination
  ],
}

/**
 * Topic extraction patterns
 * Used to extract the subject/topic from user messages
 */
export const TOPIC_EXTRACTION_PATTERNS = [
  /(?:about|on|for|regarding|study|learn|explain|understand)\s+([a-zA-Z][a-zA-Z\s]{2,30}?)(?:\.|,|\?|!|$)/i,
  /(?:what is|what are|how does|how do)\s+([a-zA-Z][a-zA-Z\s]{2,30}?)(?:\?|$)/i,
  /(?:help me with|teach me|show me)\s+([a-zA-Z][a-zA-Z\s]{2,30}?)(?:\.|,|\?|!|$)/i,
]

/**
 * Math expression patterns
 */
export const MATH_PATTERNS = [
  /\d+\s*[\+\-\*\/\^=]\s*[\dx\d\(\)]+/g, // Basic math
  /[xyz]\s*[\+\-\*\/\^=]\s*[\dxyz\(\)]+/g, // Algebraic
  /\bsin\b|\bcos\b|\btan\b|\blog\b|\bln\b|\bsqrt\b/gi, // Functions
  /\bintegral\b|\bderivative\b|\blimit\b/gi, // Calculus
]

/**
 * Confusion signal patterns (for adaptive tracking)
 */
export const CONFUSION_PATTERNS = [
  /i\s+(don'?t|do not|still don'?t)\s+(understand|get|follow)/i,
  /(confused|lost|stuck)/i,
  /makes?\s+no\s+sense/i,
  /^huh\??$/i,
  /^what\??$/i,
  /explain.+again/i,
  /not (following|getting it)/i,
]

/**
 * Completion/understanding signal patterns
 */
export const COMPLETION_PATTERNS = [
  /^(got it|i (got|get) it|understood|i (understand|see)|makes sense|that makes sense|clear now|ah i see|oh i see|now i (get|understand) it)!?$/i,
  /thanks?,?\s+(that|this)\s+(helps?|makes sense|is clear)/i,
  /^perfect!?$/i,
  /^exactly!?$/i,
  /^right!?$/i,
]

/**
 * Disengagement signal patterns
 */
export const DISENGAGEMENT_PATTERNS = [
  /^(ok|okay|k|kk|cool|sure|fine|whatever|idk|dunno|meh)!?\.?$/i,
  /^(yes|no|yeah|yep|nope|nah)!?\.?$/i,
  /^\.{1,3}$/i, // Just dots
  /^[a-z]{1,3}$/i, // Very short responses (1-3 chars)
]

/**
 * Short reply threshold (word count)
 */
export const SHORT_REPLY_THRESHOLD = 3

/**
 * Check if a pattern matches the content
 */
export function matchesPattern(content: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(content))
}

/**
 * Extract topic from content using patterns
 */
export function extractTopic(content: string): string | null {
  for (const pattern of TOPIC_EXTRACTION_PATTERNS) {
    const match = content.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  return null
}

/**
 * Extract math expressions from content
 */
export function extractMathExpressions(content: string): string[] {
  const expressions: string[] = []
  for (const pattern of MATH_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      expressions.push(...matches)
    }
  }
  return [...new Set(expressions)] // Remove duplicates
}
