/**
 * Partner Matching Algorithm v2.0
 *
 * Advanced weighted matching system for Clerva App.
 * Uses multiple components with configurable weights to calculate match percentages.
 *
 * Based on study partner matching best practices:
 * - Jaccard similarity for tag/array fields
 * - Numeric closeness for skill levels
 * - Overlap scoring for availability
 * - Detailed breakdown for transparency
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ProfileData {
  // Array fields (use Jaccard similarity)
  subjects?: string[] | null
  interests?: string[] | null
  goals?: string[] | null
  availableDays?: string[] | null
  availableHours?: string[] | null
  languages?: string[] | null
  aboutYourselfItems?: string[] | null

  // Categorical/enum fields
  skillLevel?: string | null
  studyStyle?: string | null

  // Text fields
  school?: string | null
  timezone?: string | null
  bio?: string | null
  aboutYourself?: string | null
  role?: string | null // Student, Professional, etc.

  // Numeric fields
  age?: number | null

  // Location fields (for proximity matching)
  location_lat?: number | null
  location_lng?: number | null
  location_city?: string | null
  location_country?: string | null

  // Activity tracking
  lastStudyDate?: string | Date | null
  isLookingForPartner?: boolean | null

  // Learning profile (strengths/weaknesses)
  strengths?: string[] | null
  weaknesses?: string[] | null
}

export interface ComponentScore {
  score: number           // 0-1 normalized score for this component
  weight: number          // Weight applied to this component
  weightedScore: number   // score * weight
  details: string         // Human-readable description
  matchItems?: string[]   // Specific items that matched
  bothHaveData: boolean   // Whether both profiles have this data
}

export interface MatchResult {
  /** Final match score 0-100 */
  matchScore: number | null

  /** True if either profile lacks sufficient data */
  matchDataInsufficient: boolean

  /** Human-readable reasons for the match (top matches only) */
  matchReasons: string[]

  /** Detailed breakdown by component */
  matchDetails: MatchDetails | null

  /** Component scores with full breakdown */
  componentScores: Record<string, ComponentScore>

  /** Match quality tier */
  matchTier: 'excellent' | 'good' | 'fair' | 'low' | 'insufficient'

  /** Fields current user should fill for better matching */
  currentUserMissingFields: string[]

  /** Fields partner should fill for better matching */
  partnerMissingFields: string[]

  /** Summary for UI display */
  summary: MatchSummary
}

export interface MatchDetails {
  subjects: { count: number; items: string[]; score: number; bothHaveData: boolean }
  interests: { count: number; items: string[]; score: number; bothHaveData: boolean }
  goals: { count: number; items: string[]; score: number; bothHaveData: boolean }
  availableDays: { count: number; items: string[]; score: number; bothHaveData: boolean }
  availableHours: { count: number; items: string[]; score: number; bothHaveData: boolean }
  skillLevel: { matches: boolean; compatible: boolean; value: string | null; bothHaveData: boolean }
  studyStyle: { matches: boolean; compatible: boolean; value: string | null; bothHaveData: boolean }
  school: { matches: boolean; value: string | null; bothHaveData: boolean }
  timezone: { matches: boolean; offset: number; bothHaveData: boolean }
  strengthsWeaknesses: { complementary: number; items: string[]; bothHaveData: boolean }
}

