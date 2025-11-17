'use client'

import React, { ReactNode, CSSProperties } from 'react'

interface FastBounceProps {
  children: ReactNode
  className?: string
  delay?: number
  style?: CSSProperties
}

/**
 * Lightweight CSS-only bounce animation
 * Replaces Framer Motion version for better performance
 */
const FastBounce: React.FC<FastBounceProps> = ({
  children,
  className = '',
  delay = 0,
  style
}) => {
  return (
    <>
      <div
        className={`animate-bounce-in ${className}`}
        style={{
          ...style,
          animationDelay: `${delay}s`,
        }}
      >
        {children}
      </div>

      <style jsx>{`
        @keyframes bounce-in {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          50% {
            transform: translateY(2px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-bounce-in {
          animation: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
          opacity: 0;
        }
      `}</style>
    </>
  )
}

export default React.memo(FastBounce)
