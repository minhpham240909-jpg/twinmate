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
export type MissionItemType = 'flashcard' | 'concept' | 'step'
export type MissionItemSource = 'test_prep' | 'explain_pack' | 'guide_me'

export interface MissionItem {
  id: string
  type: MissionItemType
  source: MissionItemSource
  title: string
  description: string
  topic?: string
  createdAt: number // timestamp
  completedAt?: number
  priority: 'high' | 'medium' | 'low' // high = weak spot, medium = in progress, low = review
}

interface MissionState {
  items: MissionItem[]
  lastUpdated: number
}

const STORAGE_KEY = 'clerva_mission'
const EXPIRY_DAYS = 7

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Get today's date string for grouping
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]
}

// Check if item is expired (older than 7 days)
function isExpired(item: MissionItem): boolean {
  const expiryTime = EXPIRY_DAYS * 24 * 60 * 60 * 1000
  return Date.now() - item.createdAt > expiryTime
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
      // Filter out expired and completed items
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

  // Sync with localStorage on mount
  useEffect(() => {
    const loaded = loadMission()
    setMissionState(loaded)
  }, [])

  // Save whenever state changes
  useEffect(() => {
    saveMission(missionState)
  }, [missionState])

  // Get active (incomplete) mission items, sorted by priority
  const missionItems = missionState.items
    .filter(item => !item.completedAt)
    .sort((a, b) => {
      // Sort by priority (high first), then by date (newest first)
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      return b.createdAt - a.createdAt
    })
    .slice(0, 5) // Max 5 items shown

  // Add a new mission item
  const addMissionItem = useCallback((
    type: MissionItemType,
    source: MissionItemSource,
    title: string,
    description: string,
    priority: 'high' | 'medium' | 'low' = 'medium',
    topic?: string
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

  // Add weak flashcard (wrong answer)
  const addWeakFlashcard = useCallback((question: string, topic?: string) => {
    return addMissionItem(
      'flashcard',
      'test_prep',
      'Review flashcard',
      question.length > 60 ? question.slice(0, 60) + '...' : question,
      'high',
      topic
    )
  }, [addMissionItem])

  // Add confused concept (from Explain Pack)
  const addConfusedConcept = useCallback((concept: string, topic?: string) => {
    return addMissionItem(
      'concept',
      'explain_pack',
      'Revisit concept',
      concept.length > 60 ? concept.slice(0, 60) + '...' : concept,
      'high',
      topic
    )
  }, [addMissionItem])

  // Add stuck step (from Guide Me - multiple hints requested)
  const addStuckStep = useCallback((stepTitle: string, topic?: string) => {
    return addMissionItem(
      'step',
      'guide_me',
      'Practice step',
      stepTitle.length > 60 ? stepTitle.slice(0, 60) + '...' : stepTitle,
      'medium',
      topic
    )
  }, [addMissionItem])

  // Mark item as completed
  const completeMissionItem = useCallback((itemId: string) => {
    setMissionState(prev => ({
      items: prev.items.map(item =>
        item.id === itemId
          ? { ...item, completedAt: Date.now() }
          : item
      ),
      lastUpdated: Date.now(),
    }))
  }, [])

  // Remove item entirely
  const removeMissionItem = useCallback((itemId: string) => {
    setMissionState(prev => ({
      items: prev.items.filter(item => item.id !== itemId),
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
    clearCompleted,
    getCounts,
    hasMission: missionItems.length > 0,
  }
}
