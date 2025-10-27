/**
 * Match Insight Tool - Analyze partner compatibility and availability
 */

import {
  Tool,
  MatchInsightInputSchema,
  MatchInsightOutputSchema,
  MatchInsightInput,
  MatchInsightOutput,
  AgentContext,
} from '../types'
import { SupabaseClient } from '@supabase/supabase-js'
import {
  computeSharedWindows,
  computeNextBestTimes,
  canStudyNow as checkCanStudyNow,
  type AvailabilityWindow,
} from '../lib/availability'

export function createMatchInsightTool(supabase: SupabaseClient): Tool<MatchInsightInput, MatchInsightOutput> {
  return {
    name: 'matchInsight',
    description: 'Analyze compatibility between two study partners, including subject overlap, learning styles, strengths/weaknesses complementarity, and availability for studying now or scheduling later.',
    category: 'collaboration',
    inputSchema: MatchInsightInputSchema,
    outputSchema: MatchInsightOutputSchema,
    estimatedLatencyMs: 1000,

    async call(input: MatchInsightInput, _ctx: AgentContext): Promise<MatchInsightOutput> {
      const { forUserId, candidateId } = input

      // 1. Fetch both profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profile')
        .select('user_id, subjects, learning_style, grade_level, goals, preferences')
        .in('user_id', [forUserId, candidateId])

      if (profileError) throw new Error(`Failed to fetch profiles: ${profileError.message}`)
      if (!profiles || profiles.length < 2) throw new Error('One or both users not found')

      const userProfile = profiles.find(p => p.user_id === forUserId)!
      const candidateProfile = profiles.find(p => p.user_id === candidateId)!

      // 2. Fetch learning profiles (strengths/weaknesses)
      const { data: learningProfiles } = await supabase
        .from('learning_profile')
        .select('user_id, strengths, weaknesses')
        .in('user_id', [forUserId, candidateId])

      const userLearning = learningProfiles?.find(p => p.user_id === forUserId)
      const candidateLearning = learningProfiles?.find(p => p.user_id === candidateId)

      // 3. Compute compatibility score
      const compatibility = computeCompatibilityScore(
        userProfile,
        candidateProfile,
        userLearning,
        candidateLearning
      )

      // 4. Analyze complementary skills
      const complementary = analyzeComplementarySkills(
        userLearning?.strengths || [],
        userLearning?.weaknesses || [],
        candidateLearning?.strengths || [],
        candidateLearning?.weaknesses || []
      )

      // 5. Identify potential risks
      const risks = identifyRisks(userProfile, candidateProfile)

      // 6. Generate joint study plan suggestions
      const jointStudyPlan = generateJointStudyPlan(
        userProfile,
        candidateProfile,
        complementary
      )

      // 7. Fetch availability windows for both users
      const { data: availabilities, error: availError } = await supabase
        .from('availability_block')
        .select('user_id, dow, start_min, end_min, timezone')
        .in('user_id', [forUserId, candidateId])

      // Gracefully handle missing table
      let userWindows: AvailabilityWindow[] = []
      let candidateWindows: AvailabilityWindow[] = []

      if (!availError) {
        userWindows = (availabilities || [])
          .filter(a => a.user_id === forUserId)
          .map(a => ({
            dow: a.dow,
            startMin: a.start_min,
            endMin: a.end_min,
            timezone: a.timezone,
          }))

        candidateWindows = (availabilities || [])
          .filter(a => a.user_id === candidateId)
          .map(a => ({
            dow: a.dow,
            startMin: a.start_min,
            endMin: a.end_min,
            timezone: a.timezone,
          }))
      } else if (availError.code !== '42P01' && !availError.message.includes('does not exist')) {
        // Only throw if it's not a "table doesn't exist" error
        console.error('Error fetching availability:', availError)
      }

      // 8. Compute shared availability windows
      const sharedWindows = computeSharedWindows(userWindows, candidateWindows)

      // 9. Check if they can study NOW (presence + current time in shared window)
      const { data: presenceData } = await supabase
        .from('presence')
        .select('user_id, is_online, current_activity')
        .eq('user_id', candidateId)
        .single()

      const isOnline = presenceData?.is_online &&
                       (presenceData.current_activity === 'available' ||
                        presenceData.current_activity === 'studying')

      const inSharedWindow = checkCanStudyNow(sharedWindows)
      const canStudyNow = isOnline && inSharedWindow

      // 10. Find next best times from shared windows
      const nextBestTimes = computeNextBestTimes(sharedWindows, {
        weeksAhead: 2,
        topK: 5,
        minDurationMin: 30,
      })

      return {
        compatibilityScore: compatibility.score,
        complementarySkills: complementary.skills,
        risks,
        jointStudyPlan,
        canStudyNow,
        nextBestTimes,
      }
    },
  }
}

