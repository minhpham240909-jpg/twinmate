/**
 * XP Management Module
 *
 * Centralized XP handling for the Clerva learning platform.
 */

export {
  // Core functions
  addXp,
  getUserXpSummary,
  getUserLevel,
  syncUserXp,
  getXpLeaderboard,

  // Pure calculation functions
  calculateLevel,
  getXpToNextLevel,
  getLevelProgress,
  getRankForLevel,

  // Constants
  LEVEL_THRESHOLDS,
  RANK_NAMES,

  // Types
  type XpSource,
  type XpTransaction,
  type UserXpSummary,
} from './xp-manager'
