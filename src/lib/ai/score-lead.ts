import Anthropic from '@anthropic-ai/sdk'
import { LeadScoreSchema, type ScoreLeadInput, type ScoreLeadResult } from './types'
import { buildSystemPrompt, buildUserPrompt } from './prompts'

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
    },
    required: ['intent_score', 'intent_label', 'confidence', 'deal_tier', 'scoring_reasons', 'summary_bullets', 'suggested_reply'],
  },
}

export async function scoreLead(input: ScoreLeadInput): Promise<ScoreLeadResult> {
  const startTime = Date.now()
  const model = 'claude-sonnet-4-20250514'

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
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

  const latencyMs = Date.now() - startTime

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  )

  if (!toolUseBlock) {
    throw new Error('AI did not return a tool_use block')
  }

  // Validate with Zod
  const score = LeadScoreSchema.parse(toolUseBlock.input)

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
