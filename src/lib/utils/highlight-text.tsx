import React from 'react'

/**
 * Highlight search terms in text
 * 
 * Usage:
 * ```tsx
 * <HighlightedText 
 *   text="Hello World" 
 *   searchTerms={["world"]} 
 *   highlightClassName="bg-yellow-200 dark:bg-yellow-900"
 * />
 * ```
 */
export function highlightText(
  text: string,
  searchTerms: string[],
  highlightClassName: string = 'bg-yellow-200 dark:bg-yellow-900/50 px-0.5 rounded'
): (string | React.ReactElement)[] {
  if (!text || !searchTerms.length) {
    return [text]
  }

  // Filter out empty terms and escape regex special chars
  const validTerms = searchTerms
    .filter(term => term && term.trim().length > 0)
    .map(term => term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  if (validTerms.length === 0) {
    return [text]
  }

  // Create regex pattern matching any term (case insensitive)
  const pattern = new RegExp(`(${validTerms.join('|')})`, 'gi')
  
  // Split text by pattern, keeping the delimiters
  const parts = text.split(pattern)
  
  return parts.map((part, index) => {
    // Check if this part matches any search term
    const isMatch = validTerms.some(
      term => part.toLowerCase() === term.toLowerCase()
    )
    
    if (isMatch) {
      return (
        <mark 
          key={index} 
          className={highlightClassName}
        >
          {part}
        </mark>
      )
    }
    
    return part
  })
}

/**
 * React component for highlighted text
 */
export function HighlightedText({
  text,
  searchTerms,
  highlightClassName,
  as: Component = 'span',
  className,
}: {
  text: string
  searchTerms: string[]
  highlightClassName?: string
  as?: 'span' | 'p' | 'div'
  className?: string
}) {
  const highlighted = highlightText(text, searchTerms, highlightClassName)
  
  return (
    <Component className={className}>
      {highlighted}
    </Component>
  )
}

/**
 * Extract search terms from a search query
 * Handles quoted phrases and individual words
 */
export function extractSearchTerms(query: string): string[] {
  if (!query) return []
  
  const terms: string[] = []
  
  // Extract quoted phrases first
  const quotedRegex = /"([^"]+)"/g
  let match
  let remaining = query
  
  while ((match = quotedRegex.exec(query)) !== null) {
    terms.push(match[1])
    remaining = remaining.replace(match[0], '')
  }
  
  // Split remaining by spaces and filter
  remaining.split(/\s+/).forEach(word => {
    if (word.length >= 2) { // Only include words with 2+ chars
      terms.push(word)
    }
  })
  
  return terms
}

/**
 * Highlight array items that match search terms
 */
export function highlightArrayItems(
  items: string[],
  searchTerms: string[]
): { item: string; isMatch: boolean }[] {
  const lowerTerms = searchTerms.map(t => t.toLowerCase())
  
  return items.map(item => ({
    item,
    isMatch: lowerTerms.some(term => 
      item.toLowerCase().includes(term)
    ),
  }))
}

