/**
 * Practice Arena - Scoring System
 *
 * Calculates points for correct answers with:
 * - Base points (1000)
 * - Time bonus (faster = more points, up to 500)
 * - Streak bonus (10% per streak, max 50%)
 */

import type { PointsBreakdown } from './types'

// Constants
export const BASE_POINTS = 1000
export const MAX_TIME_BONUS = 500
export const MAX_STREAK_MULTIPLIER = 0.5 // 50%
export const STREAK_INCREMENT = 0.1 // 10% per streak

/**
 * Calculate points for an answer
 *
 * @param isCorrect - Whether the answer was correct
 * @param responseTimeMs - Time taken to answer in milliseconds
 * @param streak - Current answer streak (consecutive correct answers)
 * @param timeLimit - Time limit for the question in seconds
 * @returns Points breakdown with base, time bonus, streak bonus, and total
 */
export function calculatePoints(
  isCorrect: boolean,
  responseTimeMs: number,
  streak: number,
  timeLimit: number = 20
): PointsBreakdown {
  // Wrong answers get no points
  if (!isCorrect) {
    return {
      base: 0,
      timeBonus: 0,
      streakBonus: 0,
      total: 0,
    }
  }

  const base = BASE_POINTS

  // Time bonus: faster = more points
  // Linear scale from 0 to MAX_TIME_BONUS based on remaining time
  const maxTimeMs = timeLimit * 1000
  const timeRatio = Math.max(0, 1 - responseTimeMs / maxTimeMs)
  const timeBonus = Math.round(timeRatio * MAX_TIME_BONUS)

  // Streak bonus: 10% per streak, capped at 50%
  const streakMultiplier = Math.min(MAX_STREAK_MULTIPLIER, streak * STREAK_INCREMENT)
  const streakBonus = Math.round(base * streakMultiplier)

  return {
    base,
    timeBonus,
    streakBonus,
    total: base + timeBonus + streakBonus,
  }
}

/**
 * Calculate XP reward for game completion
 *
 * Formula:
 * - Base XP: score / 100 (1 XP per 100 points)
 * - Placement bonus: 1st = 100, 2nd = 50, 3rd = 25
 * - Participation bonus: 10 XP for completing
 *
 * @param finalScore - Total points scored
 * @param rank - Final ranking in the game
 * @param totalPlayers - Total players in the arena
 * @returns XP earned
 */
export function calculateXPReward(
  finalScore: number,
  rank: number,
  totalPlayers: number
): number {
  // Base XP from score
  const baseXP = Math.round(finalScore / 100)

  // Placement bonus (top 3 only)
  let placementBonus = 0
  if (rank === 1) placementBonus = 100
  else if (rank === 2) placementBonus = 50
  else if (rank === 3) placementBonus = 25

  // Participation bonus (just for playing)
  const participationBonus = 10

  // Scale bonus for smaller games (minimum 3 players for full bonus)
  const scaleFactor = Math.min(1, totalPlayers / 3)
  const scaledPlacementBonus = Math.round(placementBonus * scaleFactor)

  return baseXP + scaledPlacementBonus + participationBonus
}

/**
 * Calculate combined score for weekly leaderboard
 *
 * Formula: (totalXP * 0.4) + (correctAnswers * 0.3) + (bestStreak * 100 * 0.3)
 *
 * This balances:
 * - XP (represents overall play and success)
 * - Correct answers (accuracy)
 * - Best streak (consistency)
 *
 * @param totalXP - Total XP earned this week
 * @param correctAnswers - Total correct answers this week
 * @param bestStreak - Best streak achieved this week
 * @returns Combined score for ranking
 */
export function calculateCombinedScore(
  totalXP: number,
  correctAnswers: number,
  bestStreak: number
): number {
  return (totalXP * 0.4) + (correctAnswers * 0.3) + (bestStreak * 100 * 0.3)
}

/**
 * Get the current week's start date (Monday 00:00 UTC)
 *
 * @param date - Date to calculate from (defaults to now)
 * @returns Date object for Monday 00:00 UTC of the current week
 */
export function getCurrentWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  // Adjust to Monday (day 1). If Sunday (0), go back 6 days
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

/**
 * Get the current week's end date (Sunday 23:59:59 UTC)
 *
 * @param date - Date to calculate from (defaults to now)
 * @returns Date object for Sunday 23:59:59 UTC of the current week
 */
export function getCurrentWeekEnd(date: Date = new Date()): Date {
  const weekStart = getCurrentWeekStart(date)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
  weekEnd.setUTCHours(23, 59, 59, 999)
  return weekEnd
}

/**
 * Calculate time until next weekly reset
 *
 * @returns Object with days, hours, minutes until reset
 */
export function getTimeUntilReset(): { days: number; hours: number; minutes: number } {
  const now = new Date()
  const weekEnd = getCurrentWeekEnd(now)
  const diff = weekEnd.getTime() - now.getTime()

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return { days, hours, minutes }
}

/**
 * Generate a 6-character invite code
 *
 * Uses alphanumeric characters (uppercase) for readability
 * Excludes confusing characters: 0, O, I, L
 *
 * @returns 6-character invite code
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
