/**
 * SMART RESOURCE URL GENERATOR
 *
 * Generates direct links to learning platforms based on:
 * - Resource type (video, article, exercise, tool, book)
 * - Subject/topic
 * - Platform relevance scoring
 *
 * This replaces generic Google searches with targeted platform links.
 */

import { Platform, PLATFORMS, getPlatformsForSubject, getPlatformSearchUrl } from '../platforms/platform-database'

// ============================================
// TYPES
// ============================================

export interface SmartResource {
  type: 'video' | 'article' | 'exercise' | 'tool' | 'book' | 'course'
  title: string
  description?: string
  searchQuery: string
  // Generated fields
  platformId: string
  platformName: string
  platformIcon: string
  platformColor: string
  directUrl: string
}

export interface ResourceInput {
  type: string
  title: string
  description?: string
  searchQuery?: string
}

// ============================================
// PLATFORM MAPPINGS BY RESOURCE TYPE
// ============================================

// Best platforms for each resource type
const PLATFORM_BY_TYPE: Record<string, string[]> = {
  video: ['youtube', 'khan_academy', 'coursera', 'udemy', 'skillshare'],
  article: ['khan_academy', 'mdn', 'w3schools', 'geeksforgeeks', 'freecodecamp'],
  exercise: ['leetcode', 'hackerrank', 'khan_academy', 'brilliant', 'freecodecamp'],
  tool: ['desmos', 'wolfram_alpha', 'replit', 'codepen', 'figma'],
  book: ['openlibrary', 'gutenberg', 'libgen'],
  course: ['coursera', 'edx', 'udemy', 'khan_academy', 'freecodecamp'],
}

// Platform search URL patterns (for platforms missing in database)
const FALLBACK_SEARCH_URLS: Record<string, string> = {
  youtube: 'https://www.youtube.com/results?search_query={query}+tutorial',
  google: 'https://www.google.com/search?q={query}',
  coursera: 'https://www.coursera.org/search?query={query}',
  udemy: 'https://www.udemy.com/courses/search/?q={query}',
  edx: 'https://www.edx.org/search?q={query}',
  freecodecamp: 'https://www.freecodecamp.org/news/search/?query={query}',
  mdn: 'https://developer.mozilla.org/en-US/search?q={query}',
  w3schools: 'https://www.w3schools.com/search/search_result.asp?q={query}',
  stackoverflow: 'https://stackoverflow.com/search?q={query}',
  github: 'https://github.com/search?q={query}&type=repositories',
  leetcode: 'https://leetcode.com/problemset/all/?search={query}',
  hackerrank: 'https://www.hackerrank.com/domains?filters%5Bsubdomains%5D%5B%5D={query}',
  geeksforgeeks: 'https://www.geeksforgeeks.org/search/{query}/',
  replit: 'https://replit.com/search?q={query}',
  codepen: 'https://codepen.io/search/pens?q={query}',
}

// Platform metadata for fallbacks
const FALLBACK_PLATFORMS: Record<string, { name: string; icon: string; color: string }> = {
  youtube: { name: 'YouTube', icon: '📺', color: '#FF0000' },
  google: { name: 'Google', icon: '🔍', color: '#4285F4' },
  coursera: { name: 'Coursera', icon: '🎓', color: '#0056D2' },
  udemy: { name: 'Udemy', icon: '📖', color: '#A435F0' },
  edx: { name: 'edX', icon: '🏫', color: '#02262B' },
  stackoverflow: { name: 'Stack Overflow', icon: '💬', color: '#F48024' },
  github: { name: 'GitHub', icon: '🐙', color: '#24292E' },
}

// ============================================
// SMART URL GENERATION
// ============================================

/**
 * Get the best platform for a resource based on type and subject
 */
function getBestPlatform(
  resourceType: string,
  subject: string,
  searchQuery: string
): { platform: Platform | null; fallbackId: string | null } {
  const normalizedType = resourceType.toLowerCase()

  // Get platforms good for this resource type
  const preferredPlatformIds = PLATFORM_BY_TYPE[normalizedType] || PLATFORM_BY_TYPE['article']

  // Get platforms good for this subject
  const subjectPlatforms = getPlatformsForSubject(subject, 10)

  // Find intersection - platforms good for both type AND subject
  for (const platformId of preferredPlatformIds) {
    const found = subjectPlatforms.find(p => p.id === platformId)
    if (found && found.searchUrl) {
      return { platform: found, fallbackId: null }
    }
  }

  // If no intersection, try to find any platform from preferred list
  for (const platformId of preferredPlatformIds) {
    const found = PLATFORMS.find(p => p.id === platformId)
    if (found && found.searchUrl) {
      return { platform: found, fallbackId: null }
    }
  }

  // Fallback to type-specific platform that might not be in database
  const fallbackId = preferredPlatformIds[0] || 'google'
  if (FALLBACK_SEARCH_URLS[fallbackId]) {
    return { platform: null, fallbackId }
  }

  return { platform: null, fallbackId: 'google' }
}

