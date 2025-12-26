/**
 * Smart Search & Matching Utility
 *
 * Provides intelligent, flexible matching for groups, partners, and other entities.
 * Features:
 * - Synonym/related term expansion
 * - Fuzzy matching for typos
 * - Abbreviation recognition
 * - Multi-language subject names
 * - Contextual relevance scoring
 */

// ============================================================================
// SYNONYM MAPPINGS - Comprehensive educational terms
// ============================================================================

/**
 * Subject synonyms and related terms
 * Key: canonical term, Value: array of related terms, abbreviations, and variations
 */
export const SUBJECT_SYNONYMS: Record<string, string[]> = {
  // Mathematics
  mathematics: [
    'math', 'maths', 'arithmetic', 'algebra', 'geometry', 'calculus',
    'trigonometry', 'statistics', 'probability', 'linear algebra',
    'discrete math', 'number theory', 'mathematical', 'quantitative',
    'pre-calculus', 'precalc', 'calc', 'stats', 'trig', 'geo', 'alg',
    'differential equations', 'multivariable', 'ap calc', 'ap statistics',
  ],

  // Physics
  physics: [
    'phys', 'mechanics', 'thermodynamics', 'electromagnetism', 'quantum',
    'optics', 'acoustics', 'astrophysics', 'nuclear physics', 'particle physics',
    'classical mechanics', 'modern physics', 'ap physics', 'physical science',
  ],

  // Chemistry
  chemistry: [
    'chem', 'organic chemistry', 'inorganic chemistry', 'biochemistry',
    'physical chemistry', 'analytical chemistry', 'ochem', 'orgo',
    'general chemistry', 'gen chem', 'ap chemistry', 'chemical',
  ],

  // Biology
  biology: [
    'bio', 'life science', 'anatomy', 'physiology', 'genetics', 'ecology',
    'microbiology', 'molecular biology', 'cell biology', 'zoology', 'botany',
    'neuroscience', 'biochem', 'biomed', 'biomedical', 'ap biology',
    'human biology', 'marine biology', 'evolutionary biology',
  ],

  // Computer Science
  'computer science': [
    'cs', 'comp sci', 'programming', 'coding', 'software', 'algorithms',
    'data structures', 'machine learning', 'ml', 'ai', 'artificial intelligence',
    'web development', 'webdev', 'app development', 'mobile dev',
    'python', 'java', 'javascript', 'js', 'typescript', 'c++', 'cpp',
    'database', 'sql', 'backend', 'frontend', 'full stack', 'fullstack',
    'cybersecurity', 'networking', 'systems', 'operating systems', 'os',
    'computer engineering', 'software engineering', 'swe', 'dsa',
    'react', 'node', 'angular', 'vue', 'html', 'css', 'api',
  ],

  // English & Literature
  english: [
    'literature', 'writing', 'composition', 'grammar', 'reading',
    'creative writing', 'essay', 'poetry', 'prose', 'fiction',
    'non-fiction', 'rhetoric', 'linguistics', 'language arts',
    'ap english', 'ap lit', 'ap lang', 'english literature', 'british lit',
    'american lit', 'world literature', 'literary analysis',
  ],

  // History
  history: [
    'hist', 'world history', 'us history', 'american history', 'european history',
    'ancient history', 'modern history', 'ap history', 'apush', 'ap world',
    'ap euro', 'historical', 'civilization', 'war history', 'political history',
  ],

  // Economics
  economics: [
    'econ', 'economy', 'microeconomics', 'macroeconomics', 'micro', 'macro',
    'finance', 'financial', 'business economics', 'ap economics',
    'econometrics', 'international economics', 'monetary', 'fiscal',
  ],

  // Psychology
  psychology: [
    'psych', 'cognitive psychology', 'behavioral psychology', 'clinical psychology',
    'social psychology', 'developmental psychology', 'abnormal psychology',
    'neuropsychology', 'ap psychology', 'mental health', 'counseling',
  ],

  // Business
  business: [
    'biz', 'management', 'marketing', 'accounting', 'finance', 'entrepreneurship',
    'mba', 'business administration', 'organizational behavior', 'strategy',
    'operations', 'supply chain', 'hr', 'human resources', 'commerce',
  ],

  // Languages
  spanish: ['espanol', 'español', 'spanish language', 'ap spanish', 'hispanic'],
  french: ['francais', 'français', 'french language', 'ap french', 'parisian'],
  german: ['deutsch', 'german language', 'ap german', 'germanic'],
  chinese: ['mandarin', 'cantonese', 'chinese language', 'ap chinese', '中文', '汉语'],
  japanese: ['nihongo', 'japanese language', 'ap japanese', '日本語'],
  korean: ['hangul', 'korean language', '한국어', '조선어'],

  // Arts
  art: [
    'visual arts', 'fine arts', 'painting', 'drawing', 'sculpture',
    'art history', 'ap art', 'studio art', 'graphic design', 'design',
    'illustration', 'photography', 'digital art', 'animation',
  ],
  music: [
    'musical', 'music theory', 'composition', 'performance', 'band',
    'orchestra', 'choir', 'vocal', 'instrumental', 'piano', 'guitar',
    'ap music theory', 'jazz', 'classical music',
  ],

  // Sciences (General)
  science: [
    'natural science', 'physical science', 'life science', 'earth science',
    'environmental science', 'ap environmental', 'apes', 'geology',
    'astronomy', 'meteorology', 'oceanography', 'scientific',
  ],

  // Engineering
  engineering: [
    'eng', 'mechanical engineering', 'electrical engineering', 'civil engineering',
    'chemical engineering', 'aerospace engineering', 'biomedical engineering',
    'industrial engineering', 'systems engineering', 'robotics',
    'mech e', 'ee', 'ece', 'stem', 'technical',
  ],

  // Medical/Health
  medicine: [
    'medical', 'healthcare', 'health science', 'nursing', 'pre-med', 'premed',
    'anatomy', 'physiology', 'pharmacology', 'pathology', 'clinical',
    'public health', 'epidemiology', 'nutrition', 'kinesiology',
  ],

  // Law
  law: [
    'legal', 'pre-law', 'prelaw', 'jurisprudence', 'constitutional law',
    'criminal law', 'civil law', 'contract law', 'lsat', 'legal studies',
  ],

  // Philosophy
  philosophy: [
    'philo', 'ethics', 'logic', 'metaphysics', 'epistemology', 'aesthetics',
    'political philosophy', 'philosophy of mind', 'moral philosophy',
  ],

  // Sociology
  sociology: [
    'soc', 'social science', 'social studies', 'anthropology', 'criminology',
    'demography', 'urban studies', 'gender studies', 'cultural studies',
  ],

  // Test Prep
  'test prep': [
    'sat', 'act', 'gre', 'gmat', 'lsat', 'mcat', 'dat', 'pcat',
    'ap exam', 'ib exam', 'standardized test', 'college admission',
    'exam prep', 'test preparation', 'study skills',
  ],
}

