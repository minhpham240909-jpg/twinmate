'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Focus Trap Hook for Modals
 * 
 * Traps keyboard focus within a modal/dialog for accessibility.
 * Handles Tab/Shift+Tab navigation and returns focus on close.
 * 
 * Usage:
 * ```tsx
 * function Modal({ isOpen, onClose, children }) {
 *   const { containerRef, initialFocusRef } = useFocusTrap(isOpen)
 *   
 *   return isOpen ? (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       <button ref={initialFocusRef} onClick={onClose}>Close</button>
 *       {children}
 *     </div>
 *   ) : null
 * }
 * ```
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialFocusRef = useRef<HTMLButtonElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // Get all focusable elements within the container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return []
    
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ')

    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter(el => {
      // Filter out hidden elements
      const style = window.getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden'
    })
  }, [])

  // Handle Tab key navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!containerRef.current) return

    // Handle Escape key
    if (event.key === 'Escape') {
      // Focus will be restored when isActive becomes false
      return
    }

    // Only handle Tab key
    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements()
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement as HTMLElement

    // Handle Shift+Tab (backwards)
    if (event.shiftKey) {
      if (activeElement === firstElement || !containerRef.current.contains(activeElement)) {
        event.preventDefault()
        lastElement.focus()
      }
    } 
    // Handle Tab (forwards)
    else {
      if (activeElement === lastElement || !containerRef.current.contains(activeElement)) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }, [getFocusableElements])

  // Setup focus trap when active
  useEffect(() => {
    if (!isActive) return

    // Store previous active element to restore later
    previousActiveElement.current = document.activeElement as HTMLElement

    // Focus the initial element or first focusable element
    const setInitialFocus = () => {
      if (initialFocusRef.current) {
        initialFocusRef.current.focus()
      } else {
        const focusableElements = getFocusableElements()
        if (focusableElements.length > 0) {
          focusableElements[0].focus()
        }
      }
    }

    // Small delay to ensure modal is rendered
    const timeoutId = setTimeout(setInitialFocus, 10)

    // Add keyboard listener
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActive, getFocusableElements, handleKeyDown])

  // Restore focus when trap is deactivated
  useEffect(() => {
    if (isActive) return

    // Restore focus to previous element
    if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
      // Small delay to ensure modal close animation completes
      const timeoutId = setTimeout(() => {
        previousActiveElement.current?.focus()
      }, 10)

      return () => clearTimeout(timeoutId)
    }
  }, [isActive])

  return {
    containerRef,
    initialFocusRef,
  }
}

/**
 * Focus Trap Provider Component
 * 
 * Alternative component-based approach for focus trapping.
 * 
 * Usage:
 * ```tsx
 * <FocusTrap active={isOpen}>
 *   <div role="dialog" aria-modal="true">
 *     <button onClick={onClose}>Close</button>
 *     {children}
 *   </div>
 * </FocusTrap>
 * ```
 */
export function FocusTrap({ 
  children, 
  active = true,
  onEscape,
}: { 
  children: React.ReactNode
  active?: boolean
  onEscape?: () => void
}) {
  const { containerRef } = useFocusTrap(active)

  useEffect(() => {
    if (!active || !onEscape) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [active, onEscape])

  return (
    <div ref={containerRef}>
      {children}
    </div>
  )
}
