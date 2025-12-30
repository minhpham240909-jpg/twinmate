/**
 * AI Partner Streaming Message API
 * POST /api/ai-partner/message/stream - Send message to AI partner with streaming response
 *
 * Enhanced with Intelligence System v2.0:
 * - Intent classification (fast path + AI fallback)
 * - Dynamic response configuration
 * - Adaptive behavior tracking
 * - Memory-aware decisions
 *
 * SCALABILITY: Uses Redis-based rate limiting for 1000-3000 concurrent users
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  sendChatMessageStream,
  moderateContent,
  checkContentSafety,
  AIMessage,
  manageContextWindow,
  generateEducationalImage,
  ImageGenerationStyle,
} from '@/lib/ai-partner/openai'
import { rateLimit } from '@/lib/rate-limit'

// Intelligence System imports
import {
  makeDecision,
  injectDecisionIntoPrompt,
  restoreAdaptiveTracker,
  isLegacySession,
  type SessionContext,
  type MemoryContext,
  DEFAULT_MEMORY_CONTEXT,
} from '@/lib/ai-partner/intelligence'

// AI Partner stream rate limit: 30 messages per minute per user
const AI_PARTNER_STREAM_RATE_LIMIT = {
  max: 30,
  windowMs: 60000,
  keyPrefix: 'ai-partner-stream',
}

/**
 * Detect if user is asking for image generation
 */
function detectImageGenerationRequest(content: string): {
  isImageRequest: boolean
  prompt?: string
  style?: ImageGenerationStyle
} {
  const lowerContent = content.toLowerCase()

  // Keywords that indicate image generation request
  const imageKeywords = [
    // Direct requests - generate
    'generate an image',
    'generate image',
    'generate the image',
    'generate images',
    'generate the images',
    'generate a picture',
    'generate picture',
    'generate the picture',
    'generate pictures',
    'generate the pictures',
    // Direct requests - create
    'create an image',
    'create image',
    'create the image',
    'create images',
    'create the images',
    'create a picture',
    'create picture',
    'create the picture',
    'create pictures',
    // Direct requests - make
    'make an image',
    'make image',
    'make the image',
    'make images',
    'make the images',
    'make a picture',
    'make picture',
    'make the picture',
    'make pictures',
    // Draw
    'draw',
    // Show me
    'show me a picture',
    'show me an image',
    'show me the image',
    'show me the picture',
    'show me pictures',
    'show me images',
    // Visualize / illustrate
    'visualize',
    'illustrate',
    'illustration of',
    'illustration for',
    // Diagrams
    'create a diagram',
    'create diagram',
    'create the diagram',
    'make a diagram',
    'make diagram',
    'generate a diagram',
    'generate diagram',
    'draw a diagram',
    'draw diagram',
    // Illustrations
    'create an illustration',
    'create illustration',
    'make an illustration',
    'generate an illustration',
    // Visuals
    'generate a visual',
    'create a visual',
    'make a visual',
    // Question forms - can you
    'can you draw',
    'can you create an image',
    'can you create image',
    'can you create the image',
    'can you create images',
    'can you create pictures',
    'can you generate an image',
    'can you generate image',
    'can you generate the image',
    'can you generate images',
    'can you generate the images',
    'can you generate pictures',
    'can you generate the pictures',
    'can you make an image',
    'can you make image',
    'can you make the image',
    'can you make images',
    'can you make pictures',
    'can you illustrate',
    // Question forms - could you
    'could you draw',
    'could you create an image',
    'could you generate an image',
    'could you generate the image',
    'could you generate images',
    'could you generate pictures',
    'could you make an image',
    'could you make images',
    'could you illustrate',
    // Please forms
    'please draw',
    'please create an image',
    'please create images',
    'please generate an image',
    'please generate the image',
    'please generate images',
    'please generate pictures',
    'please make an image',
    'please make images',
    'please illustrate',
    // Want/need forms
    'i want an image',
    'i want image',
    'i want the image',
    'i want images',
    'i want pictures',
    'i need an image',
    'i need image',
    'i need images',
    'i need pictures',
    'i want a picture',
    'i need a picture',
    // Show/give forms
    'show me visually',
    'give me an image',
    'give me a picture',
    'give me images',
    'give me pictures',
    // Charts and diagrams
    'create a chart',
    'make a chart',
    'generate a chart',
    'create a flowchart',
    'make a flowchart',
    'create an infographic',
    'make an infographic',
    'create a mindmap',
    'make a mindmap',
    'create a logo',
    'make a logo',
    'design a logo',
    'create a poster',
    'make a poster',
    'design a poster',
  ]

  const isImageRequest = imageKeywords.some(keyword => lowerContent.includes(keyword))

  if (!isImageRequest) {
    return { isImageRequest: false }
  }

  // Determine style based on keywords
  let style: ImageGenerationStyle = 'illustration' // default

  if (lowerContent.includes('diagram')) {
    style = 'diagram'
  } else if (lowerContent.includes('chart') && !lowerContent.includes('flowchart')) {
    style = 'chart'
  } else if (lowerContent.includes('flowchart')) {
    style = 'flowchart'
  } else if (lowerContent.includes('infographic')) {
    style = 'infographic'
  } else if (lowerContent.includes('mindmap') || lowerContent.includes('mind map')) {
    style = 'mindmap'
  } else if (lowerContent.includes('timeline')) {
    style = 'timeline'
  } else if (lowerContent.includes('concept map')) {
    style = 'concept-map'
  } else if (lowerContent.includes('logo')) {
    style = 'logo'
  } else if (lowerContent.includes('poster')) {
    style = 'poster'
  } else if (lowerContent.includes('icon')) {
    style = 'icon'
  } else if (lowerContent.includes('cartoon')) {
    style = 'cartoon'
  } else if (lowerContent.includes('sketch')) {
    style = 'sketch'
  } else if (lowerContent.includes('technical') || lowerContent.includes('blueprint')) {
    style = 'technical'
  } else if (lowerContent.includes('realistic') || lowerContent.includes('photo')) {
    style = 'picture'
  }

  // Extract the prompt - remove the image generation keywords to get the actual subject
  let prompt = content
  for (const keyword of imageKeywords) {
    const regex = new RegExp(keyword, 'gi')
    prompt = prompt.replace(regex, '')
  }
  // Clean up common filler words
  prompt = prompt
    .replace(/^(of|about|for|showing|depicting|with|that shows|that depicts)\s+/i, '')
    .replace(/\s+(of|about|for|showing|depicting|with)\s*$/i, '')
    .replace(/^\s*[,.:;]\s*/, '')
    .replace(/\s*[,.:;]\s*$/, '')
    .trim()

  // If prompt is too short, use the original content
  if (prompt.length < 5) {
    prompt = content
  }

  return { isImageRequest: true, prompt, style }
}

