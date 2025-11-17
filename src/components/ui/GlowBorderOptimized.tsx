'use client'

import React, { CSSProperties, PropsWithChildren, useEffect, useRef, useState } from 'react'

type GlowBorderOptimizedProps = PropsWithChildren<{
  color?: string
  intensity?: 'low' | 'medium' | 'high'
  className?: string
  style?: CSSProperties
  animated?: boolean
  onlyWhenVisible?: boolean
  reduceMotion?: boolean
}>

/**
 * Optimized GlowBorder with visibility detection and reduced motion support
 * - Uses IntersectionObserver to only animate when visible
 * - Respects prefers-reduced-motion
 * - Pure CSS animations (no SVG filters)
 */
const GlowBorderOptimized: React.FC<GlowBorderOptimizedProps> = ({
  children,
  color = '#3b82f6',
  intensity = 'medium',
  className = '',
  style,
  animated = true,
  onlyWhenVisible = true,
  reduceMotion = false
}) => {
  const [isVisible, setIsVisible] = useState(!onlyWhenVisible)
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const intensityMap = {
    low: { blur: 4, opacity: 0.3, borderWidth: 1 },
    medium: { blur: 8, opacity: 0.5, borderWidth: 2 },
    high: { blur: 12, opacity: 0.7, borderWidth: 2 }
  }

  const config = intensityMap[intensity]

  // Check for reduced motion preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      setShouldReduceMotion(mediaQuery.matches || reduceMotion)

      const handler = (e: MediaQueryListEvent) => setShouldReduceMotion(e.matches || reduceMotion)
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [reduceMotion])

  // Intersection Observer for visibility
  useEffect(() => {
    if (!onlyWhenVisible || !rootRef.current) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    observer.observe(rootRef.current)
    return () => observer.disconnect()
  }, [onlyWhenVisible])

  const shouldAnimate = animated && isVisible && !shouldReduceMotion

  return (
    <div ref={rootRef} className={`relative ${className}`} style={{ ...style, borderRadius: style?.borderRadius || '0.5rem' }}>
      {shouldAnimate && (
        <div
          className="absolute inset-0 rounded-[inherit] pointer-events-none animate-pulse-glow"
          style={{
            background: `linear-gradient(45deg, ${color}, transparent, ${color})`,
            filter: `blur(${config.blur}px)`,
            opacity: config.opacity,
            zIndex: -1,
          }}
        />
      )}
      <div
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          border: `${config.borderWidth}px solid ${color}`,
          boxShadow: shouldAnimate ? `0 0 ${config.blur}px ${color}` : 'none',
        }}
      />
      <div className="relative">{children}</div>
      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: ${config.opacity}; }
          50% { opacity: ${config.opacity * 1.5}; }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

export default React.memo(GlowBorderOptimized)
