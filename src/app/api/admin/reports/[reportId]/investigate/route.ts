/**
 * Admin Report Investigation API
 * Fetches all data needed to investigate a report:
 * - Conversation history between reporter and reported user
 * - User history (previous reports, warnings, bans)
 * - Message patterns and activity
 * - AI analysis of content
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify admin status
    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { reportId } = await params

    // Get the report with full details
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
        reportedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
            deactivatedAt: true,
            deactivationReason: true,
          },
        },
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const reporterId = report.reporterId
    const reportedUserId = report.reportedUserId

    // Fetch all investigation data in parallel
    const [
      conversation,
      reportedUserHistory,
      reporterHistory,
      reportedUserBan,
      reportedUserWarnings,
      reportedUserActivity,
      relatedContent,
    ] = await Promise.all([
      // 1. Conversation between reporter and reported user (if both exist)
      reportedUserId ? getConversation(reporterId, reportedUserId) : null,

      // 2. Reports against the reported user
      reportedUserId ? getReportsAgainstUser(reportedUserId) : null,

      // 3. Reports made by the reporter (to check for false reporting patterns)
      getReportsMadeByUser(reporterId),

      // 4. Check if reported user is already banned
      reportedUserId ? prisma.userBan.findUnique({
        where: { userId: reportedUserId },
      }) : null,

      // 5. Warnings issued to reported user
      reportedUserId ? prisma.userWarning.findMany({
        where: { userId: reportedUserId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }) : [],

      // 6. Recent activity of reported user
      reportedUserId ? getRecentActivity(reportedUserId) : null,

      // 7. Get the specific content being reported (if contentId exists)
      report.contentId ? getRelatedContent(report.contentType, report.contentId) : null,
    ])

    // Analyze content for violations
    const aiAnalysis = await analyzeContent(report, conversation, relatedContent)

    return NextResponse.json({
      success: true,
      data: {
        report,
        investigation: {
          conversation,
          reportedUserHistory: {
            reportsAgainst: reportedUserHistory,
            currentBan: reportedUserBan,
            warnings: reportedUserWarnings,
            recentActivity: reportedUserActivity,
          },
          reporterHistory: {
            reportsMade: reporterHistory,
            falseReportCount: reporterHistory?.filter((r: { status: string }) => r.status === 'DISMISSED').length || 0,
          },
          relatedContent,
          aiAnalysis,
        },
      },
    })
  } catch (error) {
    console.error('[Investigation API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Get conversation/messages between two users
 */
async function getConversation(userId1: string, userId2: string) {
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId1, recipientId: userId2 },
        { senderId: userId2, recipientId: userId1 },
      ],
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
    take: 100, // Last 100 messages
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  })

  // Extract patterns for analysis
  const messageStats = {
    totalMessages: messages.length,
    messagesByUser1: messages.filter(m => m.senderId === userId1).length,
    messagesByUser2: messages.filter(m => m.senderId === userId2).length,
    linksShared: messages.filter(m => containsUrl(m.content)).length,
    flaggedContent: messages.filter(m => containsSuspiciousContent(m.content)),
  }

  return {
    messages,
    stats: messageStats,
  }
}

/**
 * Get reports filed against a user
 */
async function getReportsAgainstUser(userId: string) {
  return prisma.report.findMany({
    where: { reportedUserId: userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      reporter: {
        select: { name: true, email: true },
      },
    },
  })
}

/**
 * Get reports made by a user (to check for abuse of reporting)
 */
async function getReportsMadeByUser(userId: string) {
  return prisma.report.findMany({
    where: { reporterId: userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      reportedUser: {
        select: { name: true, email: true },
      },
    },
  })
}

/**
 * Get recent activity of a user
 */
