import Anthropic from '@anthropic-ai/sdk'
import { LeadScoreSchema, type ScoreLeadInput, type ScoreLeadResult } from './types'
import { buildSystemPrompt, buildUserPrompt } from './prompts'
import { preFilterMessage } from './pre-filter'
import { getCachedScore, setCachedScore } from './score-cache'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const LEAD_SCORING_TOOL = {
  name: 'score_lead' as const,
  description: 'Score and analyze an inbound lead message with deal intelligence',
  input_schema: {
    type: 'object' as const,
    properties: {
      intent_score: {
        type: 'number' as const,
        description:
          'Lead intent score from 0.0 (spam/irrelevant) to 1.0 (ready to buy). Be conservative: when unsure, score lower.',
      },
      intent_label: {
        type: 'string' as const,
        enum: ['high', 'medium', 'low'],
        description:
          'high: 0.7+, clear buying intent. medium: 0.4-0.69, possible interest. low: below 0.4, unlikely lead.',
      },
      confidence: {
        type: 'number' as const,
        description:
          'How confident you are in this score, 0-100. High (80+) when clear signals. Lower when ambiguous.',
      },
      deal_tier: {
        type: 'string' as const,
        enum: ['enterprise', 'mid-high', 'mid', 'small', 'unknown'],
        description:
          'Estimated deal size. enterprise: $50k+. mid-high: $10-50k. mid: $2-10k. small: under $2k. unknown: no budget signals.',
      },
      scoring_reasons: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description:
          'Why this score was given. Short signal phrases like "Budget confirmed: $15-25k", "Decision-maker: Head of Sales", "Timeline: 3 months", "Competitive: evaluating agencies", "No budget mentioned", "Spam/sales pitch". Max 5.',
      },
      summary_bullets: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description:
          'Two to four structured signal bullets. Use signal format: "Budget confirmed: $15-25k", "Timeline: launch by March", "Decision-maker: Head of Sales", "Competitive: speaking to other agencies". Each under 15 words.',
      },
      suggested_reply: {
        type: 'string' as const,
        description:
          'A human reply the freelancer can send. For high-budget leads ($5k+), write with confident authority — no filler words, structured, slightly premium tone. For smaller/casual leads, warmer and more casual. Keep under 100 words.',
      },
      response_priority: {
        type: 'string' as const,
        enum: ['urgent', 'same_day', 'this_week', 'no_rush'],
        description:
          'How quickly the freelancer should respond. urgent: respond within 2 hours (competitive situation, explicit deadline, or high-value lead with time pressure). same_day: respond within 12 hours (high intent, active buyer). this_week: respond within a few days (medium intent, no urgency). no_rush: low priority (low intent, spam, or networking).',
      },
      priority_reason: {
        type: 'string' as const,
        description:
          'One short sentence explaining WHY this response priority was chosen. Actionable and specific. Examples: "Competitive situation — they\'re evaluating other agencies", "High close probability — budget and timeline confirmed", "Decision-maker with urgent deadline", "Exploratory inquiry — no time pressure", "Low intent — reply when convenient".',
      },
    },
    required: ['intent_score', 'intent_label', 'confidence', 'deal_tier', 'scoring_reasons', 'summary_bullets', 'suggested_reply', 'response_priority', 'priority_reason'],
  },
}

export async function scoreLead(input: ScoreLeadInput): Promise<ScoreLeadResult> {
  const startTime = Date.now()
  const model = 'claude-sonnet-4-5-20250929'

  let response
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: 1536,
      system: buildSystemPrompt(input.profile),
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(input),
        },
      ],
      tools: [LEAD_SCORING_TOOL],
      tool_choice: { type: 'tool', name: 'score_lead' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`AI API call failed: ${msg}`)
  }

  const latencyMs = Date.now() - startTime

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  )

  if (!toolUseBlock) {
    throw new Error('AI did not return a tool_use block')
  }

  // Validate with Zod
  let score
  try {
    score = LeadScoreSchema.parse(toolUseBlock.input)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`AI returned invalid score structure: ${msg}`)
  }

  // Post-processing: enforce label-score consistency
  if (score.intent_score >= 0.70 && score.intent_label !== 'high') {
    score.intent_label = 'high'
  } else if (score.intent_score >= 0.40 && score.intent_score < 0.70 && score.intent_label !== 'medium') {
    score.intent_label = 'medium'
  } else if (score.intent_score < 0.40 && score.intent_label !== 'low') {
    score.intent_label = 'low'
  }

  return {
    score,
    usage: {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
    },
    latencyMs,
    model,
  }
}

/**
 * Smart scoring wrapper with two cost-saving stages:
 *
 * Stage 1: Pre-filter — skip obvious spam/junk with zero API calls.
 *   Returns { filtered: true } so the route can handle it (skip insert or insert as low).
 *
 * Stage 2: Cache — check Redis for a previously scored similar message.
 *   If found, return the cached score with the sender name personalized.
 *   If not found, call Claude API and cache the result for future messages.
 *
 * Returns the same ScoreLeadResult as scoreLead(), plus metadata about cache/filter status.
 */
export type SmartScoreResult =
  | { filtered: true; reason: string }
  | { filtered: false; result: ScoreLeadResult; fromCache: boolean }

export async function scoreLeadSmart(input: ScoreLeadInput): Promise<SmartScoreResult> {
  // Stage 1: Pre-filter obvious spam/junk
  const filterResult = preFilterMessage(input.message)
  if (filterResult.filtered) {
    console.log('[score-smart] Pre-filtered:', filterResult.reason)
    return { filtered: true, reason: filterResult.reason || 'Pre-filtered' }
  }

  // Stage 2: Check cache for similar message
  const niche = input.profile.niche || 'other'
  const cached = await getCachedScore(input.message, niche, input.senderName)
  if (cached) {
    console.log('[score-smart] Cache hit for niche:', niche)
    return {
      filtered: false,
      fromCache: true,
      result: {
        score: cached.score,
        usage: { promptTokens: 0, completionTokens: 0 },
        latencyMs: 0,
        model: `${cached.model} (cached)`,
      },
    }
  }

  // Stage 3: Call Claude API (no cache hit)
  const result = await scoreLead(input)

  // Cache the result for future similar messages (fire-and-forget)
  void setCachedScore(input.message, niche, result.score, result.model)

  return { filtered: false, fromCache: false, result }
}
