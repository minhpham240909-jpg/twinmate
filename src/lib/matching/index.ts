/**
 * Partner Matching Module
 *
 * Exports the matching algorithm and utilities for finding compatible study partners.
 * Uses weighted scoring across multiple profile components.
 */

export {
  // Main matching function
  calculateMatchScore,

  // Utility functions
  jaccard,
  smartJaccard,
  getIntersection,
  skillLevelCloseness,
  studyStyleCompatibility,
  timezoneProximity,
  calculateDistance,
  locationProximity,
  hasStringData,
  hasArrayData,
  countFilledFields,
  getMissingFields,
  hasMinimumProfileData,
  getMatchTier,
  formatSkillLevel,
  formatStudyStyle,

  // Sorting & filtering utilities
  sortByMatchScore,
  filterByMinScore,
  weightedRandomSelect,

  // Configuration
  DEFAULT_WEIGHTS,

  // Types
  type ProfileData,
  type MatchResult,
  type MatchDetails,
  type MatchSummary,
  type ComponentScore,
} from './algorithm'
