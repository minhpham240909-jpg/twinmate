'use client'

import { motion } from 'framer-motion'
import { ReactNode, useEffect, useRef, useState } from 'react'

interface BounceOptimizedProps {
  children: ReactNode
  className?: string
  duration?: number
  delay?: number
  onlyWhenVisible?: boolean
}

export default function BounceOptimized({ 
  children, 
  className = '', 
  duration = 0.5,
  delay = 0,
  onlyWhenVisible = true
}: BounceOptimizedProps) {
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
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [onlyWhenVisible])

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: -10 }}
      animate={isVisible ? { 
        opacity: 1, 
        y: 0,
      } : { opacity: 0, y: -10 }}
      transition={{
        duration,
        delay,
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
    >
      {children}
    </motion.div>
  )
}

