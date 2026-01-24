// Content Moderation API - Scan messages for inappropriate content
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// OpenAI Moderation API endpoint
const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations'

// Categories that OpenAI flags
interface ModerationCategories {
  sexual: boolean
  hate: boolean
  harassment: boolean
  'self-harm': boolean
  'sexual/minors': boolean
  'hate/threatening': boolean
  'violence/graphic': boolean
  violence: boolean
  'harassment/threatening': boolean
  'self-harm/intent': boolean
  'self-harm/instructions': boolean
}

interface ModerationResult {
  flagged: boolean
  categories: ModerationCategories
  category_scores: Record<string, number>
}

// Scan content using OpenAI Moderation API
async function scanWithOpenAI(content: string): Promise<ModerationResult | null> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.warn('OpenAI API key not configured, skipping AI moderation')
    return null
  }

  try {
    const response = await fetch(OPENAI_MODERATION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: content }),
    })

    if (!response.ok) {
      console.error('OpenAI Moderation API error:', response.status)
      return null
    }

    const data = await response.json()
    return data.results?.[0] || null
  } catch (error) {
    console.error('OpenAI Moderation API error:', error)
    return null
  }
}

// Banned keywords list (basic profanity filter)
// Add your banned keywords here - this is a basic list you may want to expand
const BANNED_KEYWORDS: readonly string[] = [] as const

// Check for banned keywords
function checkBannedKeywords(content: string): string[] {
  const lowerContent = content.toLowerCase()
  return BANNED_KEYWORDS.filter((keyword: string) =>
    lowerContent.includes(keyword.toLowerCase())
  )
}

// POST - Scan content for moderation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      content,
      contentType, // DIRECT_MESSAGE, GROUP_MESSAGE, SESSION_MESSAGE, POST, COMMENT
      contentId,
      senderId,
      senderEmail,
      senderName,
      conversationId,
      conversationType,
    } = body

    if (!content || !contentType || !contentId || !senderId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    let shouldFlag = false
    let flagReason: 'AI_DETECTED' | 'KEYWORD_MATCH' | null = null
    let aiCategories: Record<string, boolean> | null = null
    let aiScore: number | null = null

    // Check banned keywords first (fast, no API call)
    const matchedKeywords = checkBannedKeywords(content)
    if (matchedKeywords.length > 0) {
      shouldFlag = true
      flagReason = 'KEYWORD_MATCH'
      aiCategories = { keyword_match: true, matched_keywords: matchedKeywords as any }
    }

    // Scan with OpenAI if no keyword match (or always for thorough scanning)
    if (!shouldFlag || process.env.ALWAYS_SCAN_AI === 'true') {
      const aiResult = await scanWithOpenAI(content)

      if (aiResult?.flagged) {
        shouldFlag = true
        flagReason = 'AI_DETECTED'
        aiCategories = aiResult.categories as any

        // Get the highest score
        const scores = Object.values(aiResult.category_scores)
        aiScore = Math.max(...scores)
      }
    }

    // If content should be flagged, create a FlaggedContent record
    if (shouldFlag && flagReason) {
      await prisma.flaggedContent.create({
        data: {
          contentType: contentType as any,
          contentId,
          content,
          senderId,
          senderEmail,
          senderName,
          conversationId,
          conversationType,
          flagReason,
          aiCategories: aiCategories as any,
          aiScore,
          status: 'PENDING',
        },
      })

      console.log(`[Moderation] Content flagged: ${contentType} ${contentId} - ${flagReason}`)
    }

    return NextResponse.json({
      success: true,
      flagged: shouldFlag,
      flagReason,
      categories: aiCategories,
      score: aiScore,
    })
  } catch (error) {
    console.error('Content moderation error:', error)
    // SECURITY FIX: On moderation errors, return 503 to indicate service unavailable
    // Callers should decide whether to block or allow content when moderation fails
    return NextResponse.json(
      {
        success: false,
        flagged: null, // Unknown - moderation failed
        error: 'Moderation service temporarily unavailable',
        retryable: true,
      },
      { status: 503 }
    )
  }
}
