'use client'

import { motion } from 'framer-motion'
import { ReactNode, useEffect, useRef, useState } from 'react'

interface PulseOptimizedProps {
  children: ReactNode
  className?: string
  duration?: number
  scale?: number
  onlyWhenVisible?: boolean
}

export default function PulseOptimized({ 
  children, 
  className = '', 
  duration = 2,
  scale = 1.05,
  onlyWhenVisible = true
}: PulseOptimizedProps) {
  const [isVisible, setIsVisible] = useState(!onlyWhenVisible)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!onlyWhenVisible || !ref.current) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [onlyWhenVisible])

  if (!isVisible) {
    return <div ref={ref} className={className}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      animate={{
        scale: [1, scale, 1],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  )
}

