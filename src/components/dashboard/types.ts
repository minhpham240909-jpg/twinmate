/**
 * Dashboard Component Types
 * Shared type definitions for all dashboard components
 */

// View state for dashboard navigation
export type ViewState = 'mission' | 'roadmap' | 'proof' | 'loading' | 'onboarding' | 'identity-discovery' | 'identity-reveal'

// Resource suggestion type for steps
export interface StepResource {
  type: 'video' | 'article' | 'exercise' | 'tool' | 'book'
  title: string
  description?: string
  url?: string
  searchQuery?: string
}

// Roadmap step with status tracking
export interface RoadmapStep {
  id: string
  order: number
  title: string
  description: string
  status: 'locked' | 'current' | 'completed'
  duration?: number
  timeframe?: string
  method?: string
  avoid?: string
  doneWhen?: string
  resources?: StepResource[]
  // Enhanced fields for quality improvements
  whyFirst?: string
  timeBreakdown?: { daily: string; total: string; flexible: string }
  commonMistakes?: string[]
  selfTest?: { challenge: string; passCriteria: string }
  abilities?: string[]
  whyAfterPrevious?: string
  previewAbilities?: string[]
}

// Recommended platform type
export interface RecommendedPlatform {
  id: string
  name: string
  description: string
  url: string
  icon: string
  color: string
  searchUrl?: string
}

// Full roadmap structure
export interface Roadmap {
  id: string
  title: string
  overview?: string
  goal: string
  steps: RoadmapStep[]
  currentStepIndex: number
  totalSteps: number
  completedSteps: number
  estimatedMinutes: number
  pitfalls?: string[]
  successLooksLike?: string
  recommendedPlatforms?: RecommendedPlatform[]
  targetDate?: string // Accountability deadline
  // Enhanced fields
  estimatedDays?: number
  dailyCommitment?: string
}

// Input material for goal submission
export interface InputMaterial {
  type: 'url' | 'image' | 'none'
  value: string
  preview?: string
}

// Adaptive feedback type for help panel
export interface AdaptiveFeedback {
  encouragement: string
  tips: string[]
  alternativeApproach?: string
  breakdownSuggested: boolean
  breakdownPreview?: {
    title: string
    substeps: string[]
  }
  resources?: {
    type: string
    title: string
    searchQuery: string
  }[]
}

// Days remaining calculation result
export interface DaysRemaining {
  days: number
  isUrgent: boolean
  display: string
}

// Level calculation result
export interface LevelData {
  level: number
  currentXP: number
  xpForNextLevel: number
  progress: number
}

// User identity for learning profile
export interface UserIdentity {
  archetype?: string
  strengths: string[]
  growthAreas: string[]
}
