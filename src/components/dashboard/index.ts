export { default as DashboardTopBar } from './DashboardTopBar'
export { default as DashboardMenuDropdown } from './DashboardMenuDropdown'
export { default as DashboardSearch } from './DashboardSearch'

// Vision Components (kept for potential future use)
export { default as StartStudyingCTA } from './StartStudyingCTA'
export { default as ImStuckFlow } from './ImStuckFlow'
export { default as StudySuggestions } from './StudySuggestions'
export { default as StudyGuideModal } from './StudyGuideModal'
export { default as GlobalLeaderboard } from './GlobalLeaderboard'

// Progressive Disclosure System
export {
  calculateUserTier,
  shouldShowFeature,
  getSuggestionsLimit,
  NewUserWelcome,
  UnlockTeasersSection,
  FeatureGate,
  DISCLOSURE_THRESHOLDS,
} from './ProgressiveDisclosure'
export type { UserTier } from './ProgressiveDisclosure'

// Note: ClassmatesStudying removed from exports - social feature hidden
