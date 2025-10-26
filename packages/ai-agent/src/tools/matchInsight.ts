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
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function createMatchInsightTool(supabase: SupabaseClient): Tool<MatchInsightInput, MatchInsightOutput> {
  return {
    name: 'matchInsight',
    description: 'Analyze compatibility between two study partners, including subject overlap, learning styles, strengths/weaknesses complementarity, and availability for studying now or scheduling later.',
    category: 'collaboration',
    inputSchema: MatchInsightInputSchema,
    outputSchema: MatchInsightOutputSchema,
    estimatedLatencyMs: 1000,

    async call(input: MatchInsightInput, ctx: AgentContext): Promise<MatchInsightOutput> {
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
      const { data: learningProfiles, error: learningError } = await supabase
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

      // 7. Check online presence (can study now?)
      const { data: presenceData, error: presenceError } = await supabase
        .from('presence')
        .select('user_id, is_online, current_activity')
        .eq('user_id', candidateId)
        .single()

      const canStudyNow = presenceData?.is_online &&
                         (presenceData.current_activity === 'available' ||
                          presenceData.current_activity === 'studying')

      // 8. Find next best times if not available now
      const nextBestTimes = await findNextBestTimes(supabase, forUserId, candidateId)

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

/**
 * Find next best times when both users are available
 */
async function findNextBestTimes(
  supabase: SupabaseClient,
  user1Id: string,
  user2Id: string
): Promise<Array<{ whenISO: string; confidence: number }>> {
  // Fetch availability windows for both users
  const { data: availabilities, error } = await supabase
    .from('availability_block')
    .select('user_id, dow, start_min, end_min, timezone')
    .in('user_id', [user1Id, user2Id])

  if (error || !availabilities) {
    return []
  }

  const user1Windows = availabilities.filter(a => a.user_id === user1Id)
  const user2Windows = availabilities.filter(a => a.user_id === user2Id)

  // Find overlapping windows
  const overlaps: Array<{ whenISO: string; confidence: number }> = []

  for (const w1 of user1Windows) {
    for (const w2 of user2Windows) {
      // Same day of week
      if (w1.dow !== w2.dow) continue

      // Find time overlap
      const overlapStart = Math.max(w1.start_min, w2.start_min)
      const overlapEnd = Math.min(w1.end_min, w2.end_min)

      if (overlapEnd - overlapStart >= 30) { // At least 30 min overlap
        // Calculate next occurrence of this day
        const now = new Date()
        const daysUntil = (w1.dow - now.getDay() + 7) % 7 || 7
        const nextDate = new Date(now)
        nextDate.setDate(now.getDate() + daysUntil)
        nextDate.setHours(Math.floor(overlapStart / 60), overlapStart % 60, 0, 0)

        overlaps.push({
          whenISO: nextDate.toISOString(),
          confidence: (overlapEnd - overlapStart) / 60 / 2, // Confidence based on duration
        })
      }
    }
  }

  // Return top 3 next best times
  return overlaps
    .sort((a, b) => new Date(a.whenISO).getTime() - new Date(b.whenISO).getTime())
    .slice(0, 3)
}