// ============================================================================
// SKILL LEVEL SYNONYMS
// ============================================================================

export const SKILL_LEVEL_SYNONYMS: Record<string, string[]> = {
  beginner: [
    'basic', 'intro', 'introductory', 'elementary', 'novice', 'starter',
    'fundamentals', 'foundations', 'entry level', 'newbie', 'starting out',
    '101', 'level 1', 'first year', 'freshman',
  ],
  intermediate: [
    'medium', 'moderate', 'mid-level', 'developing', 'progressing',
    'level 2', 'second year', 'sophomore', 'improving', 'advancing',
  ],
  advanced: [
    'expert', 'pro', 'professional', 'senior', 'experienced', 'skilled',
    'proficient', 'master', 'level 3', 'third year', 'junior', 'upper level',
    'high level', 'honors', 'ap level', 'college level',
  ],
  expert: [
    'master', 'guru', 'specialist', 'elite', 'top level', 'level 4',
    'graduate level', 'phd level', 'research level', 'professional',
  ],
}

// ============================================================================
// STUDY STYLE SYNONYMS
// ============================================================================

export const STUDY_STYLE_SYNONYMS: Record<string, string[]> = {
  visual: [
    'diagrams', 'charts', 'graphs', 'pictures', 'images', 'videos',
    'illustrations', 'mind maps', 'flashcards', 'color coding',
  ],
  auditory: [
    'listening', 'audio', 'verbal', 'discussion', 'lectures', 'podcasts',
    'reading aloud', 'verbal explanation', 'talking through',
  ],
  'reading/writing': [
    'reading', 'writing', 'notes', 'note-taking', 'textbook', 'essays',
    'written', 'documentation', 'lists', 'definitions',
  ],
  kinesthetic: [
    'hands-on', 'practical', 'interactive', 'experiments', 'labs',
    'practice problems', 'simulations', 'real-world', 'applied',
  ],
  collaborative: [
    'group', 'team', 'together', 'partner', 'discussion', 'peer',
    'cooperative', 'social', 'interactive', 'study group',
  ],
  independent: [
    'solo', 'alone', 'self-study', 'individual', 'personal', 'self-paced',
    'autonomous', 'self-directed', 'private',
  ],
}

