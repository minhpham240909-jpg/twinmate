/**
 * Match Candidates Tool - Pre-compute match scores for potential study partners
 */

import {
  Tool,
  MatchCandidatesInputSchema,
  MatchCandidatesOutputSchema,
  MatchCandidatesInput,
  MatchCandidatesOutput,
  AgentContext,
} from '../types'
import { SupabaseClient } from '@supabase/supabase-js'

export function createMatchCandidatesTool(supabase: SupabaseClient): Tool<MatchCandidatesInput, MatchCandidatesOutput> {
  return {
    name: 'matchCandidates',
    description: `🎯 CRITICAL TOOL - ALWAYS extract specific criteria from detailed requests!

WHEN TO CALL: ANY partner request - simple OR detailed
- "partner", "study buddy", "find someone", "match me"
- "Find me a partner who studies Python and is available on weekends"
- "Looking for someone intermediate level who wants to pass exams"

IMPORTANT: Extract ALL criteria from user's request:
✅ subjects - ["Python", "Machine Learning", "Business"]
✅ interests - ["Gaming", "Music", "Sports"]
✅ goals - ["Pass exam", "Build project", "Learn fundamentals"]
✅ studyStyle - "visual", "auditory", "kinesthetic", "reading/writing"
✅ skillLevel - "beginner", "intermediate", "advanced"
✅ availableDays - ["Monday", "Tuesday", "Saturday", "Sunday"]
✅ school - "MIT", "Stanford", specific institution
✅ languages - "English", "Spanish", "Mandarin"

EXAMPLES:
User: "Find me a partner who studies Python"
→ Call matchCandidates({ subjects: ["Python"] })

User: "Looking for someone who studies ML, available weekends, intermediate level"
→ Call matchCandidates({ subjects: ["Machine Learning"], availableDays: ["Saturday", "Sunday"], skillLevel: "intermediate" })

User: "partner" (no criteria)
→ Call matchCandidates({}) // Returns all compatible partners

Returns matches ranked by compatibility. Filters applied at database level for efficiency.`,
    category: 'collaboration',
    inputSchema: MatchCandidatesInputSchema,
    outputSchema: MatchCandidatesOutputSchema,
    estimatedLatencyMs: 1500,

    async call(input: MatchCandidatesInput, ctx: AgentContext): Promise<MatchCandidatesOutput> {
      // Extract filter criteria
      const {
        limit = 10,
        minScore = 0.1,
        subjects,
        interests,
        goals,
        studyStyle,
        skillLevel,
        availableDays,
        school,
        languages
      } = input

      console.log('[matchCandidates] Filters:', {
        subjects,
        interests,
        goals,
        studyStyle,
        skillLevel,
        availableDays,
        school,
        languages
      })

      // 1. Fetch current user's profile and learning profile (including ALL fields)
      const { data: userProfile, error: userError } = await supabase
        .from('Profile')
        .select(`
          userId, subjects, studyStyle, skillLevel, goals, interests,
          bio, school, languages, aboutYourself, aboutYourselfItems,
          skillLevelCustomDescription, studyStyleCustomDescription,
          availabilityCustomDescription, subjectCustomDescription, interestsCustomDescription
        `)
        .eq('userId', ctx.userId)
        .single()

      console.log('[matchCandidates] Profile:', {
        found: !!userProfile,
        subjects: userProfile?.subjects || [],
        interests: userProfile?.interests || [],
        error: userError?.message
      })

      if (userError || !userProfile) {
        console.error('[matchCandidates] ERROR: User profile not found for', ctx.userId)
        throw new Error('User profile not found')
      }

      const { data: userLearning } = await supabase
        .from('LearningProfile')
        .select('strengths, weaknesses')
        .eq('userId', ctx.userId)
        .single()

      // 2. Fetch all potential candidates (exclude self, including ALL fields)
      const { data: candidates, error: candidatesError } = await supabase
        .from('Profile')
        .select(`
          userId, subjects, studyStyle, skillLevel, goals, interests,
          bio, school, languages, aboutYourself, aboutYourselfItems,
          skillLevelCustomDescription, studyStyleCustomDescription,
          availabilityCustomDescription, subjectCustomDescription, interestsCustomDescription
        `)
        .neq('userId', ctx.userId)
        .limit(100) // Process top 100 candidates

      if (candidatesError) {
        throw new Error(`Failed to fetch candidates: ${candidatesError.message}`)
      }

      console.log('[matchCandidates] Candidates found:', candidates?.length || 0)

      if (!candidates || candidates.length === 0) {
        console.log('[matchCandidates] RETURN: No candidates in database')
        return { matches: [], total: 0 }
      }

      // 2.5. Apply filters to candidates BEFORE computing compatibility (more efficient)
      let filteredCandidates = candidates.filter(candidate => {
        // Filter by subjects (if ANY match)
        if (subjects && subjects.length > 0) {
          const candidateSubjects = candidate.subjects || []
          const hasSubjectMatch = subjects.some(sub =>
            candidateSubjects.some((cs: string) => cs.toLowerCase().includes(sub.toLowerCase()))
          )
          if (!hasSubjectMatch) return false
        }

        // Filter by interests (if ANY match)
        if (interests && interests.length > 0) {
          const candidateInterests = candidate.interests || []
          const hasInterestMatch = interests.some(int =>
            candidateInterests.some((ci: string) => ci.toLowerCase().includes(int.toLowerCase()))
          )
          if (!hasInterestMatch) return false
        }

        // Filter by goals (if ANY match)
        if (goals && goals.length > 0) {
          const candidateGoals = candidate.goals || []
          const hasGoalMatch = goals.some(goal =>
            candidateGoals.some((cg: string) => cg.toLowerCase().includes(goal.toLowerCase()))
          )
          if (!hasGoalMatch) return false
        }

        // Filter by study style (exact match, case insensitive)
        if (studyStyle) {
          const candidateStyle = candidate.studyStyle || ''
          if (!candidateStyle.toLowerCase().includes(studyStyle.toLowerCase())) {
            return false
          }
        }

        // Filter by skill level (exact match, case insensitive)
        if (skillLevel) {
          const candidateLevel = candidate.skillLevel || ''
          if (!candidateLevel.toLowerCase().includes(skillLevel.toLowerCase())) {
            return false
          }
        }

        // Filter by availability (if ANY day matches)
        if (availableDays && availableDays.length > 0) {
          // Note: availableDays might be stored differently - adjust as needed
          // For now, checking if studyStyle or custom descriptions mention the days
          const availabilityText = (candidate.availabilityCustomDescription || '').toLowerCase()
          const hasDayMatch = availableDays.some(day =>
            availabilityText.includes(day.toLowerCase())
          )
          if (!hasDayMatch) return false
        }

        // Filter by school (case insensitive partial match)
        if (school) {
          const candidateSchool = candidate.school || ''
          if (!candidateSchool.toLowerCase().includes(school.toLowerCase())) {
            return false
          }
        }

        // Filter by languages (case insensitive partial match)
        if (languages) {
          const candidateLanguages = candidate.languages || ''
          if (!candidateLanguages.toLowerCase().includes(languages.toLowerCase())) {
            return false
          }
        }

        // If all filters pass (or no filters), include candidate
        return true
      })

      console.log('[matchCandidates] After filtering:', filteredCandidates.length, 'candidates')

      if (filteredCandidates.length === 0) {
        console.log('[matchCandidates] RETURN: No candidates match the specified criteria')
        return { matches: [], total: 0 }
      }

      // 3. Fetch learning profiles for filtered candidates
      const candidateIds = filteredCandidates.map(c => c.userId)
      const { data: candidateLearningProfiles } = await supabase
        .from('LearningProfile')
        .select('userId, strengths, weaknesses')
        .in('userId', candidateIds)

      const learningMap = new Map(
        candidateLearningProfiles?.map(lp => [lp.userId, lp]) || []
      )

      // 3.5. Fetch user names and emails for filtered candidates
      const { data: userNames, error: userNamesError } = await supabase
        .from('User')
        .select('id, name, email')
        .in('id', candidateIds)

      if (userNamesError) {
        console.error('[matchCandidates] Failed to fetch user names:', userNamesError)
      }

      const userNameMap = new Map(
        userNames?.map(u => [u.id, { name: u.name, email: u.email }]) || []
      )

      // 4. Compute match scores for each filtered candidate
      const scoredMatches = filteredCandidates.map(candidate => {
        const candidateLearning = learningMap.get(candidate.userId)
        const score = computeCompatibilityScore(
          userProfile,
          candidate,
          userLearning,
          candidateLearning
        )

        // Compute facets breakdown
        const facets = computeFacets(userProfile, candidate, userLearning, candidateLearning)

        // Generate match reasons based on what matched
        const matchReasons = generateMatchReasons(userProfile, candidate, facets)

        // Get user info
        const userInfo = userNameMap.get(candidate.userId)

        return {
          userId: candidate.userId,
          name: userInfo?.name || 'Unknown User',
          email: userInfo?.email,
          score: score.score,
          subjects: candidate.subjects || [],
          interests: candidate.interests || [],
          studyStyle: candidate.studyStyle,
          skillLevel: candidate.skillLevel,
          school: candidate.school,
          matchReasons,
          facets,
        }
      })

      // 5. Filter by minimum score and sort
      let filteredMatches = scoredMatches
        .filter(m => m.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      console.log('[matchCandidates] Scored:', scoredMatches.length, 'Filtered:', filteredMatches.length)
      console.log('[matchCandidates] Top 3 scores:', scoredMatches.slice(0, 3).map(m => m.score.toFixed(2)))

      // FIXED: If no matches meet minScore threshold, return top candidates anyway
      // This prevents "no partners found" when users have incomplete profiles
      if (filteredMatches.length === 0 && scoredMatches.length > 0) {
        console.log('[matchCandidates] FALLBACK: No matches above minScore, returning top candidates')
        filteredMatches = scoredMatches
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
      }

      console.log('[matchCandidates] RETURN:', filteredMatches.length, 'matches')

      // 6. Optionally cache results in MatchCandidate table (if exists)
      try {
        if (filteredMatches.length > 0) {
          const cacheRecords = filteredMatches.map(m => ({
            userId: ctx.userId,
            candidateId: m.userId,
            score: m.score,
            facets: m.facets,
            computedAt: new Date().toISOString(),
          }))

          // Delete old cache entries for this user
          await supabase
            .from('MatchCandidate')
            .delete()
            .eq('userId', ctx.userId)

          // Insert new cache
          await supabase
            .from('MatchCandidate')
            .insert(cacheRecords)
        }
      } catch (error) {
        // Gracefully handle if MatchCandidate table doesn't exist
        console.warn('Failed to cache match results (table may not exist):', error)
      }

      return {
        matches: filteredMatches,
        total: filteredMatches.length,
      }
    },
  }
}

/**
 * Compute overall compatibility score (same logic as matchInsight)
 * FIXED: More lenient scoring for users with incomplete profiles
 */
function computeCompatibilityScore(
  user: any,
  candidate: any,
  userLearning: any,
  candidateLearning: any
): { score: number } {
  let score = 0
  let maxPossibleScore = 0

  // Subject overlap (40% weight)
  const userSubjects = new Set(user.subjects || [])
  const candidateSubjects = new Set(candidate.subjects || [])

  // FIXED: If either user has subjects, count this factor
  if (userSubjects.size > 0 || candidateSubjects.size > 0) {
    const overlap = Array.from(userSubjects).filter(s => candidateSubjects.has(s)).length
    const subjectScore = Math.min(overlap / 3, 1) // Cap at 3 subjects
    score += subjectScore * 0.4
    maxPossibleScore += 0.4
  }

  // Learning style compatibility (20% weight)
  if (user.studyStyle && candidate.studyStyle) {
    const styleScore = user.studyStyle === candidate.studyStyle ? 0.8 : 0.7
    score += styleScore * 0.2
    maxPossibleScore += 0.2
  }

  // Skill level proximity (15% weight)
  if (user.skillLevel && candidate.skillLevel) {
    const skillScore = user.skillLevel === candidate.skillLevel ? 1.0 : 0.6
    score += skillScore * 0.15
    maxPossibleScore += 0.15
  }

  // Strength/weakness complementarity (25% weight)
  if (userLearning && candidateLearning) {
    const userStrengths = new Set(userLearning.strengths || [])
    const userWeaknesses = new Set(userLearning.weaknesses || [])
    const candidateStrengths = new Set(candidateLearning.strengths || [])
    const candidateWeaknesses = new Set(candidateLearning.weaknesses || [])

    const userHelpsCandidate = Array.from(userStrengths).filter(s => candidateWeaknesses.has(s)).length
    const candidateHelpsUser = Array.from(candidateStrengths).filter(s => userWeaknesses.has(s)).length

    const complementScore = Math.min((userHelpsCandidate + candidateHelpsUser) / 4, 1)
    score += complementScore * 0.25
    maxPossibleScore += 0.25
  }

  // FIXED: If profiles are mostly empty, give a baseline score so users aren't completely filtered out
  // This allows matching even when profiles are incomplete
  if (maxPossibleScore === 0) {
    // No data to compare - return small baseline score
    return { score: 0.1 }
  }

  // Normalize score based on factors that were actually comparable
  const normalizedScore = maxPossibleScore > 0 ? score / maxPossibleScore : 0

  return { score: Math.min(normalizedScore, 1) }
}

/**
 * Compute facets breakdown for transparency
 */
function computeFacets(
  user: any,
  candidate: any,
  userLearning: any,
  candidateLearning: any
): Record<string, any> {
  const userSubjects = new Set(user.subjects || [])
  const candidateSubjects = new Set(candidate.subjects || [])
  const commonSubjects = Array.from(userSubjects).filter(s => candidateSubjects.has(s))

  const facets: Record<string, any> = {
    commonSubjects,
    subjectCount: commonSubjects.length,
    studyStyleMatch: user.studyStyle === candidate.studyStyle,
    skillLevelMatch: user.skillLevel === candidate.skillLevel,
  }

  // Complementarity
  if (userLearning && candidateLearning) {
    const userStrengths = new Set(userLearning.strengths || [])
    const userWeaknesses = new Set(userLearning.weaknesses || [])
    const candidateStrengths = new Set(candidateLearning.strengths || [])
    const candidateWeaknesses = new Set(candidateLearning.weaknesses || [])

    const theyHelp = Array.from(candidateStrengths).filter(s => userWeaknesses.has(s))
    const youHelp = Array.from(userStrengths).filter(s => candidateWeaknesses.has(s))

    facets.complementarity = {
      theyHelpWith: theyHelp,
      youHelpWith: youHelp,
    }
  }

  return facets
}

/**
 * Generate human-readable match reasons based on compatibility
 */
function generateMatchReasons(
  user: any,
  candidate: any,
  facets: Record<string, any>
): string[] {
  const reasons: string[] = []

  // Common subjects
  if (facets.commonSubjects && facets.commonSubjects.length > 0) {
    reasons.push(`Both study: ${facets.commonSubjects.join(', ')}`)
  }

  // Study style match
  if (facets.studyStyleMatch && user.studyStyle) {
    reasons.push(`Same ${user.studyStyle} learning style`)
  }

  // Skill level match
  if (facets.skillLevelMatch && user.skillLevel) {
    reasons.push(`Both at ${user.skillLevel} level`)
  }

  // Complementarity
  if (facets.complementarity) {
    if (facets.complementarity.theyHelpWith && facets.complementarity.theyHelpWith.length > 0) {
      reasons.push(`They can help with: ${facets.complementarity.theyHelpWith.join(', ')}`)
    }
    if (facets.complementarity.youHelpWith && facets.complementarity.youHelpWith.length > 0) {
      reasons.push(`You can help with: ${facets.complementarity.youHelpWith.join(', ')}`)
    }
  }

  // Same school
  if (user.school && candidate.school && user.school === candidate.school) {
    reasons.push(`Both attend ${user.school}`)
  }

  // Common interests (not in facets, compute here)
  const userInterests = new Set(user.interests || [])
  const candidateInterests = new Set(candidate.interests || [])
  const commonInterests = Array.from(userInterests).filter(i => candidateInterests.has(i))
  if (commonInterests.length > 0) {
    reasons.push(`Shared interests: ${commonInterests.join(', ')}`)
  }

  return reasons
}
