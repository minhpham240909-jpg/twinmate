'use client'

import React, { ReactNode, CSSProperties } from 'react'

interface FastPulseProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * Lightweight CSS-only pulse animation
 * Replaces Framer Motion version for better performance
 */
const FastPulse: React.FC<FastPulseProps> = ({
  children,
  className = '',
  style
}) => {
  return (
    <>
      <div
        className={`animate-pulse-scale ${className}`}
        style={style}
      >
        {children}
      </div>

      <style jsx>{`
        @keyframes pulse-scale {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        .animate-pulse-scale {
          animation: pulse-scale 2s ease-in-out infinite;
        }
      `}</style>
    </>
  )
}

export default React.memo(FastPulse)
