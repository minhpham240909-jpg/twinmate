'use client'

import { ReactNode, CSSProperties } from 'react'

interface SmoothBorderProps {
  children: ReactNode
  color?: string
  gradient?: string
  className?: string
  style?: CSSProperties
}

/**
 * Lightweight alternative to ElectricBorder
 * Uses simple CSS gradients instead of heavy SVG filters
 * Perfect for Safari performance
 */
export default function SmoothBorder({
  children,
  color = '#3b82f6',
  gradient,
  className = '',
  style = {},
}: SmoothBorderProps) {
  const borderGradient = gradient || `linear-gradient(135deg, ${color}, ${color}80, ${color})`

  return (
    <div
      className={`relative p-[2px] rounded-[inherit] animate-gradient-slow ${className}`}
      style={{
        ...style,
        backgroundImage: borderGradient,
        backgroundSize: '200% 200%',
      }}
    >
      {children}
    </div>
  )
}
