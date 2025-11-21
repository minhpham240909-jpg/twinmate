/**
 * Partner Matching Algorithm
 * 
 * Intelligent matching system that scores compatibility between study partners based on:
 * - Subjects (35%) - Shared academic interests
 * - Timezone (25%) - Availability alignment  
 * - Skill Level (15%) - Balanced learning partnerships
 * - Availability (15%) - Schedule compatibility
 * - Study Style (10%) - Learning preference compatibility
 * 
 * Total score: 0-100 (higher = better match)
 */

interface UserProfile {
  id: string
  subjects?: string[]
  timezone?: string
  skillLevel?: string
  availableDays?: string[]
  availableHours?: string[]
  studyStyle?: string
  goals?: string[]
  interests?: string[]
}

interface MatchScore {
  totalScore: number
  breakdown: {
    subjects: number
    timezone: number
    skillLevel: number
    availability: number
    studyStyle: number
  }
  details: {
    sharedSubjects: string[]
    timezoneCompatible: boolean
    skillLevelDifference: number
    sharedDays: string[]
    sharedHours: string[]
    styleCompatible: boolean
  }
}

/**
 * Weights for each matching criterion
 */
const WEIGHTS = {
  SUBJECTS: 0.35, // 35%
  TIMEZONE: 0.25, // 25%
  SKILL_LEVEL: 0.15, // 15%
  AVAILABILITY: 0.15, // 15%
  STUDY_STYLE: 0.10, // 10%
} as const

/**
 * Skill level hierarchy for comparison
 */
const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const

/**
 * Compatible study style pairs
 */
const COMPATIBLE_STYLES: Record<string, string[]> = {
  COLLABORATIVE: ['COLLABORATIVE', 'MIXED'],
  INDEPENDENT: ['INDEPENDENT', 'SOLO', 'MIXED'],
  MIXED: ['COLLABORATIVE', 'INDEPENDENT', 'MIXED', 'VISUAL', 'AUDITORY'],
  VISUAL: ['VISUAL', 'MIXED'],
  AUDITORY: ['AUDITORY', 'MIXED'],
  KINESTHETIC: ['KINESTHETIC', 'MIXED'],
  READING_WRITING: ['READING_WRITING', 'MIXED'],
  SOLO: ['SOLO', 'INDEPENDENT', 'MIXED'],
}

/**
 * Calculate subject compatibility score (0-1)
 */
function calculateSubjectScore(user1: UserProfile, user2: UserProfile): {
  score: number
  sharedSubjects: string[]
} {
  const subjects1 = user1.subjects || []
  const subjects2 = user2.subjects || []

  if (subjects1.length === 0 || subjects2.length === 0) {
    return { score: 0, sharedSubjects: [] }
  }

  // Find shared subjects (case-insensitive)
  const subjects1Lower = subjects1.map(s => s.toLowerCase())
  const subjects2Lower = subjects2.map(s => s.toLowerCase())
  
  const sharedSubjects = subjects1.filter(s => 
    subjects2Lower.includes(s.toLowerCase())
  )

  if (sharedSubjects.length === 0) {
    return { score: 0, sharedSubjects: [] }
  }

  // Score based on percentage of overlap
  const totalUnique = new Set([...subjects1Lower, ...subjects2Lower]).size
  const overlapRatio = sharedSubjects.length / Math.max(subjects1.length, subjects2.length)
  
  // Bonus for multiple shared subjects
  const bonusMultiplier = Math.min(1 + (sharedSubjects.length - 1) * 0.1, 1.5)
  
  const score = Math.min(overlapRatio * bonusMultiplier, 1)

  return { score, sharedSubjects }
}

/**
 * Calculate timezone compatibility score (0-1)
 */
