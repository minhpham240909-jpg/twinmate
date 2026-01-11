/**
 * Post Cache Utility
 *
 * Provides synchronized caching for posts across pages (Profile, Community)
 * Ensures edits made on one page reflect on all other pages
 *
 * PERFORMANCE: Uses localStorage for instant display with background refresh
 * SCALABILITY: Designed for 2,000-3,000 concurrent users with minimal memory footprint
 */

// Cache version - increment to invalidate all client caches on deploy
const CACHE_VERSION = 'v3'

// Cache keys
export const POST_CACHE_KEYS = {
  RECENT: `community_posts_${CACHE_VERSION}`,
  POPULAR: `community_popular_posts_${CACHE_VERSION}`,
  USER_PREFIX: `user_posts_${CACHE_VERSION}_`, // Append userId
} as const

// Event name for cross-tab synchronization
const POST_UPDATE_EVENT = 'post-cache-update'

// Post type for cache (minimal fields needed)
export interface CachedPost {
  id: string
  content: string
  imageUrls: string[]
  postUrl?: string | null
  createdAt: string
  updatedAt?: string
  user: {
    id: string
    name: string
    avatarUrl: string | null
    onlineStatus?: 'ONLINE' | 'OFFLINE' | null
  }
  _count: {
    likes: number
    comments: number
    reposts: number
  }
  isLikedByUser?: boolean
  connectionStatus?: 'none' | 'pending' | 'connected'
}

/**
 * Check if running in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Get cached posts from localStorage
 */
export function getCachedPosts(cacheKey: string): CachedPost[] {
  if (!isBrowser()) return []

  try {
    const cached = localStorage.getItem(cacheKey)
    if (!cached) return []

    const posts: CachedPost[] = JSON.parse(cached)

    // Validate cache structure
    if (posts.length > 0 && (!posts[0]._count || !posts[0].user)) {
      localStorage.removeItem(cacheKey)
      return []
    }

    return posts
  } catch (error) {
    console.error('Error loading cached posts:', error)
    return []
  }
}

/**
 * Set cached posts to localStorage
 */
export function setCachedPosts(cacheKey: string, posts: CachedPost[]): void {
  if (!isBrowser()) return

  try {
    localStorage.setItem(cacheKey, JSON.stringify(posts))
  } catch (error) {
    console.error('Error caching posts:', error)
    // Clear old caches if storage is full
    clearOldCaches()
  }
}

/**
 * Update a single post in all relevant caches
 * This is called when a post is edited from any page
 */
export function updatePostInCache(
  postId: string,
  updates: Partial<CachedPost>,
  userId?: string
): void {
  if (!isBrowser()) return

  const cacheKeys: string[] = [
    POST_CACHE_KEYS.RECENT,
    POST_CACHE_KEYS.POPULAR,
  ]

  // Add user-specific cache if userId provided
  if (userId) {
    cacheKeys.push(`${POST_CACHE_KEYS.USER_PREFIX}${userId}`)
  }

  // Update each cache
  for (const cacheKey of cacheKeys) {
    try {
      const cached = localStorage.getItem(cacheKey)
      if (!cached) continue

      const posts: CachedPost[] = JSON.parse(cached)
      const updatedPosts = posts.map(post =>
        post.id === postId ? { ...post, ...updates } : post
      )

      localStorage.setItem(cacheKey, JSON.stringify(updatedPosts))
    } catch (error) {
      console.error(`Error updating cache ${cacheKey}:`, error)
    }
  }

  // Dispatch custom event for cross-component sync
  dispatchPostUpdateEvent(postId, updates)
}

/**
 * Remove a post from all caches (for delete)
 */
export function removePostFromCache(postId: string, userId?: string): void {
  if (!isBrowser()) return

  const cacheKeys: string[] = [
    POST_CACHE_KEYS.RECENT,
    POST_CACHE_KEYS.POPULAR,
  ]

  if (userId) {
    cacheKeys.push(`${POST_CACHE_KEYS.USER_PREFIX}${userId}`)
  }

  for (const cacheKey of cacheKeys) {
    try {
      const cached = localStorage.getItem(cacheKey)
      if (!cached) continue

      const posts: CachedPost[] = JSON.parse(cached)
      const filteredPosts = posts.filter(post => post.id !== postId)

      localStorage.setItem(cacheKey, JSON.stringify(filteredPosts))
    } catch (error) {
      console.error(`Error removing from cache ${cacheKey}:`, error)
    }
  }

  // Dispatch delete event
  dispatchPostUpdateEvent(postId, null, true)
}

/**
 * Dispatch custom event for cross-component synchronization
 */
function dispatchPostUpdateEvent(
  postId: string,
  updates: Partial<CachedPost> | null,
  isDelete: boolean = false
): void {
  if (!isBrowser()) return

  const event = new CustomEvent(POST_UPDATE_EVENT, {
    detail: { postId, updates, isDelete, timestamp: Date.now() }
  })
  window.dispatchEvent(event)
}

/**
 * Subscribe to post update events
 * Returns unsubscribe function
 */
export function subscribeToPostUpdates(
  callback: (data: {
    postId: string
    updates: Partial<CachedPost> | null
    isDelete: boolean
  }) => void
): () => void {
  if (!isBrowser()) return () => {}

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent
    callback(customEvent.detail)
  }

  window.addEventListener(POST_UPDATE_EVENT, handler)

  return () => {
    window.removeEventListener(POST_UPDATE_EVENT, handler)
  }
}

/**
 * Clear old cache versions to prevent storage bloat
 */
export function clearOldCaches(): void {
  if (!isBrowser()) return

  const keysToRemove = [
    'community_posts',
    'community_popular_posts',
    'community_posts_v1',
    'community_popular_posts_v1',
    'community_posts_v2',
    'community_popular_posts_v2',
  ]

  for (const key of keysToRemove) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Invalidate all post caches (force refresh on next load)
 */
export function invalidateAllPostCaches(): void {
  if (!isBrowser()) return

  try {
    // Remove current version caches
    localStorage.removeItem(POST_CACHE_KEYS.RECENT)
    localStorage.removeItem(POST_CACHE_KEYS.POPULAR)

    // Remove all user-specific caches
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith(POST_CACHE_KEYS.USER_PREFIX)) {
        localStorage.removeItem(key)
      }
    }
  } catch (error) {
    console.error('Error invalidating caches:', error)
  }
}

export default {
  getCachedPosts,
  setCachedPosts,
  updatePostInCache,
  removePostFromCache,
  subscribeToPostUpdates,
  clearOldCaches,
  invalidateAllPostCaches,
  POST_CACHE_KEYS,
}
