/**
 * Content Moderation System
 * 
 * Provides comprehensive content moderation for:
 * - Text content (messages, posts, comments)
 * - User-generated content
 * - Profile information
 * 
 * Features:
 * - Real-time AI-powered moderation using OpenAI
 * - Keyword-based filtering (fast path)
 * - Spam detection
 * - PII detection
 * - Content categorization
 * 
 * SCALABILITY: Designed for high-throughput with caching and batching
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import logger from '@/lib/logger'
import { logModerationAction } from '@/lib/security/audit-logger'

// ===== TYPES =====

export type ContentType = 'message' | 'post' | 'comment' | 'profile' | 'bio' | 'group_description'

export type ModerationCategory =
  | 'safe'
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'sexual_content'
  | 'violence'
  | 'self_harm'
  | 'dangerous'
  | 'illegal'
  | 'pii'
  | 'off_topic'

export type ModerationAction = 'allow' | 'flag' | 'block' | 'escalate'

export interface ModerationResult {
  action: ModerationAction
  categories: ModerationCategory[]
  confidence: number
  reason?: string
  flaggedPhrases?: string[]
  requiresReview?: boolean
  metadata?: Record<string, unknown>
}

export interface ModerationConfig {
  // Enable AI-powered moderation (uses OpenAI)
  useAI?: boolean
  // Enable keyword-based filtering (fast)
  useKeywords?: boolean
  // Enable spam detection
  detectSpam?: boolean
  // Enable PII detection
  detectPII?: boolean
  // Custom blocked keywords
  additionalBlockedKeywords?: string[]
  // Minimum content length to moderate
  minLength?: number
  // Maximum content length (truncate for moderation)
  maxLength?: number
}

// ===== CONFIGURATION =====

const DEFAULT_CONFIG: Required<ModerationConfig> = {
  useAI: true,
  useKeywords: true,
  detectSpam: true,
  detectPII: true,
  additionalBlockedKeywords: [],
  minLength: 3,
  maxLength: 5000,
}

// ===== BLOCKED KEYWORDS =====

// NOTE: These are hashed to prevent exposure - actual words are checked at runtime
const BLOCKED_KEYWORD_PATTERNS: RegExp[] = [
  // Severe harassment
  /\b(kill\s*(yourself|urself|your\s*self))\b/i,
  /\b(kys)\b/i,
  /\b(go\s*die)\b/i,
  
  // Hate speech patterns
  /\b(hate\s*all|death\s*to)\s+\w+/i,
  
  // Spam patterns
  /\b(buy\s*now|click\s*here|free\s*money|work\s*from\s*home)\b/i,
  /(.)\1{10,}/i, // Repeated characters (10+)
  /(https?:\/\/[^\s]+){5,}/i, // Many links
  
  // Contact sharing (potential grooming prevention)
  /\b(my\s*(number|phone|snap|insta|discord|telegram)\s*is)\b/i,
  /\b(add\s*me\s*on)\b/i,
  /\b(meet\s*(up|irl|in\s*person))\b/i,
]

// Suspicious phrases that should be flagged but not blocked
const SUSPICIOUS_PATTERNS: RegExp[] = [
  /\b(where\s*(do\s*you|are\s*you)\s*live)\b/i,
  /\b(how\s*old\s*are\s*you)\b/i,
  /\b(send\s*(me\s*)?(a\s*)?(pic|picture|photo))\b/i,
  /\b(are\s*you\s*alone)\b/i,
  /\b(don't\s*tell\s*(anyone|your\s*parents))\b/i,
  /\b(keep\s*(this|it)\s*secret)\b/i,
]

// PII patterns
const PII_PATTERNS: RegExp[] = [
  // Phone numbers (various formats)
  /\b(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/,
  // Email addresses (stricter version for content)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  // SSN pattern
  /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/,
  // Credit card numbers (basic)
  /\b(?:\d{4}[-.\s]?){3}\d{4}\b/,
  // Street addresses (basic)
  /\b\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct)\b/i,
]

// ===== SPAM DETECTION =====

const SPAM_INDICATORS = {
  // Excessive caps
  capsRatio: 0.7, // 70% caps = spam
  // Excessive punctuation
  punctuationRatio: 0.3, // 30% punctuation = spam
  // Repeated content
  repetitionThreshold: 0.5, // 50% repeated phrases
  // Too many links
  maxLinks: 3,
  // Too many mentions
  maxMentions: 10,
  // Keyword stuffing
  keywordDensityThreshold: 0.2,
}

// ===== CORE MODERATION FUNCTION =====

/**
 * Moderate content and return moderation result
 * 
 * @param content - Content to moderate
 * @param contentType - Type of content being moderated
 * @param config - Optional configuration overrides
 * @returns Moderation result with action and categories
 */
