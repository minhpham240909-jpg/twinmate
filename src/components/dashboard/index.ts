export { default as DashboardTopBar } from './DashboardTopBar'
export { default as DashboardMenuDropdown } from './DashboardMenuDropdown'
export { default as DashboardStatsRow } from './DashboardStatsRow'
export { default as DashboardSearch } from './DashboardSearch'
export { default as DashboardPartnersSection } from './DashboardPartnersSection'

// New Vision Components
export { default as StartStudyingCTA } from './StartStudyingCTA'
export { default as ClassmatesStudying } from './ClassmatesStudying'
export { default as ImStuckFlow } from './ImStuckFlow'
export { default as StudySuggestions } from './StudySuggestions'
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
