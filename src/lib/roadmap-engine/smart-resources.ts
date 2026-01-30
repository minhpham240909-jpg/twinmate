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
  // NEW: Visual content fields
  thumbnailUrl?: string      // Preview image for the resource
  embedUrl?: string          // Embeddable URL (e.g., YouTube embed)
  platformLogoUrl?: string   // Platform's logo image URL
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
const FALLBACK_PLATFORMS: Record<string, { name: string; icon: string; color: string; logoUrl?: string }> = {
  youtube: { name: 'YouTube', icon: '📺', color: '#FF0000', logoUrl: 'https://www.youtube.com/s/desktop/c6f5b811/img/favicon_144x144.png' },
  google: { name: 'Google', icon: '🔍', color: '#4285F4', logoUrl: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' },
  coursera: { name: 'Coursera', icon: '🎓', color: '#0056D2', logoUrl: 'https://d3njjcbhbojbot.cloudfront.net/web/images/favicons/android-chrome-144x144.png' },
  udemy: { name: 'Udemy', icon: '📖', color: '#A435F0', logoUrl: 'https://www.udemy.com/staticx/udemy/images/v7/logo-udemy.svg' },
  edx: { name: 'edX', icon: '🏫', color: '#02262B', logoUrl: 'https://www.edx.org/images/logos/edx-logo-elm.svg' },
  stackoverflow: { name: 'Stack Overflow', icon: '💬', color: '#F48024', logoUrl: 'https://cdn.sstatic.net/Sites/stackoverflow/Img/apple-touch-icon.png' },
  github: { name: 'GitHub', icon: '🐙', color: '#24292E', logoUrl: 'https://github.githubassets.com/favicons/favicon.svg' },
  khan_academy: { name: 'Khan Academy', icon: '📚', color: '#14BF96', logoUrl: 'https://cdn.kastatic.org/images/apple-touch-icon-144x144-precomposed.png' },
  freecodecamp: { name: 'freeCodeCamp', icon: '🏕️', color: '#0A0A23', logoUrl: 'https://www.freecodecamp.org/icons/icon-144x144.png' },
  leetcode: { name: 'LeetCode', icon: '💻', color: '#FFA116', logoUrl: 'https://leetcode.com/static/images/LeetCode_logo_oj.png' },
  mdn: { name: 'MDN Web Docs', icon: '📖', color: '#83D0F2', logoUrl: 'https://developer.mozilla.org/apple-touch-icon.png' },
  w3schools: { name: 'W3Schools', icon: '🌐', color: '#04AA6D', logoUrl: 'https://www.w3schools.com/favicon.ico' },
}

// ============================================
// THUMBNAIL AND EMBED URL GENERATION
// ============================================

/**
 * Generate a YouTube search thumbnail placeholder
 * Since we're generating search URLs (not specific video IDs), we use a placeholder
 * that represents the platform. For actual video IDs, we'd use:
 * https://img.youtube.com/vi/{VIDEO_ID}/mqdefault.jpg
 */
function generateYouTubeThumbnail(searchQuery: string): string {
  // For search results, we can't get a specific thumbnail, so we use a
  // placeholder image based on the search query
  // Using a gradient placeholder with the search query encoded
  const encodedQuery = encodeURIComponent(searchQuery.slice(0, 50))
  return `https://via.placeholder.com/320x180/FF0000/FFFFFF?text=${encodedQuery}`
}

/**
 * Generate YouTube embed URL from a search URL
 * Note: For search URLs, we generate a search results embed
 * For actual video URLs, this would extract the video ID
 */
function generateYouTubeEmbedUrl(searchQuery: string): string {
  // YouTube doesn't support embedding search results, but we can create
  // a link that opens in YouTube's embedded player context
  const encoded = encodeURIComponent(searchQuery + ' tutorial')
  return `https://www.youtube.com/embed?listType=search&list=${encoded}`
}

/**
 * Generate platform-specific thumbnail based on resource type
 */
function generatePlatformThumbnail(platformId: string, resourceType: string, searchQuery: string): string | undefined {
  switch (platformId) {
    case 'youtube':
      return generateYouTubeThumbnail(searchQuery)
    case 'khan_academy':
      return 'https://cdn.kastatic.org/images/khan-logo-dark-background.new.png'
    case 'coursera':
      return 'https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera_assets.s3.amazonaws.com/images/open_graph_images/default_open_graph_image.png'
    case 'udemy':
      return 'https://www.udemy.com/staticx/udemy/images/v7/logo-udemy-inverted.svg'
    case 'freecodecamp':
      return 'https://cdn.freecodecamp.org/platform/universal/fcc_meta_1920X1080-indigo.png'
    case 'leetcode':
      return 'https://leetcode.com/static/images/LeetCode_Sharing.png'
    case 'mdn':
      return 'https://developer.mozilla.org/mdn-social-share.png'
    default:
      // Return a placeholder based on resource type
      const typeColors: Record<string, string> = {
        video: 'FF0000',
        article: '4285F4',
        exercise: '14BF96',
        tool: 'A435F0',
        course: '0056D2',
        book: 'F48024',
      }
      const color = typeColors[resourceType] || '333333'
      const encodedType = encodeURIComponent(resourceType.toUpperCase())
      return `https://via.placeholder.com/320x180/${color}/FFFFFF?text=${encodedType}`
  }
}

/**
 * Generate embed URL if platform supports embedding
 */
function generateEmbedUrl(platformId: string, searchQuery: string): string | undefined {
  switch (platformId) {
    case 'youtube':
      return generateYouTubeEmbedUrl(searchQuery)
    // Other platforms don't support search result embedding
    default:
      return undefined
  }
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
 * Resource URL result with visual content fields
 */
export interface ResourceUrlResult {
  url: string
  platformId: string
  platformName: string
  platformIcon: string
  platformColor: string
  thumbnailUrl?: string
  embedUrl?: string
  platformLogoUrl?: string
}

/**
 * Generate a direct URL for a resource with thumbnails and embeds
 */
export function generateResourceUrl(
  resourceType: string,
  searchQuery: string,
  subject: string
): ResourceUrlResult {
  const { platform, fallbackId } = getBestPlatform(resourceType, subject, searchQuery)

  if (platform) {
    const platformId = platform.id
    const thumbnailUrl = generatePlatformThumbnail(platformId, resourceType, searchQuery)
    const embedUrl = generateEmbedUrl(platformId, searchQuery)
    // Get logo from fallback platforms if available
    const fallbackMeta = FALLBACK_PLATFORMS[platformId]

    return {
      url: getPlatformSearchUrl(platform, searchQuery),
      platformId: platform.id,
      platformName: platform.name,
      platformIcon: platform.icon,
      platformColor: platform.color,
      thumbnailUrl,
      embedUrl,
      platformLogoUrl: fallbackMeta?.logoUrl,
    }
  }

  // Use fallback
  const id = fallbackId || 'google'
  const urlPattern = FALLBACK_SEARCH_URLS[id] || FALLBACK_SEARCH_URLS['google']
  const meta = FALLBACK_PLATFORMS[id] || FALLBACK_PLATFORMS['google']
  const thumbnailUrl = generatePlatformThumbnail(id, resourceType, searchQuery)
  const embedUrl = generateEmbedUrl(id, searchQuery)

  return {
    url: urlPattern.replace('{query}', encodeURIComponent(searchQuery)),
    platformId: id,
    platformName: meta.name,
    platformIcon: meta.icon,
    platformColor: meta.color,
    thumbnailUrl,
    embedUrl,
    platformLogoUrl: meta.logoUrl,
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

  const {
    url,
    platformId,
    platformName,
    platformIcon,
    platformColor,
    thumbnailUrl,
    embedUrl,
    platformLogoUrl,
  } = generateResourceUrl(type, searchQuery, subject)

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
    thumbnailUrl,
    embedUrl,
    platformLogoUrl,
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
