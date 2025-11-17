'use client'

import React, { CSSProperties, PropsWithChildren } from 'react'

type GlowBorderProps = PropsWithChildren<{
  color?: string
  intensity?: 'low' | 'medium' | 'high'
  className?: string
  style?: CSSProperties
  animated?: boolean
}>

/**
 * Lightweight CSS-only glow border component
 * Use this instead of ElectricBorder for list items and repeated elements
 * Much better performance - no SVG filters, no ResizeObserver, no JavaScript animations
 */
const GlowBorder: React.FC<GlowBorderProps> = ({
  children,
  color = '#3b82f6',
  intensity = 'medium',
  className = '',
  style,
  animated = true
}) => {
  const intensityMap = {
    low: { blur: 4, opacity: 0.3, borderWidth: 1 },
    medium: { blur: 8, opacity: 0.5, borderWidth: 2 },
    high: { blur: 12, opacity: 0.7, borderWidth: 2 }
  }

  const config = intensityMap[intensity]

  return (
    <div
      className={`relative ${className}`}
      style={{
        ...style,
        borderRadius: style?.borderRadius || '0.5rem',
      }}
    >
      {/* Animated glow effect */}
      <div
        className={`absolute inset-0 rounded-[inherit] pointer-events-none ${animated ? 'animate-pulse-glow' : ''}`}
        style={{
          background: `linear-gradient(45deg, ${color}, transparent, ${color})`,
          filter: `blur(${config.blur}px)`,
          opacity: config.opacity,
          zIndex: -1,
        }}
      />

      {/* Border */}
      <div
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          border: `${config.borderWidth}px solid ${color}`,
          boxShadow: `0 0 ${config.blur}px ${color}`,
        }}
      />

      {/* Content */}
      <div className="relative">
        {children}
      </div>

      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% {
            opacity: ${config.opacity};
          }
          50% {
            opacity: ${config.opacity * 1.5};
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

export default React.memo(GlowBorder)
