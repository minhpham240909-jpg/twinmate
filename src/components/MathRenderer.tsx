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

  // Pass 1: Handle display math with $$ ... $$
  result = processDisplayMath(result, /\$\$([\s\S]*?)\$\$/g)

  // Pass 2: Handle display math with \[ ... \]
  result = processDisplayMath(result, /\\\[([\s\S]*?)\\\]/g)

  // Pass 3: Handle inline math with $ ... $ (but not $$ which was already handled)
  // Need to be careful not to match currency symbols like "$5" or "$100"
  result = processInlineMath(result, /(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g)

  // Pass 4: Handle inline math with \( ... \)
  result = processInlineMath(result, /\\\((.+?)\\\)/g)

  // Escape remaining HTML that isn't part of KaTeX output
  result = escapeNonMathHtml(result)

  return result
}

/**
 * Process display math (block-level, centered equations)
 */
function processDisplayMath(text: string, pattern: RegExp): string {
  return text.replace(pattern, (match, latex) => {
    try {
      const html = katex.renderToString(latex.trim(), {
        displayMode: true,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: {
          // Common macros for various subjects
          '\\R': '\\mathbb{R}',
          '\\N': '\\mathbb{N}',
          '\\Z': '\\mathbb{Z}',
          '\\Q': '\\mathbb{Q}',
          '\\C': '\\mathbb{C}',
          '\\deg': '^\\circ',
        },
      })
      // Wrap in a div for block display with marker to skip HTML escaping
      return `<div class="math-display my-3">KATEX_SAFE${html}KATEX_END</div>`
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
        displayMode: false,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: {
          '\\R': '\\mathbb{R}',
          '\\N': '\\mathbb{N}',
          '\\Z': '\\mathbb{Z}',
          '\\Q': '\\mathbb{Q}',
          '\\C': '\\mathbb{C}',
          '\\deg': '^\\circ',
        },
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
