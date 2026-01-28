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

// Micro-task for task-based progression
export interface MicroTask {
  id: string
  order: number
  title: string
  description: string
  taskType: 'ACTION' | 'LEARN' | 'PRACTICE' | 'TEST' | 'REFLECT'
  duration: number
  verificationMethod?: string
  proofRequired: boolean
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
  completedAt?: string
  attempts: number
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
  completedAt?: string  // Timestamp when step was completed
  // Enhanced fields for quality improvements
  whyFirst?: string
  timeBreakdown?: { daily: string; total: string; flexible: string }
  commonMistakes?: string[]
  selfTest?: { challenge: string; passCriteria: string }
  abilities?: string[]
  whyAfterPrevious?: string
  previewAbilities?: string[]
  // Phase and milestone support
  phase?: 'NOW' | 'NEXT' | 'LATER'
  milestone?: string
  risk?: { warning: string; consequence: string; severity: string }
  // Micro-tasks for task-based progression
  microTasks?: MicroTask[]
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

// Critical warning structure
export interface CriticalWarning {
  warning: string
  consequence: string
  severity: 'CRITICAL'
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
  // Vision & Strategy fields
  vision?: string
  targetUser?: string
  successMetrics?: string[]
  outOfScope?: string[]
  criticalWarning?: CriticalWarning
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
