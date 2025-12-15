/**
 * AI Partner Intelligence System - Version Management
 *
 * Manages intelligence system versions for migration and compatibility.
 * Ensures graceful handling of legacy sessions.
 */

/**
 * Current intelligence system version
 * Increment this when making breaking changes
 */
export const INTELLIGENCE_VERSION = '2.0.0'

/**
 * Minimum compatible version
 * Sessions older than this require upgrade
 */
export const MIN_COMPATIBLE_VERSION = '2.0.0'

/**
 * Version history for reference
 */
export const VERSION_HISTORY = {
  '1.0.0': 'Legacy system (prompt-based)',
  '2.0.0': 'Intelligence system (intent classification, adaptive responses)',
}

/**
 * Check if a session is using the legacy system
 */
export function isLegacySession(intelligenceVersion: string | null | undefined): boolean {
  if (!intelligenceVersion) {
    return true // No version means legacy
  }
  return compareVersions(intelligenceVersion, MIN_COMPATIBLE_VERSION) < 0
}

/**
 * Check if a session needs upgrade
 */
export function needsUpgrade(intelligenceVersion: string | null | undefined): boolean {
  return isLegacySession(intelligenceVersion)
}

/**
 * Get upgrade message for legacy sessions
 */
export function getUpgradeMessage(): string {
  return "I've been upgraded with better understanding! For the best experience, start a new session."
}

/**
 * Get upgrade prompt for soft notification
 */
export function getUpgradePrompt(): {
  title: string
  message: string
  action: string
} {
  return {
    title: 'AI Partner Upgraded',
    message: 'Your AI partner now understands you better! Start a new session to experience improved responses.',
    action: 'Start New Session',
  }
}

/**
 * Compare two version strings
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0
    const numB = partsB[i] || 0

    if (numA < numB) return -1
    if (numA > numB) return 1
  }

  return 0
}

/**
 * Check if version is compatible
 */
export function isVersionCompatible(version: string): boolean {
  return compareVersions(version, MIN_COMPATIBLE_VERSION) >= 0
}

/**
 * Get current version info
 */
export function getVersionInfo(): {
  current: string
  minCompatible: string
  isLatest: boolean
} {
  return {
    current: INTELLIGENCE_VERSION,
    minCompatible: MIN_COMPATIBLE_VERSION,
    isLatest: true,
  }
}

/**
 * Create version metadata for new sessions
 */
export function createVersionMetadata(): {
  intelligenceVersion: string
  createdAt: string
  features: string[]
} {
  return {
    intelligenceVersion: INTELLIGENCE_VERSION,
    createdAt: new Date().toISOString(),
    features: [
      'intent-classification',
      'adaptive-responses',
      'dynamic-tone',
      'smart-questioning',
      'memory-integration',
    ],
  }
}

/**
 * Check if a feature is available in a version
 */
export function hasFeature(
  version: string | null | undefined,
  feature: 'intent-classification' | 'adaptive-responses' | 'dynamic-tone' | 'smart-questioning' | 'memory-integration'
): boolean {
  if (!version || isLegacySession(version)) {
    return false
  }

  // All features available in 2.0.0+
  return compareVersions(version, '2.0.0') >= 0
}

/**
 * Log version info for debugging
 */
export function logVersionInfo(sessionId: string, version: string | null | undefined): void {
  const isLegacy = isLegacySession(version)
  console.log(`[AI Partner] Session ${sessionId}: version=${version || 'legacy'}, legacy=${isLegacy}`)
}
