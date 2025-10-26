'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'

interface LazySectionProps {
  children: ReactNode
  threshold?: number
  rootMargin?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Lazy loading section wrapper with Intersection Observer
 * Only renders children when scrolled into viewport
 * Apple.com-style progressive loading
 */
export default function LazySection({
  children,
  threshold = 0.1,
  rootMargin = '100px',
  className = '',
  style,
}: LazySectionProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasLoaded) {
            setIsVisible(true)
            setHasLoaded(true)
          }
        })
      },
      {
        threshold,
        rootMargin,
      }
    )

    observer.observe(sectionRef.current)

    return () => {
      observer.disconnect()
    }
  }, [threshold, rootMargin, hasLoaded])

  return (
    <section
      ref={sectionRef}
      className={className}
      style={style}
    >
      {isVisible || hasLoaded ? (
        children
      ) : (
        // Placeholder to maintain layout
        <div style={{ minHeight: '400px' }} />
      )}
    </section>
  )
}
