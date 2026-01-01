/**
 * Smart Text Splitter Utility
 *
 * Handles intelligent splitting of compound text inputs like:
 * - "Mathematics and Computer Science" → ["Mathematics", "Computer Science"]
 * - "Mathematics or Physics" → ["Mathematics", "Physics"]
 * - "Physics, Chemistry, Biology" → ["Physics", "Chemistry", "Biology"]
 * - "Machine Learning & AI" → ["Machine Learning", "AI"]
 *
 * SCALABILITY: This is a pure function with O(n) complexity where n is string length.
 * Safe for use with 1000-3000 concurrent users as it involves no I/O operations.
 * - No database calls
 * - No N+1 queries
 * - Memory-safe with limits (max 10-20 items)
 */

// Common separators that indicate multiple items
const SEPARATORS = [
  ' and ',   // "Mathematics and Computer Science"
  ' or ',    // "Mathematics or Physics"
  ' & ',     // "Physics & Chemistry"
  ', ',      // "Math, Science, History"
  '; ',      // "Math; Science; History"
  ' / ',     // "Frontend / Backend"
]

// Minimum length for a valid item (prevents empty or single-char items)
const MIN_ITEM_LENGTH = 2

// Maximum items to prevent abuse (memory protection)
const MAX_ITEMS_PER_INPUT = 10

/**
 * Split a compound text input into individual items
 *
 * @param input - The raw text input from user
 * @returns Array of individual items, trimmed and deduplicated
 *
 * @example
 * splitCompoundText("Mathematics and Computer Science")
 * // Returns: ["Mathematics", "Computer Science"]
 *
 * @example
 * splitCompoundText("Physics, Chemistry, Biology")
 * // Returns: ["Physics", "Chemistry", "Biology"]
 *
 * @example
 * splitCompoundText("JavaScript") // No separator found
 * // Returns: ["JavaScript"]
 */
export function splitCompoundText(input: string): string[] {
  if (!input || typeof input !== 'string') {
    return []
  }

  const trimmedInput = input.trim()
  if (!trimmedInput) {
    return []
  }

  // Try each separator to find matches
  for (const separator of SEPARATORS) {
    if (trimmedInput.toLowerCase().includes(separator.toLowerCase())) {
      // Found a separator - split by it (case-insensitive split)
      const parts = splitCaseInsensitive(trimmedInput, separator)

      // Clean, filter, and deduplicate
      const cleanedParts = parts
        .map(part => part.trim())
        .filter(part => part.length >= MIN_ITEM_LENGTH)
        .slice(0, MAX_ITEMS_PER_INPUT) // Limit to prevent abuse

      // Deduplicate (case-insensitive)
      const seen = new Set<string>()
      const uniqueParts: string[] = []

      for (const part of cleanedParts) {
        const lowerPart = part.toLowerCase()
        if (!seen.has(lowerPart)) {
          seen.add(lowerPart)
          uniqueParts.push(part)
        }
      }

      // Only return split result if we got multiple items
      if (uniqueParts.length > 1) {
        return uniqueParts
      }
    }
  }

  // No separator found or splitting didn't produce multiple items
  // Return the original input as a single-item array
  return trimmedInput.length >= MIN_ITEM_LENGTH ? [trimmedInput] : []
}

/**
 * Case-insensitive split that preserves original casing
 */
function splitCaseInsensitive(str: string, separator: string): string[] {
  const lowerStr = str.toLowerCase()
  const lowerSep = separator.toLowerCase()

  const result: string[] = []
  let lastIndex = 0
  let index = lowerStr.indexOf(lowerSep)

  while (index !== -1) {
    result.push(str.slice(lastIndex, index))
    lastIndex = index + separator.length
    index = lowerStr.indexOf(lowerSep, lastIndex)
  }

  result.push(str.slice(lastIndex))
  return result
}

/**
 * Process an array of items, splitting any compound items
 * Useful for processing existing arrays that might have unsplit items
 *
 * @param items - Array of items that may contain compound strings
 * @returns Flattened array with all compound strings split
 *
 * @example
 * processItemsWithSplitting(["Math", "Physics and Chemistry"])
 * // Returns: ["Math", "Physics", "Chemistry"]
 */
export function processItemsWithSplitting(items: string[]): string[] {
  if (!Array.isArray(items)) {
    return []
  }

  const result: string[] = []
  const seen = new Set<string>()

  for (const item of items) {
    const splitItems = splitCompoundText(item)

    for (const splitItem of splitItems) {
      const lowerItem = splitItem.toLowerCase()
      if (!seen.has(lowerItem)) {
        seen.add(lowerItem)
        result.push(splitItem)
      }
    }
  }

  return result.slice(0, MAX_ITEMS_PER_INPUT * 2) // Allow slightly more for processed arrays
}

/**
 * Check if a string contains any compound separators
 * Useful for UI hints
 */
export function containsCompoundSeparator(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false
  }

  const lowerInput = input.toLowerCase()
  return SEPARATORS.some(sep => lowerInput.includes(sep.toLowerCase()))
}

/**
 * Get display text showing how input will be split
 * Useful for preview in UI
 */
export function getPreviewSplit(input: string): string[] | null {
  const split = splitCompoundText(input)
  return split.length > 1 ? split : null
}