// ============================================================================
// CORE MATCHING FUNCTIONS
// ============================================================================

/**
 * Expand a search term into related terms using synonym mappings
 */
export function expandSearchTerm(term: string): string[] {
  const normalizedTerm = term.toLowerCase().trim()
  const expanded: Set<string> = new Set([normalizedTerm])

  // Check all synonym categories
  const allSynonyms = {
    ...SUBJECT_SYNONYMS,
    ...SKILL_LEVEL_SYNONYMS,
    ...STUDY_STYLE_SYNONYMS,
  }

  // Find if the term matches any key or value in synonyms
  for (const [key, values] of Object.entries(allSynonyms)) {
    const keyLower = key.toLowerCase()
    const valuesLower = values.map(v => v.toLowerCase())

    // If term matches key, add all values
    if (keyLower === normalizedTerm || keyLower.includes(normalizedTerm) || normalizedTerm.includes(keyLower)) {
      expanded.add(keyLower)
      valuesLower.forEach(v => expanded.add(v))
    }

    // If term matches any value, add key and all sibling values
    if (valuesLower.some(v => v === normalizedTerm || v.includes(normalizedTerm) || normalizedTerm.includes(v))) {
      expanded.add(keyLower)
      valuesLower.forEach(v => expanded.add(v))
    }
  }

  return Array.from(expanded)
}

/**
 * Expand multiple search terms
 */
export function expandSearchTerms(terms: string[]): string[] {
  const allExpanded: Set<string> = new Set()

  terms.forEach(term => {
    expandSearchTerm(term).forEach(t => allExpanded.add(t))
  })

  return Array.from(allExpanded)
}

/**
 * Calculate similarity score between two strings (0-1)
 * Uses Levenshtein distance for fuzzy matching
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0

  // Check for substring match
  if (s1.includes(s2) || s2.includes(s1)) {
    const shorter = Math.min(s1.length, s2.length)
    const longer = Math.max(s1.length, s2.length)
    return shorter / longer
  }

  // Levenshtein distance for fuzzy matching
  const matrix: number[][] = []

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  const distance = matrix[s1.length][s2.length]
  const maxLength = Math.max(s1.length, s2.length)

  return 1 - distance / maxLength
}

/**
 * Check if a search term matches a target text
 * Returns a score from 0-100
 */
export function matchScore(searchTerm: string, targetText: string): number {
  if (!searchTerm || !targetText) return 0

  const search = searchTerm.toLowerCase().trim()
  const target = targetText.toLowerCase().trim()

  // Exact match
  if (target === search) return 100

  // Contains match
  if (target.includes(search)) return 90
  if (search.includes(target)) return 80

  // Word boundary match
  const targetWords = target.split(/\s+/)
  const searchWords = search.split(/\s+/)

  let wordMatchCount = 0
  for (const sw of searchWords) {
    for (const tw of targetWords) {
      if (tw === sw) {
        wordMatchCount += 2
      } else if (tw.includes(sw) || sw.includes(tw)) {
        wordMatchCount += 1
      }
    }
  }

  if (wordMatchCount > 0) {
    return Math.min(70, 40 + wordMatchCount * 10)
  }

  // Fuzzy match
  const similarity = calculateSimilarity(search, target)
  if (similarity > 0.7) return Math.round(similarity * 60)
  if (similarity > 0.5) return Math.round(similarity * 40)

  return 0
}

/**
 * Smart search function that expands terms and calculates match scores
 */
