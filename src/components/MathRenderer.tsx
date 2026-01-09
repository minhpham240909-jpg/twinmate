'use client'

import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MathRendererProps {
  content: string
  className?: string
}

/**
 * MathRenderer - Renders text with LaTeX math equations
 *
 * Supports:
 * - Display math: $$...$$  (centered, block-level equations)
 * - Inline math: $...$ or \(...\)  (inline equations within text)
 * - Display math: \[...\]  (block-level equations)
 *
 * Works for all subjects: Math, Physics, Chemistry, Economics, Statistics, Engineering, etc.
 */
export default function MathRenderer({ content, className = '' }: MathRendererProps) {
  const renderedContent = useMemo(() => {
    if (!content) return ''

    try {
      return renderMathContent(content)
    } catch (error) {
      // If rendering fails, return original content
      console.error('[MathRenderer] Failed to render:', error)
      return escapeHtml(content)
    }
  }, [content])

  return (
    <span
      className={`math-content ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  )
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char)
}

/**
 * Render LaTeX math expressions within text content
 * Handles both display math ($$...$$, \[...\]) and inline math ($...$, \(...\))
 */
function renderMathContent(text: string): string {
  // Process the text in multiple passes for different math delimiters
  let result = text

  // Fix escaped backslashes from JSON responses (\\frac -> \frac, \\{ -> \{)
  result = result.replace(/\\\\([a-zA-Z{}\[\]()])/g, '\\$1')

  // Pass 1: Handle display math with $$ ... $$
  result = processDisplayMath(result, /\$\$([\s\S]*?)\$\$/g)

  // Pass 2: Handle display math with \[ ... \]
  result = processDisplayMath(result, /\\\[([\s\S]*?)\\\]/g)

  // Pass 3: Handle inline math with $ ... $ (but not $$ which was already handled)
  // Need to be careful not to match currency symbols like "$5" or "$100"
  result = processInlineMath(result, /(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g)

  // Pass 4: Handle inline math with \( ... \)
  result = processInlineMath(result, /\\\((.+?)\\\)/g)

  // Pass 5: Convert quoted text to highlighted text (before HTML escaping)
  result = processQuotedText(result)

  // Escape remaining HTML that isn't part of KaTeX output
  result = escapeNonMathHtml(result)

  return result
}

/**
 * Convert quoted text "..." to highlighted styled text
 */
function processQuotedText(text: string): string {
  // Match text in double quotes (but not inside KATEX_SAFE markers)
  return text.replace(/"([^"]+)"/g, (match, content) => {
    // Skip if inside a KATEX block
    if (match.includes('KATEX_SAFE') || match.includes('KATEX_END')) {
      return match
    }
    // Return highlighted span
    return `KATEX_SAFE<span class="text-highlight">${escapeHtml(content)}</span>KATEX_END`
  })
}

// SECURITY: Safe KaTeX options - prevents XSS via LaTeX commands
const SAFE_KATEX_OPTIONS = {
  throwOnError: false,
  // SECURITY: strict mode catches dangerous commands
  strict: 'warn' as const,
  // SECURITY: trust=false prevents dangerous commands like \url, \href with javascript:
  trust: false,
  // SECURITY: Disable URL commands entirely to prevent XSS
  maxSize: 500, // Prevent DoS via extremely large expressions
  maxExpand: 1000, // Limit macro expansion depth
  macros: {
    // Safe macros for various subjects (no URLs or external resources)
    '\\R': '\\mathbb{R}',
    '\\N': '\\mathbb{N}',
    '\\Z': '\\mathbb{Z}',
    '\\Q': '\\mathbb{Q}',
    '\\C': '\\mathbb{C}',
    '\\deg': '^\\circ',
  },
}

/**
 * Process display math (block-level, centered equations)
 */
function processDisplayMath(text: string, pattern: RegExp): string {
  return text.replace(pattern, (match, latex) => {
    try {
      const html = katex.renderToString(latex.trim(), {
        ...SAFE_KATEX_OPTIONS,
        displayMode: true,
      })
      // Wrap in a div for block display with marker to skip HTML escaping
      return `KATEX_SAFE<div class="math-display my-3">${html}</div>KATEX_END`
    } catch (error) {
      console.error('[MathRenderer] Display math error:', error)
      return match // Return original on error
    }
  })
}

/**
 * Process inline math (within text flow)
 */
function processInlineMath(text: string, pattern: RegExp): string {
  return text.replace(pattern, (match, latex) => {
    // Skip if it looks like a currency value (e.g., $5, $100)
    if (/^\d+([.,]\d+)?$/.test(latex.trim())) {
      return match
    }

    try {
      const html = katex.renderToString(latex.trim(), {
        ...SAFE_KATEX_OPTIONS,
        displayMode: false,
      })
      // Mark as safe to skip HTML escaping
      return `KATEX_SAFE${html}KATEX_END`
    } catch (error) {
      console.error('[MathRenderer] Inline math error:', error)
      return match // Return original on error
    }
  })
}

/**
 * Escape HTML in non-math parts of the content
 * Preserves KaTeX-generated HTML
 */
function escapeNonMathHtml(text: string): string {
  // Split by our KaTeX markers
  const parts = text.split(/(KATEX_SAFE[\s\S]*?KATEX_END)/g)

  return parts
    .map((part) => {
      if (part.startsWith('KATEX_SAFE') && part.endsWith('KATEX_END')) {
        // Remove markers and return KaTeX HTML as-is
        return part.slice(10, -9)
      }
      // Escape HTML in non-math parts
      return escapeHtml(part)
    })
    .join('')
}

/**
 * Simple utility to check if text contains any math expressions
 */
export function containsMath(text: string): boolean {
  const mathPatterns = [
    /\$\$[\s\S]*?\$\$/,    // Display math $$...$$
    /\\\[[\s\S]*?\\\]/,    // Display math \[...\]
    /(?<!\$)\$(?!\$)[^\$\n]+?\$(?!\$)/, // Inline math $...$
    /\\\(.+?\\\)/,         // Inline math \(...\)
  ]

  return mathPatterns.some((pattern) => pattern.test(text))
}
