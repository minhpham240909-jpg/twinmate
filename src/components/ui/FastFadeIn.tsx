'use client'

import React, { ReactNode, CSSProperties } from 'react'

interface FastFadeInProps {
  children: ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  style?: CSSProperties
}

/**
 * Lightweight CSS-only fade-in animation
 * Replaces Framer Motion version for better performance
 */
const FastFadeIn: React.FC<FastFadeInProps> = ({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  style
}) => {
  const directionClass = `fade-in-${direction}`

  return (
    <>
      <div
        className={`${directionClass} ${className}`}
        style={{
          ...style,
          animationDelay: `${delay}s`,
        }}
      >
        {children}
      </div>

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-in-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-in-left {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fade-in-right {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fade-in-none {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .fade-in-up,
        .fade-in-down,
        .fade-in-left,
        .fade-in-right,
        .fade-in-none {
          animation-duration: 0.5s;
          animation-timing-function: ease-out;
          animation-fill-mode: forwards;
          opacity: 0;
        }

        .fade-in-up {
          animation-name: fade-in-up;
        }

        .fade-in-down {
          animation-name: fade-in-down;
        }

        .fade-in-left {
          animation-name: fade-in-left;
        }

        .fade-in-right {
          animation-name: fade-in-right;
        }

        .fade-in-none {
          animation-name: fade-in-none;
        }
      `}</style>
    </>
  )
}

export default React.memo(FastFadeIn)