/**
 * Generate a direct URL for a resource
 */
export function generateResourceUrl(
  resourceType: string,
  searchQuery: string,
  subject: string
): { url: string; platformId: string; platformName: string; platformIcon: string; platformColor: string } {
  const { platform, fallbackId } = getBestPlatform(resourceType, subject, searchQuery)

  if (platform) {
    return {
      url: getPlatformSearchUrl(platform, searchQuery),
      platformId: platform.id,
      platformName: platform.name,
      platformIcon: platform.icon,
      platformColor: platform.color,
    }
  }

  // Use fallback
  const id = fallbackId || 'google'
  const urlPattern = FALLBACK_SEARCH_URLS[id] || FALLBACK_SEARCH_URLS['google']
  const meta = FALLBACK_PLATFORMS[id] || FALLBACK_PLATFORMS['google']

  return {
    url: urlPattern.replace('{query}', encodeURIComponent(searchQuery)),
    platformId: id,
    platformName: meta.name,
    platformIcon: meta.icon,
    platformColor: meta.color,
  }
}

/**
 * Transform basic resource into smart resource with direct platform links
 */
export function createSmartResource(
  input: ResourceInput,
  subject: string
): SmartResource {
  const type = (input.type || 'article') as SmartResource['type']
  const searchQuery = input.searchQuery || input.title

  const { url, platformId, platformName, platformIcon, platformColor } = generateResourceUrl(
    type,
    searchQuery,
    subject
  )

  return {
    type,
    title: input.title,
    description: input.description,
    searchQuery,
    platformId,
    platformName,
    platformIcon,
    platformColor,
    directUrl: url,
  }
}

/**
 * Generate multiple resources for a step with variety
 */
export function generateStepResources(
  stepTitle: string,
  subject: string,
  count: number = 2
): SmartResource[] {
  const resources: SmartResource[] = []

  // Always include a video resource
  if (count >= 1) {
    resources.push(createSmartResource({
      type: 'video',
      title: `${stepTitle} - Video Tutorial`,
      searchQuery: `${stepTitle} ${subject} tutorial`,
    }, subject))
  }

  // Add article or exercise based on subject
  if (count >= 2) {
    const isCodeSubject = ['programming', 'coding', 'javascript', 'python', 'web development', 'computer science'].some(
      s => subject.toLowerCase().includes(s)
    )

    if (isCodeSubject) {
      resources.push(createSmartResource({
        type: 'exercise',
        title: `${stepTitle} - Practice Problems`,
        searchQuery: `${stepTitle} practice exercises`,
      }, subject))
    } else {
      resources.push(createSmartResource({
        type: 'article',
        title: `${stepTitle} - Guide`,
        searchQuery: `${stepTitle} ${subject} guide`,
      }, subject))
    }
  }

  return resources
}

/**
 * Get platform-specific resources for common learning types
 */
export function getResourcesByLearningStyle(
  topic: string,
  subject: string,
  style: 'visual' | 'reading' | 'hands-on' | 'mixed'
): SmartResource[] {
  switch (style) {
    case 'visual':
      return [
        createSmartResource({ type: 'video', title: `${topic} Explained`, searchQuery: `${topic} explained visually` }, subject),
        createSmartResource({ type: 'video', title: `${topic} Tutorial`, searchQuery: `${topic} step by step tutorial` }, subject),
      ]

    case 'reading':
      return [
        createSmartResource({ type: 'article', title: `${topic} Guide`, searchQuery: `${topic} comprehensive guide` }, subject),
        createSmartResource({ type: 'article', title: `${topic} Documentation`, searchQuery: `${topic} documentation` }, subject),
      ]

    case 'hands-on':
      return [
        createSmartResource({ type: 'exercise', title: `${topic} Practice`, searchQuery: `${topic} practice problems` }, subject),
        createSmartResource({ type: 'tool', title: `${topic} Playground`, searchQuery: `${topic} interactive` }, subject),
      ]

    case 'mixed':
    default:
      return [
        createSmartResource({ type: 'video', title: `${topic} Tutorial`, searchQuery: `${topic} tutorial for beginners` }, subject),
        createSmartResource({ type: 'exercise', title: `${topic} Exercises`, searchQuery: `${topic} practice` }, subject),
      ]
  }
}
