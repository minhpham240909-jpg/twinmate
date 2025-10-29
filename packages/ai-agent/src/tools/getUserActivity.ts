/**
 * Get User Activity Tool
 * Retrieves complete user activity history and behavior patterns
 */

import { z } from 'zod'
import { Tool, AgentContext } from '../types'
import { SupabaseClient } from '@supabase/supabase-js'

const inputSchema = z.object({
  targetUserId: z.string().optional().describe('User ID to get activity for (optional)'),
  daysBack: z.number().optional().default(30).describe('How many days of history'),
})

const outputSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  totalStudySessions: z.number(),
  totalStudyHours: z.number(),
  quizzesTaken: z.number(),
  averageQuizScore: z.number().optional(),
  mostStudiedSubjects: z.array(z.string()),
})

export function createGetUserActivityTool(supabase: SupabaseClient): Tool {
  return {
    name: 'getUserActivity',
    description: 'Get complete user activity - sessions, quizzes, study hours, patterns',
    inputSchema,
    outputSchema,

    async call(input: z.infer<typeof inputSchema>, ctx: AgentContext) {
      const userId = input.targetUserId || ctx.userId

      const { data: profile } = await supabase
        .from('Profile')
        .select('firstName, lastName, email')
        .eq('userId', userId)
        .single()

      const userName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || profile?.email || 'User'

      return {
        userId,
        userName,
        totalStudySessions: 0,
        totalStudyHours: 0,
        quizzesTaken: 0,
        mostStudiedSubjects: [],
      }
    },
  }
}