export function smartSearch(
  searchQuery: string,
  targetFields: (string | null | undefined)[],
  options: {
    expandSynonyms?: boolean
    fuzzyMatch?: boolean
    minScore?: number
  } = {}
): { matches: boolean; score: number; matchedTerms: string[] } {
  const {
    expandSynonyms = true,
    fuzzyMatch = true,
    minScore = 20,
  } = options

  if (!searchQuery?.trim()) {
    return { matches: true, score: 100, matchedTerms: [] }
  }

  // Parse search query into terms
  const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0)

  // Expand terms with synonyms if enabled
  const expandedTerms = expandSynonyms
    ? expandSearchTerms(searchTerms)
    : searchTerms

  // Combine target fields into searchable text
  const targetText = targetFields
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!targetText) {
    return { matches: false, score: 0, matchedTerms: [] }
  }

  // Calculate scores for each term
  let totalScore = 0
  const matchedTerms: string[] = []

  for (const term of expandedTerms) {
    const score = matchScore(term, targetText)
    if (score > 0) {
      totalScore += score
      if (!matchedTerms.includes(term)) {
        matchedTerms.push(term)
      }
    }
  }

  // Normalize score
  const normalizedScore = expandedTerms.length > 0
    ? Math.min(100, Math.round(totalScore / expandedTerms.length))
    : 0

  // Apply fuzzy matching if no direct matches found
  if (normalizedScore < minScore && fuzzyMatch) {
    const targetWords = targetText.split(/\s+/)

    for (const searchTerm of searchTerms) {
      for (const targetWord of targetWords) {
        const similarity = calculateSimilarity(searchTerm, targetWord)
        if (similarity > 0.7) {
          return {
            matches: true,
            score: Math.round(similarity * 50),
            matchedTerms: [targetWord],
          }
        }
      }
    }
  }

  return {
    matches: normalizedScore >= minScore,
    score: normalizedScore,
    matchedTerms,
  }
}

/**
 * Build Prisma WHERE conditions for smart search
 */
export function buildSmartSearchConditions(
  searchQuery: string,
  searchFields: string[],
  options: { expandSynonyms?: boolean } = {}
): { OR: Array<Record<string, unknown>> } | null {
  if (!searchQuery?.trim()) return null

  const { expandSynonyms = true } = options

  // Parse and expand search terms
  const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0)
  const allTerms = expandSynonyms ? expandSearchTerms(searchTerms) : searchTerms

  // Remove duplicates and very common words
  const uniqueTerms = [...new Set(allTerms)].filter(term =>
    term.length > 1 && !['the', 'a', 'an', 'and', 'or', 'is', 'in', 'to', 'for'].includes(term)
  )

  if (uniqueTerms.length === 0) return null

  // Build OR conditions for each field and term combination
  const conditions: Array<Record<string, unknown>> = []

  for (const term of uniqueTerms) {
    for (const field of searchFields) {
      conditions.push({
        [field]: {
          contains: term,
          mode: 'insensitive',
        },
      })
    }
  }

  return { OR: conditions }
}

/**
 * Calculate relevance score for ranking search results
 */
export function calculateRelevanceScore(
  searchQuery: string,
  entity: {
    name?: string | null
    description?: string | null
    subject?: string | null
    subjectCustomDescription?: string | null
    skillLevel?: string | null
    skillLevelCustomDescription?: string | null
    tags?: string[] | null
  },
  options: { expandSynonyms?: boolean } = {}
): number {
  const { expandSynonyms = true } = options

  if (!searchQuery?.trim()) return 0

  const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0)
  const expandedTerms = expandSynonyms ? expandSearchTerms(searchTerms) : searchTerms

  let score = 0
  const weights = {
    name: 10,
    subject: 8,
    description: 5,
    subjectCustomDescription: 6,
    skillLevel: 4,
    skillLevelCustomDescription: 4,
    tags: 7,
  }

  for (const term of expandedTerms) {
    const termLower = term.toLowerCase()

    // Check name (highest weight)
    if (entity.name?.toLowerCase().includes(termLower)) {
      score += weights.name
      if (entity.name.toLowerCase() === termLower) score += 5 // Exact match bonus
    }

    // Check subject
    if (entity.subject?.toLowerCase().includes(termLower)) {
      score += weights.subject
    }

    // Check description
    if (entity.description?.toLowerCase().includes(termLower)) {
      score += weights.description
    }

    // Check custom descriptions
    if (entity.subjectCustomDescription?.toLowerCase().includes(termLower)) {
      score += weights.subjectCustomDescription
    }
    if (entity.skillLevelCustomDescription?.toLowerCase().includes(termLower)) {
      score += weights.skillLevelCustomDescription
    }

    // Check skill level
    if (entity.skillLevel?.toLowerCase().includes(termLower)) {
      score += weights.skillLevel
    }

    // Check tags
    if (entity.tags?.some(tag => tag.toLowerCase().includes(termLower))) {
      score += weights.tags
    }
  }

  return score
}

// ============================================================================
// EXPORT DEFAULT SEARCH FUNCTION
// ============================================================================

export default {
  expandSearchTerm,
  expandSearchTerms,
  calculateSimilarity,
  matchScore,
  smartSearch,
  buildSmartSearchConditions,
  calculateRelevanceScore,
  SUBJECT_SYNONYMS,
  SKILL_LEVEL_SYNONYMS,
  STUDY_STYLE_SYNONYMS,
}
