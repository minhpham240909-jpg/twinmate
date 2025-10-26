/**
 * Get Online Users Tool - Find who's online and available for studying now
 */

import {
  Tool,
  GetOnlineUsersInputSchema,
  GetOnlineUsersOutputSchema,
  GetOnlineUsersInput,
  GetOnlineUsersOutput,
  AgentContext,
} from '../types'
import { SupabaseClient } from '@supabase/supabase-js'

export function createGetOnlineUsersTool(supabase: SupabaseClient): Tool<GetOnlineUsersInput, GetOnlineUsersOutput> {
  return {
    name: 'getOnlineUsers',
    description: 'Get list of users currently online and available for study sessions. Useful for "Study Now" matching.',
    category: 'collaboration',
    inputSchema: GetOnlineUsersInputSchema,
    outputSchema: GetOnlineUsersOutputSchema,
    estimatedLatencyMs: 300,

    async call(input: GetOnlineUsersInput, ctx: AgentContext): Promise<GetOnlineUsersOutput> {
      const { activityFilter, limit = 50 } = input

      // Build query
      let query = supabase
        .from('presence')
        .select(`
          user_id,
          is_online,
          last_seen,
          current_activity,
          profile:user_id (
            grade_level,
            subjects,
            learning_style
          )
        `)
        .eq('is_online', true)
        .order('last_seen', { ascending: false })
        .limit(limit)

      // Filter by activity if specified
      if (activityFilter && activityFilter.length > 0) {
        query = query.in('current_activity', activityFilter)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(`Failed to fetch online users: ${error.message}`)
      }

      if (!data) {
        return { users: [], total: 0 }
      }

      // Map to output format
      const users = data.map(p => ({
        userId: p.user_id,
        currentActivity: p.current_activity,
        lastSeen: p.last_seen,
        profile: p.profile ? {
          gradeLevel: p.profile.grade_level,
          subjects: p.profile.subjects || [],
          learningStyle: p.profile.learning_style,
        } : undefined,
      }))

      return {
        users,
        total: users.length,
      }
    },
  }
}
