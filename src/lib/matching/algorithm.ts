/**
 * Partner Matching Algorithm
 * 
 * Calculates accurate match percentages based on REAL profile data only.
 * Returns null/0 when profiles don't have enough data for meaningful matching.
 */

export interface ProfileData {
  subjects?: string[] | null
  interests?: string[] | null
  goals?: string[] | null
  availableDays?: string[] | null
  skillLevel?: string | null
  studyStyle?: string | null
}

export interface MatchResult {
  /** Match score from 0-100. null if insufficient data */
  matchScore: number | null
  /** Reasons for the match (only real matches) */
  matchReasons: string[]
  /** True if either profile lacks sufficient data for matching */
  matchDataInsufficient: boolean
  /** Details about which fields matched */
  matchDetails: MatchDetails | null
  /** Fields the current user needs to fill for better matching */
  currentUserMissingFields: string[]
  /** Fields the partner needs to fill for better matching */
  partnerMissingFields: string[]
}

export interface MatchDetails {
  subjects: { count: number; items: string[]; score: number; bothHaveData: boolean }
  interests: { count: number; items: string[]; score: number; bothHaveData: boolean }
  goals: { count: number; items: string[]; score: number; bothHaveData: boolean }
  availableDays: { count: number; items: string[]; score: number; bothHaveData: boolean }
  skillLevel: { matches: boolean; value: string | null; bothHaveData: boolean }
  studyStyle: { matches: boolean; value: string | null; bothHaveData: boolean }
}

// Minimum number of fields that must be filled for meaningful matching
const MIN_FIELDS_FOR_MATCHING = 2

// Point values for each matching criterion
const SCORING = {
  SUBJECT_FIRST_TWO: 12, // First 2 subjects worth more
  SUBJECT_ADDITIONAL: 4,  // Additional subjects
  SUBJECT_MAX: 32,
  
  INTEREST_FIRST_TWO: 8,
  INTEREST_ADDITIONAL: 3,
  INTEREST_MAX: 22,
  
  GOAL_EACH: 8,
  GOAL_MAX: 16,
  
  DAY_EACH: 3,
  DAY_MAX: 15,
  
  SKILL_LEVEL: 10,
  STUDY_STYLE: 5,
}

/**
 * Check if an array has real data (non-empty array with at least one item)
 */
function hasArrayData(arr: string[] | null | undefined): boolean {
  return Array.isArray(arr) && arr.length > 0 && arr.some(item => item && item.trim() !== '')
}

/**
 * Check if a string field has real data
 */
function hasStringData(str: string | null | undefined): boolean {
  return typeof str === 'string' && str.trim() !== ''
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
  if (hasStringData(profile.skillLevel)) count++
  if (hasStringData(profile.studyStyle)) count++
  
  return count
}

/**
 * Get list of missing fields for a profile
 */
export function getMissingFields(profile: ProfileData | null | undefined): string[] {
  const missing: string[] = []
  if (!profile) {
    return ['subjects', 'interests', 'goals', 'skill level', 'study style']
  }
  
  if (!hasArrayData(profile.subjects)) missing.push('subjects')
  if (!hasArrayData(profile.interests)) missing.push('interests')
  if (!hasArrayData(profile.goals)) missing.push('goals')
  if (!hasStringData(profile.skillLevel)) missing.push('skill level')
  if (!hasStringData(profile.studyStyle)) missing.push('study style')
  
  return missing
}

/**
 * Calculate match score between two profiles
 * 
 * Key principles:
 * 1. Both profiles must have at least MIN_FIELDS_FOR_MATCHING filled
 * 2. Only compare fields where BOTH profiles have data
 * 3. Match reasons only show REAL matches, not assumptions
 * 4. Returns null score if insufficient data
 */
