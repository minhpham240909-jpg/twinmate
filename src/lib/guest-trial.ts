/**
 * Guest Trial System
 *
 * Allows users to try 3 AI requests without signing up.
 * Uses localStorage for client-side tracking + IP-based server-side limiting.
 *
 * Flow:
 * 1. Guest opens app → can use AI 3 times
 * 2. After 3 uses → prompted to sign up
 * 3. No data sync needed (trial responses are ephemeral)
 *
 * Security:
 * - Client: localStorage counter (easy to bypass, but that's OK)
 * - Server: IP-based rate limiting (harder to bypass)
 * - Combined: Reasonable protection without over-engineering
 */

// Constants
export const GUEST_TRIAL_LIMIT = 3
export const GUEST_STORAGE_KEY = 'clerva_guest_trial'

// Types
export interface GuestTrialState {
  usesRemaining: number
  firstUseAt: number | null
  lastUseAt: number | null
  responses: GuestTrialResponse[]
}

export interface GuestTrialResponse {
  id: string
  question: string
  type: 'explanation' | 'flashcards' | 'roadmap'
  timestamp: number
}

// Default state for new guests
const DEFAULT_STATE: GuestTrialState = {
  usesRemaining: GUEST_TRIAL_LIMIT,
  firstUseAt: null,
  lastUseAt: null,
  responses: [],
}

/**
 * Get current guest trial state from localStorage
 */
export function getGuestTrialState(): GuestTrialState {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE
  }

  try {
    const stored = localStorage.getItem(GUEST_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as GuestTrialState
      // Validate structure
      if (typeof parsed.usesRemaining === 'number' && Array.isArray(parsed.responses)) {
        return parsed
      }
    }
  } catch (err) {
    console.warn('[GuestTrial] Failed to load state:', err)
  }

  return DEFAULT_STATE
}

/**
 * Save guest trial state to localStorage
 */
export function saveGuestTrialState(state: GuestTrialState): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('[GuestTrial] Failed to save state:', err)
  }
}

/**
 * Check if guest has remaining trials
 */
export function hasTrialsRemaining(): boolean {
  const state = getGuestTrialState()
  return state.usesRemaining > 0
}

/**
 * Get number of remaining trials
 */
export function getTrialsRemaining(): number {
  const state = getGuestTrialState()
  return Math.max(0, state.usesRemaining)
}

/**
 * Use one trial (call after successful AI response)
 */
export function useOneTrial(question: string, type: 'explanation' | 'flashcards' | 'roadmap'): GuestTrialState {
  const state = getGuestTrialState()
  const now = Date.now()

  const newResponse: GuestTrialResponse = {
    id: `guest-${now}-${Math.random().toString(36).substr(2, 9)}`,
    question: question.slice(0, 100), // Truncate for storage
    type,
    timestamp: now,
  }

  const newState: GuestTrialState = {
    usesRemaining: Math.max(0, state.usesRemaining - 1),
    firstUseAt: state.firstUseAt || now,
    lastUseAt: now,
    responses: [...state.responses, newResponse].slice(-GUEST_TRIAL_LIMIT), // Keep only last 3
  }

  saveGuestTrialState(newState)
  return newState
}

/**
 * Clear guest trial state (called after successful signup)
 */
export function clearGuestTrialState(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(GUEST_STORAGE_KEY)
  } catch (err) {
    console.warn('[GuestTrial] Failed to clear state:', err)
  }
}

/**
 * Check if this is a returning guest (has used trial before)
 */
export function isReturningGuest(): boolean {
  const state = getGuestTrialState()
  return state.firstUseAt !== null
}

/**
 * Get guest's previous responses (for showing in UI)
 */
export function getGuestResponses(): GuestTrialResponse[] {
  const state = getGuestTrialState()
  return state.responses
}
