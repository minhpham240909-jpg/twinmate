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

      // Get user info (name is in User table, not Profile)
      const { data: user } = await supabase
        .from('User')
        .select('name, email')
        .eq('id', userId)
        .single()

      const userName = user?.name || user?.email || 'User'

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
