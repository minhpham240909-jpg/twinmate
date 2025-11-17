'use client'

import { motion } from 'framer-motion'
import { ReactNode, useEffect, useRef, useState } from 'react'

interface FadeInOptimizedProps {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  threshold?: number
}

export default function FadeInOptimized({ 
  children, 
  className = '', 
  delay = 0,
  duration = 0.4,
  direction = 'up',
  threshold = 0.1
}: FadeInOptimizedProps) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return

    // Use Intersection Observer for performance
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin: '50px' }
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])

  const variants = {
    up: { y: 20, opacity: 0 },
    down: { y: -20, opacity: 0 },
    left: { x: 20, opacity: 0 },
    right: { x: -20, opacity: 0 },
    none: { opacity: 0 },
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={variants[direction]}
      animate={isVisible ? { 
        y: 0,
        x: 0,
        opacity: 1 
      } : variants[direction]}
      transition={{
        duration,
        delay,
        ease: 'easeOut',
      }}
    >
      {children}
    </motion.div>
  )
}

