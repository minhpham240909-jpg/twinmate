/**
 * AI Partner Intelligence System - Input Processor
 *
 * Cleans and normalizes messy user inputs before classification.
 * Handles bullet points, fragments, code blocks, math expressions, etc.
 */

import type { ProcessedInput, InputFormat } from './types'
import { extractTopic, extractMathExpressions } from './intent-patterns'

/**
 * Process raw user input into a normalized, classified format
 */
export function processInput(raw: string): ProcessedInput {
  const original = raw
  let cleaned = raw.trim()

  // Detect input format
  const format = detectFormat(cleaned)

  // Extract components before cleaning
  const questions = extractQuestions(cleaned)
  const codeBlocks = extractCodeBlocks(cleaned)
  const mathExpressions = extractMathExpressions(cleaned)

  // Clean the input
  cleaned = cleanInput(cleaned, codeBlocks)

  // Extract topics from cleaned input
  const topics = extractTopics(cleaned)

  // Count words in cleaned input
  const wordCount = countWords(cleaned)

  return {
    original,
    cleaned,
    format,
    wordCount,
    extracted: {
      questions,
      topics,
      mathExpressions,
      codeBlocks,
    },
  }
}

/**
 * Detect the format of the input
 */
function detectFormat(content: string): InputFormat {
  // Check for code blocks first
  if (/```[\s\S]*```/.test(content) || /`[^`]+`/.test(content)) {
    return 'code'
  }

  // Check for bullet points or numbered lists
  if (/^[-•*]\s/m.test(content) || /^\d+[.)]\s/m.test(content)) {
    return 'bullets'
  }

  // Check for math expressions
  if (/[=\+\-\*\/\^]\s*\d/.test(content) || /\d\s*[=\+\-\*\/\^]/.test(content)) {
    return 'math'
  }

  // Check if it's a short fragment
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length
  if (wordCount <= 5 && !content.includes('.') && !content.includes('?')) {
    return 'fragment'
  }

  // Check if it's mixed (multiple formats detected)
  const hasBullets = /^[-•*]\s/m.test(content)
  const hasMath = /\d+\s*[\+\-\*\/\^=]/.test(content)
  const hasCode = /`[^`]+`/.test(content)
  if ([hasBullets, hasMath, hasCode].filter(Boolean).length > 1) {
    return 'mixed'
  }

  return 'sentence'
}

/**
 * Extract all questions from the content
 */
function extractQuestions(content: string): string[] {
  const questions: string[] = []

  // Match sentences ending with ?
  const questionMatches = content.match(/[^.!?]*\?/g)
  if (questionMatches) {
    questions.push(...questionMatches.map(q => q.trim()))
  }

  return questions
}

/**
 * Extract code blocks from content
 */
function extractCodeBlocks(content: string): string[] {
  const codeBlocks: string[] = []

  // Triple backtick blocks
  const tripleBacktickMatches = content.match(/```[\s\S]*?```/g)
  if (tripleBacktickMatches) {
    codeBlocks.push(...tripleBacktickMatches)
  }

  // Single backtick inline code (only if substantial)
  const inlineCodeMatches = content.match(/`[^`]{5,}[^`]*`/g)
  if (inlineCodeMatches) {
    codeBlocks.push(...inlineCodeMatches)
  }

  return codeBlocks
}

/**
 * Extract topics from content
 */
function extractTopics(content: string): string[] {
  const topics: string[] = []

  // Use pattern-based extraction
  const patternTopic = extractTopic(content)
  if (patternTopic) {
    topics.push(patternTopic)
  }

  // Extract from "about X" patterns
  const aboutMatches = content.match(/(?:about|on|regarding)\s+([a-zA-Z][a-zA-Z\s]{2,25}?)(?:\.|,|\?|!|$)/gi)
  if (aboutMatches) {
    aboutMatches.forEach(match => {
      const topic = match.replace(/^(about|on|regarding)\s+/i, '').replace(/[.,?!]$/, '').trim()
      if (topic && !topics.includes(topic)) {
        topics.push(topic)
      }
    })
  }

  return topics.slice(0, 3) // Limit to 3 topics
}

/**
 * Clean the input for processing
 */
function cleanInput(content: string, codeBlocks: string[]): string {
  let cleaned = content

  // Remove code blocks (already extracted)
  for (const block of codeBlocks) {
    cleaned = cleaned.replace(block, '')
  }

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ')

  // Remove bullet markers but keep content
  cleaned = cleaned.replace(/^[-•*]\s*/gm, '')
  cleaned = cleaned.replace(/^\d+[.)]\s*/gm, '')

  // Remove excessive punctuation
  cleaned = cleaned.replace(/\.{3,}/g, '...')
  cleaned = cleaned.replace(/!{2,}/g, '!')
  cleaned = cleaned.replace(/\?{2,}/g, '?')

  // Clean up spacing around punctuation
  cleaned = cleaned.replace(/\s+([.,!?])/g, '$1')
  cleaned = cleaned.replace(/([.,!?])\s+/g, '$1 ')

  // Trim
  cleaned = cleaned.trim()

  // If cleaned is empty but original had content, use a simplified version
  if (!cleaned && content.trim()) {
    cleaned = content.replace(/[^\w\s?]/g, ' ').replace(/\s+/g, ' ').trim()
  }

  return cleaned
}

/**
 * Count words in content
 */
function countWords(content: string): number {
  return content.split(/\s+/).filter(w => w.length > 0).length
}

/**
 * Check if input is a short reply (potential disengagement)
 */
export function isShortReply(content: string): boolean {
  const wordCount = countWords(content.trim())
  return wordCount <= 3
}

/**
 * Check if input ends with a question
 */
export function endsWithQuestion(content: string): boolean {
  return content.trim().endsWith('?')
}

/**
 * Normalize input for pattern matching (lowercase, trimmed)
 */
export function normalizeForMatching(content: string): string {
  return content.trim().toLowerCase()
}

/**
 * Check if input contains substantial content (not just filler)
 */
export function hasSubstantialContent(content: string): boolean {
  const cleaned = content
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\b(ok|okay|um|uh|like|just|so|well|yeah|yes|no|maybe)\b/gi, '') // Remove filler words
    .trim()

  return cleaned.split(/\s+/).filter(w => w.length > 1).length >= 2
}

/**
 * Extract the main question from a message that might have multiple parts
 */
export function extractMainQuestion(content: string): string | null {
  const questions = extractQuestions(content)

  if (questions.length === 0) {
    // No explicit question, return the whole content if it seems like a request
    if (/^(can|could|would|please|help|explain|tell|show|what|how|why|when|where|who)/i.test(content.trim())) {
      return content.trim()
    }
    return null
  }

  // Return the longest question (likely the main one)
  return questions.reduce((longest, current) =>
    current.length > longest.length ? current : longest
  )
}

/**
 * Detect if input is likely copied homework/text (long, formal, structured)
 */
export function isLikelyCopiedContent(content: string): boolean {
  const indicators = [
    // Numbered lists that are educational
    /^\d+\.\s+[A-Z]/m,
    // "Answer the following" type instructions
    /answer the following/i,
    // "Question X:" format
    /question\s+\d+/i,
    // Very long with formal structure
    content.length > 500 && /[A-Z][^.!?]*\.\s+[A-Z]/.test(content),
    // Contains "(a)", "(b)", "(c)" or similar
    /\([a-d]\)/i,
  ]

  return indicators.some(indicator =>
    typeof indicator === 'boolean' ? indicator : indicator.test(content)
  )
}
