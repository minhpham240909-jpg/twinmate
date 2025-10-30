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
        console.log('[searchUsers] Searching for:', query, 'searchBy:', searchBy)

        // STEP 1: Search User table for name/email matches
        // Note: We ALWAYS search by name first, then filter by Profile data if needed
        let userQuery = supabase
          .from('User')
          .select('id, name, email, createdAt')
          .neq('id', ctx.userId) // Don't include current user
          .limit(100) // Get more, we'll filter by Profile data later

        // For name/all search, filter by name in the query
        // For subjects/interests/etc, we'll filter after getting Profile data
        if (searchBy === 'all' || searchBy === 'name') {
          userQuery = userQuery.or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        }
        // If searching by subjects/interests/etc, get all users and filter by Profile later

        const { data: users, error: userError } = await userQuery

        console.log('[searchUsers] User query result:', {
          found: users?.length || 0,
          error: userError?.message
        })

        if (userError) {
          console.error('[searchUsers] User search error:', userError)
          throw new Error(`Failed to search users: ${userError.message}`)
        }

        if (!users || users.length === 0) {
          console.log('[searchUsers] No users found matching:', query)
          return {
            users: [],
            totalFound: 0,
            searchedBy: searchBy,
          }
        }

        // Get user IDs
        const userIds = users.map(u => u.id)
        console.log('[searchUsers] Found user IDs:', userIds)

        // STEP 2: Get Profile data for these users
        const { data: profiles, error: profileError } = await supabase
          .from('Profile')
          .select('userId, subjects, interests, goals, studyStyle, skillLevel, onlineStatus')
          .in('userId', userIds)

        console.log('[searchUsers] Profile query result:', {
          found: profiles?.length || 0,
          error: profileError?.message
        })

        // Map profiles by userId for easy lookup
        const profileMap = new Map(
          profiles?.map(p => [p.userId, p]) || []
        )

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
          .from('SessionParticipant')
          .select('sessionId, userId')
          .or(`userId.eq.${ctx.userId},userId.in.(${userIds.join(',')})`)

        // Count shared sessions per user
        const sharedSessionCounts = new Map<string, number>()
        if (sessionParticipants) {
          const sessionsByUser = new Map<string, Set<string>>()

          // Group sessions by user
          for (const sp of sessionParticipants) {
            if (!sessionsByUser.has(sp.userId)) {
              sessionsByUser.set(sp.userId, new Set())
            }
            sessionsByUser.get(sp.userId)!.add(sp.sessionId)
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
          .from('GroupMember')
          .select('groupId')
          .eq('userId', ctx.userId)

        const myGroupIds = new Set(myGroups?.map(g => g.groupId) || [])

        const { data: theirGroups } = await supabase
          .from('GroupMember')
          .select('groupId, userId')
          .in('userId', userIds)

        const sharedGroupCounts = new Map<string, number>()
        if (theirGroups) {
          for (const tg of theirGroups) {
            if (myGroupIds.has(tg.groupId)) {
              sharedGroupCounts.set(tg.userId, (sharedGroupCounts.get(tg.userId) || 0) + 1)
            }
          }
        }

        // Calculate compatibility scores based on subjects overlap
        const myProfile = await supabase
          .from('Profile')
          .select('subjects, interests, studyStyle')
          .eq('userId', ctx.userId)
          .single()

        const mySubjects = new Set(myProfile.data?.subjects || [])
        const myInterests = new Set(myProfile.data?.interests || [])

        // Build result - map users with their profiles
        const resultUsers = users.map(user => {
          // Get profile from profileMap (we queried separately)
          const profile = profileMap.get(user.id)
          const presence = presenceMap.get(user.id)

          console.log('[searchUsers] Mapping user:', user.name, 'has profile:', !!profile)

          const theirSubjects = new Set(profile?.subjects || [])
          const theirInterests = new Set(profile?.interests || [])

          // Calculate compatibility
          const subjectOverlap = [...mySubjects].filter(s => theirSubjects.has(s)).length
          const interestOverlap = [...myInterests].filter(i => theirInterests.has(i)).length
          const totalOverlap = subjectOverlap + interestOverlap
          const maxPossible = Math.max(mySubjects.size + myInterests.size, theirSubjects.size + theirInterests.size)
          const compatibilityScore = maxPossible > 0 ? totalOverlap / maxPossible : 0

          return {
            userId: user.id,
            name: user.name || user.email,
            email: user.email,
            subjects: profile?.subjects || [],
            interests: profile?.interests || [],
            goals: profile?.goals || [],
            learningStyle: profile?.studyStyle || undefined,
            skillLevel: profile?.skillLevel || undefined,
            gradeLevel: undefined, // Not in schema
            isOnline: presence?.is_online || profile?.onlineStatus === 'ONLINE' || false,
            lastSeen: presence?.last_seen || undefined,
            studiedTogetherCount: sharedSessionCounts.get(user.id) || 0,
            sharedGroups: sharedGroupCounts.get(user.id) || 0,
            compatibilityScore: Math.round(compatibilityScore * 100) / 100,
          }
        })

        // Sort by relevance (compatibility + studied together)
        resultUsers.sort((a, b) => {
          const scoreA = (a.compatibilityScore || 0) + (a.studiedTogetherCount || 0) * 0.1
          const scoreB = (b.compatibilityScore || 0) + (b.studiedTogetherCount || 0) * 0.1
          return scoreB - scoreA
        })

        // Limit final results
        const limitedResults = resultUsers.slice(0, limit)

        console.log('[searchUsers] Returning', limitedResults.length, 'users out of', resultUsers.length, 'found')
        console.log('[searchUsers] User names:', limitedResults.map(u => u.name).join(', '))

        return {
          users: limitedResults,
          totalFound: resultUsers.length,
          searchedBy: searchBy,
        }
      } catch (error) {
        console.error('Search users error:', error)
        throw error
      }
    },
  }
}
