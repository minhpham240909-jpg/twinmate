/**
 * Partner Matching Module
 * 
 * Provides accurate matching algorithms based on real profile data.
 */

export {
  type ProfileData,
  type MatchResult,
  type MatchDetails,
  calculateMatchScore,
  countFilledFields,
  getMissingFields,
  formatSkillLevel,
  formatStudyStyle,
  hasMinimumProfileData,
} from './algorithm'

