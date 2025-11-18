'use client'

import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface FadeOnScrollProps {
  children: React.ReactNode
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right'
  className?: string
}

export default function FadeOnScroll({ 
  children, 
  delay = 0,
  direction = 'up',
  className = ''
}: FadeOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!ref.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const variants = {
    up: { y: 40, opacity: 0 },
    down: { y: -40, opacity: 0 },
    left: { x: 40, opacity: 0 },
    right: { x: -40, opacity: 0 },
  }

  return (
    <motion.div
      ref={ref}
      initial={variants[direction]}
      animate={isVisible ? { x: 0, y: 0, opacity: 1 } : variants[direction]}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

