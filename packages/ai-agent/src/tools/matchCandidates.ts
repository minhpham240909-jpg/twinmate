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
    description: 'Find and rank potential study partners based on compatibility (subjects, learning style, availability). Returns top matches.',
    category: 'collaboration',
    inputSchema: MatchCandidatesInputSchema,
    outputSchema: MatchCandidatesOutputSchema,
    estimatedLatencyMs: 1500,

    async call(input: MatchCandidatesInput, ctx: AgentContext): Promise<MatchCandidatesOutput> {
      const { limit = 10, minScore = 0.4 } = input

      // 1. Fetch current user's profile and learning profile
      const { data: userProfile, error: userError } = await supabase
        .from('Profile')
        .select('userId, subjects, studyStyle, skillLevel, goals, interests')
        .eq('userId', ctx.userId)
        .single()

      if (userError || !userProfile) {
        throw new Error('User profile not found')
      }

      const { data: userLearning } = await supabase
        .from('LearningProfile')
        .select('strengths, weaknesses')
        .eq('userId', ctx.userId)
        .single()

      // 2. Fetch all potential candidates (exclude self)
      const { data: candidates, error: candidatesError } = await supabase
        .from('Profile')
        .select('userId, subjects, studyStyle, skillLevel, goals, interests')
        .neq('userId', ctx.userId)
        .limit(100) // Process top 100 candidates

      if (candidatesError) {
        throw new Error(`Failed to fetch candidates: ${candidatesError.message}`)
      }

      if (!candidates || candidates.length === 0) {
        return { matches: [], total: 0 }
      }

      // 3. Fetch learning profiles for candidates
      const candidateIds = candidates.map(c => c.userId)
      const { data: candidateLearningProfiles } = await supabase
        .from('LearningProfile')
        .select('userId, strengths, weaknesses')
        .in('userId', candidateIds)

      const learningMap = new Map(
        candidateLearningProfiles?.map(lp => [lp.userId, lp]) || []
      )

      // 4. Compute match scores for each candidate
      const scoredMatches = candidates.map(candidate => {
        const candidateLearning = learningMap.get(candidate.userId)
        const score = computeCompatibilityScore(
          userProfile,
          candidate,
          userLearning,
          candidateLearning
        )

        // Compute facets breakdown
        const facets = computeFacets(userProfile, candidate, userLearning, candidateLearning)

        return {
          userId: candidate.userId,
          score: score.score,
          facets,
        }
      })

      // 5. Filter by minimum score and sort
      const filteredMatches = scoredMatches
        .filter(m => m.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

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
 */
function computeCompatibilityScore(
  user: any,
  candidate: any,
  userLearning: any,
  candidateLearning: any
): { score: number } {
  let score = 0
  let factors = 0

  // Subject overlap (40% weight)
  const userSubjects = new Set(user.subjects || [])
  const candidateSubjects = new Set(candidate.subjects || [])
  const overlap = [...userSubjects].filter(s => candidateSubjects.has(s)).length
  const subjectScore = Math.min(overlap / 3, 1) // Cap at 3 subjects
  score += subjectScore * 0.4
  factors++

  // Learning style compatibility (20% weight)
  if (user.studyStyle && candidate.studyStyle) {
    const styleScore = user.studyStyle === candidate.studyStyle ? 0.8 : 0.7
    score += styleScore * 0.2
    factors++
  }

  // Skill level proximity (15% weight)
  if (user.skillLevel && candidate.skillLevel) {
    // SkillLevel is an enum, so we'll compare as strings
    const skillScore = user.skillLevel === candidate.skillLevel ? 1.0 : 0.6
    score += skillScore * 0.15
    factors++
  }

  // Strength/weakness complementarity (25% weight)
  if (userLearning && candidateLearning) {
    const userStrengths = new Set(userLearning.strengths || [])
    const userWeaknesses = new Set(userLearning.weaknesses || [])
    const candidateStrengths = new Set(candidateLearning.strengths || [])
    const candidateWeaknesses = new Set(candidateLearning.weaknesses || [])

    const userHelpsCandidate = [...userStrengths].filter(s => candidateWeaknesses.has(s)).length
    const candidateHelpsUser = [...candidateStrengths].filter(s => userWeaknesses.has(s)).length

    const complementScore = Math.min((userHelpsCandidate + candidateHelpsUser) / 4, 1)
    score += complementScore * 0.25
    factors++
  }

  return { score: Math.min(score, 1) }
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
  const commonSubjects = [...userSubjects].filter(s => candidateSubjects.has(s))

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

    const theyHelp = [...candidateStrengths].filter(s => userWeaknesses.has(s))
    const youHelp = [...userStrengths].filter(s => candidateWeaknesses.has(s))

    facets.complementarity = {
      theyHelpWith: theyHelp,
      youHelpWith: youHelp,
    }
  }

  return facets
}