export interface MatchSummary {
  totalMatched: number           // Number of components with matches
  totalComponents: number        // Number of components compared
  topMatches: string[]           // Top 3 matching areas
  improvementAreas: string[]     // Areas where match could improve
  compatibilityLevel: string     // "High", "Medium", "Low", "Unknown"
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Default weights for each matching component
 * Weights sum to 1.0 for normalized scoring
 * These can be tuned based on what matters most for study partners
 */
export const DEFAULT_WEIGHTS = {
  subjects: 0.28,           // Most important - what they study together
  interests: 0.18,          // Learning interests alignment
  goals: 0.14,              // Study goals alignment
  availableDays: 0.10,      // Schedule compatibility (days)
  availableHours: 0.08,     // Schedule compatibility (hours)
  skillLevel: 0.08,         // Skill level compatibility
  studyStyle: 0.05,         // Study style compatibility
  strengthsWeaknesses: 0.04, // Complementary skills
  school: 0.03,             // Same school bonus
  timezone: 0.02,           // Timezone proximity
} as const

/**
 * Skill level ordering for compatibility scoring
 * Adjacent levels are considered compatible
 */
const SKILL_LEVEL_ORDER: Record<string, number> = {
  'BEGINNER': 0,
  'INTERMEDIATE': 1,
  'ADVANCED': 2,
  'EXPERT': 3,
}

/**
 * Study style compatibility matrix
 * Some styles work well together even if different
 */
const COMPATIBLE_STUDY_STYLES: Record<string, string[]> = {
  'VISUAL': ['VISUAL', 'MIXED', 'READING_WRITING'],
  'AUDITORY': ['AUDITORY', 'MIXED', 'COLLABORATIVE'],
  'KINESTHETIC': ['KINESTHETIC', 'MIXED', 'COLLABORATIVE'],
  'READING_WRITING': ['READING_WRITING', 'MIXED', 'VISUAL', 'INDEPENDENT'],
  'COLLABORATIVE': ['COLLABORATIVE', 'AUDITORY', 'KINESTHETIC', 'MIXED'],
  'INDEPENDENT': ['INDEPENDENT', 'READING_WRITING', 'SOLO'],
  'SOLO': ['SOLO', 'INDEPENDENT'],
  'MIXED': ['MIXED', 'VISUAL', 'AUDITORY', 'KINESTHETIC', 'READING_WRITING', 'COLLABORATIVE'],
}

/**
 * Minimum fields required for meaningful matching
 * Increased from 2 to 3 to prevent false matches with mostly empty profiles
 * User should have at least subjects + interests + one more field
 */
const MIN_FIELDS_FOR_MATCHING = 3

/**
 * Match tier thresholds
 */
const MATCH_TIERS = {
  excellent: 85,
  good: 70,
  fair: 50,
  low: 0,
} as const

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate Jaccard similarity between two arrays
 * Jaccard(A, B) = |A ∩ B| / |A ∪ B|
 * Returns 0 if both arrays are empty
 */
export function jaccard(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 0

  const setA = new Set(a.map(s => s.toLowerCase().trim()))
  const setB = new Set(b.map(s => s.toLowerCase().trim()))

  const intersection = new Set([...setA].filter(x => setB.has(x)))
  const union = new Set([...setA, ...setB])

  if (union.size === 0) return 0
  return intersection.size / union.size
}

/**
 * Get intersection items between two arrays (case-insensitive)
 */
export function getIntersection(a: string[], b: string[]): string[] {
  const setB = new Set(b.map(s => s.toLowerCase().trim()))
  return a.filter(item => setB.has(item.toLowerCase().trim()))
}

/**
 * Calculate numeric closeness between two skill levels
 * Returns 1 for exact match, 0.7 for adjacent levels, 0.4 for 2 levels apart, 0 for 3+
 */
export function skillLevelCloseness(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0

  const levelA = SKILL_LEVEL_ORDER[a.toUpperCase()]
  const levelB = SKILL_LEVEL_ORDER[b.toUpperCase()]

  if (levelA === undefined || levelB === undefined) return 0

  const diff = Math.abs(levelA - levelB)

  if (diff === 0) return 1      // Exact match
  if (diff === 1) return 0.7    // Adjacent levels (compatible)
  if (diff === 2) return 0.4    // 2 levels apart
  return 0                       // Too far apart
}

/**
 * Check if two study styles are compatible
 */
export function studyStyleCompatibility(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0

  const styleA = a.toUpperCase()
  const styleB = b.toUpperCase()

  if (styleA === styleB) return 1  // Exact match

  const compatibleWith = COMPATIBLE_STUDY_STYLES[styleA] || []
  if (compatibleWith.includes(styleB)) return 0.7  // Compatible

  return 0.3  // Different but not incompatible
}

/**
 * Calculate timezone proximity score
 * Returns 1 for same timezone, decreasing for larger differences
 */
export function timezoneProximity(tz1: string | null | undefined, tz2: string | null | undefined): { score: number; offsetHours: number } {
  if (!tz1 || !tz2) return { score: 0, offsetHours: 0 }

  // Simple string match for now
  // TODO: Could use actual timezone offset calculation
  if (tz1 === tz2) return { score: 1, offsetHours: 0 }

  // Try to extract UTC offset or common timezone patterns
  const extractOffset = (tz: string): number | null => {
    // Match patterns like "UTC+5", "GMT-8", etc.
    const match = tz.match(/[+-]?\d+/)
    return match ? parseInt(match[0]) : null
  }

  const offset1 = extractOffset(tz1)
  const offset2 = extractOffset(tz2)

  if (offset1 !== null && offset2 !== null) {
    const diff = Math.abs(offset1 - offset2)
    // Score decreases as timezone difference increases
    // 0-3 hours: good, 4-6 hours: okay, 7+ hours: poor
    const score = Math.max(0, 1 - (diff / 12))
    return { score, offsetHours: diff }
  }

  return { score: 0.5, offsetHours: 0 } // Unknown but not penalized heavily
}

/**
 * Check if a string field has real data
 */
export function hasStringData(str: string | null | undefined): boolean {
  return typeof str === 'string' && str.trim().length > 0
}

/**
 * Check if an array field has real data
 */
export function hasArrayData(arr: string[] | null | undefined): boolean {
  return Array.isArray(arr) && arr.length > 0 && arr.some(item => item && item.trim() !== '')
}

/**
 * Count how many matchable fields a profile has filled
 */
export function countFilledFields(profile: ProfileData | null | undefined): number {
  if (!profile) return 0

  let count = 0
  if (hasArrayData(profile.subjects)) count++
  if (hasArrayData(profile.interests)) count++
  if (hasArrayData(profile.goals)) count++
  if (hasArrayData(profile.availableDays)) count++
  if (hasArrayData(profile.availableHours)) count++
  if (hasStringData(profile.skillLevel)) count++
  if (hasStringData(profile.studyStyle)) count++
  if (hasStringData(profile.school)) count++
  if (hasStringData(profile.timezone)) count++

  return count
}

/**
 * Get list of missing fields for a profile
 */
export function getMissingFields(profile: ProfileData | null | undefined): string[] {
  const missing: string[] = []

  if (!profile) {
    return ['subjects', 'interests', 'goals', 'availability', 'skill level', 'study style']
  }

  if (!hasArrayData(profile.subjects)) missing.push('subjects')
  if (!hasArrayData(profile.interests)) missing.push('interests')
  if (!hasArrayData(profile.goals)) missing.push('goals')
  if (!hasArrayData(profile.availableDays)) missing.push('availability')
  if (!hasStringData(profile.skillLevel)) missing.push('skill level')
  if (!hasStringData(profile.studyStyle)) missing.push('study style')

  return missing
}

/**
 * Check if profile has minimum data for meaningful matching
 */
export function hasMinimumProfileData(profile: ProfileData | null | undefined): boolean {
  return countFilledFields(profile) >= MIN_FIELDS_FOR_MATCHING
}

/**
 * Get match tier based on score
 */
export function getMatchTier(score: number | null): 'excellent' | 'good' | 'fair' | 'low' | 'insufficient' {
  if (score === null) return 'insufficient'
  if (score >= MATCH_TIERS.excellent) return 'excellent'
  if (score >= MATCH_TIERS.good) return 'good'
  if (score >= MATCH_TIERS.fair) return 'fair'
  return 'low'
}

/**
 * Format skill level for display
 */
export function formatSkillLevel(skillLevel: string | null | undefined): string {
  if (!skillLevel) return ''
  return skillLevel.charAt(0).toUpperCase() + skillLevel.slice(1).toLowerCase()
}

/**
 * Format study style for display
 */
export function formatStudyStyle(studyStyle: string | null | undefined): string {
  if (!studyStyle) return ''
  return studyStyle
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// ============================================================================
// MAIN MATCHING FUNCTION
// ============================================================================

/**
 * Calculate comprehensive match score between two profiles
 *
 * This uses weighted scoring across multiple components:
 * - Subjects: Jaccard similarity (most important)
 * - Interests: Jaccard similarity
 * - Goals: Jaccard similarity
 * - Availability: Overlap in days and hours
 * - Skill Level: Numeric closeness
 * - Study Style: Compatibility matrix
 * - School: Exact match bonus
 * - Timezone: Proximity score
 * - Strengths/Weaknesses: Complementary matching
 */
export function calculateMatchScore(
  currentUserProfile: ProfileData | null | undefined,
  partnerProfile: ProfileData | null | undefined,
  weights: typeof DEFAULT_WEIGHTS = DEFAULT_WEIGHTS
): MatchResult {
  const currentUserMissingFields = getMissingFields(currentUserProfile)
  const partnerMissingFields = getMissingFields(partnerProfile)

  const currentFilledCount = countFilledFields(currentUserProfile)
  const partnerFilledCount = countFilledFields(partnerProfile)

  // Check if we have enough data
  // Both profiles must have minimum fields AND at least one key array field (subjects or interests)
  const currentHasKeyData = hasArrayData(currentUserProfile?.subjects) || hasArrayData(currentUserProfile?.interests)
  const partnerHasKeyData = hasArrayData(partnerProfile?.subjects) || hasArrayData(partnerProfile?.interests)

  const canCalculate =
    currentFilledCount >= MIN_FIELDS_FOR_MATCHING &&
    partnerFilledCount >= MIN_FIELDS_FOR_MATCHING &&
    currentHasKeyData &&
    partnerHasKeyData &&
    currentUserProfile && partnerProfile

  // Initialize empty result for insufficient data case
  const emptyResult: MatchResult = {
    matchScore: null,
    matchDataInsufficient: true,
    matchReasons: [],
    matchDetails: null,
    componentScores: {},
    matchTier: 'insufficient',
    currentUserMissingFields,
    partnerMissingFields,
    summary: {
      totalMatched: 0,
      totalComponents: 0,
      topMatches: [],
      improvementAreas: currentUserMissingFields.slice(0, 3),
      compatibilityLevel: 'Unknown',
    }
  }

  if (!canCalculate || !currentUserProfile || !partnerProfile) {
    return emptyResult
  }

  // Calculate each component score
  const componentScores: Record<string, ComponentScore> = {}

  // ===== SUBJECTS =====
  const currentSubjects = currentUserProfile.subjects || []
  const partnerSubjects = partnerProfile.subjects || []
  const bothHaveSubjects = hasArrayData(currentSubjects) && hasArrayData(partnerSubjects)

  if (bothHaveSubjects) {
    const subjectScore = jaccard(currentSubjects, partnerSubjects)
    const matchedSubjects = getIntersection(currentSubjects, partnerSubjects)

    componentScores.subjects = {
      score: subjectScore,
      weight: weights.subjects,
      weightedScore: subjectScore * weights.subjects,
      details: matchedSubjects.length > 0
        ? `${matchedSubjects.length} shared subject${matchedSubjects.length > 1 ? 's' : ''}`
        : 'No shared subjects',
      matchItems: matchedSubjects,
      bothHaveData: true,
    }
  } else {
    componentScores.subjects = {
      score: 0,
      weight: weights.subjects,
      weightedScore: 0,
      details: 'Missing data',
      matchItems: [],
      bothHaveData: false,
    }
  }

  // ===== INTERESTS =====
  const currentInterests = currentUserProfile.interests || []
  const partnerInterests = partnerProfile.interests || []
  const bothHaveInterests = hasArrayData(currentInterests) && hasArrayData(partnerInterests)

  if (bothHaveInterests) {
    const interestScore = jaccard(currentInterests, partnerInterests)
    const matchedInterests = getIntersection(currentInterests, partnerInterests)

    componentScores.interests = {
      score: interestScore,
      weight: weights.interests,
      weightedScore: interestScore * weights.interests,
      details: matchedInterests.length > 0
        ? `${matchedInterests.length} shared interest${matchedInterests.length > 1 ? 's' : ''}`
        : 'No shared interests',
      matchItems: matchedInterests,
      bothHaveData: true,
    }
  } else {
    componentScores.interests = {
      score: 0,
      weight: weights.interests,
      weightedScore: 0,
      details: 'Missing data',
      matchItems: [],
      bothHaveData: false,
    }
  }

  // ===== GOALS =====
  const currentGoals = currentUserProfile.goals || []
  const partnerGoals = partnerProfile.goals || []
  const bothHaveGoals = hasArrayData(currentGoals) && hasArrayData(partnerGoals)

  if (bothHaveGoals) {
    const goalScore = jaccard(currentGoals, partnerGoals)
    const matchedGoals = getIntersection(currentGoals, partnerGoals)

    componentScores.goals = {
      score: goalScore,
      weight: weights.goals,
      weightedScore: goalScore * weights.goals,
      details: matchedGoals.length > 0
        ? `${matchedGoals.length} shared goal${matchedGoals.length > 1 ? 's' : ''}`
        : 'No shared goals',
      matchItems: matchedGoals,
      bothHaveData: true,
    }
  } else {
    componentScores.goals = {
      score: 0,
      weight: weights.goals,
      weightedScore: 0,
      details: 'Missing data',
      matchItems: [],
      bothHaveData: false,
    }
  }

  // ===== AVAILABLE DAYS =====
  const currentDays = currentUserProfile.availableDays || []
  const partnerDays = partnerProfile.availableDays || []
  const bothHaveDays = hasArrayData(currentDays) && hasArrayData(partnerDays)

  if (bothHaveDays) {
    const dayScore = jaccard(currentDays, partnerDays)
    const matchedDays = getIntersection(currentDays, partnerDays)

    componentScores.availableDays = {
      score: dayScore,
      weight: weights.availableDays,
      weightedScore: dayScore * weights.availableDays,
      details: matchedDays.length > 0
        ? `${matchedDays.length} matching day${matchedDays.length > 1 ? 's' : ''}`
        : 'No schedule overlap',
      matchItems: matchedDays,
      bothHaveData: true,
    }
  } else {
    componentScores.availableDays = {
      score: 0,
      weight: weights.availableDays,
      weightedScore: 0,
      details: 'Missing data',
      matchItems: [],
      bothHaveData: false,
    }
  }

  // ===== AVAILABLE HOURS =====
  const currentHours = currentUserProfile.availableHours || []
  const partnerHours = partnerProfile.availableHours || []
  const bothHaveHours = hasArrayData(currentHours) && hasArrayData(partnerHours)

  if (bothHaveHours) {
    const hourScore = jaccard(currentHours, partnerHours)
    const matchedHours = getIntersection(currentHours, partnerHours)

    componentScores.availableHours = {
      score: hourScore,
      weight: weights.availableHours,
      weightedScore: hourScore * weights.availableHours,
      details: matchedHours.length > 0
        ? `${matchedHours.length} matching time slot${matchedHours.length > 1 ? 's' : ''}`
        : 'No time overlap',
      matchItems: matchedHours,
      bothHaveData: true,
    }
  } else {
    componentScores.availableHours = {
      score: 0,
      weight: weights.availableHours,
      weightedScore: 0,
      details: 'Missing data',
      matchItems: [],
      bothHaveData: false,
    }
  }

  // ===== SKILL LEVEL =====
  const currentSkill = currentUserProfile.skillLevel
  const partnerSkill = partnerProfile.skillLevel
  const bothHaveSkill = hasStringData(currentSkill) && hasStringData(partnerSkill)

  if (bothHaveSkill) {
    const skillScore = skillLevelCloseness(currentSkill, partnerSkill)
    const isExactMatch = currentSkill?.toUpperCase() === partnerSkill?.toUpperCase()
    const isCompatible = skillScore >= 0.7

    componentScores.skillLevel = {
      score: skillScore,
      weight: weights.skillLevel,
      weightedScore: skillScore * weights.skillLevel,
      details: isExactMatch
        ? `Same skill level (${formatSkillLevel(partnerSkill)})`
        : isCompatible
          ? `Compatible skill levels`
          : `Different skill levels`,
      matchItems: isExactMatch ? [formatSkillLevel(partnerSkill!)] : [],
      bothHaveData: true,
    }
  } else {
    componentScores.skillLevel = {
      score: 0,
      weight: weights.skillLevel,
      weightedScore: 0,
      details: 'Missing data',
      matchItems: [],
      bothHaveData: false,
    }
  }

  // ===== STUDY STYLE =====
  const currentStyle = currentUserProfile.studyStyle
  const partnerStyle = partnerProfile.studyStyle
  const bothHaveStyle = hasStringData(currentStyle) && hasStringData(partnerStyle)

  if (bothHaveStyle) {
    const styleScore = studyStyleCompatibility(currentStyle, partnerStyle)
    const isExactMatch = currentStyle?.toUpperCase() === partnerStyle?.toUpperCase()
    const isCompatible = styleScore >= 0.7

    componentScores.studyStyle = {
      score: styleScore,
      weight: weights.studyStyle,
      weightedScore: styleScore * weights.studyStyle,
      details: isExactMatch
        ? `Same study style (${formatStudyStyle(partnerStyle)})`
        : isCompatible
          ? `Compatible study styles`
          : `Different study styles`,
      matchItems: isExactMatch ? [formatStudyStyle(partnerStyle!)] : [],
      bothHaveData: true,
    }
  } else {
    componentScores.studyStyle = {
      score: 0,
      weight: weights.studyStyle,
      weightedScore: 0,
      details: 'Missing data',
      matchItems: [],
      bothHaveData: false,
    }
  }

  // ===== STRENGTHS/WEAKNESSES (Complementary) =====
  const currentStrengths = currentUserProfile.strengths || []
  const partnerStrengths = partnerProfile.strengths || []
  const currentWeaknesses = currentUserProfile.weaknesses || []
  const partnerWeaknesses = partnerProfile.weaknesses || []

  const hasStrengthsWeaknesses =
    (hasArrayData(currentStrengths) || hasArrayData(currentWeaknesses)) &&
    (hasArrayData(partnerStrengths) || hasArrayData(partnerWeaknesses))

  if (hasStrengthsWeaknesses) {
    // Look for complementary matches:
    // - Partner's strengths match your weaknesses
    // - Your strengths match partner's weaknesses
    const partnerHelpsYou = getIntersection(partnerStrengths, currentWeaknesses)
    const youHelpPartner = getIntersection(currentStrengths, partnerWeaknesses)
    const complementaryMatches = [...new Set([...partnerHelpsYou, ...youHelpPartner])]

    // Score based on how many complementary matches found
    const maxPossible = Math.max(
      currentWeaknesses.length + partnerWeaknesses.length,
      1
    )
    const complementaryScore = Math.min(complementaryMatches.length / maxPossible, 1)

    componentScores.strengthsWeaknesses = {
      score: complementaryScore,
      weight: weights.strengthsWeaknesses,
      weightedScore: complementaryScore * weights.strengthsWeaknesses,
      details: complementaryMatches.length > 0
        ? `${complementaryMatches.length} complementary skill${complementaryMatches.length > 1 ? 's' : ''}`
        : 'No complementary skills found',
      matchItems: complementaryMatches,
      bothHaveData: true,
    }
  } else {
    componentScores.strengthsWeaknesses = {
      score: 0,
      weight: weights.strengthsWeaknesses,
      weightedScore: 0,
      details: 'Missing data',
      matchItems: [],
      bothHaveData: false,
    }
  }

  // ===== SCHOOL =====
  const currentSchool = currentUserProfile.school
  const partnerSchool = partnerProfile.school
  const bothHaveSchool = hasStringData(currentSchool) && hasStringData(partnerSchool)

  if (bothHaveSchool) {
    const schoolMatch = currentSchool?.toLowerCase().trim() === partnerSchool?.toLowerCase().trim()

    componentScores.school = {
      score: schoolMatch ? 1 : 0,
      weight: weights.school,
      weightedScore: schoolMatch ? weights.school : 0,
      details: schoolMatch ? `Same school (${partnerSchool})` : 'Different schools',
      matchItems: schoolMatch ? [partnerSchool!] : [],
      bothHaveData: true,
    }
  } else {
    componentScores.school = {
      score: 0,
      weight: weights.school,
      weightedScore: 0,
      details: 'Missing data',
      matchItems: [],
      bothHaveData: false,
    }
  }

  // ===== TIMEZONE =====
  const currentTimezone = currentUserProfile.timezone
  const partnerTimezone = partnerProfile.timezone
  const bothHaveTimezone = hasStringData(currentTimezone) && hasStringData(partnerTimezone)

  if (bothHaveTimezone) {
    const tzResult = timezoneProximity(currentTimezone, partnerTimezone)

    componentScores.timezone = {
      score: tzResult.score,
      weight: weights.timezone,
      weightedScore: tzResult.score * weights.timezone,
      details: tzResult.score >= 0.9
        ? 'Same timezone'
        : tzResult.offsetHours > 0
          ? `${tzResult.offsetHours}h timezone difference`
          : 'Compatible timezone',
      matchItems: tzResult.score >= 0.9 ? [partnerTimezone!] : [],
      bothHaveData: true,
    }
  } else {
    componentScores.timezone = {
      score: 0,
      weight: weights.timezone,
      weightedScore: 0,
      details: 'Missing data',
      matchItems: [],
      bothHaveData: false,
    }
  }

  // ===== CALCULATE FINAL SCORE =====

  // Only count components where both profiles have data
  const activeComponents = Object.values(componentScores).filter(c => c.bothHaveData)

  // Require at least 2 active components for a valid score
  // AND at least one must be a major component (subjects or interests)
  const hasSubjectsOrInterests =
    componentScores.subjects?.bothHaveData || componentScores.interests?.bothHaveData

  if (activeComponents.length < 2 || !hasSubjectsOrInterests) {
    return {
      ...emptyResult,
      matchDataInsufficient: true,
      matchReasons: [],
      summary: {
        totalMatched: 0,
        totalComponents: activeComponents.length,
        topMatches: [],
        improvementAreas: [...currentUserMissingFields, ...partnerMissingFields].slice(0, 3),
        compatibilityLevel: 'Unknown',
      }
    }
  }

  // Calculate weighted sum, normalized by active weights
  const totalWeightedScore = activeComponents.reduce((sum, c) => sum + c.weightedScore, 0)
  const totalActiveWeight = activeComponents.reduce((sum, c) => sum + c.weight, 0)

  // Normalize to 0-100 scale
  const normalizedScore = totalActiveWeight > 0
    ? Math.round((totalWeightedScore / totalActiveWeight) * 100)
    : 0

  // Apply a confidence penalty if we have limited data
  // If less than 4 active components, reduce score slightly to indicate lower confidence
  const confidenceFactor = activeComponents.length >= 4 ? 1.0 : 0.85 + (activeComponents.length * 0.05)
  const adjustedScore = Math.round(normalizedScore * confidenceFactor)

  const finalScore = Math.min(Math.max(adjustedScore, 0), 100)
  const matchTier = getMatchTier(finalScore)

  // Generate match reasons (only for components with actual matches)
  const matchReasons = activeComponents
    .filter(c => c.score > 0 && c.matchItems && c.matchItems.length > 0)
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 5)
    .map(c => c.details)

  // Build match details for backward compatibility
  const matchDetails: MatchDetails = {
    subjects: {
      count: componentScores.subjects?.matchItems?.length || 0,
      items: componentScores.subjects?.matchItems || [],
      score: Math.round((componentScores.subjects?.score || 0) * 100),
      bothHaveData: componentScores.subjects?.bothHaveData || false,
    },
    interests: {
      count: componentScores.interests?.matchItems?.length || 0,
      items: componentScores.interests?.matchItems || [],
      score: Math.round((componentScores.interests?.score || 0) * 100),
      bothHaveData: componentScores.interests?.bothHaveData || false,
    },
    goals: {
      count: componentScores.goals?.matchItems?.length || 0,
      items: componentScores.goals?.matchItems || [],
      score: Math.round((componentScores.goals?.score || 0) * 100),
      bothHaveData: componentScores.goals?.bothHaveData || false,
    },
    availableDays: {
      count: componentScores.availableDays?.matchItems?.length || 0,
      items: componentScores.availableDays?.matchItems || [],
      score: Math.round((componentScores.availableDays?.score || 0) * 100),
      bothHaveData: componentScores.availableDays?.bothHaveData || false,
    },
    availableHours: {
      count: componentScores.availableHours?.matchItems?.length || 0,
      items: componentScores.availableHours?.matchItems || [],
      score: Math.round((componentScores.availableHours?.score || 0) * 100),
      bothHaveData: componentScores.availableHours?.bothHaveData || false,
    },
    skillLevel: {
      matches: componentScores.skillLevel?.score === 1,
      compatible: (componentScores.skillLevel?.score || 0) >= 0.7,
      value: partnerSkill || null,
      bothHaveData: componentScores.skillLevel?.bothHaveData || false,
    },
    studyStyle: {
      matches: componentScores.studyStyle?.score === 1,
      compatible: (componentScores.studyStyle?.score || 0) >= 0.7,
      value: partnerStyle || null,
      bothHaveData: componentScores.studyStyle?.bothHaveData || false,
    },
    school: {
      matches: componentScores.school?.score === 1,
      value: partnerSchool || null,
      bothHaveData: componentScores.school?.bothHaveData || false,
    },
    timezone: {
      matches: componentScores.timezone?.score === 1,
      offset: 0, // Could be enhanced with actual offset
      bothHaveData: componentScores.timezone?.bothHaveData || false,
    },
    strengthsWeaknesses: {
      complementary: componentScores.strengthsWeaknesses?.matchItems?.length || 0,
      items: componentScores.strengthsWeaknesses?.matchItems || [],
      bothHaveData: componentScores.strengthsWeaknesses?.bothHaveData || false,
    },
  }

  // Build summary
  const summary: MatchSummary = {
    totalMatched: activeComponents.filter(c => c.score > 0).length,
    totalComponents: activeComponents.length,
    topMatches: matchReasons.slice(0, 3),
    improvementAreas: currentUserMissingFields.slice(0, 3),
    compatibilityLevel: matchTier === 'excellent' ? 'High'
      : matchTier === 'good' ? 'Good'
      : matchTier === 'fair' ? 'Medium'
      : matchTier === 'low' ? 'Low'
      : 'Unknown',
  }

  return {
    matchScore: finalScore,
    matchDataInsufficient: false,
    matchReasons,
    matchDetails,
    componentScores,
    matchTier,
    currentUserMissingFields,
    partnerMissingFields,
    summary,
  }
}

// ============================================================================
// SORTING & FILTERING UTILITIES
// ============================================================================

/**
 * Sort partners by match score (highest first)
 */
export function sortByMatchScore<T extends { matchScore: number | null }>(
  partners: T[]
): T[] {
  return [...partners].sort((a, b) => {
    const scoreA = a.matchScore ?? -1
    const scoreB = b.matchScore ?? -1
    return scoreB - scoreA
  })
}

/**
 * Filter partners by minimum match score
 */
export function filterByMinScore<T extends { matchScore: number | null }>(
  partners: T[],
  minScore: number
): T[] {
  return partners.filter(p => p.matchScore !== null && p.matchScore >= minScore)
}

/**
 * Get weighted-random selection (higher scores more likely to be selected)
 * Useful for random partner loading that still prefers better matches
 */
export function weightedRandomSelect<T extends { matchScore: number | null }>(
  partners: T[],
  count: number
): T[] {
  if (partners.length <= count) return partners

  // Calculate weights (score^2 + 1 to avoid zero weights)
  const weights = partners.map(p => Math.pow((p.matchScore ?? 0) + 1, 2))

  const selected: T[] = []
  const remaining = [...partners]
  const remainingWeights = [...weights]

  for (let i = 0; i < count && remaining.length > 0; i++) {
    // Select based on weighted probability
    let random = Math.random() * remainingWeights.reduce((s, w) => s + w, 0)
    let selectedIndex = 0

    for (let j = 0; j < remainingWeights.length; j++) {
      random -= remainingWeights[j]
      if (random <= 0) {
        selectedIndex = j
        break
      }
    }

    selected.push(remaining[selectedIndex])
    remaining.splice(selectedIndex, 1)
    remainingWeights.splice(selectedIndex, 1)
  }

  return selected
}
