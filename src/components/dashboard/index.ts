/**
 * Dashboard Components Barrel Export
 * Centralized exports for all dashboard components
 */

// Types
export type {
  ViewState,
  StepResource,
  RoadmapStep,
  RecommendedPlatform,
  Roadmap,
  InputMaterial,
  AdaptiveFeedback,
  DaysRemaining,
  LevelData,
  UserIdentity,
} from './types'

// Utility functions
export {
  getDaysRemaining,
  calculateLevel,
  getInputTypeLabel,
} from './utils'

// Components
export { DashboardHeader } from './DashboardHeader'
export { TodaysMission } from './TodaysMission'
export { IdentityCard } from './IdentityCard'
export { SkillProgressCard } from './SkillProgressCard'
export { StruggleNudge } from './StruggleNudge'
export { DashboardCelebrationModal } from './DashboardCelebrationModal'
export { OnboardingPrompt } from './OnboardingPrompt'
export { ProofSubmission } from './ProofSubmission'
export { default as IdentityDiscovery, IdentityReveal } from './IdentityDiscovery'
