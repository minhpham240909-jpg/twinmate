'use client'

import React from 'react'

/**
 * Lightweight CSS-only dot pattern
 * Replaces expensive WebGLDotGrid component
 * Uses CSS background patterns for performance
 */
export default function ModernDotPattern({ 
  dotSize = 2, 
  gap = 30,
  color = 'rgba(255,255,255,0.1)'
}: {
  dotSize?: number
  gap?: number
  color?: string
}) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `radial-gradient(circle, ${color} ${dotSize}px, transparent ${dotSize}px)`,
        backgroundSize: `${gap}px ${gap}px`,
        backgroundPosition: '0 0',
      }}
    />
  )
}

