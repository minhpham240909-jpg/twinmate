import { z } from 'zod'

export const LeadScoreSchema = z.object({
  intent_score: z.number().min(0).max(1),
  intent_label: z.enum(['high', 'medium', 'low']),
  summary_bullets: z.array(z.string()).min(1).max(3),
  suggested_reply: z.string().min(10),
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