function calculateTimezoneScore(user1: UserProfile, user2: UserProfile): {
  score: number
  compatible: boolean
} {
  const tz1 = user1.timezone
  const tz2 = user2.timezone

  if (!tz1 || !tz2) {
    return { score: 0.5, compatible: true } // Neutral if unknown
  }

  // Same timezone = perfect match
  if (tz1 === tz2) {
    return { score: 1, compatible: true }
  }

  // Parse timezone offsets (e.g., "UTC+8", "UTC-5")
  const extractOffset = (tz: string): number => {
    const match = tz.match(/UTC([+-]\d+)/)
    return match ? parseInt(match[1]) : 0
  }

  const offset1 = extractOffset(tz1)
  const offset2 = extractOffset(tz2)
  const difference = Math.abs(offset1 - offset2)

  // Score decreases with timezone difference
  // 0-2 hours = 0.9+, 3-5 hours = 0.7+, 6-8 hours = 0.5+, 9+ hours = 0.3-
  let score: number
  if (difference <= 2) {
    score = 1 - (difference * 0.05) // 1.0 to 0.9
  } else if (difference <= 5) {
    score = 0.85 - ((difference - 2) * 0.05) // 0.85 to 0.7
  } else if (difference <= 8) {
    score = 0.7 - ((difference - 5) * 0.06) // 0.7 to 0.52
  } else {
    score = Math.max(0.3 - ((difference - 8) * 0.02), 0) // 0.3 down
  }

  const compatible = difference <= 8 // Within 8 hours is workable

  return { score, compatible }
}

/**
 * Calculate skill level compatibility score (0-1)
 */
function calculateSkillLevelScore(user1: UserProfile, user2: UserProfile): {
  score: number
  difference: number
} {
  const level1 = user1.skillLevel
  const level2 = user2.skillLevel

  if (!level1 || !level2) {
    return { score: 0.5, difference: 0 } // Neutral if unknown
  }

  const index1 = SKILL_LEVELS.indexOf(level1 as any)
  const index2 = SKILL_LEVELS.indexOf(level2 as any)

  if (index1 === -1 || index2 === -1) {
    return { score: 0.5, difference: 0 }
  }

  const difference = Math.abs(index1 - index2)

  // Score based on skill level difference
  // Same level = 1.0, 1 level apart = 0.9, 2 levels = 0.7, 3 levels = 0.5
  let score: number
  switch (difference) {
    case 0:
      score = 1.0 // Same level - perfect match
      break
    case 1:
      score = 0.9 // One level apart - great for learning
      break
    case 2:
      score = 0.7 // Two levels apart - workable
      break
    case 3:
      score = 0.5 // Three levels apart - challenging
      break
    default:
      score = 0.3
  }

  return { score, difference }
}

/**
 * Calculate availability compatibility score (0-1)
 */
function calculateAvailabilityScore(user1: UserProfile, user2: UserProfile): {
  score: number
  sharedDays: string[]
  sharedHours: string[]
} {
  const days1 = user1.availableDays || []
  const days2 = user2.availableDays || []
  const hours1 = user1.availableHours || []
  const hours2 = user2.availableHours || []

  if (days1.length === 0 || days2.length === 0) {
    return { score: 0.5, sharedDays: [], sharedHours: [] } // Neutral if unknown
  }

  // Find shared days (case-insensitive)
  const days1Lower = days1.map(d => d.toLowerCase())
  const days2Lower = days2.map(d => d.toLowerCase())
  const sharedDays = days1.filter(d => days2Lower.includes(d.toLowerCase()))

  if (sharedDays.length === 0) {
    return { score: 0, sharedDays: [], sharedHours: [] }
  }

  // Find shared hours if available
  let hoursScore = 0.5 // Default neutral
  let sharedHours: string[] = []
  
  if (hours1.length > 0 && hours2.length > 0) {
    const hours1Lower = hours1.map(h => h.toLowerCase())
    const hours2Lower = hours2.map(h => h.toLowerCase())
    sharedHours = hours1.filter(h => hours2Lower.includes(h.toLowerCase()))
    
    hoursScore = sharedHours.length > 0 ? 1 : 0.3
  }

  // Calculate day overlap score
  const dayOverlapRatio = sharedDays.length / Math.max(days1.length, days2.length)
  
  // Combine day and hour scores (60% days, 40% hours)
  const score = (dayOverlapRatio * 0.6) + (hoursScore * 0.4)

  return { score, sharedDays, sharedHours }
}

