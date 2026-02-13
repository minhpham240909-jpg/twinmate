import { z } from 'zod'

export const LeadScoreSchema = z.object({
  intent_score: z.number().min(0).max(1),
  intent_label: z.enum(['high', 'medium', 'low']),
  summary_bullets: z.array(z.string()).min(1).max(5),
  suggested_reply: z.string().min(10),
  confidence: z.number().int().min(0).max(100),
  deal_tier: z.enum(['enterprise', 'mid-high', 'mid', 'small', 'unknown']),
  scoring_reasons: z.array(z.string()).min(1).max(5),
})

export type LeadScore = z.infer<typeof LeadScoreSchema>

export interface ScoreLeadInput {
  message: string
  threadContext?: string
  profile: {
    niche: string
    tone: string
    bookingLink?: string
    businessName?: string
    customInstructions?: string
    replyFromName?: string
  }
  source: 'slack' | 'email'
  senderName?: string
}

export interface ScoreLeadResult {
  score: LeadScore
  usage: { promptTokens: number; completionTokens: number }
  latencyMs: number
  model: string
}
