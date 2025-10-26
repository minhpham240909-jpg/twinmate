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
        .from('profile')
        .select('user_id, subjects, learning_style, grade_level, goals, preferences')
        .eq('user_id', ctx.userId)
        .single()

      if (userError || !userProfile) {
        throw new Error('User profile not found')
      }

      const { data: userLearning } = await supabase
        .from('learning_profile')
        .select('strengths, weaknesses')
        .eq('user_id', ctx.userId)
        .single()

      // 2. Fetch all potential candidates (exclude self)
      const { data: candidates, error: candidatesError } = await supabase
        .from('profile')
        .select('user_id, subjects, learning_style, grade_level, goals, preferences')
        .neq('user_id', ctx.userId)
        .limit(100) // Process top 100 candidates

      if (candidatesError) {
        throw new Error(`Failed to fetch candidates: ${candidatesError.message}`)
      }

      if (!candidates || candidates.length === 0) {
        return { matches: [], total: 0 }
      }

      // 3. Fetch learning profiles for candidates
      const candidateIds = candidates.map(c => c.user_id)
      const { data: candidateLearningProfiles } = await supabase
        .from('learning_profile')
        .select('user_id, strengths, weaknesses')
        .in('user_id', candidateIds)

      const learningMap = new Map(
        candidateLearningProfiles?.map(lp => [lp.user_id, lp]) || []
      )

      // 4. Compute match scores for each candidate
      const scoredMatches = candidates.map(candidate => {
        const candidateLearning = learningMap.get(candidate.user_id)
        const score = computeCompatibilityScore(
          userProfile,
          candidate,
          userLearning,
          candidateLearning
        )

        // Compute facets breakdown
        const facets = computeFacets(userProfile, candidate, userLearning, candidateLearning)

        return {
          userId: candidate.user_id,
          score: score.score,
          facets,
        }
      })

      // 5. Filter by minimum score and sort
      const filteredMatches = scoredMatches
        .filter(m => m.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      // 6. Optionally cache results in match_candidate table
      if (filteredMatches.length > 0) {
        const cacheRecords = filteredMatches.map(m => ({
          user_id: ctx.userId,
          candidate_id: m.userId,
          score: m.score,
          facets: m.facets,
          computed_at: new Date().toISOString(),
        }))

        // Delete old cache entries for this user
        await supabase
          .from('match_candidate')
          .delete()
          .eq('user_id', ctx.userId)

        // Insert new cache
        await supabase
          .from('match_candidate')
          .insert(cacheRecords)
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
  if (user.learning_style && candidate.learning_style) {
    const styleScore = user.learning_style === candidate.learning_style ? 0.8 : 0.7
    score += styleScore * 0.2
    factors++
  }

  // Grade level proximity (15% weight)
  if (user.grade_level && candidate.grade_level) {
    const gradeDiff = Math.abs(
      parseInt(user.grade_level) - parseInt(candidate.grade_level)
    )
    const gradeScore = Math.max(0, 1 - gradeDiff * 0.2)
    score += gradeScore * 0.15
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
    learningStyleMatch: user.learning_style === candidate.learning_style,
    gradeLevelDiff: user.grade_level && candidate.grade_level
      ? Math.abs(parseInt(user.grade_level) - parseInt(candidate.grade_level))
      : null,
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
