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
 * SCALABILITY: Uses Redis-based rate limiting and per-user quota for 1000-3000 concurrent users
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
import { enforceQuota } from '@/lib/ai-partner/quota'
import {
  sanitizePromptInput,
  getInjectionErrorMessage,
  wrapUserContent,
} from '@/lib/ai-partner/prompt-security'

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
 * Uses smart pattern matching instead of exact phrases for better detection
 */
function detectImageGenerationRequest(content: string): {
  isImageRequest: boolean
  prompt?: string
  style?: ImageGenerationStyle
} {
  const lowerContent = content.toLowerCase()

  // ==========================================================================
  // SMART PATTERN-BASED DETECTION
  // ==========================================================================

  // Action verbs that indicate creation/generation
  const actionVerbs = [
    'generate', 'create', 'make', 'draw', 'design', 'build', 'produce',
    'render', 'illustrate', 'visualize', 'sketch', 'paint', 'show', 'give'
  ]

  // Visual content types (what the user wants created)
  const visualTypes = [
    'image', 'images', 'picture', 'pictures', 'photo', 'photos',
    'diagram', 'diagrams', 'illustration', 'illustrations',
    'chart', 'charts', 'graph', 'graphs',
    'flowchart', 'flowcharts', 'flow chart', 'flow charts',
    'infographic', 'infographics',
    'mindmap', 'mindmaps', 'mind map', 'mind maps',
    'timeline', 'timelines', 'time line', 'time lines',
    'concept map', 'concept maps', 'conceptmap', 'conceptmaps',
    'visual', 'visuals', 'visualization', 'visualizations',
    'logo', 'logos', 'icon', 'icons',
    'poster', 'posters', 'banner', 'banners',
    'sketch', 'sketches', 'drawing', 'drawings',
    'graphic', 'graphics', 'artwork', 'art',
    'figure', 'figures', 'representation', 'depiction'
  ]

  let isImageRequest = false

  // Method 1: Check for action verb + visual type combination
  // e.g., "generate a diagram", "create an illustration", "make me an image"
  for (const verb of actionVerbs) {
    if (lowerContent.includes(verb)) {
      for (const visualType of visualTypes) {
        if (lowerContent.includes(visualType)) {
          isImageRequest = true
          break
        }
      }
      if (isImageRequest) break
    }
  }

  // Method 2: Check for request patterns with visual types
  // e.g., "can you show me a diagram", "i want an image of"
  if (!isImageRequest) {
    const requestPatterns = [
      'can you', 'could you', 'would you', 'will you',
      'please', 'i want', 'i need', 'i would like',
      'help me', 'show me', 'give me', 'get me',
      'let me see', "i'd like", 'id like'
    ]

    for (const pattern of requestPatterns) {
      if (lowerContent.includes(pattern)) {
        for (const visualType of visualTypes) {
          if (lowerContent.includes(visualType)) {
            isImageRequest = true
            break
          }
        }
        if (isImageRequest) break
      }
    }
  }

  // Method 3: Check for direct visual requests without action verbs
  // e.g., "a diagram of photosynthesis", "picture of a cell"
  if (!isImageRequest) {
    const directPatterns = [
      /\b(a|an|the)\s+(image|picture|diagram|illustration|chart|graph|flowchart|infographic|visual|sketch|drawing)\s+(of|for|about|showing)/i,
      /\b(image|picture|diagram|illustration|chart|graph|flowchart|infographic|visual|sketch|drawing)\s+(of|for|about|showing)/i,
    ]
    for (const pattern of directPatterns) {
      if (pattern.test(lowerContent)) {
        isImageRequest = true
        break
      }
    }
  }

  // Method 4: Check for "what does X look like" patterns
  if (!isImageRequest) {
    const lookLikePatterns = [
      /what\s+(does|do)\s+.+\s+look\s+like/i,
      /show\s+(me\s+)?(what|how)\s+.+\s+(looks?|appears?)/i,
      /visualize\s+(this|that|it|the)/i,
    ]
    for (const pattern of lookLikePatterns) {
      if (pattern.test(lowerContent)) {
        isImageRequest = true
        break
      }
    }
  }

  if (!isImageRequest) {
    return { isImageRequest: false }
  }

  // ==========================================================================
  // DETERMINE STYLE BASED ON CONTENT
  // ==========================================================================
  let style: ImageGenerationStyle = 'illustration' // default

  if (lowerContent.includes('diagram')) {
    style = 'diagram'
  } else if (lowerContent.includes('flowchart') || lowerContent.includes('flow chart')) {
    style = 'flowchart'
  } else if (lowerContent.includes('chart') || lowerContent.includes('graph')) {
    style = 'chart'
  } else if (lowerContent.includes('infographic')) {
    style = 'infographic'
  } else if (lowerContent.includes('mindmap') || lowerContent.includes('mind map')) {
    style = 'mindmap'
  } else if (lowerContent.includes('timeline') || lowerContent.includes('time line')) {
    style = 'timeline'
  } else if (lowerContent.includes('concept map')) {
    style = 'concept-map'
  } else if (lowerContent.includes('logo')) {
    style = 'logo'
  } else if (lowerContent.includes('poster') || lowerContent.includes('banner')) {
    style = 'poster'
  } else if (lowerContent.includes('icon')) {
    style = 'icon'
  } else if (lowerContent.includes('cartoon') || lowerContent.includes('anime')) {
    style = 'cartoon'
  } else if (lowerContent.includes('sketch') || lowerContent.includes('drawing')) {
    style = 'sketch'
  } else if (lowerContent.includes('technical') || lowerContent.includes('blueprint') || lowerContent.includes('schematic')) {
    style = 'technical'
  } else if (lowerContent.includes('realistic') || lowerContent.includes('photo') || lowerContent.includes('real')) {
    style = 'picture'
  }

  // ==========================================================================
  // EXTRACT PROMPT - Get the actual subject matter
  // ==========================================================================
  let prompt = content

  // Remove common request phrases to extract the core subject
  const phrasesToRemove = [
    /^(can you|could you|would you|will you|please|help me|i want|i need|i would like|i'd like)\s*/i,
    /\b(generate|create|make|draw|design|build|produce|render|illustrate|visualize|sketch|paint|show|give)\s+(me\s+)?(a|an|the)?\s*/gi,
    /\b(image|picture|photo|diagram|illustration|chart|graph|flowchart|infographic|visual|visualization|logo|icon|poster|banner|sketch|drawing|graphic|artwork|art|figure)\s+(of|for|about|showing|depicting)?\s*/gi,
    /\bof\s+$/i,
    /\bfor\s+$/i,
  ]

  for (const pattern of phrasesToRemove) {
    prompt = prompt.replace(pattern, '')
  }

  // Clean up
  prompt = prompt
    .replace(/^\s*[,.:;!?]\s*/, '')
    .replace(/\s*[,.:;!?]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()

  // If prompt is too short after cleaning, use original content
  if (prompt.length < 3) {
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

    // SCALABILITY: Check per-user daily quota
    const quotaCheck = await enforceQuota(user.id)
    if (!quotaCheck.allowed) {
      return new Response(JSON.stringify({
        error: quotaCheck.error!.message,
        quotaExceeded: true,
      }), {
        status: quotaCheck.error!.status,
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

    // SECURITY: Check for prompt injection attempts
    const injectionCheck = sanitizePromptInput(content, {
      maxLength: 5000,
      stripPatterns: false, // Reject instead of strip
      logDetections: true,
      userId: user.id,
    })

    if (!injectionCheck.isSafe) {
      console.warn('[AI Partner Stream] Prompt injection detected', {
        userId: user.id,
        riskLevel: injectionCheck.riskLevel,
        patterns: injectionCheck.detectedPatterns.map(p => p.description),
      })

      return new Response(JSON.stringify({
        error: getInjectionErrorMessage(injectionCheck.riskLevel),
        type: 'injection_blocked',
        riskLevel: injectionCheck.riskLevel,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Use sanitized content for further processing
    const sanitizedContent = injectionCheck.sanitizedContent || content

    // N+1 FIX: Fetch session with optimized query - only select fields we need
    // This reduces data transfer and prevents loading unnecessary relations
    const session = await prisma.aIPartnerSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        status: true,
        subject: true,
        skillLevel: true,
        studySessionId: true,
        messageCount: true,
        totalTokensUsed: true,
        fallbackCallCount: true,
        startedAt: true,
        intelligenceVersion: true,
        adaptiveState: true,
        persona: {
          select: {
            temperature: true,
            maxTokens: true,
          },
        },
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

    // N+1 FIX: Run content safety and moderation checks in parallel
    // These are independent operations that can run concurrently
    const [safetyCheck, moderation] = await Promise.all([
      checkContentSafety(sanitizedContent),
      moderateContent(sanitizedContent),
    ])

    // Save user message (store sanitized content)
    const userMsg = await prisma.aIPartnerMessage.create({
      data: {
        sessionId: session.id,
        studySessionId: session.studySessionId,
        role: 'USER',
        content: sanitizedContent,
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

    // IMAGE GENERATION: Check if user is asking for an image (using sanitized content)
    const imageRequest = detectImageGenerationRequest(sanitizedContent)

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

    // N+1 FIX: Fetch system and conversation messages in parallel
    // These are independent queries that can run concurrently
    const [systemMessages, conversationMessages] = await Promise.all([
      prisma.aIPartnerMessage.findMany({
        where: { sessionId: session.id, role: 'SYSTEM' },
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true }, // Only select needed fields
      }),
      prisma.aIPartnerMessage.findMany({
        where: { sessionId: session.id, role: { in: ['USER', 'ASSISTANT'] } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { role: true, content: true }, // Only select needed fields
      }),
    ])

    const limitedHistory = [
      ...systemMessages,
      ...conversationMessages.reverse(),
    ]

    // Build messages array for OpenAI
    let messages: AIMessage[] = limitedHistory.map((msg) => ({
      role: msg.role.toLowerCase() as 'system' | 'user' | 'assistant',
      content: msg.content,
    }))

    // Add the new user message (use sanitized content)
    messages.push({ role: 'user', content: sanitizedContent })

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

        // Process user message for adaptive signals (use sanitized content)
        adaptiveTracker.processUserMessage(sanitizedContent, Date.now())

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

        // Make intelligent decision about how to respond (use sanitized content)
        decision = await makeDecision(
          sanitizedContent,
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

    // SCALE: Streaming timeout (60 seconds max) to prevent hanging connections
    const STREAM_TIMEOUT_MS = 60000
    let streamTimeoutId: NodeJS.Timeout | null = null
    let isStreamClosed = false

    const closeStreamWithTimeout = async () => {
      if (isStreamClosed) return
      isStreamClosed = true
      if (streamTimeoutId) clearTimeout(streamTimeoutId)
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          error: 'Response timeout - please try again',
        })}\n\n`))
        await writer.close()
      } catch {
        // Writer may already be closed
      }
    }

    // Start streaming in background
    ;(async () => {
      let aiMessageId = ''
      let fullContent = ''

      // SCALE: Set timeout to close stream if it hangs
      streamTimeoutId = setTimeout(() => {
        console.warn('[AI Partner Stream] Timeout after', STREAM_TIMEOUT_MS, 'ms for session:', sessionId)
        closeStreamWithTimeout()
      }, STREAM_TIMEOUT_MS)

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

              // SCALE: Clear timeout on successful completion
              if (streamTimeoutId) clearTimeout(streamTimeoutId)
              isStreamClosed = true

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
              // SCALE: Clear timeout on error
              if (streamTimeoutId) clearTimeout(streamTimeoutId)
              isStreamClosed = true

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
        // SCALE: Clear timeout on outer error
        if (streamTimeoutId) clearTimeout(streamTimeoutId)
        if (isStreamClosed) return

        isStreamClosed = true
        console.error('[AI Partner Stream] Outer error:', err)
        try {
          await writer.write(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: 'Failed to stream response',
          })}\n\n`))
          await writer.close()
        } catch {
          // Writer may already be closed
        }
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
