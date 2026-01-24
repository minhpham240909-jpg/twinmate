/**
 * Smart Search - Simplified for PWA
 *
 * Provides basic search term expansion and relevance scoring
 */

/**
 * Expand search terms with synonyms and related words
 */
export function expandSearchTerms(query: string): string[] {
  const terms = query.toLowerCase().trim().split(/\s+/)
  const expanded = new Set<string>(terms)

  // Add basic synonyms
  const synonyms: Record<string, string[]> = {
    math: ['mathematics', 'algebra', 'calculus', 'geometry'],
    science: ['physics', 'chemistry', 'biology'],
    english: ['literature', 'writing', 'grammar'],
    history: ['social studies', 'civics'],
    programming: ['coding', 'computer science', 'software'],
  }

  terms.forEach(term => {
    if (synonyms[term]) {
      synonyms[term].forEach(syn => expanded.add(syn))
    }
  })

  return Array.from(expanded)
}

/**
 * Calculate relevance score between query and content
 * Content can be a string or an object with string fields
 */
export function calculateRelevanceScore(
  query: string,
  content: string | Record<string, string | null | undefined>
): number {
  if (!query || !content) return 0

  // Convert object to string if necessary
  let contentStr: string
  if (typeof content === 'string') {
    contentStr = content
  } else {
    // Combine all non-null object values into a single string
    contentStr = Object.values(content)
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .join(' ')
  }

  if (!contentStr) return 0

  const queryTerms = query.toLowerCase().split(/\s+/)
  const contentLower = contentStr.toLowerCase()

  let score = 0

  queryTerms.forEach(term => {
    if (contentLower.includes(term)) {
      // Boost exact word matches
      if (new RegExp(`\\b${term}\\b`).test(contentLower)) {
        score += 2
      } else {
        score += 1
      }
    }
  })

  // Normalize by query length
  return queryTerms.length > 0 ? (score / queryTerms.length) * 50 : 0
}
