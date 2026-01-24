'use client'

/**
 * useMission Hook - Today's Mission System
 *
 * Lightweight localStorage-based mission storage for MVP.
 * Tracks weak spots from all tools and shows actionable items on dashboard.
 *
 * Mission items are auto-added when:
 * - Flashcard answered wrong
 * - User says "still confused" in Explain Pack
 * - User requests multiple hints in Guide Me
 *
 * Items auto-expire after 7 days if not completed.
 */

import { useState, useEffect, useCallback } from 'react'

// Types
export type MissionItemType = 'flashcard' | 'concept' | 'step' | 'starter'
export type MissionItemSource = 'test_prep' | 'explain_pack' | 'guide_me' | 'onboarding'

export interface MissionItem {
  id: string
  type: MissionItemType
  source: MissionItemSource
  title: string
  description: string
  topic?: string
  createdAt: number // timestamp
  completedAt?: number
  hiddenUntil?: number // timestamp - for "Not now" snooze (24hr hide)
  priority: 'high' | 'medium' | 'low' // high = weak spot, medium = in progress, low = review
  // Richer context for direct deep-linking
  originalQuestion?: string // Full question to submit directly to API
  priorConfusion?: string // What the user was confused about
  isStarter?: boolean // True for first-time user starter missions
}

interface MissionState {
  items: MissionItem[]
  lastUpdated: number
  hasCompletedFirstMission?: boolean // Track if user has ever completed a mission
}

const STORAGE_KEY = 'clerva_mission'
const EXPIRY_DAYS = 7

// Starter missions for first-time users - welcoming and educational
// Using actual tool sources so deep-linking works correctly
const STARTER_MISSIONS: Omit<MissionItem, 'id' | 'createdAt'>[] = [
  {
    type: 'starter',
    source: 'explain_pack', // Routes to Explain Pack tool
    title: 'Try your first explanation',
    description: 'Ask about any concept you find confusing',
    priority: 'medium',
    isStarter: true,
    originalQuestion: 'Explain photosynthesis in simple terms',
  },
  {
    type: 'starter',
    source: 'test_prep', // Routes to Test Prep tool
    title: 'Create your first flashcards',
    description: 'Generate study cards for any topic',
    priority: 'medium',
    isStarter: true,
    originalQuestion: 'Create flashcards for basic algebra concepts',
  },
  {
    type: 'starter',
    source: 'guide_me', // Routes to Guide Me tool
    title: 'Get help with a problem',
    description: 'Get step-by-step guidance on any task',
    priority: 'medium',
    isStarter: true,
    originalQuestion: 'Help me solve a quadratic equation step by step',
  },
]

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

// Check if item is expired (older than 7 days)
function isExpired(item: MissionItem): boolean {
  const expiryTime = EXPIRY_DAYS * 24 * 60 * 60 * 1000
  return Date.now() - item.createdAt > expiryTime
}

// Check if item is currently snoozed (hidden until time has passed)
function isSnoozed(item: MissionItem): boolean {
  if (!item.hiddenUntil) return false
  return Date.now() < item.hiddenUntil
}

// Load mission from localStorage
function loadMission(): MissionState {
  if (typeof window === 'undefined') {
    return { items: [], lastUpdated: Date.now() }
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as MissionState
      // Filter out expired and completed items (but keep snoozed for storage)
      const activeItems = parsed.items.filter(
        item => !item.completedAt && !isExpired(item)
      )
      return { items: activeItems, lastUpdated: parsed.lastUpdated }
    }
  } catch (err) {
    console.warn('[useMission] Failed to load mission:', err)
  }

  return { items: [], lastUpdated: Date.now() }
}

// Save mission to localStorage
function saveMission(state: MissionState): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('[useMission] Failed to save mission:', err)
  }
}

