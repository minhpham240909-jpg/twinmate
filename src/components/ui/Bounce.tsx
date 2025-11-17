'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface BounceProps {
  children: ReactNode
  className?: string
  duration?: number
  delay?: number
}

export default function Bounce({ 
  children, 
  className = '', 
  duration = 0.6,
  delay = 0
}: BounceProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: -10 }}
      animate={{ 
        opacity: 1, 
        y: 0,
      }}
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