/**
 * Compute overall compatibility score (0-1)
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
    // Same learning style = 0.8, complementary = 1.0, opposite = 0.5
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

    // Check if one's strength covers other's weakness
    const userHelpsCandidate = [...userStrengths].filter(s => candidateWeaknesses.has(s)).length
    const candidateHelpsUser = [...candidateStrengths].filter(s => userWeaknesses.has(s)).length

    const complementScore = Math.min((userHelpsCandidate + candidateHelpsUser) / 4, 1)
    score += complementScore * 0.25
    factors++
  }

  return { score: Math.min(score, 1) }
}

/**
 * Analyze complementary skills
 */
function analyzeComplementarySkills(
  userStrengths: string[],
  userWeaknesses: string[],
  candidateStrengths: string[],
  candidateWeaknesses: string[]
): { skills: string[] } {
  const skills: string[] = []

  // Find where candidate's strength helps user's weakness
  const candidateStrengthSet = new Set(candidateStrengths)
  for (const weakness of userWeaknesses) {
    if (candidateStrengthSet.has(weakness)) {
      skills.push(`Candidate excels at ${weakness} (your weak spot)`)
    }
  }

  // Find where user's strength helps candidate's weakness
  const userStrengthSet = new Set(userStrengths)
  for (const weakness of candidateWeaknesses) {
    if (userStrengthSet.has(weakness)) {
      skills.push(`You excel at ${weakness} (their weak spot)`)
    }
  }

  // Find mutual strengths
  const mutualStrengths = userStrengths.filter(s => candidateStrengthSet.has(s))
  if (mutualStrengths.length > 0) {
    skills.push(`Shared strengths: ${mutualStrengths.join(', ')}`)
  }

  return { skills }
}

/**
 * Identify potential risks or challenges
 */
function identifyRisks(user: any, candidate: any): string[] {
  const risks: string[] = []

  // No subject overlap
  const userSubjects = new Set(user.subjects || [])
  const candidateSubjects = new Set(candidate.subjects || [])
  const overlap = [...userSubjects].filter(s => candidateSubjects.has(s))
  if (overlap.length === 0) {
    risks.push('No overlapping subjects - may need to find common ground')
  }

  // Very different grade levels
  if (user.grade_level && candidate.grade_level) {
    const gradeDiff = Math.abs(
      parseInt(user.grade_level) - parseInt(candidate.grade_level)
    )
    if (gradeDiff >= 3) {
      risks.push('Significant grade level difference - adjust expectations')
    }
  }

  // Different learning paces (from preferences)
  if (user.preferences?.pace && candidate.preferences?.pace) {
    if (user.preferences.pace !== candidate.preferences.pace) {
      risks.push('Different learning paces - may need to compromise')
    }
  }

  return risks
}

/**
 * Generate joint study plan suggestions
 */
function generateJointStudyPlan(
  user: any,
  candidate: any,
  complementary: { skills: string[] }
): string[] {
  const plan: string[] = []

  // Find common subjects
  const userSubjects = new Set(user.subjects || [])
  const candidateSubjects = new Set(candidate.subjects || [])
  const common = [...userSubjects].filter(s => candidateSubjects.has(s))

  if (common.length > 0) {
    plan.push(`Focus on shared subjects: ${common.join(', ')}`)
  }

  // Suggest teaching approach if complementary skills exist
  if (complementary.skills.length > 0) {
    plan.push('Take turns teaching each other your strong areas')
    plan.push('Create practice problems together for weak spots')
  }

  // General recommendations
  plan.push('Start with 30-45 minute sessions to build rapport')
  plan.push('Set clear goals for each session')

  return plan
}
