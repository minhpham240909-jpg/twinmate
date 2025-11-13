/**
 * Device ID Management
 * Generates and persists a unique device ID for tracking user sessions
 */

const DEVICE_ID_KEY = 'clerva_device_id'

/**
 * Generate a unique device ID using crypto.randomUUID or fallback
 */
export function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Get or create device ID from localStorage
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'server-side'
  }

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY)

    if (!deviceId) {
      deviceId = generateDeviceId()
      localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }

    return deviceId
  } catch (error) {
    console.error('Error accessing localStorage for device ID:', error)
    // Return a session-only ID if localStorage is not available
    return `session-${generateDeviceId()}`
  }
}

/**
 * Clear device ID (useful for logout)
 */
export function clearDeviceId(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(DEVICE_ID_KEY)
  } catch (error) {
    console.error('Error clearing device ID:', error)
  }
}

/**
 * Get current device ID without creating one
 */
export function getDeviceId(): string | null {
  if (typeof window === 'undefined') return null

  try {
    return localStorage.getItem(DEVICE_ID_KEY)
  } catch (error) {
    console.error('Error getting device ID:', error)
    return null
  }
}