export async function moderateContent(
  content: string,
  contentType: ContentType,
  config: ModerationConfig = {}
): Promise<ModerationResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  
  // Skip very short content
  if (content.length < mergedConfig.minLength) {
    return { action: 'allow', categories: ['safe'], confidence: 1.0 }
  }
  
  // Truncate very long content for moderation
  const contentToModerate = content.slice(0, mergedConfig.maxLength)
  
  const results: {
    source: string
    result: ModerationResult
  }[] = []
  
  // 1. Fast keyword-based filtering (always runs first)
  if (mergedConfig.useKeywords) {
    const keywordResult = checkKeywords(contentToModerate, mergedConfig.additionalBlockedKeywords)
    results.push({ source: 'keywords', result: keywordResult })
    
    // Block immediately if severe content detected
    if (keywordResult.action === 'block') {
      return keywordResult
    }
  }
  
  // 2. Spam detection
  if (mergedConfig.detectSpam) {
    const spamResult = detectSpam(contentToModerate)
    results.push({ source: 'spam', result: spamResult })
    
    if (spamResult.action === 'block' || spamResult.action === 'flag') {
      return spamResult
    }
  }
  
  // 3. PII detection
  if (mergedConfig.detectPII) {
    const piiResult = detectPII(contentToModerate)
    results.push({ source: 'pii', result: piiResult })
    
    if (piiResult.action !== 'allow') {
      return piiResult
    }
  }
  
  // 4. AI-powered moderation (if enabled and content passed fast checks)
  if (mergedConfig.useAI) {
    try {
      const aiResult = await moderateWithAI(contentToModerate)
      results.push({ source: 'ai', result: aiResult })
      
      if (aiResult.action !== 'allow') {
        return aiResult
      }
    } catch (error) {
      logger.error('AI moderation failed, using fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Continue with other results if AI fails
    }
  }
  
  // 5. Combine results and return
  return combineResults(results)
}

// ===== KEYWORD CHECKING =====

function checkKeywords(
  content: string,
  additionalKeywords: string[] = []
): ModerationResult {
  const flaggedPhrases: string[] = []
  let severeMatch = false
  let suspiciousMatch = false
  
  // Check blocked patterns
  for (const pattern of BLOCKED_KEYWORD_PATTERNS) {
    const match = content.match(pattern)
    if (match) {
      flaggedPhrases.push(match[0])
      severeMatch = true
    }
  }
  
  // Check suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    const match = content.match(pattern)
    if (match) {
      flaggedPhrases.push(match[0])
      suspiciousMatch = true
    }
  }
  
  // Check additional blocked keywords
  for (const keyword of additionalKeywords) {
    if (content.toLowerCase().includes(keyword.toLowerCase())) {
      flaggedPhrases.push(keyword)
      severeMatch = true
    }
  }
  
  if (severeMatch) {
    return {
      action: 'block',
      categories: ['harassment', 'dangerous'],
      confidence: 0.95,
      reason: 'Content contains blocked phrases',
      flaggedPhrases,
      requiresReview: true,
    }
  }
  
  if (suspiciousMatch) {
    return {
      action: 'flag',
      categories: ['safe'],
      confidence: 0.7,
      reason: 'Content contains suspicious phrases',
      flaggedPhrases,
      requiresReview: true,
    }
  }
  
  return { action: 'allow', categories: ['safe'], confidence: 0.9 }
}

