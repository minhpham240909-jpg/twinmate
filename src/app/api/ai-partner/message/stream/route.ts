/**
 * AI Partner Streaming Message API
 * POST /api/ai-partner/message/stream - Send message to AI partner with streaming response
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
} from '@/lib/ai-partner/openai'

// Simple per-user rate limit to protect OpenAI/DB (30 requests per minute)
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30
const rateLimitMap = new Map<string, number[]>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(userId) || []
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  recent.push(now)
  rateLimitMap.set(userId, recent)
  return recent.length > RATE_LIMIT_MAX
}

// POST: Send message to AI partner with streaming response
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (isRateLimited(user.id)) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please slow down.' }), {
        status: 429,
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

    // Trim/summarize context while preserving system prompts
    messages = await manageContextWindow(messages, {
      preserveSystemPrompt: true,
      reserveTokens: 800,
    })

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
            onComplete: async (content, usage) => {
              // Save AI message to database
              const aiMsg = await prisma.aIPartnerMessage.create({
                data: {
                  sessionId: session.id,
                  studySessionId: session.studySessionId,
                  role: 'ASSISTANT',
                  content,
                  messageType,
                  wasModerated: false,
                  promptTokens: usage.promptTokens,
                  completionTokens: usage.completionTokens,
                  totalTokens: usage.totalTokens,
                },
              })
              aiMessageId = aiMsg.id

              // Update session message count
              await prisma.aIPartnerSession.update({
                where: { id: session.id },
                data: {
                  messageCount: { increment: 2 },
                  ...(moderation.flagged ? { flaggedCount: { increment: 1 } } : {}),
                },
              })

              // Send complete event
              await writer.write(encoder.encode(`data: ${JSON.stringify({
                type: 'complete',
                aiMessageId,
                content,
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
            maxTokens: session.persona?.maxTokens || 500,
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
