/**
 * XSS Protection Utilities
 * Sanitizes user-generated content to prevent Cross-Site Scripting attacks
 */

import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize HTML content - removes dangerous tags and attributes
 * Use this for rich text content that may contain HTML
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''
  
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 's', 'strike', 'del',
      'a', 'p', 'br', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'span', 'div'
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  })
}

/**
 * Sanitize plain text - strips all HTML tags
 * Use this for content that should never contain HTML (usernames, titles, etc.)
 */
export function sanitizeText(dirty: string): string {
  if (!dirty) return ''
  
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  })
}

/**
 * Sanitize markdown content - allows basic markdown but prevents XSS
 * Use this for content that will be rendered as markdown
 */
export function sanitizeMarkdown(dirty: string): string {
  if (!dirty) return ''
  
  // First, escape potential XSS in markdown
  // Markdown itself is safe, but we need to sanitize any embedded HTML
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
    ],
    ALLOWED_ATTR: ['href', 'title'],
    KEEP_CONTENT: true,
  })
}

/**
 * Sanitize URL - ensures URLs are safe and don't contain javascript: or data: schemes
 */
export function sanitizeUrl(url: string): string {
  if (!url) return ''
  
  // Remove dangerous protocols
  const cleaned = DOMPurify.sanitize(url, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  })
  
  // Check if it's a valid HTTP(S) URL
  try {
    const parsed = new URL(cleaned)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return cleaned
    }
  } catch {
    // Not a valid URL, return empty
  }
  
  return ''
}

/**
 * Sanitize user bio/description
 * Allows some formatting but strict on scripts
 */
export function sanitizeBio(dirty: string): string {
  if (!dirty) return ''
  
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'a'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    KEEP_CONTENT: true,
  })
}

/**
 * Sanitize array of strings
 */
export function sanitizeArray(dirtyArray: string[]): string[] {
  if (!Array.isArray(dirtyArray)) return []
  return dirtyArray.map(item => sanitizeText(item))
}

/**
 * React component helper - use with dangerouslySetInnerHTML
 * Returns an object suitable for dangerouslySetInnerHTML prop
 */
export function createSafeHtml(dirty: string): { __html: string } {
  return {
    __html: sanitizeHtml(dirty)
  }
}

/**
 * Escape HTML entities for display
 * Use when you want to show HTML code as text
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe) return ''
  
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