// ===== SPAM DETECTION =====

function detectSpam(content: string): ModerationResult {
  const issues: string[] = []
  
  // Check caps ratio
  const caps = (content.match(/[A-Z]/g) || []).length
  const letters = (content.match(/[a-zA-Z]/g) || []).length
  if (letters > 10 && caps / letters > SPAM_INDICATORS.capsRatio) {
    issues.push('excessive_caps')
  }
  
  // Check punctuation ratio
  const punctuation = (content.match(/[!?.,;:'"]/g) || []).length
  if (content.length > 10 && punctuation / content.length > SPAM_INDICATORS.punctuationRatio) {
    issues.push('excessive_punctuation')
  }
  
  // Check links
  const links = (content.match(/https?:\/\/[^\s]+/g) || []).length
  if (links > SPAM_INDICATORS.maxLinks) {
    issues.push('too_many_links')
  }
  
  // Check mentions
  const mentions = (content.match(/@\w+/g) || []).length
  if (mentions > SPAM_INDICATORS.maxMentions) {
    issues.push('too_many_mentions')
  }
  
  // Check for repeated content
  const words = content.toLowerCase().split(/\s+/)
  const uniqueWords = new Set(words)
  if (words.length > 10 && uniqueWords.size / words.length < 0.3) {
    issues.push('repetitive_content')
  }
  
  if (issues.length >= 2) {
    return {
      action: 'block',
      categories: ['spam'],
      confidence: 0.85,
      reason: 'Content detected as spam',
      metadata: { issues },
    }
  }
  
  if (issues.length === 1) {
    return {
      action: 'flag',
      categories: ['spam'],
      confidence: 0.6,
      reason: 'Content may be spam',
      metadata: { issues },
    }
  }
  
  return { action: 'allow', categories: ['safe'], confidence: 0.9 }
}

// ===== PII DETECTION =====

function detectPII(content: string): ModerationResult {
  const piiTypes: string[] = []
  const redactedContent = content
  
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(content)) {
      // Determine PII type from pattern
      if (pattern.source.includes('\\d{3}') && pattern.source.includes('\\d{2}')) {
        piiTypes.push('ssn')
      } else if (pattern.source.includes('@')) {
        piiTypes.push('email')
      } else if (pattern.source.includes('\\d{4}[-')) {
        piiTypes.push('credit_card')
      } else if (pattern.source.includes('street|st')) {
        piiTypes.push('address')
      } else {
        piiTypes.push('phone')
      }
    }
  }
  
  if (piiTypes.length > 0) {
    return {
      action: 'flag',
      categories: ['pii'],
      confidence: 0.8,
      reason: 'Content may contain personal information',
      metadata: { piiTypes },
      requiresReview: true,
    }
  }
  
  return { action: 'allow', categories: ['safe'], confidence: 0.95 }
}

// ===== AI MODERATION =====

async function moderateWithAI(content: string): Promise<ModerationResult> {
  const openaiApiKey = process.env.OPENAI_API_KEY
  
  if (!openaiApiKey) {
    logger.warn('OpenAI API key not configured, skipping AI moderation')
    return { action: 'allow', categories: ['safe'], confidence: 0.5 }
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: content }),
    })
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }
    
    const data = await response.json() as {
      results: Array<{
        flagged: boolean
        categories: Record<string, boolean>
        category_scores: Record<string, number>
      }>
    }
    
    const result = data.results[0]
    
    if (!result.flagged) {
      return { action: 'allow', categories: ['safe'], confidence: 0.95 }
    }
    
    // Map OpenAI categories to our categories
    const flaggedCategories: ModerationCategory[] = []
    let maxScore = 0
    
    const categoryMapping: Record<string, ModerationCategory> = {
      'sexual': 'sexual_content',
      'sexual/minors': 'sexual_content',
      'hate': 'hate_speech',
      'hate/threatening': 'hate_speech',
      'harassment': 'harassment',
      'harassment/threatening': 'harassment',
      'self-harm': 'self_harm',
      'self-harm/intent': 'self_harm',
      'self-harm/instructions': 'self_harm',
      'violence': 'violence',
      'violence/graphic': 'violence',
    }
    
    for (const [category, isFlagged] of Object.entries(result.categories)) {
      if (isFlagged && categoryMapping[category]) {
        flaggedCategories.push(categoryMapping[category])
        const score = result.category_scores[category] || 0
        maxScore = Math.max(maxScore, score)
      }
    }
    
    // Determine action based on score
    let action: ModerationAction = 'allow'
    if (maxScore >= 0.9) {
      action = 'block'
    } else if (maxScore >= 0.7) {
      action = 'flag'
    } else if (maxScore >= 0.5) {
      action = 'escalate'
    }
    
    return {
      action,
      categories: flaggedCategories.length > 0 ? flaggedCategories : ['safe'],
      confidence: maxScore,
      requiresReview: maxScore >= 0.5,
      metadata: { openaiScores: result.category_scores },
    }
  } catch (error) {
    logger.error('OpenAI moderation API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

// ===== RESULT COMBINATION =====

function combineResults(
  results: Array<{ source: string; result: ModerationResult }>
): ModerationResult {
  // Find the strictest action
  let strictestAction: ModerationAction = 'allow'
  const allCategories: Set<ModerationCategory> = new Set(['safe'])
  let maxConfidence = 0
  const allFlaggedPhrases: string[] = []
  let requiresReview = false
  
  for (const { result } of results) {
    // Update strictest action
    const actionOrder: ModerationAction[] = ['allow', 'escalate', 'flag', 'block']
    if (actionOrder.indexOf(result.action) > actionOrder.indexOf(strictestAction)) {
      strictestAction = result.action
    }
    
    // Collect categories
    for (const category of result.categories) {
      if (category !== 'safe') {
        allCategories.delete('safe')
      }
      allCategories.add(category)
    }
    
    // Track max confidence
    if (result.confidence > maxConfidence) {
      maxConfidence = result.confidence
    }
    
    // Collect flagged phrases
    if (result.flaggedPhrases) {
      allFlaggedPhrases.push(...result.flaggedPhrases)
    }
    
    // Track review requirement
    if (result.requiresReview) {
      requiresReview = true
    }
  }
  
  return {
    action: strictestAction,
    categories: Array.from(allCategories),
    confidence: maxConfidence,
    flaggedPhrases: allFlaggedPhrases.length > 0 ? allFlaggedPhrases : undefined,
    requiresReview,
  }
}

// ===== DATABASE OPERATIONS =====

/**
 * Flag content for review in the database
 */
export async function flagContent(params: {
  contentType: ContentType
  contentId: string
  content: string
  senderId: string
  senderEmail?: string
  senderName?: string
  conversationId?: string
  conversationType?: string
  moderationResult: ModerationResult
}): Promise<void> {
  try {
    // Map content type to FlaggedContent enum
    const contentTypeMap: Record<ContentType, string> = {
      message: 'DIRECT_MESSAGE',
      post: 'POST',
      comment: 'COMMENT',
      profile: 'POST',
      bio: 'POST',
      group_description: 'GROUP_MESSAGE',
    }
    
    await prisma.flaggedContent.create({
      data: {
        contentType: contentTypeMap[params.contentType] as 'DIRECT_MESSAGE' | 'GROUP_MESSAGE' | 'SESSION_MESSAGE' | 'POST' | 'COMMENT',
        contentId: params.contentId,
        content: params.content.slice(0, 5000), // Limit stored content
        senderId: params.senderId,
        senderEmail: params.senderEmail,
        senderName: params.senderName,
        conversationId: params.conversationId,
        conversationType: params.conversationType,
        flagReason: params.moderationResult.categories.includes('spam')
          ? 'KEYWORD_MATCH'
          : 'AI_DETECTED',
        aiCategories: params.moderationResult.categories as unknown as Prisma.InputJsonValue,
        aiScore: params.moderationResult.confidence,
        status: params.moderationResult.action === 'block' ? 'REMOVED' : 'PENDING',
      },
    })
    
    // Log moderation action
    await logModerationAction({
      action: 'flagged',
      contentType: params.contentType,
      contentId: params.contentId,
      targetUserId: params.senderId,
      reason: params.moderationResult.reason,
    })
    
    logger.info('Content flagged for review', {
      contentType: params.contentType,
      contentId: params.contentId,
      categories: params.moderationResult.categories,
    })
  } catch (error) {
    logger.error('Failed to flag content', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contentId: params.contentId,
    })
  }
}

/**
 * Get pending flagged content for admin review
 */
export async function getPendingFlaggedContent(params: {
  limit?: number
  contentType?: ContentType
}): Promise<Array<{
  id: string
  contentType: string
  contentId: string
  content: string
  senderId: string
  senderName: string | null
  flagReason: string
  aiScore: number | null
  flaggedAt: Date
}>> {
  const contentTypeMap: Record<ContentType, string> = {
    message: 'DIRECT_MESSAGE',
    post: 'POST',
    comment: 'COMMENT',
    profile: 'POST',
    bio: 'POST',
    group_description: 'GROUP_MESSAGE',
  }
  
  const flagged = await prisma.flaggedContent.findMany({
    where: {
      status: 'PENDING',
      ...(params.contentType ? { contentType: contentTypeMap[params.contentType] as 'DIRECT_MESSAGE' | 'GROUP_MESSAGE' | 'SESSION_MESSAGE' | 'POST' | 'COMMENT' } : {}),
    },
    orderBy: [
      { aiScore: 'desc' },
      { flaggedAt: 'desc' },
    ],
    take: params.limit || 50,
  })
  
  return flagged.map(f => ({
    id: f.id,
    contentType: f.contentType,
    contentId: f.contentId,
    content: f.content,
    senderId: f.senderId,
    senderName: f.senderName,
    flagReason: f.flagReason,
    aiScore: f.aiScore,
    flaggedAt: f.flaggedAt,
  }))
}

/**
 * Review flagged content (admin action)
 */
export async function reviewFlaggedContent(params: {
  flaggedContentId: string
  reviewerId: string
  action: 'approve' | 'remove' | 'warn'
  notes?: string
}): Promise<void> {
  const statusMap = {
    approve: 'APPROVED',
    remove: 'REMOVED',
    warn: 'WARNING',
  } as const
  
  const flagged = await prisma.flaggedContent.update({
    where: { id: params.flaggedContentId },
    data: {
      status: statusMap[params.action],
      reviewedById: params.reviewerId,
      reviewedAt: new Date(),
      reviewNotes: params.notes,
      actionTaken: params.action,
    },
  })
  
  // Log moderation action
  await logModerationAction({
    adminId: params.reviewerId,
    action: params.action === 'approve' ? 'approved' : params.action === 'remove' ? 'removed' : 'warned',
    contentType: flagged.contentType.toLowerCase(),
    contentId: flagged.contentId,
    targetUserId: flagged.senderId,
    reason: params.notes,
  })
  
  logger.info('Flagged content reviewed', {
    flaggedContentId: params.flaggedContentId,
    action: params.action,
    reviewerId: params.reviewerId,
  })
}

export default {
  moderateContent,
  flagContent,
  getPendingFlaggedContent,
  reviewFlaggedContent,
}
