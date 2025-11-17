'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface FadeInProps {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
}

export default function FadeIn({ 
  children, 
  className = '', 
  delay = 0,
  duration = 0.5,
  direction = 'up'
}: FadeInProps) {
  const variants = {
    up: { y: 20, opacity: 0 },
    down: { y: -20, opacity: 0 },
    left: { x: 20, opacity: 0 },
    right: { x: -20, opacity: 0 },
    none: { opacity: 0 },
  }

  return (
    <motion.div
      className={className}
      initial={variants[direction]}
      animate={{ 
        y: 0,
        x: 0,
        opacity: 1 
      }}
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

