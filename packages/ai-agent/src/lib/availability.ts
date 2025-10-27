/**
 * Availability Window Calculations
 * For computing nextBestTimes and scheduling windows
 */

export interface AvailabilityWindow {
  dow: number // 0=Sunday, 6=Saturday
  startMin: number // minutes from 00:00
  endMin: number // minutes from 00:00 (exclusive)
  timezone: string
}

export interface TimeSlot {
  whenISO: string // ISO datetime string
  confidence: number // 0-1
  durationMin: number
}

/**
 * Find intersection of two availability windows
 * Returns null if no overlap
 */
export function intersectWindows(
  a: AvailabilityWindow,
  b: AvailabilityWindow
): AvailabilityWindow | null {
  // Must be same day of week
  if (a.dow !== b.dow) return null

  // Find overlap
  const startMin = Math.max(a.startMin, b.startMin)
  const endMin = Math.min(a.endMin, b.endMin)

  // No overlap
  if (startMin >= endMin) return null

  return {
    dow: a.dow,
    startMin,
    endMin,
    timezone: a.timezone, // Use first user's timezone
  }
}

/**
 * Compute all availability window intersections between two users
 */
export function computeSharedWindows(
  userA: AvailabilityWindow[],
  userB: AvailabilityWindow[]
): AvailabilityWindow[] {
  const shared: AvailabilityWindow[] = []

  for (const windowA of userA) {
    for (const windowB of userB) {
      const intersection = intersectWindows(windowA, windowB)
      if (intersection) {
        shared.push(intersection)
      }
    }
  }

  return shared
}

/**
 * Convert availability windows to concrete time slots for next N weeks
 * Returns top K slots sorted by preference (soonest, longest)
 */
export function computeNextBestTimes(
  sharedWindows: AvailabilityWindow[],
  options: {
    weeksAhead?: number
    topK?: number
    minDurationMin?: number
    now?: Date
  } = {}
): TimeSlot[] {
  const { weeksAhead = 2, topK = 5, minDurationMin = 30, now = new Date() } = options

  const slots: TimeSlot[] = []

  // For each week ahead
  for (let week = 0; week < weeksAhead; week++) {
    for (const window of sharedWindows) {
      // Find next occurrence of this day of week
      const daysUntil = (window.dow - now.getDay() + 7) % 7 + week * 7
      const targetDate = new Date(now)
      targetDate.setDate(now.getDate() + daysUntil)

      // Set time to window start
      targetDate.setHours(0, 0, 0, 0)
      targetDate.setMinutes(targetDate.getMinutes() + window.startMin)

      // Skip if in the past
      if (targetDate < now) continue

      const durationMin = window.endMin - window.startMin

      // Skip if too short
      if (durationMin < minDurationMin) continue

      // Confidence: higher for sooner dates and longer durations
      const daysAway = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const recencyScore = 1 - daysAway / (weeksAhead * 7)
      const durationScore = Math.min(durationMin / 120, 1) // Normalize to 2 hours max
      const confidence = recencyScore * 0.6 + durationScore * 0.4

      slots.push({
        whenISO: targetDate.toISOString(),
        confidence: parseFloat(confidence.toFixed(2)),
        durationMin,
      })
    }
  }

  // Sort by confidence (desc) then by date (asc)
  slots.sort((a, b) => {
    if (Math.abs(a.confidence - b.confidence) > 0.01) {
      return b.confidence - a.confidence
    }
    return new Date(a.whenISO).getTime() - new Date(b.whenISO).getTime()
  })

  return slots.slice(0, topK)
}

/**
 * Check if two users can study NOW based on shared availability
 * Returns true if current time falls within a shared window
 */
export function canStudyNow(
  sharedWindows: AvailabilityWindow[],
  now: Date = new Date()
): boolean {
  const currentDow = now.getDay()
  const currentMin = now.getHours() * 60 + now.getMinutes()

  for (const window of sharedWindows) {
    if (window.dow === currentDow && currentMin >= window.startMin && currentMin < window.endMin) {
      return true
    }
  }

  return false
}

/**
 * Convert minutes-since-midnight to HH:MM string
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Format availability window for display
 */
export function formatWindow(window: AvailabilityWindow): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayName = days[window.dow]
  const start = minutesToTime(window.startMin)
  const end = minutesToTime(window.endMin)
  return `${dayName} ${start}-${end}`
}
