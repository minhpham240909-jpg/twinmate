/**
 * Search Users Tool
 * Search for users by ANY criteria: name, subjects, interests, goals, learning style, etc.
 */

import { z } from 'zod'
import { Tool, AgentContext } from '../types'
import { SupabaseClient } from '@supabase/supabase-js'

// Input schema - flexible search
const inputSchema = z.object({
  query: z.string().describe('Search query - can be name, subject, interest, or any user info'),
  searchBy: z.enum(['all', 'name', 'subjects', 'interests', 'goals', 'learningStyle']).optional().default('all')
    .describe('What to search by - "all" searches everything'),
  limit: z.number().optional().default(10).describe('Maximum number of results'),
})

// Output schema
const outputSchema = z.object({
  users: z.array(z.object({
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    subjects: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    goals: z.array(z.string()).optional(),
    learningStyle: z.string().optional(),
    skillLevel: z.string().optional(),
    gradeLevel: z.string().optional(),
    isOnline: z.boolean().optional(),
    lastSeen: z.string().optional(),
    studiedTogetherCount: z.number().optional().describe('How many times you studied together'),
    sharedGroups: z.number().optional().describe('Number of shared study groups'),
    compatibilityScore: z.number().optional().describe('Compatibility score 0-1'),
  })),
  totalFound: z.number(),
  searchedBy: z.string(),
})

export function createSearchUsersTool(supabase: SupabaseClient): Tool {
  return {
    name: 'searchUsers',
    description: `Search for users by ANYTHING - name, subjects, interests, goals, learning style, etc.

Examples:
- "Gia Khang" → finds users with that name
- "Python" → finds users studying Python
- "Gaming" → finds users interested in gaming
- "Visual learner" → finds visual learners

Returns complete user info including:
- Profile (name, subjects, interests, goals, style)
- Online status
- How many times you studied together
- Shared groups
- Compatibility score`,

    inputSchema,
    outputSchema,

    async call(input: z.infer<typeof inputSchema>, ctx: AgentContext) {
      const { query, searchBy, limit } = input

      try {
        // Build dynamic query based on searchBy
        let profileQuery = supabase
          .from('Profile')
          .select(`
            user_id,
            first_name,
            last_name,
            email,
            subjects,
            interests,
            goals,
            study_style,
            skill_level,
            grade_level,
            strengths,
            weaknesses
          `)
          .neq('user_id', ctx.userId) // Don't include current user
          .limit(limit)

        // Search by name (first name, last name, or email)
        const nameLower = query.toLowerCase()
        profileQuery = profileQuery.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)

        const { data: profiles, error: profileError } = await profileQuery

        if (profileError) {
          console.error('Profile search error:', profileError)
          throw new Error(`Failed to search users: ${profileError.message}`)
        }

        if (!profiles || profiles.length === 0) {
          return {
            users: [],
            totalFound: 0,
            searchedBy: searchBy,
          }
        }

        // Get user IDs
        const userIds = profiles.map(p => p.user_id)

        // Get online presence for all users
        const { data: presenceData } = await supabase
          .from('presence')
          .select('user_id, is_online, last_seen')
          .in('user_id', userIds)

        const presenceMap = new Map(
          presenceData?.map(p => [p.user_id, p]) || []
        )

        // Get study together count (sessions where both users participated)
        const { data: sessionParticipants } = await supabase
          .from('session_participant')
          .select('session_id, user_id')
          .or(`user_id.eq.${ctx.userId},user_id.in.(${userIds.join(',')})`)

        // Count shared sessions per user
        const sharedSessionCounts = new Map<string, number>()
        if (sessionParticipants) {
          const sessionsByUser = new Map<string, Set<string>>()

          // Group sessions by user
          for (const sp of sessionParticipants) {
            if (!sessionsByUser.has(sp.user_id)) {
              sessionsByUser.set(sp.user_id, new Set())
            }
            sessionsByUser.get(sp.user_id)!.add(sp.session_id)
          }

          const mySessions = sessionsByUser.get(ctx.userId) || new Set()

          // Count intersections
          for (const userId of userIds) {
            const theirSessions = sessionsByUser.get(userId) || new Set()
            const sharedCount = [...mySessions].filter(s => theirSessions.has(s)).length
            sharedSessionCounts.set(userId, sharedCount)
          }
        }

        // Get shared groups count
        const { data: myGroups } = await supabase
          .from('group_member')
          .select('group_id')
          .eq('user_id', ctx.userId)

        const myGroupIds = new Set(myGroups?.map(g => g.group_id) || [])

        const { data: theirGroups } = await supabase
          .from('group_member')
          .select('group_id, user_id')
          .in('user_id', userIds)

        const sharedGroupCounts = new Map<string, number>()
        if (theirGroups) {
          for (const tg of theirGroups) {
            if (myGroupIds.has(tg.group_id)) {
              sharedGroupCounts.set(tg.user_id, (sharedGroupCounts.get(tg.user_id) || 0) + 1)
            }
          }
        }

        // Calculate compatibility scores based on subjects overlap
        const myProfile = await supabase
          .from('Profile')
          .select('subjects, interests, study_style')
          .eq('user_id', ctx.userId)
          .single()

        const mySubjects = new Set(myProfile.data?.subjects || [])
        const myInterests = new Set(myProfile.data?.interests || [])

        // Build result
        const users = profiles.map(profile => {
          const presence = presenceMap.get(profile.user_id)
          const theirSubjects = new Set(profile.subjects || [])
          const theirInterests = new Set(profile.interests || [])

          // Calculate compatibility
          const subjectOverlap = [...mySubjects].filter(s => theirSubjects.has(s)).length
          const interestOverlap = [...myInterests].filter(i => theirInterests.has(i)).length
          const totalOverlap = subjectOverlap + interestOverlap
          const maxPossible = Math.max(mySubjects.size + myInterests.size, theirSubjects.size + theirInterests.size)
          const compatibilityScore = maxPossible > 0 ? totalOverlap / maxPossible : 0

          return {
            userId: profile.user_id,
            name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
            email: profile.email,
            subjects: profile.subjects || [],
            interests: profile.interests || [],
            goals: profile.goals || [],
            learningStyle: profile.study_style || undefined,
            skillLevel: profile.skill_level || undefined,
            gradeLevel: profile.grade_level || undefined,
            isOnline: presence?.is_online || false,
            lastSeen: presence?.last_seen || undefined,
            studiedTogetherCount: sharedSessionCounts.get(profile.user_id) || 0,
            sharedGroups: sharedGroupCounts.get(profile.user_id) || 0,
            compatibilityScore: Math.round(compatibilityScore * 100) / 100,
          }
        })

        // Sort by relevance (compatibility + studied together)
        users.sort((a, b) => {
          const scoreA = (a.compatibilityScore || 0) + (a.studiedTogetherCount || 0) * 0.1
          const scoreB = (b.compatibilityScore || 0) + (b.studiedTogetherCount || 0) * 0.1
          return scoreB - scoreA
        })

        return {
          users,
          totalFound: users.length,
          searchedBy: searchBy,
        }
      } catch (error) {
        console.error('Search users error:', error)
        throw error
      }
    },
  }
}
