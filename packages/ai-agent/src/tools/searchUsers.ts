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
    bio: z.string().optional().describe('User bio/personal description'),
    skillLevelCustomDescription: z.string().optional().describe('Custom description of skill level'),
    studyStyleCustomDescription: z.string().optional().describe('Custom description of study style'),
    availabilityCustomDescription: z.string().optional().describe('Custom description of availability'),
    subjectCustomDescription: z.string().optional().describe('Custom description of subjects'),
    interestsCustomDescription: z.string().optional().describe('Custom description of interests'),
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
    description: `🔴 CRITICAL TOOL - ALWAYS USE FOR PEOPLE SEARCHES 🔴

⚠️ MANDATORY: Call this tool IMMEDIATELY if the user message contains:
1. Any capitalized word that looks like a name (John, Sarah, Alex, Mike, etc.)
2. Words like "find", "search", "show me", "who is", "look for" + a name
3. ANY proper noun that could be a person's name
4. Requests about partners, users, students, or people

This tool searches the REAL database for users by:
✅ Name (partial or full): "John", "Sarah Chen", "Gia Khang"
✅ Email: "user@example.com"
✅ Subjects: "Python", "Math", "Business"
✅ Interests: "Gaming", "Music", "Sports"

EXAMPLES REQUIRING THIS TOOL:
- User types: "John" → CALL searchUsers with query="John", searchBy="name"
- User types: "find Sarah" → CALL searchUsers with query="Sarah", searchBy="name"
- User types: "Minh Pham" → CALL searchUsers with query="Minh Pham", searchBy="name"
- User types: "who studies Python" → CALL searchUsers with query="Python", searchBy="subjects"

NEVER say "I can't find" without calling this tool first!
NEVER guess or assume - ALWAYS query the database!

Returns complete user data:
- Name, email, bio
- Subjects, interests, goals, learning style, skill level
- ALL custom descriptions (detailed info about their profile)
- Online status, study history, shared groups, compatibility score`,

    inputSchema,
    outputSchema,

    async call(input: z.infer<typeof inputSchema>, ctx: AgentContext) {
      const { query, searchBy, limit } = input

      try {
        console.log('[searchUsers] Searching for:', query, 'searchBy:', searchBy)

        // STEP 1: Search for users by name/email in User table
        // Note: Profile table doesn't have firstName/lastName - only User.name exists
        let userIds: string[] = []
        let userMap = new Map<string, { name: string; email: string }>()

        // Build search query for User table
        let userQuery = supabase
          .from('User')
          .select('id, name, email, createdAt')
          .neq('id', ctx.userId) // Don't include current user
          .limit(100)

        // For name/all search: Search by name and email
        // Split multi-word queries to match partial names (e.g., "Gia Khang Pham")
        if (searchBy === 'all' || searchBy === 'name') {
          const searchTerms = query.trim().split(/\s+/) // Split by whitespace
          
          // Build OR conditions for each search term against name and email
          const conditions: string[] = []
          for (const term of searchTerms) {
            if (term.length > 0) {
              conditions.push(`name.ilike.%${term}%`)
              conditions.push(`email.ilike.%${term}%`)
            }
          }
          
          if (conditions.length > 0) {
            userQuery = userQuery.or(conditions.join(','))
          }

          console.log('[searchUsers] Searching User table with terms:', searchTerms)
        }

        const { data: users, error: userError } = await userQuery

        console.log('[searchUsers] User table search result:', {
          query: query,
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

        // Store user data
        for (const user of users) {
          userIds.push(user.id)
          userMap.set(user.id, { name: user.name, email: user.email })
        }

        console.log('[searchUsers] Found user IDs:', userIds)
        console.log('[searchUsers] User names:', users.map(u => u.name).join(', '))

        // STEP 2: Get Profile data for these users (including ALL custom descriptions)
        const { data: profiles, error: profileError } = await supabase
          .from('Profile')
          .select(`
            userId, subjects, interests, goals, studyStyle, skillLevel, onlineStatus,
            bio, skillLevelCustomDescription, studyStyleCustomDescription,
            availabilityCustomDescription, subjectCustomDescription, interestsCustomDescription
          `)
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
        let resultUsers = userIds.map(userId => {
          const userInfo = userMap.get(userId)!
          // Get profile from profileMap (we queried separately)
          const profile = profileMap.get(userId)
          const presence = presenceMap.get(userId)

          console.log('[searchUsers] Mapping user:', userInfo.name, 'has profile:', !!profile)

          const theirSubjects = new Set(profile?.subjects || [])
          const theirInterests = new Set(profile?.interests || [])

          // Calculate compatibility
          const subjectOverlap = [...mySubjects].filter(s => theirSubjects.has(s)).length
          const interestOverlap = [...myInterests].filter(i => theirInterests.has(i)).length
          const totalOverlap = subjectOverlap + interestOverlap
          const maxPossible = Math.max(mySubjects.size + myInterests.size, theirSubjects.size + theirInterests.size)
          const compatibilityScore = maxPossible > 0 ? totalOverlap / maxPossible : 0

          return {
            userId: userId,
            name: userInfo.name || userInfo.email,
            email: userInfo.email,
            subjects: profile?.subjects || [],
            interests: profile?.interests || [],
            goals: profile?.goals || [],
            learningStyle: profile?.studyStyle || undefined,
            skillLevel: profile?.skillLevel || undefined,
            gradeLevel: undefined, // Not in schema
            bio: profile?.bio || undefined,
            skillLevelCustomDescription: profile?.skillLevelCustomDescription || undefined,
            studyStyleCustomDescription: profile?.studyStyleCustomDescription || undefined,
            availabilityCustomDescription: profile?.availabilityCustomDescription || undefined,
            subjectCustomDescription: profile?.subjectCustomDescription || undefined,
            interestsCustomDescription: profile?.interestsCustomDescription || undefined,
            isOnline: presence?.is_online || profile?.onlineStatus === 'ONLINE' || false,
            lastSeen: presence?.last_seen || undefined,
            studiedTogetherCount: sharedSessionCounts.get(userId) || 0,
            sharedGroups: sharedGroupCounts.get(userId) || 0,
            compatibilityScore: Math.round(compatibilityScore * 100) / 100,
          }
        })

        // Filter by specific criteria if searchBy is not 'all' or 'name'
        if (searchBy && searchBy !== 'all' && searchBy !== 'name') {
          const queryLower = query.toLowerCase()
          
          resultUsers = resultUsers.filter(user => {
            switch (searchBy) {
              case 'subjects':
                return user.subjects.some((s: string) => s.toLowerCase().includes(queryLower))
              case 'interests':
                return user.interests.some((i: string) => i.toLowerCase().includes(queryLower))
              case 'goals':
                return user.goals.some((g: string) => g.toLowerCase().includes(queryLower))
              case 'learningStyle':
                return user.learningStyle?.toLowerCase().includes(queryLower)
              default:
                return true // Include all if unknown searchBy
            }
          })
          
          console.log('[searchUsers] Filtered by', searchBy, '- remaining:', resultUsers.length)
        }

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
