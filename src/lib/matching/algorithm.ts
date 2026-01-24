/**
 * Profile Matching Algorithm - Simplified for PWA
 *
 * Provides basic profile completion metrics
 * Full matching features removed for PWA edition
 */

export interface ProfileData {
  bio?: string | null
  subjects?: string[] | null
  interests?: string[] | null
  goals?: string[] | null
  skillLevel?: string | null
  studyStyle?: string | null
  availableDays?: string[] | null
  availableHours?: string[] | null
  school?: string | null
  timezone?: string | null
  languages?: string[] | null
  role?: string | null
  location_lat?: number | null
  location_lng?: number | null
  location_city?: string | null
  location_country?: string | null
}

/**
 * Count the number of filled fields in a profile
 */
export function countFilledFields(profile: ProfileData): number {
  let count = 0

  if (profile.bio && profile.bio.trim().length > 0) count++
  if (profile.subjects && profile.subjects.length > 0) count++
  if (profile.interests && profile.interests.length > 0) count++
  if (profile.goals && profile.goals.length > 0) count++
  if (profile.skillLevel) count++
  if (profile.studyStyle) count++
  if (profile.availableDays && profile.availableDays.length > 0) count++
  if (profile.availableHours && profile.availableHours.length > 0) count++

  return count
}

/**
 * Get list of missing profile fields
 */
export function getMissingFields(profile: ProfileData): string[] {
  const missing: string[] = []

  if (!profile.bio || profile.bio.trim().length === 0) missing.push('bio')
  if (!profile.subjects || profile.subjects.length === 0) missing.push('subjects')
  if (!profile.interests || profile.interests.length === 0) missing.push('interests')
  if (!profile.goals || profile.goals.length === 0) missing.push('goals')
  if (!profile.skillLevel) missing.push('skillLevel')
  if (!profile.studyStyle) missing.push('studyStyle')

  return missing
}

/**
 * Check if profile has minimum required data
 */
export function hasMinimumProfileData(profile: ProfileData): boolean {
  // At minimum, need bio or subjects
  const hasBio = !!(profile.bio && profile.bio.trim().length > 0)
  const hasSubjects = !!(profile.subjects && profile.subjects.length > 0)

  return hasBio || hasSubjects
}

/**
 * Calculate match score between two profiles
 * Simplified version - returns basic compatibility
 */
export function calculateMatchScore(
  profile1: ProfileData,
  profile2: ProfileData
): { score: number; reasons: string[] } {
  let score = 50 // Base score
  const reasons: string[] = []

  // Check for common subjects
  const commonSubjects = (profile1.subjects || []).filter(
    s => (profile2.subjects || []).includes(s)
  )
  if (commonSubjects.length > 0) {
    score += commonSubjects.length * 10
    reasons.push(`${commonSubjects.length} common subject${commonSubjects.length > 1 ? 's' : ''}`)
  }

  // Check for common interests
  const commonInterests = (profile1.interests || []).filter(
    i => (profile2.interests || []).includes(i)
  )
  if (commonInterests.length > 0) {
    score += commonInterests.length * 5
    reasons.push(`${commonInterests.length} common interest${commonInterests.length > 1 ? 's' : ''}`)
  }

  // Check for same skill level
  if (profile1.skillLevel && profile1.skillLevel === profile2.skillLevel) {
    score += 10
    reasons.push('Same skill level')
  }

  // Check for same study style
  if (profile1.studyStyle && profile1.studyStyle === profile2.studyStyle) {
    score += 10
    reasons.push('Compatible study style')
  }

  // Cap at 100
  score = Math.min(score, 100)

  return { score, reasons }
}