async function getRecentActivity(userId: string) {
  const [messageCount, groupMemberships, studySessions, matchCount] = await Promise.all([
    // Message count in last 7 days
    prisma.message.count({
      where: {
        senderId: userId,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    // Groups joined
    prisma.groupMember.count({
      where: { userId },
    }),
    // Study sessions participated
    prisma.sessionParticipant.count({
      where: { userId },
    }),
    // Matches
    prisma.match.count({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        status: 'ACCEPTED',
      },
    }),
  ])

  return {
    messagesLast7Days: messageCount,
    groupMemberships,
    studySessions,
    partnerConnections: matchCount,
  }
}

/**
 * Get the specific content being reported
 */
async function getRelatedContent(contentType: string, contentId: string) {
  switch (contentType) {
    case 'message':
      return prisma.message.findUnique({
        where: { id: contentId },
        include: {
          sender: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      })
    case 'group':
      return prisma.group.findUnique({
        where: { id: contentId },
        select: {
          id: true,
          name: true,
          description: true,
          subject: true,
          ownerId: true,
          createdAt: true,
        },
      })
    case 'post':
      return prisma.post.findUnique({
        where: { id: contentId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      })
    default:
      return null
  }
}

/**
 * Check if text contains URLs
 */
function containsUrl(text: string): boolean {
  const urlRegex = /(https?:\/\/[^\s]+)|((www\.)[^\s]+)/gi
  return urlRegex.test(text)
}

/**
 * Check for suspicious content patterns
 */
function containsSuspiciousContent(text: string): boolean {
  const lowerText = text.toLowerCase()
  const suspiciousPatterns = [
    // Scam indicators
    /\b(send|transfer|wire|payment|paypal|venmo|cashapp|zelle|bitcoin|crypto|btc|eth)\b/i,
    /\b(urgent|immediately|right now|asap|hurry)\b/i,
    /\b(bank\s*account|card\s*number|ssn|social\s*security)\b/i,
    /\b(lottery|winner|prize|inheritance|million\s*dollars)\b/i,
    // Harassment indicators
    /\b(kill|die|death|threat|hurt|harm)\b/i,
    /\b(hate|stupid|idiot|loser|worthless)\b/i,
    // Spam indicators
    /\b(click\s*here|free\s*money|discount|limited\s*time)\b/i,
    // External links to suspicious sites
    /bit\.ly|tinyurl|goo\.gl/i,
  ]

  return suspiciousPatterns.some(pattern => pattern.test(lowerText))
}

/**
 * AI-powered content analysis
 */
async function analyzeContent(
  report: any,
  conversation: any,
  relatedContent: any
) {
  const analysis: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    confidence: number
    findings: Array<{
      type: string
      description: string
      severity: 'info' | 'warning' | 'danger'
      evidence?: string
    }>
    recommendation: string
    automatedFlags: string[]
  } = {
    riskLevel: 'LOW',
    confidence: 0,
    findings: [],
    recommendation: '',
    automatedFlags: [],
  }

  let riskScore = 0

  // Analyze based on report type
  switch (report.type) {
    case 'SCAM':
      riskScore += analyzeForScam(analysis, conversation, relatedContent)
      break
    case 'HARASSMENT':
      riskScore += analyzeForHarassment(analysis, conversation, relatedContent)
      break
    case 'SPAM':
      riskScore += analyzeForSpam(analysis, conversation, relatedContent)
      break
    case 'HATE_SPEECH':
      riskScore += analyzeForHateSpeech(analysis, conversation, relatedContent)
      break
    case 'VIOLENCE':
      riskScore += analyzeForViolence(analysis, conversation, relatedContent)
      break
    case 'INAPPROPRIATE_CONTENT':
      riskScore += analyzeForInappropriate(analysis, conversation, relatedContent)
      break
    case 'FAKE_ACCOUNT':
      riskScore += analyzeForFakeAccount(analysis, conversation, relatedContent)
      break
    default:
      // Generic analysis
      riskScore += genericAnalysis(analysis, conversation, relatedContent)
  }

  // Set risk level based on score
  if (riskScore >= 80) {
    analysis.riskLevel = 'CRITICAL'
    analysis.recommendation = 'Immediate action recommended. Strong evidence of violation.'
  } else if (riskScore >= 50) {
    analysis.riskLevel = 'HIGH'
    analysis.recommendation = 'Review conversation carefully. Multiple indicators present.'
  } else if (riskScore >= 25) {
    analysis.riskLevel = 'MEDIUM'
    analysis.recommendation = 'Some concerning patterns detected. Manual review needed.'
  } else {
    analysis.riskLevel = 'LOW'
    analysis.recommendation = 'Limited evidence found. May be a misunderstanding or false report.'
  }

  analysis.confidence = Math.min(riskScore, 100)

  return analysis
}

function analyzeForScam(analysis: any, conversation: any, _content: any): number {
  let score = 0

  if (!conversation?.messages) return score

  const messages = conversation.messages
  const allText = messages.map((m: any) => m.content).join(' ').toLowerCase()

  // Check for payment-related keywords
  const paymentKeywords = ['payment', 'pay', 'send money', 'transfer', 'paypal', 'venmo', 'cashapp', 'zelle', 'bitcoin', 'crypto', 'bank account', 'wire']
  const paymentMentions = paymentKeywords.filter(k => allText.includes(k))
  if (paymentMentions.length > 0) {
    score += paymentMentions.length * 15
    analysis.findings.push({
      type: 'Payment Keywords',
      description: `Found payment-related terms: ${paymentMentions.join(', ')}`,
      severity: 'danger',
      evidence: paymentMentions.join(', '),
    })
    analysis.automatedFlags.push('PAYMENT_MENTIONED')
  }

  // Check for urgency language
  const urgencyWords = ['urgent', 'immediately', 'right now', 'asap', 'hurry', 'quick', 'fast']
  const urgencyFound = urgencyWords.filter(w => allText.includes(w))
  if (urgencyFound.length > 0) {
    score += 10
    analysis.findings.push({
      type: 'Urgency Language',
      description: 'Messages contain urgency pressure tactics',
      severity: 'warning',
    })
    analysis.automatedFlags.push('URGENCY_TACTICS')
  }

  // Check for external links
  if (conversation.stats?.linksShared > 0) {
    score += conversation.stats.linksShared * 5
    analysis.findings.push({
      type: 'External Links',
      description: `${conversation.stats.linksShared} external links shared in conversation`,
      severity: 'warning',
    })
  }

  return score
}

function analyzeForHarassment(analysis: any, conversation: any, _content: any): number {
  let score = 0

  if (!conversation?.messages) return score

  const messages = conversation.messages
  const allText = messages.map((m: any) => m.content).join(' ').toLowerCase()

  // Check message frequency imbalance
  const stats = conversation.stats
  if (stats.messagesByUser1 > 0 && stats.messagesByUser2 > 0) {
    const ratio = Math.max(stats.messagesByUser1, stats.messagesByUser2) /
                  Math.min(stats.messagesByUser1, stats.messagesByUser2)
    if (ratio > 5) {
      score += 20
      analysis.findings.push({
        type: 'Message Imbalance',
        description: `Severe message imbalance (${ratio.toFixed(1)}:1 ratio) - possible one-sided harassment`,
        severity: 'warning',
      })
      analysis.automatedFlags.push('MESSAGE_IMBALANCE')
    }
  }

  // Check for insulting language
  const insultWords = ['stupid', 'idiot', 'dumb', 'ugly', 'loser', 'pathetic', 'worthless', 'hate you']
  const insultsFound = insultWords.filter(w => allText.includes(w))
  if (insultsFound.length > 0) {
    score += insultsFound.length * 10
    analysis.findings.push({
      type: 'Insulting Language',
      description: `Found insulting terms in conversation`,
      severity: 'danger',
      evidence: `${insultsFound.length} instances detected`,
    })
    analysis.automatedFlags.push('INSULTS_DETECTED')
  }

  // Check for repeated messaging after being ignored
  // (if one user sends many messages without responses)
  let consecutiveUnanswered = 0
  let maxConsecutive = 0
  let lastSenderId: string | null = null
  for (const msg of messages) {
    if (msg.senderId === lastSenderId) {
      consecutiveUnanswered++
      maxConsecutive = Math.max(maxConsecutive, consecutiveUnanswered)
    } else {
      consecutiveUnanswered = 1
      lastSenderId = msg.senderId
    }
  }
  if (maxConsecutive > 5) {
    score += 15
    analysis.findings.push({
      type: 'Repeated Messaging',
      description: `${maxConsecutive} consecutive messages without response - possible harassment pattern`,
      severity: 'warning',
    })
  }

  return score
}

function analyzeForSpam(analysis: any, conversation: any, _content: any): number {
  let score = 0

  if (!conversation?.messages) return score

  const messages = conversation.messages

  // Check for duplicate messages
  const messageContents = messages.map((m: any) => m.content.trim().toLowerCase())
  const duplicates = messageContents.filter((item: string, index: number) =>
    messageContents.indexOf(item) !== index
  )
  if (duplicates.length > 2) {
    score += duplicates.length * 10
    analysis.findings.push({
      type: 'Duplicate Messages',
      description: `${duplicates.length} duplicate messages detected - spam pattern`,
      severity: 'danger',
    })
    analysis.automatedFlags.push('DUPLICATE_MESSAGES')
  }

  // Check for promotional content
  const promoWords = ['buy', 'sale', 'discount', 'free', 'offer', 'limited time', 'click here', 'subscribe']
  const allText = messages.map((m: any) => m.content).join(' ').toLowerCase()
  const promoFound = promoWords.filter(w => allText.includes(w))
  if (promoFound.length > 2) {
    score += 25
    analysis.findings.push({
      type: 'Promotional Content',
      description: 'Messages contain promotional/advertising language',
      severity: 'warning',
    })
    analysis.automatedFlags.push('PROMOTIONAL_CONTENT')
  }

  return score
}

function analyzeForHateSpeech(analysis: any, conversation: any, _content: any): number {
  let score = 0

  if (!conversation?.messages) return score

  const allText = conversation.messages.map((m: any) => m.content).join(' ').toLowerCase()

  // Check for slurs and hate terms (generic patterns)
  const hateSpeechIndicators = [
    /\b(hate|hating)\s+(all|every|those)\b/i,
    /\b(should\s+die|deserve\s+to\s+die)\b/i,
    /\b(go\s+back\s+to)\b/i,
  ]

  const hateFound = hateSpeechIndicators.filter(pattern => pattern.test(allText))
  if (hateFound.length > 0) {
    score += hateFound.length * 30
    analysis.findings.push({
      type: 'Hate Speech Indicators',
      description: 'Messages contain potential hate speech patterns',
      severity: 'danger',
    })
    analysis.automatedFlags.push('HATE_SPEECH_DETECTED')
  }

  return score
}

function analyzeForViolence(analysis: any, conversation: any, _content: any): number {
  let score = 0

  if (!conversation?.messages) return score

  const allText = conversation.messages.map((m: any) => m.content).join(' ').toLowerCase()

  // Check for violent threats
  const violentPatterns = [
    /\b(kill|murder|hurt|harm|attack)\s+(you|him|her|them)\b/i,
    /\b(i('ll|m\s+going\s+to)|gonna)\s+(kill|hurt|beat|attack)\b/i,
    /\b(watch\s+your\s+back|you('re|r)\s+dead)\b/i,
    /\b(gun|knife|weapon|bomb)\b/i,
  ]

  const violentFound = violentPatterns.filter(pattern => pattern.test(allText))
  if (violentFound.length > 0) {
    score += violentFound.length * 40
    analysis.findings.push({
      type: 'Violent Threats',
      description: 'CRITICAL: Messages contain potential violent threats',
      severity: 'danger',
    })
    analysis.automatedFlags.push('VIOLENCE_THREAT_DETECTED')
    analysis.automatedFlags.push('REQUIRES_IMMEDIATE_REVIEW')
  }

  return score
}

function analyzeForInappropriate(analysis: any, conversation: any, _content: any): number {
  let score = 0

  if (!conversation?.messages) return score

  // Check for file attachments
  const messagesWithFiles = conversation.messages.filter((m: any) => m.fileUrl)
  if (messagesWithFiles.length > 0) {
    analysis.findings.push({
      type: 'File Attachments',
      description: `${messagesWithFiles.length} files shared - manual review of content recommended`,
      severity: 'info',
    })
    score += 10
  }

  // Check for explicit language patterns
  const allText = conversation.messages.map((m: any) => m.content).join(' ').toLowerCase()
  const adultPatterns = [/\b(nsfw|explicit|nude|naked)\b/i]
  if (adultPatterns.some(p => p.test(allText))) {
    score += 30
    analysis.findings.push({
      type: 'Explicit Content Indicators',
      description: 'Messages may contain references to explicit content',
      severity: 'warning',
    })
    analysis.automatedFlags.push('EXPLICIT_CONTENT_POSSIBLE')
  }

  return score
}

function analyzeForFakeAccount(analysis: any, _conversation: any, content: any): number {
  let score = 0

  // Check profile completeness
  if (content?.reportedUser) {
    const user = content.reportedUser
    const accountAge = Date.now() - new Date(user.createdAt).getTime()
    const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24)

    if (daysSinceCreation < 7) {
      score += 20
      analysis.findings.push({
        type: 'New Account',
        description: `Account created ${Math.floor(daysSinceCreation)} days ago`,
        severity: 'warning',
      })
    }

    if (!user.avatarUrl) {
      score += 10
      analysis.findings.push({
        type: 'No Profile Picture',
        description: 'Account has no profile picture',
        severity: 'info',
      })
    }
  }

  return score
}

function genericAnalysis(analysis: any, conversation: any, _content: any): number {
  let score = 0

  if (conversation?.stats?.flaggedContent?.length > 0) {
    score += conversation.stats.flaggedContent.length * 10
    analysis.findings.push({
      type: 'Flagged Content',
      description: `${conversation.stats.flaggedContent.length} messages contain potentially concerning content`,
      severity: 'warning',
    })
  }

  return score
}