export function useMission() {
  const [missionState, setMissionState] = useState<MissionState>(() => loadMission())

  // Sync with localStorage on mount and add starter missions for first-time users
  useEffect(() => {
    const loaded = loadMission()

    // Check if this is a first-time user (no missions ever created and no completion history)
    const isFirstTimeUser = loaded.items.length === 0 && !loaded.hasCompletedFirstMission

    if (isFirstTimeUser) {
      // Add starter missions for first-time users
      const starterItems: MissionItem[] = STARTER_MISSIONS.map((mission, index) => ({
        ...mission,
        id: `starter-${index}-${Date.now()}`,
        createdAt: Date.now(),
      }))

      setMissionState({
        items: starterItems,
        lastUpdated: Date.now(),
        hasCompletedFirstMission: false,
      })
    } else {
      setMissionState(loaded)
    }
  }, [])

  // Save whenever state changes
  useEffect(() => {
    saveMission(missionState)
  }, [missionState])

  // Get active (incomplete, non-snoozed) mission items, sorted by priority
  const missionItems = missionState.items
    .filter(item => !item.completedAt && !isSnoozed(item))
    .sort((a, b) => {
      // Sort by priority (high first), then by date (newest first)
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      return b.createdAt - a.createdAt
    })
    .slice(0, 5) // Max 5 items shown

  // Add a new mission item with optional rich context for deep-linking
  const addMissionItem = useCallback((
    type: MissionItemType,
    source: MissionItemSource,
    title: string,
    description: string,
    priority: 'high' | 'medium' | 'low' = 'medium',
    topic?: string,
    originalQuestion?: string,
    priorConfusion?: string
  ) => {
    const newItem: MissionItem = {
      id: generateId(),
      type,
      source,
      title,
      description,
      topic,
      createdAt: Date.now(),
      priority,
      originalQuestion,
      priorConfusion,
    }

    setMissionState(prev => {
      // Check if similar item already exists (same title and source)
      const exists = prev.items.some(
        item => item.title === title && item.source === source && !item.completedAt
      )
      if (exists) return prev

      return {
        items: [newItem, ...prev.items],
        lastUpdated: Date.now(),
      }
    })

    return newItem.id
  }, [])

  // Add weak flashcard (wrong answer) - stores original question for deep-linking
  // Title format: "Review weak flashcard — [Topic]"
  const addWeakFlashcard = useCallback((question: string, topic?: string, originalQuestion?: string) => {
    const topicLabel = topic || question.slice(0, 25)
    return addMissionItem(
      'flashcard',
      'test_prep',
      `Review weak flashcard — ${topicLabel}`,
      question.length > 50 ? question.slice(0, 50) + '...' : question,
      'high',
      topic,
      originalQuestion || question,
      undefined
    )
  }, [addMissionItem])

  // Add confused concept (from Explain Pack) - stores original question for deep-linking
  // Title format: "Finish explanation — [Topic]"
  const addConfusedConcept = useCallback((concept: string, topic?: string, originalQuestion?: string) => {
    const topicLabel = topic || concept.slice(0, 25)
    return addMissionItem(
      'concept',
      'explain_pack',
      `Finish explanation — ${topicLabel}`,
      concept.length > 50 ? concept.slice(0, 50) + '...' : concept,
      'high',
      topic,
      originalQuestion || concept,
      concept
    )
  }, [addMissionItem])

  // Add stuck step (from Guide Me - multiple hints requested) - stores original question for deep-linking
  // Title format: "Retry homework step — [Step title]"
  const addStuckStep = useCallback((stepTitle: string, topic?: string, originalQuestion?: string) => {
    const stepLabel = stepTitle.length > 25 ? stepTitle.slice(0, 25) + '...' : stepTitle
    return addMissionItem(
      'step',
      'guide_me',
      `Retry homework step — ${stepLabel}`,
      stepTitle.length > 50 ? stepTitle.slice(0, 50) + '...' : stepTitle,
      'medium',
      topic,
      originalQuestion || stepTitle,
      undefined
    )
  }, [addMissionItem])

  // Mark item as completed and track first completion
  const completeMissionItem = useCallback((itemId: string) => {
    setMissionState(prev => ({
      items: prev.items.map(item =>
        item.id === itemId
          ? { ...item, completedAt: Date.now() }
          : item
      ),
      lastUpdated: Date.now(),
      hasCompletedFirstMission: true, // User has now completed at least one mission
    }))
  }, [])

  // Remove item entirely
  const removeMissionItem = useCallback((itemId: string) => {
    setMissionState(prev => ({
      items: prev.items.filter(item => item.id !== itemId),
      lastUpdated: Date.now(),
    }))
  }, [])

  // Snooze item for 24 hours ("Not now")
  const snoozeMissionItem = useCallback((itemId: string) => {
    const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
    setMissionState(prev => ({
      items: prev.items.map(item =>
        item.id === itemId
          ? { ...item, hiddenUntil: Date.now() + SNOOZE_DURATION_MS }
          : item
      ),
      lastUpdated: Date.now(),
    }))
  }, [])

  // Clear all completed items
  const clearCompleted = useCallback(() => {
    setMissionState(prev => ({
      items: prev.items.filter(item => !item.completedAt),
      lastUpdated: Date.now(),
    }))
  }, [])

  // Get count of items by source
  const getCounts = useCallback(() => {
    const active = missionState.items.filter(item => !item.completedAt)
    return {
      total: active.length,
      flashcards: active.filter(i => i.type === 'flashcard').length,
      concepts: active.filter(i => i.type === 'concept').length,
      steps: active.filter(i => i.type === 'step').length,
      high: active.filter(i => i.priority === 'high').length,
    }
  }, [missionState.items])

  return {
    missionItems,
    addMissionItem,
    addWeakFlashcard,
    addConfusedConcept,
    addStuckStep,
    completeMissionItem,
    removeMissionItem,
    snoozeMissionItem,
    clearCompleted,
    getCounts,
    hasMission: missionItems.length > 0,
  }
}