/**
 * Calculate study style compatibility score (0-1)
 */
function calculateStudyStyleScore(user1: UserProfile, user2: UserProfile): {
  score: number
  compatible: boolean
} {
  const style1 = user1.studyStyle
  const style2 = user2.studyStyle

  if (!style1 || !style2) {
    return { score: 0.5, compatible: true } // Neutral if unknown
  }

  // Check if styles are compatible
  const compatibleWith1 = COMPATIBLE_STYLES[style1] || []
  const compatibleWith2 = COMPATIBLE_STYLES[style2] || []

  const compatible = 
    compatibleWith1.includes(style2) || 
    compatibleWith2.includes(style1) ||
    style1 === style2

  // Same style = 1.0, compatible = 0.8, incompatible = 0.3
  let score: number
  if (style1 === style2) {
    score = 1.0
  } else if (compatible) {
    score = 0.8
  } else {
    score = 0.3
  }

  return { score, compatible }
}

/**
 * Calculate overall match score between two users
 */
export function calculateMatchScore(user1: UserProfile, user2: UserProfile): MatchScore {
  const subjectResult = calculateSubjectScore(user1, user2)
  const timezoneResult = calculateTimezoneScore(user1, user2)
  const skillResult = calculateSkillLevelScore(user1, user2)
  const availabilityResult = calculateAvailabilityScore(user1, user2)
  const styleResult = calculateStudyStyleScore(user1, user2)

  // Calculate weighted total score (0-100)
  const totalScore = Math.round(
    (subjectResult.score * WEIGHTS.SUBJECTS +
      timezoneResult.score * WEIGHTS.TIMEZONE +
      skillResult.score * WEIGHTS.SKILL_LEVEL +
      availabilityResult.score * WEIGHTS.AVAILABILITY +
      styleResult.score * WEIGHTS.STUDY_STYLE) * 100
  )

  return {
    totalScore,
    breakdown: {
      subjects: Math.round(subjectResult.score * 100),
      timezone: Math.round(timezoneResult.score * 100),
      skillLevel: Math.round(skillResult.score * 100),
      availability: Math.round(availabilityResult.score * 100),
      studyStyle: Math.round(styleResult.score * 100),
    },
    details: {
      sharedSubjects: subjectResult.sharedSubjects,
      timezoneCompatible: timezoneResult.compatible,
      skillLevelDifference: skillResult.difference,
      sharedDays: availabilityResult.sharedDays,
      sharedHours: availabilityResult.sharedHours,
      styleCompatible: styleResult.compatible,
    },
  }
}

/**
 * Find best matches for a user from a list of candidates
 */
export function findBestMatches(
  user: UserProfile,
  candidates: UserProfile[],
  limit: number = 10,
  minScore: number = 40
): Array<{
  user: UserProfile
  matchScore: MatchScore
}> {
  // Calculate scores for all candidates
  const scoredCandidates = candidates
    .filter(candidate => candidate.id !== user.id) // Exclude self
    .map(candidate => ({
      user: candidate,
      matchScore: calculateMatchScore(user, candidate),
    }))
    .filter(result => result.matchScore.totalScore >= minScore) // Filter by minimum score
    .sort((a, b) => b.matchScore.totalScore - a.matchScore.totalScore) // Sort by score desc
    .slice(0, limit) // Take top N

  return scoredCandidates
}

/**
 * Get match quality label based on score
 */
export function getMatchQualityLabel(score: number): string {
  if (score >= 80) return 'Excellent Match'
  if (score >= 70) return 'Great Match'
  if (score >= 60) return 'Good Match'
  if (score >= 50) return 'Fair Match'
  if (score >= 40) return 'Possible Match'
  return 'Low Match'
}

/**
 * Get match quality color for UI
 */
export function getMatchQualityColor(score: number): string {
  if (score >= 80) return 'green'
  if (score >= 70) return 'blue'
  if (score >= 60) return 'cyan'
  if (score >= 50) return 'yellow'
  if (score >= 40) return 'orange'
  return 'gray'
}