export function calculateMatchScore(
  currentUserProfile: ProfileData | null | undefined,
  partnerProfile: ProfileData | null | undefined
): MatchResult {
  const currentUserMissingFields = getMissingFields(currentUserProfile)
  const partnerMissingFields = getMissingFields(partnerProfile)
  
  const currentUserFilledCount = countFilledFields(currentUserProfile)
  const partnerFilledCount = countFilledFields(partnerProfile)
  
  // Check if we have enough data for meaningful matching
  const canCalculateMeaningfulMatch = 
    currentUserFilledCount >= MIN_FIELDS_FOR_MATCHING && 
    partnerFilledCount >= MIN_FIELDS_FOR_MATCHING
  
  if (!canCalculateMeaningfulMatch || !currentUserProfile || !partnerProfile) {
    return {
      matchScore: null,
      matchReasons: [],
      matchDataInsufficient: true,
      matchDetails: null,
      currentUserMissingFields,
      partnerMissingFields,
    }
  }
  
  let totalScore = 0
  let maxPossibleScore = 0
  const matchReasons: string[] = []
  
  // Initialize match details
  const matchDetails: MatchDetails = {
    subjects: { count: 0, items: [], score: 0, bothHaveData: false },
    interests: { count: 0, items: [], score: 0, bothHaveData: false },
    goals: { count: 0, items: [], score: 0, bothHaveData: false },
    availableDays: { count: 0, items: [], score: 0, bothHaveData: false },
    skillLevel: { matches: false, value: null, bothHaveData: false },
    studyStyle: { matches: false, value: null, bothHaveData: false },
  }
  
  // === SUBJECTS ===
  const currentSubjects = currentUserProfile.subjects || []
  const partnerSubjects = partnerProfile.subjects || []
  const bothHaveSubjects = hasArrayData(currentSubjects) && hasArrayData(partnerSubjects)
  
  if (bothHaveSubjects) {
    maxPossibleScore += SCORING.SUBJECT_MAX
    matchDetails.subjects.bothHaveData = true
    
    const commonSubjects = currentSubjects.filter(s => partnerSubjects.includes(s))
    matchDetails.subjects.items = commonSubjects
    matchDetails.subjects.count = commonSubjects.length
    
    if (commonSubjects.length > 0) {
      const firstTwo = Math.min(commonSubjects.length, 2) * SCORING.SUBJECT_FIRST_TWO
      const additional = Math.max(0, commonSubjects.length - 2) * SCORING.SUBJECT_ADDITIONAL
      const subjectScore = Math.min(firstTwo + additional, SCORING.SUBJECT_MAX)
      
      totalScore += subjectScore
      matchDetails.subjects.score = subjectScore
      matchReasons.push(`${commonSubjects.length} shared subject${commonSubjects.length > 1 ? 's' : ''}`)
    }
  }
  
  // === INTERESTS ===
  const currentInterests = currentUserProfile.interests || []
  const partnerInterests = partnerProfile.interests || []
  const bothHaveInterests = hasArrayData(currentInterests) && hasArrayData(partnerInterests)
  
  if (bothHaveInterests) {
    maxPossibleScore += SCORING.INTEREST_MAX
    matchDetails.interests.bothHaveData = true
    
    const commonInterests = currentInterests.filter(i => partnerInterests.includes(i))
    matchDetails.interests.items = commonInterests
    matchDetails.interests.count = commonInterests.length
    
    if (commonInterests.length > 0) {
      const firstTwo = Math.min(commonInterests.length, 2) * SCORING.INTEREST_FIRST_TWO
      const additional = Math.max(0, commonInterests.length - 2) * SCORING.INTEREST_ADDITIONAL
      const interestScore = Math.min(firstTwo + additional, SCORING.INTEREST_MAX)
      
      totalScore += interestScore
      matchDetails.interests.score = interestScore
      matchReasons.push(`${commonInterests.length} shared interest${commonInterests.length > 1 ? 's' : ''}`)
    }
  }
  
  // === GOALS ===
  const currentGoals = currentUserProfile.goals || []
  const partnerGoals = partnerProfile.goals || []
  const bothHaveGoals = hasArrayData(currentGoals) && hasArrayData(partnerGoals)
  
  if (bothHaveGoals) {
    maxPossibleScore += SCORING.GOAL_MAX
    matchDetails.goals.bothHaveData = true
    
    const commonGoals = currentGoals.filter(g => partnerGoals.includes(g))
    matchDetails.goals.items = commonGoals
    matchDetails.goals.count = commonGoals.length
    
    if (commonGoals.length > 0) {
      const goalScore = Math.min(commonGoals.length * SCORING.GOAL_EACH, SCORING.GOAL_MAX)
      
      totalScore += goalScore
      matchDetails.goals.score = goalScore
      matchReasons.push(`${commonGoals.length} shared goal${commonGoals.length > 1 ? 's' : ''}`)
    }
  }
  
  // === AVAILABLE DAYS ===
  const currentDays = currentUserProfile.availableDays || []
  const partnerDays = partnerProfile.availableDays || []
  const bothHaveDays = hasArrayData(currentDays) && hasArrayData(partnerDays)
  
  if (bothHaveDays) {
    maxPossibleScore += SCORING.DAY_MAX
    matchDetails.availableDays.bothHaveData = true
    
    const commonDays = currentDays.filter(d => partnerDays.includes(d))
    matchDetails.availableDays.items = commonDays
    matchDetails.availableDays.count = commonDays.length
    
    if (commonDays.length > 0) {
      const dayScore = Math.min(commonDays.length * SCORING.DAY_EACH, SCORING.DAY_MAX)
      
      totalScore += dayScore
      matchDetails.availableDays.score = dayScore
      matchReasons.push(`${commonDays.length} matching day${commonDays.length > 1 ? 's' : ''}`)
    }
  }
  
  // === SKILL LEVEL ===
  const currentSkill = currentUserProfile.skillLevel
  const partnerSkill = partnerProfile.skillLevel
  const bothHaveSkill = hasStringData(currentSkill) && hasStringData(partnerSkill)
  
  if (bothHaveSkill) {
    maxPossibleScore += SCORING.SKILL_LEVEL
    matchDetails.skillLevel.bothHaveData = true
    matchDetails.skillLevel.value = partnerSkill!
    
    if (currentSkill === partnerSkill) {
      totalScore += SCORING.SKILL_LEVEL
      matchDetails.skillLevel.matches = true
      matchReasons.push('Same skill level')
    }
  }
  
  // === STUDY STYLE ===
  const currentStyle = currentUserProfile.studyStyle
  const partnerStyle = partnerProfile.studyStyle
  const bothHaveStyle = hasStringData(currentStyle) && hasStringData(partnerStyle)
  
  if (bothHaveStyle) {
    maxPossibleScore += SCORING.STUDY_STYLE
    matchDetails.studyStyle.bothHaveData = true
    matchDetails.studyStyle.value = partnerStyle!
    
    if (currentStyle === partnerStyle) {
      totalScore += SCORING.STUDY_STYLE
      matchDetails.studyStyle.matches = true
      matchReasons.push('Same study style')
    }
  }
  
  // Calculate final percentage
  // If no fields could be compared, return insufficient data
  if (maxPossibleScore === 0) {
    return {
      matchScore: null,
      matchReasons: [],
      matchDataInsufficient: true,
      matchDetails: null,
      currentUserMissingFields,
      partnerMissingFields,
    }
  }
  
  // Calculate score as percentage of max possible, capped at 100
  const matchScore = Math.min(Math.round((totalScore / maxPossibleScore) * 100), 100)
  
  return {
    matchScore,
    matchReasons,
    matchDataInsufficient: false,
    matchDetails,
    currentUserMissingFields,
    partnerMissingFields,
  }
}

/**
 * Format a skill level string for display
 */
export function formatSkillLevel(skillLevel: string | null | undefined): string {
  if (!skillLevel) return ''
  return skillLevel.charAt(0).toUpperCase() + skillLevel.slice(1).toLowerCase()
}

/**
 * Format a study style string for display
 */
export function formatStudyStyle(studyStyle: string | null | undefined): string {
  if (!studyStyle) return ''
  return studyStyle.charAt(0).toUpperCase() + studyStyle.slice(1).toLowerCase().replace('_', ' ')
}

/**
 * Check if a profile has enough data to display meaningful info
 */
export function hasMinimumProfileData(profile: ProfileData | null | undefined): boolean {
  return countFilledFields(profile) >= MIN_FIELDS_FOR_MATCHING
}