// POST: Send message to AI partner with streaming response
export async function POST(request: NextRequest) {
  try {
    // SCALABILITY: Apply Redis-based rate limiting (works across serverless instances)
    const rateLimitResult = await rateLimit(request, AI_PARTNER_STREAM_RATE_LIMIT)
    if (!rateLimitResult.success) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please slow down.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...rateLimitResult.headers },
      })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json()
    const { sessionId, content, messageType = 'CHAT' } = body

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Message content required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (content.length > 5000) {
      return new Response(JSON.stringify({ error: 'Message too long (max 5000 characters)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get session
    const session = await prisma.aIPartnerSession.findUnique({
      where: { id: sessionId },
      include: {
        persona: true,
        studySession: true,
      },
    })

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (session.userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (session.status !== 'ACTIVE') {
      return new Response(JSON.stringify({ error: 'Session is not active' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check content safety first
    const safetyCheck = await checkContentSafety(content)
    const moderation = await moderateContent(content)

    // Save user message
    const userMsg = await prisma.aIPartnerMessage.create({
      data: {
        sessionId: session.id,
        studySessionId: session.studySessionId,
        role: 'USER',
        content,
        messageType,
        wasModerated: true,
        moderationResult: moderation as unknown as Prisma.InputJsonValue,
        wasFlagged: moderation.flagged,
        flagCategories: Object.entries(moderation.categories)
          .filter(([, v]) => v)
          .map(([k]) => k),
      },
    })

    // If content is unsafe, return safety message (no streaming needed)
    if (!safetyCheck.isSafe) {
      const safetyMessage = safetyCheck.redirectMessage || "Let's focus on studying. What would you like to learn?"

      // Update session with safety block
      await prisma.aIPartnerSession.update({
        where: { id: session.id },
        data: {
          flaggedCount: { increment: 1 },
          wasSafetyBlocked: true,
          status: 'BLOCKED',
          endedAt: new Date(),
        },
      })

      // Save AI response
      const aiMsg = await prisma.aIPartnerMessage.create({
        data: {
          sessionId: session.id,
          studySessionId: session.studySessionId,
          role: 'ASSISTANT',
          content: safetyMessage,
          messageType: 'CHAT',
          wasModerated: false,
        },
      })

      return new Response(JSON.stringify({
        type: 'blocked',
        userMessageId: userMsg.id,
        userMessageWasFlagged: true,
        aiMessageId: aiMsg.id,
        content: safetyMessage,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // IMAGE GENERATION: Check if user is asking for an image
    const imageRequest = detectImageGenerationRequest(content)

    if (imageRequest.isImageRequest && imageRequest.prompt) {
      console.log('[AI Partner Stream] Image generation request detected:', imageRequest)

      try {
        // Generate the image using DALL-E
        const imageResult = await generateEducationalImage({
          prompt: imageRequest.prompt,
          subject: session.subject || undefined,
          skillLevel: session.skillLevel || undefined,
          style: imageRequest.style || 'illustration',
        })

        // Create a friendly response about the generated image
        const imageDescription = `I've created a ${imageRequest.style || 'illustration'} for you! Here's what I visualized based on your request: "${imageRequest.prompt}"`

        // Save AI message with image
        const aiMsg = await prisma.aIPartnerMessage.create({
          data: {
            sessionId: session.id,
            studySessionId: session.studySessionId,
            role: 'ASSISTANT',
            content: imageDescription,
            messageType: 'IMAGE',
            imageUrl: imageResult.imageUrl,
            imageType: 'generated',
            imagePrompt: imageRequest.prompt,
            wasModerated: false,
          },
        })

        // Update session message count
        await prisma.aIPartnerSession.update({
          where: { id: session.id },
          data: {
            messageCount: { increment: 2 },
            ...(moderation.flagged ? { flaggedCount: { increment: 1 } } : {}),
          },
        })

        // Return image generation result (no streaming needed for images)
        return new Response(JSON.stringify({
          type: 'image',
          userMessageId: userMsg.id,
          userMessageWasFlagged: moderation.flagged,
          aiMessageId: aiMsg.id,
          content: imageDescription,
          imageUrl: imageResult.imageUrl,
          revisedPrompt: imageResult.revisedPrompt,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (imageError) {
        console.error('[AI Partner Stream] Image generation failed:', imageError)
        // If image generation fails, fall back to text response
        // Continue with normal streaming response below
      }
    }

    // Get pinned system/persona prompts (keep all) and latest user/assistant messages
    const systemMessages = await prisma.aIPartnerMessage.findMany({
      where: { sessionId: session.id, role: 'SYSTEM' },
      orderBy: { createdAt: 'asc' },
    })

    const conversationMessages = await prisma.aIPartnerMessage.findMany({
      where: { sessionId: session.id, role: { in: ['USER', 'ASSISTANT'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    const limitedHistory = [
      ...systemMessages,
      ...conversationMessages.reverse(),
    ]

    // Build messages array for OpenAI
    let messages: AIMessage[] = limitedHistory.map((msg) => ({
      role: msg.role.toLowerCase() as 'system' | 'user' | 'assistant',
      content: msg.content,
    }))

    // Add the new user message
    messages.push({ role: 'user', content })

    // If content is off-topic, add redirect hint
    if (!safetyCheck.isStudyRelated && safetyCheck.redirectMessage) {
      messages.push({
        role: 'system',
        content: 'The user went off-topic. Gently redirect them back to studying while being friendly.',
      })
    }

    // =========================================================================
    // INTELLIGENCE SYSTEM v2.0
    // Only apply to new sessions (sessions with intelligenceVersion set)
    // Legacy sessions continue with old behavior for compatibility
    // =========================================================================
    let decision = null
    let adaptiveTracker = null
    const useIntelligenceSystem = !isLegacySession(session.intelligenceVersion)

    if (useIntelligenceSystem) {
      try {
        // Restore adaptive tracker from session state
        adaptiveTracker = restoreAdaptiveTracker(
          session.adaptiveState ? JSON.stringify(session.adaptiveState) : null
        )

        // Process user message for adaptive signals
        adaptiveTracker.processUserMessage(content, Date.now())

        // Build session context for decision making
        const sessionContext: SessionContext = {
          sessionId: session.id,
          userId: user.id,
          subject: session.subject,
          skillLevel: session.skillLevel,
          sessionState: 'WORKING', // Will be determined by tracker
          messageCount: session.messageCount,
          totalTokensUsed: session.totalTokensUsed || 0,
          fallbackCallCount: session.fallbackCallCount || 0,
          startedAt: session.startedAt,
          recentMessages: conversationMessages.reverse().map(m => ({
            role: m.role,
            content: m.content,
          })),
          intelligenceVersion: session.intelligenceVersion,
        }

        // Get memory context (simplified - can be enhanced with full memory system)
        const memoryContext: MemoryContext = DEFAULT_MEMORY_CONTEXT

        // Make intelligent decision about how to respond
        decision = await makeDecision(
          content,
          sessionContext,
          memoryContext,
          adaptiveTracker.getState()
        )

        console.log('[AI Partner Stream] Intelligence decision:', {
          intent: decision.meta.intent,
          confidence: decision.meta.confidence,
          style: decision.responseConfig.style,
          usedFallback: decision.meta.usedAIFallback,
          processingTimeMs: decision.meta.processingTimeMs,
        })

        // Inject decision into system prompt (first system message)
        if (messages.length > 0 && messages[0].role === 'system') {
          messages[0].content = injectDecisionIntoPrompt(messages[0].content, decision)
        }
      } catch (intelligenceError) {
        console.error('[AI Partner Stream] Intelligence system error (falling back to default):', intelligenceError)
        // Continue with default behavior if intelligence system fails
        decision = null
      }
    }

    // Trim/summarize context while preserving system prompts
    messages = await manageContextWindow(messages, {
      preserveSystemPrompt: true,
      reserveTokens: 800,
    })

    // Determine max tokens based on decision or default
    const maxTokens = decision?.responseConfig.maxTokens || session.persona?.maxTokens || 500

    // Create a TransformStream to send SSE data
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    // Start streaming in background
    ;(async () => {
      let aiMessageId = ''
      let fullContent = ''

      try {
        // Send initial event with user message info
        await writer.write(encoder.encode(`data: ${JSON.stringify({
          type: 'start',
          userMessageId: userMsg.id,
          userMessageWasFlagged: moderation.flagged,
          // Include intelligence metadata if available
          ...(decision ? {
            intent: decision.meta.intent,
            confidence: decision.meta.confidence,
          } : {}),
        })}\n\n`))

        await sendChatMessageStream(
          messages,
          {
            onToken: async (token) => {
              fullContent += token
              // Send token event
              await writer.write(encoder.encode(`data: ${JSON.stringify({
                type: 'token',
                content: token,
              })}\n\n`))
            },
            onComplete: async (responseContent, usage) => {
              // Update adaptive tracker with AI response
              if (adaptiveTracker) {
                adaptiveTracker.processAIMessage(responseContent)
              }

              // Save AI message to database
              const aiMsg = await prisma.aIPartnerMessage.create({
                data: {
                  sessionId: session.id,
                  studySessionId: session.studySessionId,
                  role: 'ASSISTANT',
                  content: responseContent,
                  messageType,
                  wasModerated: false,
                  promptTokens: usage.promptTokens,
                  completionTokens: usage.completionTokens,
                  totalTokens: usage.totalTokens,
                },
              })
              aiMessageId = aiMsg.id

              // Update session with intelligence tracking
              const sessionUpdate: Prisma.AIPartnerSessionUpdateInput = {
                messageCount: { increment: 2 },
                ...(moderation.flagged ? { flaggedCount: { increment: 1 } } : {}),
              }

              // Add intelligence system updates if applicable
              if (useIntelligenceSystem && adaptiveTracker) {
                sessionUpdate.adaptiveState = adaptiveTracker.getState() as unknown as Prisma.InputJsonValue
                sessionUpdate.totalTokensUsed = { increment: usage.totalTokens }
                if (decision?.meta.usedAIFallback) {
                  sessionUpdate.fallbackCallCount = { increment: 1 }
                }
              }

              await prisma.aIPartnerSession.update({
                where: { id: session.id },
                data: sessionUpdate,
              })

              // Send complete event
              await writer.write(encoder.encode(`data: ${JSON.stringify({
                type: 'complete',
                aiMessageId,
                content: responseContent,
                // Include intelligence metadata if available
                ...(decision ? {
                  intent: decision.meta.intent,
                  style: decision.responseConfig.style,
                } : {}),
              })}\n\n`))

              await writer.close()
            },
            onError: async (error) => {
              console.error('[AI Partner Stream] Error:', error)
              await writer.write(encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                error: error.message,
              })}\n\n`))
              await writer.close()
            },
          },
          {
            temperature: session.persona?.temperature || 0.7,
            maxTokens,
          }
        )
      } catch (err) {
        console.error('[AI Partner Stream] Outer error:', err)
        await writer.write(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          error: 'Failed to stream response',
        })}\n\n`))
        await writer.close()
      }
    })()

    // Return the stream as SSE response
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[AI Partner] Stream message error:', error)
    return new Response(JSON.stringify({ error: 'Failed to send message' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
