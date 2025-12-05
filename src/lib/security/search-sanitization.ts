/**
 * Search Query Sanitization
 * 
 * Provides comprehensive sanitization for search queries to prevent:
 * - SQL injection (via Prisma parameterization)
 * - XSS in search results
 * - Regex denial of service (ReDoS)
 * - Special character abuse
 */

// Characters that could cause issues in database queries or regex
const DANGEROUS_CHARS = /[\\<>'"`;{}()[\]|&$#!^~*?]/g

// SQL-like patterns to remove (even though Prisma prevents injection)
const SQL_PATTERNS = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|EXEC|EXECUTE|XP_|SP_|0x)\b)/gi

// Maximum search query length
const MAX_QUERY_LENGTH = 200

// Maximum number of search terms
const MAX_SEARCH_TERMS = 10

export interface SanitizedSearchQuery {
  original: string
  sanitized: string
  terms: string[]
  isValid: boolean
  warnings: string[]
}

/**
 * Sanitize a search query string
 */
export function sanitizeSearchQuery(query: string | undefined | null): SanitizedSearchQuery {
  const warnings: string[] = []
  
  // Handle empty/null input
  if (!query || typeof query !== 'string') {
    return {
      original: '',
      sanitized: '',
      terms: [],
      isValid: false,
      warnings: ['Empty search query'],
    }
  }

  let sanitized = query.trim()
  const original = sanitized

  // Check length
  if (sanitized.length > MAX_QUERY_LENGTH) {
    sanitized = sanitized.substring(0, MAX_QUERY_LENGTH)
    warnings.push(`Query truncated to ${MAX_QUERY_LENGTH} characters`)
  }

  // Remove dangerous characters
  const dangerousMatches = sanitized.match(DANGEROUS_CHARS)
  if (dangerousMatches) {
    sanitized = sanitized.replace(DANGEROUS_CHARS, ' ')
    warnings.push('Special characters removed')
  }

  // Remove SQL-like patterns (defense in depth)
  const sqlMatches = sanitized.match(SQL_PATTERNS)
  if (sqlMatches) {
    sanitized = sanitized.replace(SQL_PATTERNS, '')
    warnings.push('Potentially dangerous patterns removed')
  }

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim()

  // Extract search terms
  let terms = sanitized.split(' ').filter(term => term.length > 0)

  // Limit number of terms
  if (terms.length > MAX_SEARCH_TERMS) {
    terms = terms.slice(0, MAX_SEARCH_TERMS)
    sanitized = terms.join(' ')
    warnings.push(`Limited to ${MAX_SEARCH_TERMS} search terms`)
  }

  // Filter out very short terms (potential noise)
  terms = terms.filter(term => term.length >= 2)

  return {
    original,
    sanitized,
    terms,
    isValid: sanitized.length > 0 && terms.length > 0,
    warnings,
  }
}

/**
 * Escape special characters for use in SQL LIKE/ILIKE patterns
 * Used when building dynamic LIKE queries
 */
export function escapeLikePattern(input: string): string {
  if (!input) return ''
  
  // Escape special LIKE characters: % and _
  // Also escape backslash which is the escape character
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

/**
 * Build a safe search pattern for database queries
 * Returns a pattern suitable for ILIKE/LIKE operations
 */
export function buildSearchPattern(query: string, type: 'contains' | 'starts' | 'ends' | 'exact' = 'contains'): string {
  const sanitized = sanitizeSearchQuery(query)
  if (!sanitized.isValid) return ''
  
  const escaped = escapeLikePattern(sanitized.sanitized)
  
  switch (type) {
    case 'starts':
      return `${escaped}%`
    case 'ends':
      return `%${escaped}`
    case 'exact':
      return escaped
    case 'contains':
    default:
      return `%${escaped}%`
  }
}

/**
 * Validate and sanitize an array of search terms (like subjects, interests)
 */
export function sanitizeArrayInput(
  input: string[] | undefined | null,
  options: {
    maxItems?: number
    maxItemLength?: number
    allowedValues?: string[]
  } = {}
): string[] {
  const {
    maxItems = 20,
    maxItemLength = 100,
    allowedValues,
  } = options

  if (!input || !Array.isArray(input)) {
    return []
  }

  return input
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => item.length > 0 && item.length <= maxItemLength)
    .filter(item => !allowedValues || allowedValues.includes(item))
    .slice(0, maxItems)
}

/**
 * Validate a skill level value
 */
export function validateSkillLevel(level: string | undefined | null): string | null {
  const validLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']
  if (!level || typeof level !== 'string') return null
  const normalized = level.toUpperCase().trim()
  return validLevels.includes(normalized) ? normalized : null
}

/**
 * Validate a study style value
 */
export function validateStudyStyle(style: string | undefined | null): string | null {
  const validStyles = [
    'VISUAL', 'AUDITORY', 'KINESTHETIC', 'READING_WRITING',
    'COLLABORATIVE', 'INDEPENDENT', 'SOLO', 'MIXED'
  ]
  if (!style || typeof style !== 'string') return null
  const normalized = style.toUpperCase().trim()
  return validStyles.includes(normalized) ? normalized : null
}

/**
 * Validate age range filter
 */
export function validateAgeRange(range: string | undefined | null): { min: number; max: number } | null {
  const validRanges: Record<string, { min: number; max: number }> = {
    'under-18': { min: 0, max: 17 },
    '18-24': { min: 18, max: 24 },
    '25-34': { min: 25, max: 34 },
    '35-44': { min: 35, max: 44 },
    '45+': { min: 45, max: 999 },
  }
  
  if (!range || typeof range !== 'string') return null
  return validRanges[range.toLowerCase().trim()] || null
}

